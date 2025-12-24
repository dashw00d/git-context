import * as fs from 'fs';
import * as path from 'path';
import { normalizeEdgeIdForStorage } from '../utils/edgeNormalization';
import { logDebug, logInfo, logWarn } from '../utils/logger';
import { getDatabase } from './database';
import { ANALYSIS_VERSION } from './schema';
import type { CommitFacts } from '../analysis/commitIndexer';
import type { MovedBlock } from '../analysis/movedBlockDetector';
import type { FileSnapshot } from '../analysis/snapshotManager';
import type { StructuralDiffMetrics } from '../analysis/structuralDiffManager';
import type { WorkspaceFacts } from '../analysis/workspaceIndexer';
import type { CommitInfo, SymbolInfo } from '../types';
import type { HybridFact, DeltaChange } from '../types/cstFacts';

/**
 * Discriminated union of all write operation types
 */
export type WriteOperation =
  | { type: 'blob'; data: { blobSha: string; content: string; size: number } }
  | { type: 'snapshot'; data: FileSnapshot }
  | {
      type: 'structural_diff';
      data: {
        parentBlobSha: string;
        currentBlobSha: string;
        filePath: string;
        metrics: StructuralDiffMetrics;
      };
    }
  | {
      type: 'symbol';
      data: {
        sha: string;
        path: string;
        symbol: SymbolInfo;
        changeType: string;
        isDna?: boolean; // true for symbol_dna inserts
      };
    }
  | {
      type: 'symbol_history';
      data: {
        dnaId: string;
        sha: string;
        filePath: string;
        symbol: SymbolInfo;
        impactScore: number;
        changeType: string;
      };
    }
  | {
      type: 'edge';
      data: {
        sha: string;
        from: string;
        to: string;
        changeType: string;
        edgeType: string;
        confidence: number;
        isResolved: number;
      };
    }
  | {
      type: 'commit_metadata';
      data: { sha: string; info: CommitInfo; filesChanged: number };
    }
  | {
      type: 'commit_analysis';
      data: { sha: string; status: string; facts?: CommitFacts };
    }
  | {
      type: 'file';
      data: { sha: string; path: string; status: string; lang?: string };
    }
  | {
      type: 'symbol_version';
      data: {
        dnaId: string;
        sha: string;
        path: string;
        symbolId: string;
        name: string;
        kind: string;
        signatureHash?: string;
        bodyHash?: string;
      };
    }
  | {
      type: 'file_hotspot';
      data: {
        filePath: string;
        sha: string;
        symbolChanges: SymbolInfo[];
        author?: string;
        metrics?: {
          hotspotScore: number;
          riskLevel: 'low' | 'medium' | 'high' | 'critical';
          totalCommits: number;
          totalChanges: number;
          uniqueAuthors: number;
          firstSeenSha?: string;
        };
      };
    }
  | { type: 'symbol_hotspot'; data: { symbols: SymbolInfo[]; sha: string } }
  | {
      type: 'hotspot_snapshot';
      data: {
        sha: string;
        entityType: 'file' | 'symbol';
        entityId: string;
        score: number;
        changes: number;
      };
    }
  | {
      type: 'symbol_lineage';
      data: {
        symbolId: string;
        previousSymbolId: string;
        commitSha: string;
        moveType: string;
      };
    }
  | {
      type: 'hybrid_fact';
      data: {
        filePath: string;
        version: string;
        fact: HybridFact;
        delta: DeltaChange;
        hash: string;
        dnaId: string;
        timeline: Array<{ version: string; dna: string; delta: DeltaChange }>;
      };
    }
  | { type: 'moved_block'; data: MovedBlock }
  | {
      type: 'commit_branch';
      data: { branch: string; sha?: string; isHead: boolean };
    }
  | { type: 'workspace_analysis'; data: WorkspaceFacts };

/**
 * Centralized database write queue for batching all write operations.
 * All components queue their writes here, and they are automatically
 * batched and flushed in transactions.
 */
export class DatabaseWriteQueue {
  private static instance: DatabaseWriteQueue;
  private queues: Map<string, WriteOperation[]> = new Map();
  private totalPending = 0;
  private readonly BATCH_SIZE = 1000; // Increased batch size for better throughput
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly FLUSH_INTERVAL_MS = 2000; // Auto-flush every 2s (more frequent checks)
  private db: any;
  private isFlushing = false;

