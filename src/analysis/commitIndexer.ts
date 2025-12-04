/* eslint-disable no-restricted-syntax */
// CancellationError must be thrown to halt the pipeline immediately (see code review P1)
import * as crypto from 'crypto';
import pLimit = require('p-limit');
import * as vscode from 'vscode';
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
    id: string; // DNA hash
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
  ) {
    //empty
  }

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
  ): Promise<T | null> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        // Don't retry on cancellation - re-throw immediately
        if (error instanceof vscode.CancellationError) {
          throw error;
        }

        lastError = error as Error;

        if (attempt === maxRetries) {
          logError(
            `[CommitIndexer] All ${maxRetries} retry attempts exhausted for operation: ${lastError.message}`,
            lastError
          );
          return null;
        }

        const exponentialDelay = baseDelay * Math.pow(2, attempt);
        const jitter = Math.random() * 0.1 * exponentialDelay;
        const delay = exponentialDelay + jitter;

        logDebug(
          `[CommitIndexer] Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms: ${lastError.message}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    logError(`[CommitIndexer] Unexpected: retryWithBackoff loop completed without return`);
    return null;
  }

  /**
   * Ensure commit is indexed (idempotent, cacheable)
   */
  async ensureCommitIndexed(
    sha: string,
    opts?: {
      force?: boolean;
      modules?: string[];
      token?: vscode.CancellationToken;
      onProgress?: (event: {
        type: 'file_start' | 'file_complete';
        file: string;
        sha: string;
      }) => void;
    }
  ): Promise<CommitFacts | null> {
    if (opts?.token?.isCancellationRequested) {
      logInfo('[CommitIndexer] Operation cancelled by token');
      throw new vscode.CancellationError();
    }

    if (!opts?.force && this.isIndexed(sha)) {
      logDebug(`[CommitIndexer] ${sha} already indexed`);
      this.cacheHits++;
      return this.loadCommitFacts(sha);
    }

    this.cacheMisses++;

    this.markPending(sha);

    try {
      const facts = await this.indexCommit(sha, opts);
      this.markComplete(sha, facts);
      return facts;
    } catch (error) {
      if (error instanceof vscode.CancellationError) {
        logInfo('[CommitIndexer] Operation cancelled');
        throw error;
      }
      this.markFailed(sha, error);
      logError(`[CommitIndexer] Failed to index commit ${sha}`, error);
      return Promise.reject(error);
    }
  }

  /**
   * Index multiple commits with concurrency
   */
  async ensureCommitsIndexed(
    shas: string[],
    concurrency: number = 8,
    opts?: { force?: boolean; modules?: string[]; token?: vscode.CancellationToken },
    onProgress?: (event: {
      type: 'file_start' | 'file_complete';
      file: string;
      sha: string;
    }) => void
  ): Promise<CommitFacts[]> {
    const limit = pLimit(concurrency);
    const promises = shas.map(sha =>
      limit(async () => {
        if (opts?.token?.isCancellationRequested) {
          logInfo('[CommitIndexer] Operation cancelled');
          throw new vscode.CancellationError();
        }
        return this.retryWithBackoff(async () => {
          if (opts?.token?.isCancellationRequested) {
            logInfo('[CommitIndexer] Operation cancelled');
            throw new vscode.CancellationError();
          }
          const facts = await this.ensureCommitIndexed(sha, { ...opts, onProgress });
          if (!facts) return Promise.reject(new Error(`Failed to index ${sha}`));
          return facts;
        });
      })
    );

    const results = await Promise.all(promises);
    const validResults = results.filter((f): f is CommitFacts => f !== null && f !== undefined);

    this.snapshotManager.flushSnapshotQueue();
    this.structuralDiffManager.flushDiffQueue();

    const stats = this.getCacheStats();
    logInfo(
      `[CommitIndexer] Cache performance: ${stats.cacheHits} hits, ${
        stats.cacheMisses
      } misses (${(stats.hitRate * 100).toFixed(1)}% hit rate)`
    );

    return validResults;
  }

  private async indexCommit(
    sha: string,
    opts?: {
      force?: boolean;
      modules?: string[];
      token?: vscode.CancellationToken;
      onProgress?: (event: {
        type: 'file_start' | 'file_complete';
        file: string;
        sha: string;
      }) => void;
    }
  ): Promise<CommitFacts> {
    logInfo(`[CommitIndexer] Indexing commit ${sha}`);

    const commitInfo = await this.git.getCommitInfo(sha);
    const files = await this.git.getFileChanges(sha);
    const parentSha = commitInfo.parent || null;

    const CONCURRENCY = 8;
    const limit = pLimit(CONCURRENCY);

    logInfo(
      `[CommitIndexer] Processing ${files.length} files for ${sha} (concurrency: ${CONCURRENCY})`
    );

    const promises = files.map(file =>
      limit(async () => {
        if (opts?.token?.isCancellationRequested) {
          logInfo('[CommitIndexer] Operation cancelled');
          throw new vscode.CancellationError();
        }
        opts?.onProgress?.({ type: 'file_start', file: file.path, sha });
        const result = await this.processFile(file, sha, parentSha);
        opts?.onProgress?.({ type: 'file_complete', file: file.path, sha });
        return result;
      })
    );
    const results = await Promise.all(promises);

    let totalSymbolsAdded = 0;
    let totalSymbolsModified = 0;
    let totalSymbolsRemoved = 0;
    let totalEdgesAdded = 0;
    let totalEdgesRemoved = 0;
    let maxStructuralChange = 0;
    const allRisks: string[] = [];
    const changedSymbols: any[] = [];
    const allEdges: any[] = [];
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

      // Log if file had structural change
      if (res.maxStructuralChange > 0) {
        logDebug(
          `[CommitIndexer] File contributed structural change: ${res.maxStructuralChange.toFixed(3)}`
        );
      }

      for (const change of res.symbolChanges) {
        symbolChanges.set(change.id, change);
      }
      edgesToInsert.push(...res.edgesToInsert);
      fileHotspotsToUpdate.push(...res.hotspots);
    }

    for (const edge of edgesToInsert) {
      allEdges.push({ from: edge.from, to: edge.to });
    }

    const blastRadiusResult = this.dependencyExtractor.calculateBlastRadius(
      changedSymbols,
      allEdges
    );

    const totalImpact = Array.from(blastRadiusResult.impactScore.values()).reduce(
      (a, b) => a + b,
      0
    );

    const hotspots = Array.from(blastRadiusResult.impactScore.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symbolId, score]) => ({
        symbolId,
        impactScore: score,
        changeType: symbolChanges.get(symbolId)?.type || 'unknown',
      }));

    const detectedRisks = this.riskDetector.detectRisks(
      files,
      {
        added: changedSymbols.filter(s => symbolChanges.get(s.id)?.type === 'added'),
        removed: changedSymbols.filter(s => symbolChanges.get(s.id)?.type === 'removed'),
        modified: changedSymbols
          .filter(s => symbolChanges.get(s.id)?.type === 'modified')
          .map(symbol => ({ symbol, changeType: 'modified' as const })),
      },
      { added: allEdges, removed: [] }
    );

    allRisks.push(...detectedRisks);

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

    // Log final structural change score for debugging
    logInfo(
      `[CommitIndexer] Commit ${sha.substring(0, 8)}: ${files.length} files, structural change: ${(maxStructuralChange * 100).toFixed(1)}%`
    );

    this.storeCommitMetadata(commitInfo, facts.filesChanged);

    logInfo(`[CommitIndexer] Storing ${symbolChanges.size} symbol changes for ${sha}`);
    await this.storeSymbolHistory(sha, symbolChanges, blastRadiusResult.impactScore);

    await this.storeSymbols(sha, symbolChanges);

    if (!opts?.modules || opts.modules.includes('edges')) {
      await this.storeEdgesBatch(sha, edgesToInsert);
    }

    const { movedBlocks } = await this.movedBlockDetector.detectMovedBlocks(
      sha,
      Array.from(symbolChanges.values())
        .filter(s => s.type === 'removed')
        .map(s => s.symbol),
      Array.from(symbolChanges.values())
        .filter(s => s.type === 'added')
        .map(s => s.symbol)
    );

    this.reconcileMovesWithSymbols(symbolChanges, movedBlocks);

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
            id: symbol.id, // id is now the DNA hash
            type: 'removed',
            symbol,
            filePath: path,
          });
        }

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

    const currentBlobSha = await this.git.getBlobSha(sha, path);
    const currentContent = await this.git.safeGetFileContent(sha, path);
    const currentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
      path,
      currentBlobSha,
      currentContent
    );

    await this.extractAndSaveHybridFacts(path, sha, currentContent, currentSnapshot.symbols);

    if (status === 'A') {
      result.symbolsAdded += currentSnapshot.symbols.length;
      result.edgesAdded += currentSnapshot.edges.length;

      for (const symbol of currentSnapshot.symbols) {
        result.changedSymbols.push(symbol);
        result.symbolChanges.push({
          id: symbol.id, // id is now the DNA hash
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
          id: symbol.id, // id is now the DNA hash
          type: 'added',
          symbol,
          filePath: path,
        });
      }
      for (const mod of symbolDiff.modified) {
        result.changedSymbols.push(mod.symbol);
        result.symbolChanges.push({
          id: mod.symbol.id, // id is now the DNA hash
          type: 'modified',
          symbol: mod.symbol,
          filePath: path,
        });
      }
      for (const symbol of symbolDiff.removed) {
        result.symbolChanges.push({
          id: symbol.id, // id is now the DNA hash
          type: 'removed',
          symbol,
          filePath: path,
        });
      }

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

      const structDiff = await this.structuralDiffManager.getOrCreateStructuralDiff(
        parentBlobSha,
        currentBlobSha,
        path,
        parentContent,
        currentContent
      );

      result.maxStructuralChange = structDiff.structuralChangeScore;

      // Log structural change for debugging
      if (structDiff.structuralChangeScore > 0) {
        logDebug(
          `[CommitIndexer] Structural change detected in ${path}: ${(structDiff.structuralChangeScore * 100).toFixed(1)}%`
        );
      }

      if (structDiff.interfaceChanged) result.risks.push('breaking-api');
      if (structDiff.controlFlowChanged) result.risks.push('refactor');

      const parentFileHash = await this.computeFileHashForFacts(path, parentSha, parentContent);
      await this.extractAndSaveHybridFacts(
        path,
        sha,
        currentContent,
        currentSnapshot.symbols,
        parentFileHash
      );
    }

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

    const transaction = this.db.transaction(() => {
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
    });

    transaction();
  }

  private async updateHotspotsFromBatch(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any }>,
    fileHotspots: Array<{ path: string; symbols: any[] }>,
    author?: string
  ): Promise<void> {
    for (const { path, symbols } of fileHotspots) {
      if (symbols.length >= 5) {
        await this.hotspotDetector.updateFileHotspot(path, sha, symbols, author);
      }
    }

    const symbols = Array.from(symbolChanges.values())
      .map(change => change.symbol)
      .filter(s => s && s.id); // id is now the DNA hash

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
    // First, ensure symbol_dna records exist
    const dnaStmt = prepare(`
      INSERT OR IGNORE INTO symbol_dna (dna_id, first_seen_sha, first_seen_path)
      VALUES (?, ?, ?)
    `);

    const symbolStmt = prepare(`
      INSERT OR REPLACE INTO symbols
      (sha, path, symbol_id, dna_id, name, kind, signature, change_type, diff_snippet_pre, diff_snippet_post, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.db.transaction(() => {
      for (const [dnaId, { type, symbol, filePath }] of symbolChanges) {
        // Insert into symbol_dna first (if not exists)
        dnaStmt.run([dnaId, sha, filePath]);

        // Then insert into symbols
        symbolStmt.run([
          sha,
          filePath,
          symbol.semanticId || symbol.id, // Keep semanticId for reference, fallback to id
          dnaId, // dna_id is the DNA hash (same as symbol.id)
          symbol.name,
          symbol.kind,
          symbol.signature || '',
          type,
          '',
          '',
          1.0,
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
      return;
    }

    const language = detectLanguage(filePath);
    if (!language) return;

    const isCstOnly = isCstOnlyLanguage(language);
    if (!isCstOnly && !enableAugment) {
      return;
    }

    try {
      const hybridFacts = await this.parser.extractHybridFacts(
        content,
        filePath,
        language,
        existingSymbols
      );

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
      const hybridFacts = await this.parser.extractHybridFacts(content, filePath, language);
      const serialized = JSON.stringify(
        hybridFacts.map(f => ({
          id: f.id, // id is now the DNA hash
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
    if (!this.db) {
      return false;
    }
    const stmt = this.db.prepare(`
      SELECT status FROM commits_analysis
      WHERE sha = ? AND analysis_version = ? AND status = 'complete'
    `);
    const row = stmt.get([sha, ANALYSIS_VERSION]) as any;
    return !!row;
  }

  private loadCommitFacts(sha: string): CommitFacts {
    if (!this.db) {
      logError('[CommitIndexer] Database not initialized, returning empty facts');
      return {
        sha,
        symbolsAdded: 0,
        symbolsModified: 0,
        symbolsRemoved: 0,
        edgesAdded: 0,
        edgesRemoved: 0,
        risks: [],
        structuralChangeScore: 0,
        filesChanged: 0,
        blastRadius: 0,
        hotspots: [],
      };
    }
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

  private async storeSymbolHistory(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any; filePath: string }>,
    impactScores: Map<string, number>
  ): Promise<void> {
    const stmt = prepare(`
      INSERT INTO symbol_history
      (symbol_dna_id, sha, file_path, name, kind, signature, body_hash,
       change_type, impact_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

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

  private async storeEdges(
    sha: string,
    files: Array<{ path: string; status: string }>,
    parentSha: string | null
  ): Promise<void> {
    const stmt = prepare(`
      INSERT OR REPLACE INTO edges
      (sha, from_symbol_id, to_symbol_id, change_type, edge_type, confidence, is_resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

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

      const currentBlobSha = await this.git.getBlobSha(sha, path);
      const currentContent = await this.git.safeGetFileContent(sha, path);
      const currentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
        path,
        currentBlobSha,
        currentContent
      );

      if (status === 'A') {
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

  private async updateHotspots(
    sha: string,
    symbolChanges: Map<string, { type: string; symbol: any }>,
    files: any[]
  ): Promise<void> {
    const commitInfo = await this.git.getCommitInfo(sha);
    const author = commitInfo.author;

    for (const file of files) {
      const { path } = file;

      const fileSymbols = Array.from(symbolChanges.values())
        .filter(change => change.symbol.id.startsWith(`${path}:`))
        .map(change => change.symbol);

      if (fileSymbols.length >= 5) {
        await this.hotspotDetector.updateFileHotspot(path, sha, fileSymbols, author);
      }
    }

    const symbols = Array.from(symbolChanges.values())
      .map(change => change.symbol)
      .filter(s => s && s.id); // id is now the DNA hash

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

    const commitCount = this.getCommitCount();
    if (commitCount % 10 === 0) {
      await this.hotspotDetector.createSnapshot(sha);
    }
  }

  private reconcileMovesWithSymbols(
    symbolChanges: Map<string, { type: string; symbol: any }>,
    movedBlocks: any[]
  ): void {
    for (const move of movedBlocks) {
      const sourceSymbol = Array.from(symbolChanges.values()).find(
        change => change.symbol.id === move.sourceSymbolId
      );
      const destSymbol = Array.from(symbolChanges.values()).find(
        change => change.symbol.id === move.destSymbolId
      );

      if (sourceSymbol && destSymbol) {
        sourceSymbol.type = 'moved';
        destSymbol.type = 'moved';
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
