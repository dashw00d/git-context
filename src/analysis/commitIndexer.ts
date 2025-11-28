import * as crypto from 'crypto';
import { GitOperations } from './git';
import { SnapshotManager, FileSnapshot } from './snapshotManager';
import { StructuralDiffManager, StructuralDiffMetrics } from './structuralDiffManager';
import { RiskDetector } from './heuristics';
import { DependencyExtractor } from './dependencies';
import { HotspotDetectorV2 } from './hotspotDetector';
import { MovedBlockDetectorV2 } from './movedBlockDetector';
import { Database } from 'sql.js';
import { ANALYSIS_VERSION } from '../storage/schema';
import { logDebug, logInfo } from '../utils/logger';
import { getDatabaseManager } from '../storage/database';
// p-limit is CommonJS; use require style to avoid default-import issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
import pLimit = require('p-limit');
import { getExtensionConfig, getSupportedExtensions, detectLanguage, isCstOnlyLanguage, createCustomIgnoreMatcher } from '../utils/config';
import { shouldProcessPathWithLog } from '../utils/pathFilter';
import * as pathModule from 'path';
import { getCstTimelineManager } from './cstTimeline';
import { getTreeSitterParser } from './tree-sitter';
import type { HybridFact } from '../types/cstFacts';
import type { SymbolInfo } from '../types';

export interface CommitFacts {
  sha: string;
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  edgesAdded: number;
  edgesRemoved: number;
  risks: string[];
  structuralChangeScore: number;
  filesChanged: number;
  blastRadius: number;
  hotspots: Array<{ symbolId: string; impactScore: number; changeType: string }>;
}

export class CommitIndexer {
  private cacheHits = 0;
  private cacheMisses = 0;
  private cstTimelineManager = getCstTimelineManager();
  private parser = getTreeSitterParser();

  constructor(
    private db: Database,
    private git: GitOperations,
    private snapshotManager: SnapshotManager,
    private structuralDiffManager: StructuralDiffManager,
    private riskDetector: RiskDetector,
    private dependencyExtractor: DependencyExtractor,
    private hotspotDetector: HotspotDetectorV2,
    private movedBlockDetector: MovedBlockDetectorV2
  ) { }

  /**
   * Get cache statistics for observability
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: hitRate
    };
  }

  /**
   * Retry a function with exponential backoff and jitter
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          break; // Don't retry on final attempt
        }

        // Exponential backoff with jitter: baseDelay * 2^attempt + random jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
        const delay = exponentialDelay + jitter;

        logDebug(`[CommitIndexer] Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Ensure commit is indexed (idempotent, cacheable)
   */
  async ensureCommitIndexed(sha: string, opts?: { force?: boolean; modules?: string[] }): Promise<CommitFacts> {
    // Check if already indexed with current analysis version (unless force)
    if (!opts?.force && this.isIndexed(sha)) {
      logDebug(`[CommitIndexer] ${sha} already indexed`);
      this.cacheHits++;
      return this.loadCommitFacts(sha);
    }

    this.cacheMisses++;

    // Mark as pending
    this.markPending(sha);

    try {
      // Run indexing pipeline
      const facts = await this.indexCommit(sha, opts);

      // Mark as complete
      this.markComplete(sha, facts);

      return facts;
    } catch (error) {
      this.markFailed(sha, error);
      throw error;
    }
  }

  /**
   * Index multiple commits with concurrency
   */
  async ensureCommitsIndexed(
    shas: string[],
    concurrency: number = 8,
    opts?: { force?: boolean; modules?: string[] }
  ): Promise<CommitFacts[]> {
    const limit = pLimit(concurrency);
    const promises = shas.map(sha => limit(async () => {
      return this.retryWithBackoff(async () => {
        const facts = await this.ensureCommitIndexed(sha, opts);
        return facts;
      });
    }));

    const results = await Promise.all(promises);

    // Flush any pending snapshot and diff writes
    this.snapshotManager.flushSnapshotQueue();
    this.structuralDiffManager.flushDiffQueue();

    // Log cache performance metrics
    const stats = this.getCacheStats();
    logInfo(`[CommitIndexer] Cache performance: ${stats.cacheHits} hits, ${stats.cacheMisses} misses (${(stats.hitRate * 100).toFixed(1)}% hit rate)`);

    return results;
  }

