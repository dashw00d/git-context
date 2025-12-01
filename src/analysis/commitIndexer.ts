import * as crypto from 'crypto';
import pLimit = require('p-limit');
import { ANALYSIS_VERSION } from '../storage/schema';
import { prepare } from '../storage/statement-wrapper';
import { detectLanguage, getExtensionConfig, isCstOnlyLanguage } from '../utils/config';
import { logDebug, logError, logInfo } from '../utils/logger';
import { shouldProcessPathWithLog } from '../utils/pathFilter';
import { getCstTimelineManager } from './cstTimeline';
import { DependencyExtractor } from './dependencies';
import { GitOperations } from './git';
import { RiskDetector } from './heuristics';
import { HotspotDetectorV2 } from './hotspotDetector';
import { MovedBlockDetectorV2 } from './movedBlockDetector';
import { SnapshotManager } from './snapshotManager';
import { StructuralDiffManager } from './structuralDiffManager';
import { getTreeSitterParser } from './tree-sitter';
import type { SymbolInfo } from '../types';
// p-limit is CommonJS; use require style to avoid default-import issues
// eslint-disable-next-line @typescript-eslint/no-var-requires

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
  hotspots: Array<{
    symbolId: string;
    impactScore: number;
    changeType: string;
  }>;
}

interface FileProcessingResult {
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  edgesAdded: number;
  edgesRemoved: number;
  maxStructuralChange: number;
  risks: string[];
  changedSymbols: any[];
  symbolChanges: Array<{
    dnaId: string;
    type: string;
    symbol: any;
    filePath: string;
  }>;
  edgesToInsert: Array<{
    from: string;
    to: string;
    changeType: string;
    edgeType: string;
    confidence: number;
    isResolved: number;
  }>;
  hotspots: Array<{ path: string; symbols: any[] }>;
}

export class CommitIndexer {
  private cacheHits = 0;
  private cacheMisses = 0;
  private cstTimelineManager = getCstTimelineManager();
  private parser = getTreeSitterParser();

  constructor(
    private db: any,
    private git: GitOperations,
    private snapshotManager: SnapshotManager,
    private structuralDiffManager: StructuralDiffManager,
    private riskDetector: RiskDetector,
    private dependencyExtractor: DependencyExtractor,
    private hotspotDetector: HotspotDetectorV2,
    private movedBlockDetector: MovedBlockDetectorV2
  ) {}

  /**
   * Get cache statistics for observability
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: hitRate,
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
          // All retries failed, but fn() should now return partial data instead of throwing
          logError(
            `[CommitIndexer] All retry attempts failed, proceeding with best-effort mode`,
            lastError
          );
          return await fn();
        }

        // Exponential backoff with jitter: baseDelay * 2^attempt + random jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
        const delay = exponentialDelay + jitter;

        logDebug(
          `[CommitIndexer] Retry attempt ${
            attempt + 1
          }/${maxRetries} after ${delay.toFixed(0)}ms: ${lastError.message}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Should not reach here
    logError('Unexpected: retryWithBackoff reached end without returning');
    return await fn(); // Fallback
  }

  /**
   * Ensure commit is indexed (idempotent, cacheable)
   */
  async ensureCommitIndexed(
    sha: string,
    opts?: { force?: boolean; modules?: string[] }
  ): Promise<CommitFacts> {
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
      logError(`Failed to index commit ${sha}`, error);
      // Return partial data instead of throwing
      return {
        sha,
        symbolsAdded: 0,
        symbolsModified: 0,
        symbolsRemoved: 0,
        edgesAdded: 0,
        edgesRemoved: 0,
        risks: [`Failed to index: ${(error as Error).message}`],
        structuralChangeScore: 0,
        filesChanged: 0,
        blastRadius: 0,
        hotspots: [],
      };
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
    const promises = shas.map(sha =>
      limit(async () => {
        return this.retryWithBackoff(async () => {
          const facts = await this.ensureCommitIndexed(sha, opts);
          return facts;
        });
      })
    );

    const results = await Promise.all(promises);

    // Flush any pending snapshot and diff writes
    this.snapshotManager.flushSnapshotQueue();
    this.structuralDiffManager.flushDiffQueue();

    // Log cache performance metrics
    const stats = this.getCacheStats();
    logInfo(
      `[CommitIndexer] Cache performance: ${stats.cacheHits} hits, ${
        stats.cacheMisses
      } misses (${(stats.hitRate * 100).toFixed(1)}% hit rate)`
    );

    return results;
  }