  private constructor(db?: any) {
    this.db = db;
    this.startAutoFlush();
  }

  static getInstance(db?: any): DatabaseWriteQueue {
    if (!DatabaseWriteQueue.instance) {
      DatabaseWriteQueue.instance = new DatabaseWriteQueue(db);
    } else if (db && !DatabaseWriteQueue.instance.db) {
      DatabaseWriteQueue.instance.setDatabase(db);
    }
    return DatabaseWriteQueue.instance;
  }

  /**
   * Set the database for the write queue
   */
  setDatabase(db: any): void {
    this.db = db;
  }

  /**
   * Get the database, with lazy loading fallback
   */
  private getDb(): any {
    if (!this.db) {
      this.db = getDatabase();
    }
    return this.db;
  }

  /**
   * Queue a write operation (non-blocking)
   */
  queue(operation: WriteOperation): void {
    const queueKey = operation.type;
    if (!this.queues.has(queueKey)) {
      this.queues.set(queueKey, []);
    }
    this.queues.get(queueKey)!.push(operation);
    this.totalPending++;

    // Auto-flush if total batch size reached
    if (this.totalPending >= this.BATCH_SIZE) {
      this.flushAll().catch(err => {
        logWarn(`[DatabaseWriteQueue] Auto-flush error: ${err}`);
      });
    }
  }