  private async indexCommit(sha: string, opts?: { force?: boolean; modules?: string[] }): Promise<CommitFacts> {
    logInfo(`[CommitIndexer] Indexing commit ${sha}`);

    const commitInfo = await this.git.getCommitInfo(sha);
    const files = await this.git.getFileChanges(sha);
    const parentSha = commitInfo.parent;

    let totalSymbolsAdded = 0;
    let totalSymbolsModified = 0;
    let totalSymbolsRemoved = 0;
    let totalEdgesAdded = 0;
    let totalEdgesRemoved = 0;
    let maxStructuralChange = 0;
    const allRisks: string[] = [];

    // Collect for blast radius
    const changedSymbols: any[] = [];
    const allEdges: any[] = [];
    const symbolChanges = new Map<string, { type: string; symbol: any; filePath: string }>();

    // Process each changed file
    logInfo(`[CommitIndexer] Processing ${files.length} files for ${sha}`);
    for (const file of files) {
      const { path, status } = file;

      // Use centralized path filter
      const filterResult = await shouldProcessPathWithLog(path, {
        git: this.git,
        status,
        commitSha: sha,
        skipSizeCheck: status === 'D'
      }, 'CommitIndexer');

      if (!filterResult.shouldProcess) {
        continue;
      }

      if (status === 'D') {
        // File deleted - get parent snapshot only

        if (parentSha) {
          const parentBlobSha = await this.git.getBlobSha(parentSha, path);
          const parentContent = await this.git.safeGetFileContent(parentSha, path);
          const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
            path,
            parentBlobSha,
            parentContent
          );
          totalSymbolsRemoved += parentSnapshot.symbols.length;
          totalEdgesRemoved += parentSnapshot.edges.length;

          // Track removed symbols
          for (const symbol of parentSnapshot.symbols) {
            symbolChanges.set(symbol.dnaId, { type: 'removed', symbol, filePath: path });
          }
        }
        continue;
      }

      // Get current blob
      const currentBlobSha = await this.git.getBlobSha(sha, path);
      const currentContent = await this.git.safeGetFileContent(sha, path);
      const currentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
        path,
        currentBlobSha,
        currentContent
      );

      if (currentSnapshot.symbols.length > 0) {
        logDebug(`[CommitIndexer] Found ${currentSnapshot.symbols.length} symbols in ${path}`);
      } else {
        logDebug(`[CommitIndexer] No symbols found in ${path} (lang: ${currentSnapshot.language})`);
      }

      // Extract and save hybrid facts (CST-only or hybrid augmentation)
      await this.extractAndSaveHybridFacts(path, sha, currentContent, currentSnapshot.symbols);

      if (status === 'A') {
        // File added
        totalSymbolsAdded += currentSnapshot.symbols.length;
        totalEdgesAdded += currentSnapshot.edges.length;

        // Track added symbols
        for (const symbol of currentSnapshot.symbols) {
          changedSymbols.push(symbol);
          symbolChanges.set(symbol.dnaId, { type: 'added', symbol, filePath: path });
        }
      } else if (status === 'M' && parentSha) {
        // File modified - compare snapshots
        const parentBlobSha = await this.git.getBlobSha(parentSha, path);

        // Quick check: if blob SHAs are identical, skip expensive operations
        if (parentBlobSha === currentBlobSha) {
          logDebug(`[CommitIndexer] Skipping diff for ${path} - identical blob SHA`);
          // File content is identical, no changes to track
          // Still need to extract hybrid facts though (they might have changed even if content is same)
          await this.extractAndSaveHybridFacts(path, sha, currentContent, currentSnapshot.symbols);
          continue;
        }

        const parentContent = await this.git.safeGetFileContent(parentSha, path);
        const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
          path,
          parentBlobSha,
          parentContent
        );

        const symbolDiff = this.snapshotManager.compareSnapshots(
          parentSnapshot,
          currentSnapshot
        );

        totalSymbolsAdded += symbolDiff.added.length;
        totalSymbolsModified += symbolDiff.modified.length;
        totalSymbolsRemoved += symbolDiff.removed.length;

        // Track all changed symbols
        for (const symbol of symbolDiff.added) {
          changedSymbols.push(symbol);
          symbolChanges.set(symbol.dnaId, { type: 'added', symbol, filePath: path });
        }
        for (const mod of symbolDiff.modified) {
          changedSymbols.push(mod.symbol);
          symbolChanges.set(mod.symbol.dnaId, { type: 'modified', symbol: mod.symbol, filePath: path });
        }
        for (const symbol of symbolDiff.removed) {
          symbolChanges.set(symbol.dnaId, { type: 'removed', symbol, filePath: path });
        }