  private async indexCommit(
    sha: string,
    opts?: { force?: boolean; modules?: string[] }
  ): Promise<CommitFacts> {
    logInfo(`[CommitIndexer] Indexing commit ${sha}`);

    const commitInfo = await this.git.getCommitInfo(sha);
    const files = await this.git.getFileChanges(sha);
    const parentSha = commitInfo.parent || null;

    // Parallel processing configuration
    const CONCURRENCY = 8;
    const limit = pLimit(CONCURRENCY);

    logInfo(
      `[CommitIndexer] Processing ${files.length} files for ${sha} (concurrency: ${CONCURRENCY})`
    );

    // Process files in parallel
    const promises = files.map(file => limit(() => this.processFile(file, sha, parentSha)));
    const results = await Promise.all(promises);

    // Aggregate results
    let totalSymbolsAdded = 0;
    let totalSymbolsModified = 0;
    let totalSymbolsRemoved = 0;
    let totalEdgesAdded = 0;
    let totalEdgesRemoved = 0;
    let maxStructuralChange = 0;
    const allRisks: string[] = [];
    const changedSymbols: any[] = [];
    const allEdges: any[] = []; // Collect edge objects for blast radius
    const symbolChanges = new Map<string, { type: string; symbol: any; filePath: string }>();
    const edgesToInsert: any[] = [];
    const fileHotspotsToUpdate: Array<{ path: string; symbols: any[] }> = [];

    for (const res of results) {
      if (!res) continue;
      totalSymbolsAdded += res.symbolsAdded;
      totalSymbolsModified += res.symbolsModified;
      totalSymbolsRemoved += res.symbolsRemoved;
      totalEdgesAdded += res.edgesAdded;
      totalEdgesRemoved += res.edgesRemoved;
      maxStructuralChange = Math.max(maxStructuralChange, res.maxStructuralChange);
      allRisks.push(...res.risks);
      changedSymbols.push(...res.changedSymbols);

      for (const change of res.symbolChanges) {
        symbolChanges.set(change.dnaId, change);
      }
      edgesToInsert.push(...res.edgesToInsert);
      fileHotspotsToUpdate.push(...res.hotspots);
    }

    // Construct allEdges for blast radius from edgesToInsert
    for (const edge of edgesToInsert) {
      // Blast radius calculator expects simple edge objects or similar
      // It uses: edge.from, edge.to
      allEdges.push({ from: edge.from, to: edge.to });
    }

    // Calculate blast radius
    const blastRadiusResult = this.dependencyExtractor.calculateBlastRadius(
      changedSymbols,
      allEdges
    );

    const totalImpact = Array.from(blastRadiusResult.impactScore.values()).reduce(
      (a, b) => a + b,
      0
    );

    // Identify hotspots (symbols with highest impact)
    const hotspots = Array.from(blastRadiusResult.impactScore.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbolId, score]) => ({
        symbolId,
        impactScore: score,
        changeType: symbolChanges.get(symbolId)?.type || 'unknown',
      }));

    // Use RiskDetector for additional heuristics
    const detectedRisks = this.riskDetector.detectRisks(
      files,
      {
        added: changedSymbols.filter(s => symbolChanges.get(s.dnaId)?.type === 'added'),
        removed: changedSymbols.filter(s => symbolChanges.get(s.dnaId)?.type === 'removed'),
        modified: changedSymbols
          .filter(s => symbolChanges.get(s.dnaId)?.type === 'modified')
          .map(symbol => ({ symbol, changeType: 'modified' as const })),
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
      hotspots,
    };

    // Store metadata
    this.storeCommitMetadata(commitInfo, facts.filesChanged);

    // Store symbol history
    logInfo(`[CommitIndexer] Storing ${symbolChanges.size} symbol changes for ${sha}`);
    await this.storeSymbolHistory(sha, symbolChanges, blastRadiusResult.impactScore);

    // Store symbols
    await this.storeSymbols(sha, symbolChanges);

    // Store edges (batch insert)
    if (!opts?.modules || opts.modules.includes('edges')) {
      // We already collected edgesToInsert in parallel, now verify we have them all
      // storeEdges function in legacy code re-derived them. We should update it to take pre-calculated edges
      // OR just use the existing storeEdges for safety if logic is complex.
      // The legacy storeEdges re-reads files/snapshots. That's wasteful.
      // Let's use the edges we calculated in parallel!
      await this.storeEdgesBatch(sha, edgesToInsert);
    }

    // Detect moved blocks
    const { movedBlocks } = await this.movedBlockDetector.detectMovedBlocks(
      sha,
      Array.from(symbolChanges.values())
        .filter(s => s.type === 'removed')
        .map(s => s.symbol),
      Array.from(symbolChanges.values())
        .filter(s => s.type === 'added')
        .map(s => s.symbol)
    );

    // Update symbol change types based on moves
    this.reconcileMovesWithSymbols(symbolChanges, movedBlocks);

    // Update hotspot metrics
    const commitInfoForAuthor = await this.git.getCommitInfo(sha);
    await this.updateHotspotsFromBatch(
      sha,
      symbolChanges,
      fileHotspotsToUpdate,
      commitInfoForAuthor.author
    );

    return facts;
  }

  private async processFile(
    file: { path: string; status: string },
    sha: string,
    parentSha: string | null
  ): Promise<FileProcessingResult | null> {
    const { path, status } = file;
    const result: FileProcessingResult = {
      symbolsAdded: 0,
      symbolsModified: 0,
      symbolsRemoved: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      maxStructuralChange: 0,
      risks: [],
      changedSymbols: [],
      symbolChanges: [],
      edgesToInsert: [],
      hotspots: [],
    };

    // Use centralized path filter
    const filterResult = await shouldProcessPathWithLog(
      path,
      {
        git: this.git,
        status: status as any,
        commitSha: sha,
        skipSizeCheck: status === 'D',
      },
      'CommitIndexer'
    );

    if (!filterResult.shouldProcess) {
      return null;
    }

    if (status === 'D') {
      if (parentSha) {
        const parentBlobSha = await this.git.getBlobSha(parentSha, path);
        const parentContent = await this.git.safeGetFileContent(parentSha, path);
        const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
          path,
          parentBlobSha,
          parentContent
        );
        result.symbolsRemoved += parentSnapshot.symbols.length;
        result.edgesRemoved += parentSnapshot.edges.length;

        for (const symbol of parentSnapshot.symbols) {
          result.symbolChanges.push({
            dnaId: symbol.dnaId,
            type: 'removed',
            symbol,
            filePath: path,
          });
        }

        // Add removed edges
        for (const edge of parentSnapshot.edges) {
          result.edgesToInsert.push({
            from: edge.from,
            to: edge.to,
            changeType: 'removed',
            edgeType: (edge as any).type || 'unknown',
            confidence: (edge as any).confidence || 1.0,
            isResolved: (edge as any).isResolved !== false ? 1 : 0,
          });
        }
      }
      return result;
    }

    // Get current blob
    const currentBlobSha = await this.git.getBlobSha(sha, path);
    const currentContent = await this.git.safeGetFileContent(sha, path);
    const currentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
      path,
      currentBlobSha,
      currentContent
    );

    // Extract and save hybrid facts
    await this.extractAndSaveHybridFacts(path, sha, currentContent, currentSnapshot.symbols);

    if (status === 'A') {
      result.symbolsAdded += currentSnapshot.symbols.length;
      result.edgesAdded += currentSnapshot.edges.length;

      for (const symbol of currentSnapshot.symbols) {
        result.changedSymbols.push(symbol);
        result.symbolChanges.push({
          dnaId: symbol.dnaId,
          type: 'added',
          symbol,
          filePath: path,
        });
      }

      for (const edge of currentSnapshot.edges) {
        result.edgesToInsert.push({
          from: edge.from,
          to: edge.to,
          changeType: 'added',
          edgeType: (edge as any).type || 'unknown',
          confidence: (edge as any).confidence || 1.0,
          isResolved: (edge as any).isResolved !== false ? 1 : 0,
        });
      }
    } else if (status === 'M' && parentSha) {
      const parentBlobSha = await this.git.getBlobSha(parentSha, path);

      if (parentBlobSha === currentBlobSha) {
        // Identical content
        await this.extractAndSaveHybridFacts(path, sha, currentContent, currentSnapshot.symbols);
        return result;
      }

      const parentContent = await this.git.safeGetFileContent(parentSha, path);
      const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
        path,
        parentBlobSha,
        parentContent
      );

      const symbolDiff = this.snapshotManager.compareSnapshots(parentSnapshot, currentSnapshot);

      result.symbolsAdded += symbolDiff.added.length;
      result.symbolsModified += symbolDiff.modified.length;
      result.symbolsRemoved += symbolDiff.removed.length;

      for (const symbol of symbolDiff.added) {
        result.changedSymbols.push(symbol);
        result.symbolChanges.push({
          dnaId: symbol.dnaId,
          type: 'added',
          symbol,
          filePath: path,
        });
      }
      for (const mod of symbolDiff.modified) {
        result.changedSymbols.push(mod.symbol);
        result.symbolChanges.push({
          dnaId: mod.symbol.dnaId,
          type: 'modified',
          symbol: mod.symbol,
          filePath: path,
        });
      }
      for (const symbol of symbolDiff.removed) {
        result.symbolChanges.push({
          dnaId: symbol.dnaId,
          type: 'removed',
          symbol,
          filePath: path,
        });
      }

      // Calculate edge diffs
      const parentEdgeIds = new Set(
        parentSnapshot.edges.map(e => `${e.from}-${e.to}-${(e as any).type || 'unknown'}`)
      );
      const currentEdgeIds = new Set(
        currentSnapshot.edges.map(e => `${e.from}-${e.to}-${(e as any).type || 'unknown'}`)
      );

      result.edgesAdded += currentSnapshot.edges.filter(
        e => !parentEdgeIds.has(`${e.from}-${e.to}-${(e as any).type || 'unknown'}`)
      ).length;
      result.edgesRemoved += parentSnapshot.edges.filter(
        e => !currentEdgeIds.has(`${e.from}-${e.to}-${(e as any).type || 'unknown'}`)
      ).length;

      for (const edge of currentSnapshot.edges) {
        const edgeKey = `${edge.from}-${edge.to}-${(edge as any).type || 'unknown'}`;
        if (!parentEdgeIds.has(edgeKey)) {
          result.edgesToInsert.push({
            from: edge.from,
            to: edge.to,
            changeType: 'added',
            edgeType: (edge as any).type || 'unknown',
            confidence: (edge as any).confidence || 1.0,
            isResolved: (edge as any).isResolved !== false ? 1 : 0,
          });
        }
      }
      for (const edge of parentSnapshot.edges) {
        const edgeKey = `${edge.from}-${edge.to}-${(edge as any).type || 'unknown'}`;
        if (!currentEdgeIds.has(edgeKey)) {
          result.edgesToInsert.push({
            from: edge.from,
            to: edge.to,
            changeType: 'removed',
            edgeType: (edge as any).type || 'unknown',
            confidence: (edge as any).confidence || 1.0,
            isResolved: (edge as any).isResolved !== false ? 1 : 0,
          });
        }
      }

      // Structural diff
      const structDiff = await this.structuralDiffManager.getOrCreateStructuralDiff(
        parentBlobSha,
        currentBlobSha,
        path,
        parentContent,
        currentContent
      );

      result.maxStructuralChange = structDiff.structuralChangeScore;

      if (structDiff.interfaceChanged) result.risks.push('breaking-api');
      if (structDiff.controlFlowChanged) result.risks.push('refactor');

      // Hybrid facts with parent hash
      const parentFileHash = await this.computeFileHashForFacts(path, parentSha, parentContent);
      await this.extractAndSaveHybridFacts(
        path,
        sha,
        currentContent,
        currentSnapshot.symbols,
        parentFileHash
      );
    }

    // Collect potential hotspots (symbols changed in this file)
    const fileSymbols = result.symbolChanges.filter(c => c.filePath === path).map(c => c.symbol);

    if (fileSymbols.length > 0) {
      result.hotspots.push({ path, symbols: fileSymbols });
    }

    return result;
  }

  /**
   * Batch store edges (replaces individual storeEdges calls)
   */
  private async storeEdgesBatch(
    sha: string,
    edges: Array<{
      from: string;
      to: string;
      changeType: string;
      edgeType: string;
      confidence: number;
      isResolved: number;
    }>
  ): Promise<void> {
    const stmt = prepare(`
      INSERT OR REPLACE INTO edges
      (sha, from_symbol_id, to_symbol_id, change_type, edge_type, confidence, is_resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.transaction(() => {
      for (const edge of edges) {
        stmt.run([
          sha,
          edge.from,
          edge.to,
          edge.changeType,
          edge.edgeType,
          edge.confidence,
          edge.isResolved,
        ]);
      }
    })();
  }

  private async updateHotspotsFromBatch(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any }>,
    fileHotspots: Array<{ path: string; symbols: any[] }>,
    author?: string
  ): Promise<void> {
    // Update file-level hotspots
    for (const { path, symbols } of fileHotspots) {
      if (symbols.length >= 5) {
        await this.hotspotDetector.updateFileHotspot(path, sha, symbols, author);
      }
    }

    // Batch update symbol-level hotspots
    const symbols = Array.from(symbolChanges.values())
      .map(change => change.symbol)
      .filter(s => s && s.id && s.dnaId);

    if (symbols.length > 0) {
      const limit = pLimit(8);
      const batches: SymbolInfo[][] = [];
      const batchSize = 50;

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

    // Snapshot
    const commitCount = this.getCommitCount();
    if (commitCount % 10 === 0) {
      await this.hotspotDetector.createSnapshot(sha);
    }
  }

  /**
   * Store symbols into the legacy symbols table
   */
  private async storeSymbols(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any; filePath: string }>
  ): Promise<void> {
    const stmt = prepare(`
      INSERT OR REPLACE INTO symbols
      (sha, path, symbol_id, name, kind, signature, change_type, diff_snippet_pre, diff_snippet_post, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.transaction(() => {
      for (const [_dnaId, { type, symbol, filePath }] of symbolChanges) {
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
          1.0, // confidence
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
      // Parse file via worker
      // Note: extractHybridFacts in TreeSitterParser handles worker logic
      // We pass empty string content if not needed by worker logic for pure extraction,
      // but worker needs content to parse.
      const hybridFacts = await this.parser.extractHybridFacts(
        content,
        filePath,
        language,
        existingSymbols
      );

      // Save via timeline manager
      await this.cstTimelineManager.saveFacts(filePath, commitSha, hybridFacts, prevHash);
      if (hybridFacts.length > 0) {
        logDebug(
          `[CommitIndexer] Saved ${
            hybridFacts.length
          } hybrid facts for ${filePath}@${commitSha.substring(0, 8)}`
        );
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
      // Reuse worker to extract facts for hash computation
      const hybridFacts = await this.parser.extractHybridFacts(content, filePath, language);
      const serialized = JSON.stringify(
        hybridFacts.map(f => ({
          id: f.id,
          dnaId: f.dnaId,
          name: f.name,
          kind: f.kind,
        }))
      );
      return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
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
      hotspots: row.hotspots_json ? JSON.parse(row.hotspots_json) : [],
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
      new Date().toISOString(),
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
    const stmt = prepare(`
      INSERT INTO symbol_history
      (symbol_dna_id, sha, file_path, name, kind, signature, body_hash,
       change_type, impact_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Wrap batch inserts in transaction
    this.db.transaction(() => {
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
          new Date().toISOString(),
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
    const stmt = prepare(`
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
      const filterResult = await shouldProcessPathWithLog(
        path,
        {
          git: this.git,
          status: status as 'A' | 'M' | 'D' | 'R' | 'C' | 'U',
          commitSha: sha,
          skipSizeCheck: status === 'D',
        },
        'CommitIndexer.storeEdges'
      );

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
              isResolved: (edge as any).isResolved !== false ? 1 : 0,
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
            isResolved: (edge as any).isResolved !== false ? 1 : 0,
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

        const parentEdgeIds = new Set(
          parentSnapshot.edges.map(e => `${e.from}-${e.to}-${(e as any).type || 'unknown'}`)
        );
        const currentEdgeIds = new Set(
          currentSnapshot.edges.map(e => `${e.from}-${e.to}-${(e as any).type || 'unknown'}`)
        );

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
              isResolved: (edge as any).isResolved !== false ? 1 : 0,
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
              isResolved: (edge as any).isResolved !== false ? 1 : 0,
            });
          }
        }
      }
    }

    // Now insert all edges in a single transaction
    if (edgesToInsert.length > 0) {
      this.db.transaction(() => {
        for (const edge of edgesToInsert) {
          stmt.run([
            edge.sha,
            edge.from,
            edge.to,
            edge.changeType,
            edge.edgeType,
            edge.confidence,
            edge.isResolved,
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
      const sourceSymbol = Array.from(symbolChanges.values()).find(
        change => change.symbol.dnaId === move.sourceSymbolId
      );
      const destSymbol = Array.from(symbolChanges.values()).find(
        change => change.symbol.dnaId === move.destSymbolId
      );

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

  private markFailed(sha: string, _error: unknown): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, status, analysis_version, analyzed_at)
      VALUES (?, 'failed', ?, ?)
    `);
    stmt.run([sha, ANALYSIS_VERSION, new Date().toISOString()]);
  }

  private storeCommitMetadata(info: any, filesChanged: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_metadata
      (sha, author, date, message, parent, files_changed, loaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run([
      info.sha,
      info.author,
      info.date,
      info.message,
      info.parent || null,
      filesChanged,
      new Date().toISOString(),
    ]);
  }
}