  /**
   * Flush all pending writes in a single transaction
   */
  async flushAll(): Promise<void> {
    if (this.isFlushing || this.totalPending === 0) {
      if (this.isFlushing) {
        logDebug('[DatabaseWriteQueue] Flush already in progress, skipping');
      }
      return;
    }

    const pendingBefore = this.totalPending;
    logDebug(`[DatabaseWriteQueue] flushAll called, ${pendingBefore} operations pending`);
    this.isFlushing = true;

    try {
      const db = this.getDb();
      if (!db) {
        logWarn('[DatabaseWriteQueue] Database not initialized');
        return;
      }

      // Collect all operations to flush (up to a limit to prevent event loop blocking)
      // We process ALL queues in ONE transaction to ensure only ONE disk save
      const FLUSH_LIMIT = 5000; // Hard limit per flush cycle
      let processedCount = 0;
      const batches: Map<string, WriteOperation[]> = new Map();

      // Gather batches
      for (const [key, queue] of this.queues) {
        if (queue.length === 0) continue;

        const take = Math.min(queue.length, FLUSH_LIMIT - processedCount);
        if (take <= 0) break;

        const batch = queue.splice(0, take);
        batches.set(key, batch);
        processedCount += take;
        this.totalPending -= take;

        if (processedCount >= FLUSH_LIMIT) break;
      }

      if (processedCount === 0) return;

      // Execute all batches in a single transaction
      db.transaction(() => {
        for (const [key, batch] of batches) {
          try {
            this.executeBatchSync(key, batch);
          } catch (error) {
            logWarn(`[DatabaseWriteQueue] Failed to execute batch for ${key}: ${error}`);
            // We can't easily re-queue inside a transaction without complicating logic
            // Log error and continue (or re-throw to rollback everything)
            // For now, we log and proceed to try to save the rest
          }
        }
      })();

      // Explicitly save after transaction completes
      // The transaction wrapper saves, but we ensure it happens here too
      // Get DatabaseManager through getDatabaseManager
      const { getDatabaseManager } = await import('./database');
      const dbManager = getDatabaseManager();
      if (dbManager) {
        dbManager.save();
        logDebug('[DatabaseWriteQueue] Explicitly saved database after flush');
      }

      // Diagnostic logging
      const typeCounts = new Map<string, number>();
      for (const [key, batch] of batches) {
        typeCounts.set(key, (typeCounts.get(key) || 0) + batch.length);
      }
      logInfo(
        `[DatabaseWriteQueue] Flushed ${processedCount} operations in single transaction: ` +
          `${Array.from(typeCounts.entries())
            .map(([t, c]) => `${t}=${c}`)
            .join(', ')}`
      );

      // If we hit the limit, schedule immediate follow-up flush
      if (this.totalPending > 0) {
        logDebug(
          `[DatabaseWriteQueue] ${this.totalPending} operations still pending, scheduling follow-up flush`
        );
        setImmediate(() => this.flushAll());
      } else {
        logDebug(`[DatabaseWriteQueue] All ${pendingBefore} operations flushed successfully`);
      }
    } catch (error) {
      logWarn(`[DatabaseWriteQueue] Flush failed: ${error}`);
      // In a real robust system, we might want to re-queue these items
      // but for now we rely on the caller to retry if needed or accept loss on crash
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Execute a batch of writes synchronously (called within transaction)
   */
  private executeBatchSync(queueKey: string, batch: WriteOperation[]): void {
    switch (queueKey) {
      case 'blob':
        this.flushBlobs(batch as Array<WriteOperation & { type: 'blob' }>);
        break;
      case 'snapshot':
        this.flushSnapshots(batch as Array<WriteOperation & { type: 'snapshot' }>);
        break;
      case 'structural_diff':
        this.flushStructuralDiffs(batch as Array<WriteOperation & { type: 'structural_diff' }>);
        break;
      case 'symbol':
        this.flushSymbols(batch as Array<WriteOperation & { type: 'symbol' }>);
        break;
      case 'symbol_history':
        this.flushSymbolHistory(batch as Array<WriteOperation & { type: 'symbol_history' }>);
        break;
      case 'edge':
        this.flushEdges(batch as Array<WriteOperation & { type: 'edge' }>);
        break;
      case 'commit_metadata':
        this.flushCommitMetadata(batch as Array<WriteOperation & { type: 'commit_metadata' }>);
        break;
      case 'commit_analysis':
        this.flushCommitAnalysis(batch as Array<WriteOperation & { type: 'commit_analysis' }>);
        break;
      case 'file':
        this.flushFiles(batch as Array<WriteOperation & { type: 'file' }>);
        break;
      case 'symbol_version':
        this.flushSymbolVersions(batch as Array<WriteOperation & { type: 'symbol_version' }>);
        break;
      case 'file_hotspot':
        this.flushFileHotspots(batch as Array<WriteOperation & { type: 'file_hotspot' }>);
        break;
      case 'symbol_hotspot':
        this.flushSymbolHotspots(batch as Array<WriteOperation & { type: 'symbol_hotspot' }>);
        break;
      case 'hotspot_snapshot':
        this.flushHotspotSnapshots(batch as Array<WriteOperation & { type: 'hotspot_snapshot' }>);
        break;
      case 'symbol_lineage':
        this.flushSymbolLineage(batch as Array<WriteOperation & { type: 'symbol_lineage' }>);
        break;
      case 'hybrid_fact':
        this.flushHybridFacts(batch as Array<WriteOperation & { type: 'hybrid_fact' }>);
        break;
      case 'moved_block':
        this.flushMovedBlocks(batch as Array<WriteOperation & { type: 'moved_block' }>);
        break;
      case 'commit_branch':
        this.flushCommitBranches(batch as Array<WriteOperation & { type: 'commit_branch' }>);
        break;
      case 'workspace_analysis':
        this.flushWorkspaceAnalysis(
          batch as Array<WriteOperation & { type: 'workspace_analysis' }>
        );
        break;
      default:
        logWarn(`[DatabaseWriteQueue] Unknown operation type: ${queueKey}`);
    }
  }

  // Individual flush methods for each type

  private flushBlobs(ops: Array<WriteOperation & { type: 'blob' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR IGNORE INTO blob_content (blob_sha, content, size, created_at)
        VALUES (?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        stmt.run([op.data.blobSha, op.data.content, op.data.size, now]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushSnapshots(ops: Array<WriteOperation & { type: 'snapshot' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_snapshots
        (blob_sha, file_path, language, symbols_json, edges_json, shape_hash, body_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        const s = op.data;
        stmt.run([
          s.blobSha,
          s.filePath,
          s.language,
          JSON.stringify(s.symbols),
          JSON.stringify(s.edges),
          s.shapeHash || '',
          s.bodyHash || '',
          now,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushStructuralDiffs(ops: Array<WriteOperation & { type: 'structural_diff' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO structural_diffs
        (parent_blob_sha, current_blob_sha, file_path, structural_change_score,
         control_flow_changed, interface_changed, moved_blocks, lines_added,
         lines_removed, data_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        const d = op.data;
        stmt.run([
          d.parentBlobSha,
          d.currentBlobSha,
          d.filePath,
          d.metrics.structuralChangeScore,
          d.metrics.controlFlowChanged ? 1 : 0,
          d.metrics.interfaceChanged ? 1 : 0,
          d.metrics.movedBlocks,
          d.metrics.linesAdded,
          d.metrics.linesRemoved,
          d.metrics.rawData ? JSON.stringify(d.metrics.rawData) : null,
          now,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushSymbols(ops: Array<WriteOperation & { type: 'symbol' }>): void {
    // Diagnostic logging
    const dnaOps = ops.filter(op => op.data.isDna);
    const symbolOps = ops.filter(op => !op.data.isDna);
    const shaCounts = new Map<string, number>();
    const changeTypeCounts = new Map<string, number>();
    const pathCounts = new Map<string, number>();

    for (const op of symbolOps) {
      shaCounts.set(op.data.sha, (shaCounts.get(op.data.sha) || 0) + 1);
      changeTypeCounts.set(op.data.changeType, (changeTypeCounts.get(op.data.changeType) || 0) + 1);
      pathCounts.set(op.data.path, (pathCounts.get(op.data.path) || 0) + 1);
    }

    logInfo(
      `[DatabaseWriteQueue] flushSymbols: ${dnaOps.length} DNA ops, ${symbolOps.length} symbol ops, ` +
        `SHAs: ${Array.from(shaCounts.entries())
          .map(([s, c]) => `${s.substring(0, 8)}=${c}`)
          .join(', ')}, ` +
        `changeTypes: ${Array.from(changeTypeCounts.entries())
          .map(([t, c]) => `${t}=${c}`)
          .join(', ')}, ` +
        `paths: ${Array.from(pathCounts.entries())
          .slice(0, 5)
          .map(([p, c]) => `${p}=${c}`)
          .join(', ')}${pathCounts.size > 5 ? '...' : ''}`
    );

    // First, handle symbol_dna inserts
    let dnaStmt;
    try {
      dnaStmt = this.db.prepare(`
        INSERT OR IGNORE INTO symbol_dna (dna_id, first_seen_sha, first_seen_path)
        VALUES (?, ?, ?)
      `);
      let dnaInserted = 0;
      for (const op of ops) {
        if (op.data.isDna) {
          try {
            dnaStmt.run([op.data.symbol.id, op.data.sha, op.data.path]);
            dnaInserted++;
          } catch (error) {
            logWarn(`[DatabaseWriteQueue] Failed to insert DNA for ${op.data.symbol.id}: ${error}`);
          }
        }
      }
      logDebug(`[DatabaseWriteQueue] Inserted ${dnaInserted} DNA records`);
    } finally {
      dnaStmt?.free();
    }

    // Then, handle symbols inserts
    let symbolStmt;
    try {
      symbolStmt = this.db.prepare(`
        INSERT OR REPLACE INTO symbols
        (sha, path, symbol_id, dna_id, name, kind, signature, change_type, diff_snippet_pre, diff_snippet_post, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      let symbolsInserted = 0;
      interface InsertAttempt {
        sha: string;
        path: string;
        symbol_id: string;
        dna_id: string;
        name: string;
        kind: string;
        signature: string;
        change_type: string;
        success: boolean;
        error?: string;
      }
      const insertAttempts: InsertAttempt[] = [];

      for (const op of ops) {
        if (!op.data.isDna) {
          const s = op.data.symbol;
          const attempt: InsertAttempt = {
            sha: op.data.sha,
            path: op.data.path,
            symbol_id: s.id,
            dna_id: s.id,
            name: s.name,
            kind: s.kind,
            signature: s.signature || '',
            change_type: op.data.changeType,
            success: false,
          };

          try {
            const result = symbolStmt.run([
              op.data.sha,
              op.data.path,
              s.id, // symbol_id is now the DNA hash
              s.id, // dna_id is the DNA hash
              s.name,
              s.kind,
              s.signature || '',
              op.data.changeType,
              '',
              '',
              1.0,
            ]);
            // Check if insert actually succeeded
            const changes =
              typeof result === 'object' && 'changes' in result ? (result as any).changes : 1;
            if (changes === 0 && op.data.path === 'src/ts/math.ts') {
              attempt.error = 'INSERT returned 0 changes (possible constraint violation)';
              logWarn(
                `[DatabaseWriteQueue] INSERT returned 0 changes for ${s.name} (${s.id}) at ${op.data.path}@${op.data.sha.substring(0, 8)}`
              );
            } else {
              symbolsInserted++;
              attempt.success = true;
            }
          } catch (error: any) {
            attempt.error = error?.message || String(error);
            logWarn(
              `[DatabaseWriteQueue] Failed to insert symbol ${s.name} (${s.id}) at ${op.data.path}@${op.data.sha.substring(0, 8)}: ${error}`
            );
          }

          insertAttempts.push(attempt);
        }
      }

      // Save insert attempts to file for debugging
      if (process.env.GIT_CONTEXT_DEBUG_INSERTS && insertAttempts.length > 0) {
        try {
          const debugDir = path.join(process.cwd(), '.debug');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          const timestamp = Date.now();
          const debugFile = path.join(debugDir, `symbol-inserts-${timestamp}.json`);
          fs.writeFileSync(
            debugFile,
            JSON.stringify(
              {
                timestamp: new Date().toISOString(),
                totalAttempts: insertAttempts.length,
                successful: symbolsInserted,
                failed: insertAttempts.length - symbolsInserted,
                attempts: insertAttempts,
              },
              null,
              2
            )
          );
          logDebug(
            `[DatabaseWriteQueue] Saved ${insertAttempts.length} insert attempts to ${debugFile}`
          );
        } catch (error) {
          // Don't fail if we can't write debug file
          logDebug(`[DatabaseWriteQueue] Failed to save debug file: ${error}`);
        }
      }

      logInfo(`[DatabaseWriteQueue] Inserted ${symbolsInserted} symbol records`);
    } finally {
      symbolStmt?.free();
    }
  }

  private flushSymbolHistory(ops: Array<WriteOperation & { type: 'symbol_history' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT INTO symbol_history
        (symbol_dna_id, sha, file_path, name, kind, signature, body_hash,
         change_type, impact_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        const s = op.data.symbol;
        stmt.run([
          op.data.dnaId,
          op.data.sha,
          op.data.filePath,
          s.name,
          s.kind,
          s.signature,
          s.bodyHash || null,
          op.data.changeType,
          op.data.impactScore,
          now,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushEdges(ops: Array<WriteOperation & { type: 'edge' }>): void {
    // Diagnostic logging
    const shaCounts = new Map<string, number>();
    const changeTypeCounts = new Map<string, number>();
    const edgeTypeCounts = new Map<string, number>();

    for (const op of ops) {
      shaCounts.set(op.data.sha, (shaCounts.get(op.data.sha) || 0) + 1);
      changeTypeCounts.set(op.data.changeType, (changeTypeCounts.get(op.data.changeType) || 0) + 1);
      edgeTypeCounts.set(op.data.edgeType, (edgeTypeCounts.get(op.data.edgeType) || 0) + 1);
    }

    logInfo(
      `[DatabaseWriteQueue] flushEdges: ${ops.length} edges, ` +
        `SHAs: ${Array.from(shaCounts.entries())
          .map(([s, c]) => `${s.substring(0, 8)}=${c}`)
          .join(', ')}, ` +
        `changeTypes: ${Array.from(changeTypeCounts.entries())
          .map(([t, c]) => `${t}=${c}`)
          .join(', ')}, ` +
        `edgeTypes: ${Array.from(edgeTypeCounts.entries())
          .map(([t, c]) => `${t}=${c}`)
          .join(', ')}`
    );

    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO edges
        (sha, from_symbol_id, to_symbol_id, change_type, edge_type, confidence, is_resolved)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      let edgesInserted = 0;
      for (const op of ops) {
        try {
          // Normalize edge IDs to extract DNA hash from path-prefixed format
          // Edges from DependencyExtractor are in format "filePath:dna:hash"
          // Database should store just "dna:hash" to match symbols.dna_id for JOINs
          const normalizedFrom = normalizeEdgeIdForStorage(op.data.from);
          const normalizedTo = normalizeEdgeIdForStorage(op.data.to);

          stmt.run([
            op.data.sha,
            normalizedFrom,
            normalizedTo,
            op.data.changeType,
            op.data.edgeType,
            op.data.confidence,
            op.data.isResolved,
          ]);
          edgesInserted++;
        } catch (error) {
          logWarn(
            `[DatabaseWriteQueue] Failed to insert edge ${op.data.from} -> ${op.data.to} at ${op.data.sha.substring(0, 8)}: ${error}`
          );
        }
      }
      logInfo(`[DatabaseWriteQueue] Inserted ${edgesInserted} edge records`);
    } finally {
      stmt?.free();
    }
  }

  private flushCommitMetadata(ops: Array<WriteOperation & { type: 'commit_metadata' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO commits_metadata
        (sha, author, date, message, parent, files_changed, loaded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        const info = op.data.info;
        stmt.run([
          info.sha,
          info.author,
          info.date,
          info.message,
          info.parent || null,
          op.data.filesChanged,
          now,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushCommitAnalysis(ops: Array<WriteOperation & { type: 'commit_analysis' }>): void {
    let stmt;
    let pendingStmt;
    let failedStmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO commits_analysis
        (sha, status, analysis_version, symbols_added, symbols_modified, symbols_removed,
         edges_added, edges_removed, risks, blast_radius, structural_change_score,
         files_changed, hotspots_json, analyzed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        if (op.data.status === 'pending') {
          if (!pendingStmt) {
            pendingStmt = this.db.prepare(`
              INSERT OR REPLACE INTO commits_analysis
              (sha, status, analysis_version, analyzed_at)
              VALUES (?, ?, ?, ?)
            `);
          }
          pendingStmt.run([op.data.sha, 'pending', ANALYSIS_VERSION, now]);
        } else if (op.data.status === 'complete' && op.data.facts) {
          const facts = op.data.facts;
          stmt.run([
            op.data.sha,
            'complete',
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
            now,
          ]);
        } else if (op.data.status === 'failed') {
          if (!failedStmt) {
            failedStmt = this.db.prepare(`
              INSERT OR REPLACE INTO commits_analysis
              (sha, status, analysis_version, analyzed_at)
              VALUES (?, ?, ?, ?)
            `);
          }
          failedStmt.run([op.data.sha, 'failed', ANALYSIS_VERSION, now]);
        }
      }
    } finally {
      stmt?.free();
      pendingStmt?.free();
      failedStmt?.free();
    }
  }

  private flushFiles(ops: Array<WriteOperation & { type: 'file' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO files (sha, path, status, lang)
        VALUES (?, ?, ?, ?)
      `);
      for (const op of ops) {
        stmt.run([op.data.sha, op.data.path, op.data.status, op.data.lang || null]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushSymbolVersions(ops: Array<WriteOperation & { type: 'symbol_version' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO symbol_versions (dna_id, sha, path, symbol_id, name, kind, signature_hash, body_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const op of ops) {
        stmt.run([
          op.data.dnaId,
          op.data.sha,
          op.data.path,
          op.data.symbolId,
          op.data.name,
          op.data.kind,
          op.data.signatureHash || null,
          op.data.bodyHash || null,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushFileHotspots(ops: Array<WriteOperation & { type: 'file_hotspot' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_hotspots
        (file_path, total_commits, total_changes, unique_authors,
         last_changed_sha, last_changed_date, hotspot_score,
         first_seen_sha, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        const metrics = op.data.metrics;
        if (!metrics) {
          logWarn(`[DatabaseWriteQueue] File hotspot missing metrics for ${op.data.filePath}`);
          continue;
        }
        stmt.run([
          op.data.filePath,
          metrics.totalCommits,
          metrics.totalChanges,
          metrics.uniqueAuthors,
          op.data.sha,
          now,
          metrics.hotspotScore,
          metrics.firstSeenSha || op.data.sha,
          metrics.riskLevel,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushSymbolHotspots(_ops: Array<WriteOperation & { type: 'symbol_hotspot' }>): void {
    // This is handled by HotspotDetector.batchUpdateSymbols which already batches
    // We'll queue individual symbol updates here
    logDebug(
      `[DatabaseWriteQueue] Symbol hotspot updates are handled by HotspotDetector.batchUpdateSymbols`
    );
  }

  private flushHotspotSnapshots(ops: Array<WriteOperation & { type: 'hotspot_snapshot' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT INTO hotspot_snapshots
        (snapshot_sha, snapshot_date, entity_type, entity_id, hotspot_score, total_changes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();
      for (const op of ops) {
        stmt.run([
          op.data.sha,
          now,
          op.data.entityType,
          op.data.entityId,
          op.data.score,
          op.data.changes,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushSymbolLineage(ops: Array<WriteOperation & { type: 'symbol_lineage' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT INTO symbol_lineage (symbol_id, previous_symbol_id, commit_sha, move_type)
        VALUES (?, ?, ?, ?)
      `);
      for (const op of ops) {
        stmt.run([op.data.symbolId, op.data.previousSymbolId, op.data.commitSha, op.data.moveType]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushHybridFacts(ops: Array<WriteOperation & { type: 'hybrid_fact' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO hybrid_facts
        (file_path, version, fact_id, dna_id, serialized_fact, timeline_json, hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();

      for (const op of ops) {
        // DNA and timeline are pre-computed by caller (CstTimelineManager)
        stmt.run([
          op.data.filePath,
          op.data.version,
          op.data.fact.id,
          op.data.dnaId,
          JSON.stringify(op.data.fact),
          JSON.stringify(op.data.timeline),
          op.data.hash,
          now,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushMovedBlocks(ops: Array<WriteOperation & { type: 'moved_block' }>): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT INTO moved_blocks (
          commit_sha, source_file, source_symbol_id, source_start_line, source_end_line,
          source_content_hash, dest_file, dest_symbol_id, dest_start_line, dest_end_line,
          dest_content_hash, similarity_score, block_type, move_reason, line_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const op of ops) {
        const block = op.data;
        stmt.run([
          block.commitSha,
          block.sourceFile,
          block.sourceSymbolId || null,
          block.sourceStartLine,
          block.sourceEndLine,
          block.sourceContentHash,
          block.destFile,
          block.destSymbolId || null,
          block.destStartLine,
          block.destEndLine,
          block.destContentHash,
          block.similarityScore,
          block.blockType,
          block.moveReason,
          block.lineCount,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private flushCommitBranches(ops: Array<WriteOperation & { type: 'commit_branch' }>): void {
    // First, set all branches to is_head = 0 for the affected branches
    const branchesToUpdate = new Set(ops.map(op => op.data.branch));
    for (const branch of branchesToUpdate) {
      let clearStmt;
      try {
        clearStmt = this.db.prepare(`UPDATE commit_branches SET is_head = 0 WHERE branch = ?`);
        clearStmt.run(branch);
      } finally {
        clearStmt?.free();
      }
    }

    // Then, set the new head commits
    let setHeadStmt;
    try {
      setHeadStmt = this.db.prepare(
        `UPDATE commit_branches SET is_head = 1 WHERE sha = ? AND branch = ?`
      );
      for (const op of ops) {
        if (op.data.isHead && op.data.sha) {
          setHeadStmt.run(op.data.sha, op.data.branch);
        }
      }
    } finally {
      setHeadStmt?.free();
    }
  }

  private flushWorkspaceAnalysis(
    ops: Array<WriteOperation & { type: 'workspace_analysis' }>
  ): void {
    let stmt;
    try {
      stmt = this.db.prepare(`
        INSERT OR REPLACE INTO workspace_analysis
        (head_sha, workspace_hash, symbols_added, symbols_modified, symbols_removed,
         edges_added, edges_removed, risks, files_changed, structural_change_score,
         blast_radius, analyzed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = new Date().toISOString();

      for (const op of ops) {
        const facts = op.data;
        stmt.run([
          facts.headSha,
          facts.workspaceHash,
          facts.symbolsAdded,
          facts.symbolsModified,
          facts.symbolsRemoved,
          facts.edgesAdded,
          facts.edgesRemoved,
          JSON.stringify(facts.risks),
          facts.filesChanged,
          facts.structuralChangeScore,
          facts.blastRadius,
          now,
        ]);
      }
    } finally {
      stmt?.free();
    }
  }

  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushAll().catch(err => {
        logWarn(`[DatabaseWriteQueue] Auto-flush error: ${err}`);
      });
    }, this.FLUSH_INTERVAL_MS);
  }

  /**
   * Destroy the queue and flush all pending writes
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flushAll();
  }

  /**
   * Get queue statistics for debugging
   */
  getStats(): { [key: string]: number } {
    const stats: { [key: string]: number } = {};
    for (const [key, queue] of this.queues) {
      stats[key] = queue.length;
    }
    return stats;
  }
}