        // Edge diff (simplified)
        const parentEdgeIds = new Set(parentSnapshot.edges.map(e => `${e.from}-${e.to}`));
        const currentEdgeIds = new Set(currentSnapshot.edges.map(e => `${e.from}-${e.to}`));
        totalEdgesAdded += currentSnapshot.edges.filter(e => !parentEdgeIds.has(`${e.from}-${e.to}`)).length;
        totalEdgesRemoved += parentSnapshot.edges.filter(e => !currentEdgeIds.has(`${e.from}-${e.to}`)).length;

        // Get structural diff metrics
        const structDiff = await this.structuralDiffManager.getOrCreateStructuralDiff(
          parentBlobSha,
          currentBlobSha,
          path,
          parentContent,
          currentContent
        );

        maxStructuralChange = Math.max(maxStructuralChange, structDiff.structuralChangeScore);

        // Extract and save hybrid facts for modified files (with prior hash)
        const parentFileHash = await this.computeFileHashForFacts(path, parentSha, parentContent);
        await this.extractAndSaveHybridFacts(path, sha, currentContent, currentSnapshot.symbols, parentFileHash);

        // Detect risks based on structural changes
        if (structDiff.interfaceChanged) {
          allRisks.push('breaking-api');
        }
        if (structDiff.controlFlowChanged) {
          allRisks.push('refactor');
        }
      }
    }

    // Calculate blast radius
    const blastRadiusResult = this.dependencyExtractor.calculateBlastRadius(
      changedSymbols,
      allEdges
    );

    const totalImpact = Array.from(blastRadiusResult.impactScore.values())
      .reduce((a, b) => a + b, 0);

    // Identify hotspots (symbols with highest impact)
    const hotspots = Array.from(blastRadiusResult.impactScore.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbolId, score]) => ({
        symbolId,
        impactScore: score,
        changeType: symbolChanges.get(symbolId)?.type || 'unknown'
      }));

    // Use RiskDetector for additional heuristics
    const detectedRisks = this.riskDetector.detectRisks(
      files,
      {
        added: changedSymbols.filter(s => symbolChanges.get(s.dnaId)?.type === 'added'),
        removed: changedSymbols.filter(s => symbolChanges.get(s.dnaId)?.type === 'removed'),
        modified: changedSymbols
          .filter(s => symbolChanges.get(s.dnaId)?.type === 'modified')
          .map(symbol => ({ symbol, changeType: 'modified' as const }))
      },
      { added: allEdges, removed: [] }
    );

    allRisks.push(...detectedRisks);

    // Aggregate facts
    const facts: CommitFacts = {
      sha,
      symbolsAdded: totalSymbolsAdded,
      symbolsModified: totalSymbolsModified,
      symbolsRemoved: totalSymbolsRemoved,
      edgesAdded: totalEdgesAdded,
      edgesRemoved: totalEdgesRemoved,
      risks: [...new Set(allRisks)],
      structuralChangeScore: maxStructuralChange,
      filesChanged: files.length,
      blastRadius: totalImpact,
      hotspots
    };

    // Store symbol history for detailed tracking
    logInfo(`[CommitIndexer] Storing ${symbolChanges.size} symbol changes for ${sha}`);
    await this.storeSymbolHistory(sha, symbolChanges, blastRadiusResult.impactScore);

    // Store symbols into symbols table (legacy support for intendedMap)
    await this.storeSymbols(sha, symbolChanges);

    // Store edges into edges table (skip if modules filter excludes edges)
    if (!opts?.modules || opts.modules.includes('edges')) {
      await this.storeEdges(sha, files, parentSha || null);
    }

    // Detect moved blocks
    const { movedBlocks } = await this.movedBlockDetector.detectMovedBlocks(
      sha,
      Array.from(symbolChanges.values()).filter(s => s.type === 'removed').map(s => s.symbol),
      Array.from(symbolChanges.values()).filter(s => s.type === 'added').map(s => s.symbol)
    );

    // Update symbol change types based on moves
    this.reconcileMovesWithSymbols(symbolChanges, movedBlocks);

    // Update hotspot metrics
    await this.updateHotspots(sha, symbolChanges, files);

    return facts;
  }

  /**
   * Store symbols into the legacy symbols table
   */
  private async storeSymbols(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any; filePath: string }>
  ): Promise<void> {
    const db = getDatabaseManager().getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO symbols
      (sha, path, symbol_id, name, kind, signature, change_type, diff_snippet_pre, diff_snippet_post, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const [dnaId, { type, symbol, filePath }] of symbolChanges) {
        // Map symbol data to table columns
        // Note: signature_pre/post are not in schema, using signature for now
        // diff_snippet_pre/post are in schema

        stmt.run([
          sha,
          filePath,
          symbol.id, // Use symbol.id (e.g. "path:kind:name") or dnaId? Schema says symbol_id.
          symbol.name,
          symbol.kind,
          symbol.signature || '',
          type,
          '', // diff_snippet_pre (not easily available here without diffing again)
          '', // diff_snippet_post
          1.0 // confidence
        ]);
      }
    })();
  }

  /**
   * Extract and save hybrid facts for a file
   */
  private async extractAndSaveHybridFacts(
    filePath: string,
    commitSha: string,
    content: string,
    existingSymbols: any[],
    prevHash?: string
  ): Promise<void> {
    const config = getExtensionConfig();
    const enableCst = config.enableCstTracking ?? true;
    const enableAugment = config.enableCstAugmentation ?? false;

    if (!enableCst && !enableAugment) {
      return; // CST tracking disabled
    }

    const language = detectLanguage(filePath);
    if (!language) return;

    const isCstOnly = isCstOnlyLanguage(language);
    if (!isCstOnly && !enableAugment) {
      return; // Not CST-only and augmentation disabled
    }

    try {
      // Parse file
      const tree = await this.parser.parse(content, language);
      if (!tree) return;

      // Extract hybrid facts
      const hybridFacts = this.parser.extractHybridFacts(tree, filePath, language);

      // Save via timeline manager
      await this.cstTimelineManager.saveFacts(filePath, commitSha, hybridFacts, prevHash);
      if (hybridFacts.length > 0) {
        logDebug(`[CommitIndexer] Saved ${hybridFacts.length} hybrid facts for ${filePath}@${commitSha.substring(0, 8)}`);
      }
    } catch (error) {
      logDebug(`[CommitIndexer] Error extracting hybrid facts for ${filePath}: ${error}`);
    }
  }

  /**
   * Compute file hash for facts (for delta tracking)
   */
  private async computeFileHashForFacts(
    filePath: string,
    commitSha: string,
    content: string
  ): Promise<string | undefined> {
    const language = detectLanguage(filePath);
    if (!language) return undefined;

    try {
      const tree = await this.parser.parse(content, language);
      if (!tree) return undefined;

      const hybridFacts = this.parser.extractHybridFacts(tree, filePath, language);
      const serialized = JSON.stringify(hybridFacts.map(f => ({
        id: f.id,
        dnaId: f.dnaId,
        name: f.name,
        kind: f.kind
      })));
      return crypto.createHash('sha256')
        .update(serialized)
        .digest('hex')
        .substring(0, 16);
    } catch (error) {
      logDebug(`[CommitIndexer] Error computing file hash for ${filePath}: ${error}`);
      return undefined;
    }
  }

  private isIndexed(sha: string): boolean {
    const stmt = this.db.prepare(`
      SELECT status FROM commits_analysis
      WHERE sha = ? AND analysis_version = ? AND status = 'complete'
    `);
    const row = stmt.get([sha, ANALYSIS_VERSION]) as any;
    return !!row;
  }

  private loadCommitFacts(sha: string): CommitFacts {
    const stmt = this.db.prepare(`
      SELECT * FROM commits_analysis WHERE sha = ?
    `);
    const row = stmt.get([sha]) as any;

    return {
      sha: row.sha,
      symbolsAdded: row.symbols_added || 0,
      symbolsModified: row.symbols_modified || 0,
      symbolsRemoved: row.symbols_removed || 0,
      edgesAdded: row.edges_added || 0,
      edgesRemoved: row.edges_removed || 0,
      risks: row.risks ? JSON.parse(row.risks) : [],
      structuralChangeScore: row.structural_change_score || 0,
      filesChanged: row.files_changed || 0,
      blastRadius: row.blast_radius || 0,
      hotspots: row.hotspots_json ? JSON.parse(row.hotspots_json) : []
    };
  }

  private markPending(sha: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, status, analysis_version, analyzed_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run([sha, 'pending', ANALYSIS_VERSION, new Date().toISOString()]);
  }

  private markComplete(sha: string, facts: CommitFacts): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, status, analysis_version, symbols_added, symbols_modified, symbols_removed,
       edges_added, edges_removed, risks, blast_radius, structural_change_score,
       files_changed, hotspots_json, analyzed_at)
      VALUES (?, 'complete', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      sha,
      ANALYSIS_VERSION,
      facts.symbolsAdded,
      facts.symbolsModified,
      facts.symbolsRemoved,
      facts.edgesAdded,
      facts.edgesRemoved,
      JSON.stringify(facts.risks),
      facts.blastRadius,
      facts.structuralChangeScore,
      facts.filesChanged,
      JSON.stringify(facts.hotspots),
      new Date().toISOString()
    ]);
  }

  /**
   * Store detailed symbol change history
   */
  private async storeSymbolHistory(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any; filePath: string }>,
    impactScores: Map<string, number>
  ): Promise<void> {
    // Get wrapped database with transaction support
    const db = getDatabaseManager().getDatabase();
    const stmt = db.prepare(`
      INSERT INTO symbol_history
      (symbol_dna_id, sha, file_path, name, kind, signature, body_hash,
       change_type, impact_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Wrap batch inserts in transaction
    db.transaction(() => {
      for (const [dnaId, { type, symbol, filePath }] of symbolChanges) {
        const impactScore = impactScores.get(dnaId) || 0;

        stmt.run([
          dnaId,
          sha,
          filePath,
          symbol.name,
          symbol.kind,
          symbol.signature,
          symbol.bodyHash || null,
          type,
          impactScore,
          new Date().toISOString()
        ]);
      }
    })();
  }

  /**
   * Store edges into edges table with edge_type
   */
  private async storeEdges(
    sha: string,
    files: Array<{ path: string; status: string }>,
    parentSha: string | null
  ): Promise<void> {
    // Get wrapped database with transaction support
    const db = getDatabaseManager().getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO edges
      (sha, from_symbol_id, to_symbol_id, change_type, edge_type, confidence, is_resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Collect all edge data first (outside transaction, can use await)
    const edgesToInsert: Array<{
      sha: string;
      from: string;
      to: string;
      changeType: string;
      edgeType: string;
      confidence: number;
      isResolved: number;
    }> = [];

    for (const file of files) {
      const { path, status } = file;

      // Use centralized path filter
      const filterResult = await shouldProcessPathWithLog(path, {
        git: this.git,
        status: status as 'A' | 'M' | 'D' | 'R' | 'C' | 'U',
        commitSha: sha,
        skipSizeCheck: status === 'D'
      }, 'CommitIndexer.storeEdges');

      if (!filterResult.shouldProcess) {
        continue;
      }

      if (status === 'D') {
        // File deleted - get parent snapshot edges as removed
        if (parentSha) {
          const parentBlobSha = await this.git.getBlobSha(parentSha, path);
          const parentContent = await this.git.safeGetFileContent(parentSha, path);
          const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
            path,
            parentBlobSha,
            parentContent
          );

          for (const edge of parentSnapshot.edges) {
            edgesToInsert.push({
              sha,
              from: edge.from,
              to: edge.to,
              changeType: 'removed',
              edgeType: (edge as any).type || 'unknown',
              confidence: (edge as any).confidence || 1.0,
              isResolved: (edge as any).isResolved !== false ? 1 : 0
            });
          }
        }
        continue;
      }

      // Get current snapshot edges
      const currentBlobSha = await this.git.getBlobSha(sha, path);
      const currentContent = await this.git.safeGetFileContent(sha, path);
      const currentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
        path,
        currentBlobSha,
        currentContent
      );

      if (status === 'A') {
        // File added - all edges are added
        for (const edge of currentSnapshot.edges) {
          edgesToInsert.push({
            sha,
            from: edge.from,
            to: edge.to,
            changeType: 'added',
            edgeType: (edge as any).type || 'unknown',
            confidence: (edge as any).confidence || 1.0,
            isResolved: (edge as any).isResolved !== false ? 1 : 0
          });
        }
      } else if (status === 'M' && parentSha) {
        // File modified - compare edges
        const parentBlobSha = await this.git.getBlobSha(parentSha, path);
        const parentContent = await this.git.safeGetFileContent(parentSha, path);
        const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
          path,
          parentBlobSha,
          parentContent
        );

        const parentEdgeIds = new Set(parentSnapshot.edges.map(e => `${e.from}-${e.to}-${(e as any).type || 'unknown'}`));
        const currentEdgeIds = new Set(currentSnapshot.edges.map(e => `${e.from}-${e.to}-${(e as any).type || 'unknown'}`));

        // Added edges
        for (const edge of currentSnapshot.edges) {
          const edgeKey = `${edge.from}-${edge.to}-${(edge as any).type || 'unknown'}`;
          if (!parentEdgeIds.has(edgeKey)) {
            edgesToInsert.push({
              sha,
              from: edge.from,
              to: edge.to,
              changeType: 'added',
              edgeType: (edge as any).type || 'unknown',
              confidence: (edge as any).confidence || 1.0,
              isResolved: (edge as any).isResolved !== false ? 1 : 0
            });
          }
        }

        // Removed edges
        for (const edge of parentSnapshot.edges) {
          const edgeKey = `${edge.from}-${edge.to}-${(edge as any).type || 'unknown'}`;
          if (!currentEdgeIds.has(edgeKey)) {
            edgesToInsert.push({
              sha,
              from: edge.from,
              to: edge.to,
              changeType: 'removed',
              edgeType: (edge as any).type || 'unknown',
              confidence: (edge as any).confidence || 1.0,
              isResolved: (edge as any).isResolved !== false ? 1 : 0
            });
          }
        }
      }
    }

    // Now insert all edges in a single transaction
    if (edgesToInsert.length > 0) {
      db.transaction(() => {
        for (const edge of edgesToInsert) {
          stmt.run([
            edge.sha,
            edge.from,
            edge.to,
            edge.changeType,
            edge.edgeType,
            edge.confidence,
            edge.isResolved
          ]);
        }
      })();
    }
  }

  /**
   * Update hotspot metrics for files and symbols affected by this commit
   */
  private async updateHotspots(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any }>,
    files: any[]
  ): Promise<void> {
    const commitInfo = await this.git.getCommitInfo(sha);
    const author = commitInfo.author;

    // Update file-level hotspots (with threshold check)
    for (const file of files) {
      const { path } = file;
      // Get symbol changes for this file
      const fileSymbols = Array.from(symbolChanges.values())
        .filter(change => change.symbol.id.startsWith(`${path}:`))
        .map(change => change.symbol);

      // Skip if symbol changes < 5 (threshold)
      if (fileSymbols.length >= 5) {
        await this.hotspotDetector.updateFileHotspot(path, sha, fileSymbols, author);
      }
    }

    // Batch update symbol-level hotspots with concurrency
    const symbols = Array.from(symbolChanges.values())
      .map(change => change.symbol)
      .filter(s => s && s.id && s.dnaId);

    if (symbols.length > 0) {
      // Use batch method with concurrency limit of 8
      const limit = pLimit(8);
      const batches: SymbolInfo[][] = [];
      const batchSize = 50; // Process 50 symbols per batch

      for (let i = 0; i < symbols.length; i += batchSize) {
        batches.push(symbols.slice(i, i + batchSize));
      }

      await Promise.all(
        batches.map(batch =>
          limit(async () => {
            await this.hotspotDetector.batchUpdateSymbols(batch, sha);
          })
        )
      );
    }

    // Optionally create snapshot for trend analysis (every 10 commits)
    const commitCount = this.getCommitCount();
    if (commitCount % 10 === 0) {
      await this.hotspotDetector.createSnapshot(sha);
    }
  }

  /**
   * Update symbol change types based on detected moves
   */
  private reconcileMovesWithSymbols(
    symbolChanges: Map<string, { type: string; symbol: any }>,
    movedBlocks: any[]
  ): void {
    for (const move of movedBlocks) {
      const sourceSymbol = Array.from(symbolChanges.values())
        .find(change => change.symbol.dnaId === move.sourceSymbolId);
      const destSymbol = Array.from(symbolChanges.values())
        .find(change => change.symbol.dnaId === move.destSymbolId);

      if (sourceSymbol && destSymbol) {
        sourceSymbol.type = 'moved';
        destSymbol.type = 'moved';
        // Could add additional metadata about the move
      }
    }
  }

  private getCommitCount(): number {
    const stmt = this.db.prepare(`SELECT count(*) as count FROM commits_metadata`);
    const row = stmt.get() as any;
    return row.count || 0;
  }

  private markFailed(sha: string, error: unknown): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, status, analysis_version, analyzed_at)
      VALUES (?, 'failed', ?, ?)
    `);
    stmt.run([sha, ANALYSIS_VERSION, new Date().toISOString()]);
    logDebug(`[CommitIndexer] Failed to index ${sha}: ${error}`);
  }
}
