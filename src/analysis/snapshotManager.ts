import { LRUCache } from 'lru-cache';
import { prepare } from '../storage/statement-wrapper';
import { EdgeInfo, SymbolInfo } from '../types';
import { detectLanguage, getExtensionConfig } from '../utils/config';
import { logDebug } from '../utils/logger';
import { DependencyExtractor } from './dependencies';
import { assignDNAIds_v2 } from './symbolDna';
import { SymbolExtractor } from './symbols';

export interface FileSnapshot {
  blobSha: string;
  filePath: string;
  language: string;
  symbols: SymbolInfo[];
  edges: EdgeInfo[];
  shapeHash?: string;
  bodyHash?: string;
  _cacheSize?: number; // Internal: cached serialized size for LRU cache performance
}

export class SnapshotManager {
  private snapshotCache: LRUCache<string, FileSnapshot> | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private writeQueue: FileSnapshot[] = [];
  private readonly BATCH_SIZE = 50;

  constructor(
    private db: any,
    private symbolExtractor: SymbolExtractor,
    private dependencyExtractor: DependencyExtractor
  ) {
    const config = getExtensionConfig();
    if (config.snapshotCacheEnabled !== false) {
      this.initCache();
    }
  }

  private initCache(): void {
    if (!this.snapshotCache) {
      const config = getExtensionConfig();
      if (config.snapshotCacheEnabled === false) {
        return; // Cache is disabled, don't create it
      }
      this.snapshotCache = new LRUCache<string, FileSnapshot>({
        max: config.snapshotCacheSize || 1000, // Increased from 50 to 1000
        ttl: (config.snapshotCacheTTL || 3600) * 1000, // Convert seconds to milliseconds
        updateAgeOnGet: true, // Promote on access (LRU behavior)
        sizeCalculation: (value: FileSnapshot, key: string) => {
          // Use cached size if available (calculated once on creation/load)
          // Fallback to key length + 100KB estimate if missing (defensive)
          return key.length + (value._cacheSize || 100000);
        },
        maxSize: 100 * 1024 * 1024, // 100MB total (increased from 10MB to allow 500+ snapshots)
        dispose: (value: FileSnapshot, key: string) => {
          // Use cached size instead of recalculating
          const size = value._cacheSize || 0;
          logDebug(`[Snapshot] Evicted ${key.substring(0, 20)}... (size: ${size}B)`);
        },
      });
    }
  }

  /**
   * Clear the cache (useful for error recovery or reset)
   */
  clearCache(): void {
    this.snapshotCache?.clear();
    this.snapshotCache = null;
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
   * Get or create snapshot for a blob (content-addressed caching)
   */
  async getOrCreateSnapshot(
    filePath: string,
    blobSha: string,
    content: string
  ): Promise<FileSnapshot> {
    // Check LRU cache first
    const cacheKey = `${blobSha}:${filePath}`;
    this.initCache();
    const lruCached = this.snapshotCache?.get(cacheKey);
    if (lruCached) {
      logDebug(`[Snapshot] LRU cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
      this.cacheHits++;
      return lruCached;
    }

    // Check database cache
    const cached = this.getCachedSnapshot(blobSha, filePath);
    if (cached) {
      logDebug(`[Snapshot] DB cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
      this.cacheHits++;
      // Also cache in LRU for faster access
      this.snapshotCache?.set(cacheKey, cached);
      return cached;
    }

    this.cacheMisses++;

    // Parse with Tree-sitter
    logDebug(`[Snapshot] Creating snapshot for ${filePath}@${blobSha.substring(0, 8)}`);
    const language = this.detectLanguage(filePath);

    // Extract symbols WITH body text
    const { symbols, bodyTexts } = await this.symbolExtractor.extractSymbolsWithBodies(
      content,
      filePath,
      language
    );

    // Assign DNA IDs
    const symbolsWithDNA = await assignDNAIds_v2(symbols, bodyTexts, language);

    const edges = this.dependencyExtractor.extractDependencies(content, filePath, symbolsWithDNA);

    const shapeHash = this.computeShapeHash(symbolsWithDNA);
    const bodyHash = this.computeAggregateBodyHash(symbolsWithDNA);

    const snapshot: FileSnapshot = {
      blobSha,
      filePath,
      language,
      symbols: symbolsWithDNA,
      edges,
      shapeHash,
      bodyHash,
    };

    // Calculate and cache serialized size once (for LRU cache performance)
    snapshot._cacheSize = JSON.stringify(snapshot).length;

    // Queue for batch write
    this.queueSnapshot(snapshot);

    // Also cache in LRU cache for faster access
    const lruCacheKey = `${blobSha}:${filePath}`;
    this.snapshotCache?.set(lruCacheKey, snapshot);

    return snapshot;
  }

  /**
   * Flush any pending snapshot writes (call at end of processing)
   */
  flushSnapshotQueue(): void {
    while (this.writeQueue.length > 0) {
      this.flushSnapshotQueueInternal();
    }
  }

  private getCachedSnapshot(blobSha: string, filePath: string): FileSnapshot | null {
    const stmt = prepare(`
      SELECT * FROM file_snapshots
      WHERE blob_sha = ? AND file_path = ?
    `);
    const row = stmt.get([blobSha, filePath]) as any;
    if (!row) return null;

    const snapshot: FileSnapshot = {
      blobSha: row.blob_sha,
      filePath: row.file_path,
      language: row.language,
      symbols: JSON.parse(row.symbols_json),
      edges: JSON.parse(row.edges_json),
      shapeHash: row.shape_hash,
      bodyHash: row.body_hash,
    };

    // Calculate and cache serialized size once (for LRU cache performance)
    snapshot._cacheSize = JSON.stringify(snapshot).length;

    return snapshot;
  }

  private queueSnapshot(snapshot: FileSnapshot): void {
    this.writeQueue.push(snapshot);
    if (this.writeQueue.length >= this.BATCH_SIZE) {
      this.flushSnapshotQueueInternal();
    }
  }

  private flushSnapshotQueueInternal(): void {
    if (this.writeQueue.length === 0) return;
    const batch = this.writeQueue.splice(0, this.BATCH_SIZE);

    // Get wrapped database with transaction support
    const stmt = prepare(`
      INSERT OR REPLACE INTO file_snapshots
      (blob_sha, file_path, language, symbols_json, edges_json, shape_hash, body_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();

    // Use transaction wrapper instead of manual BEGIN/COMMIT
    this.db.transaction(() => {
      for (const snapshot of batch) {
        stmt.run([
          snapshot.blobSha,
          snapshot.filePath,
          snapshot.language,
          JSON.stringify(snapshot.symbols),
          JSON.stringify(snapshot.edges),
          snapshot.shapeHash || '',
          snapshot.bodyHash || '',
          now,
        ]);
      }
    })();

    logDebug(`[SnapshotManager] Batched ${batch.length} snapshot writes`);
  }

  private storeSnapshot(snapshot: FileSnapshot): void {
    // Legacy method - use queueSnapshot instead
    this.queueSnapshot(snapshot);
  }

  private detectLanguage(filePath: string): string {
    return detectLanguage(filePath) || 'unknown';
  }

  private computeShapeHash(symbols: SymbolInfo[]): string {
    // Simple shape hash: serialize kind + signature (ignore names)
    const shape = symbols
      .map(s => `${s.kind}:${s.signature}`)
      .sort()
      .join('|');
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(shape).digest('hex').substring(0, 16);
  }

  private computeAggregateBodyHash(symbols: SymbolInfo[]): string {
    const combined = symbols
      .map(s => s.bodyHash || '')
      .filter(Boolean)
      .sort()
      .join('|');

    const crypto = require('crypto');
    return crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
  }

  /**
   * Compare snapshots using DNA IDs (handles renames)
   */
  compareSnapshots(
    parentSnapshot: FileSnapshot | null,
    currentSnapshot: FileSnapshot
  ): {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: Array<{
      symbol: SymbolInfo;
      previousSymbol: SymbolInfo;
      changeType: 'signature' | 'body' | 'both';
    }>;
    renamed: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo }>;
  } {
    const parentSymbols = parentSnapshot?.symbols || [];
    const currentSymbols = currentSnapshot.symbols;

    // Map by DNA ID (stable across renames)
    const parentByDNA = new Map(parentSymbols.map(s => [s.dnaId, s]));
    const currentByDNA = new Map(currentSymbols.map(s => [s.dnaId, s]));

    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: Array<{
      symbol: SymbolInfo;
      previousSymbol: SymbolInfo;
      changeType: 'signature' | 'body' | 'both';
    }> = [];
    const renamed: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo }> = [];

    // Find added and modified (by DNA)
    for (const symbol of currentSymbols) {
      const prev = parentByDNA.get(symbol.dnaId);

      if (!prev) {
        added.push(symbol);
      } else {
        // Same DNA - check for modifications
        const sigChanged = prev.signature !== symbol.signature;
        const bodyChanged = prev.bodyHash !== symbol.bodyHash;
        const nameChanged = prev.name !== symbol.name;

        if (nameChanged && !sigChanged && !bodyChanged) {
          // Pure rename (same signature + body, different name)
          renamed.push({ symbol, previousSymbol: prev });
        } else if (sigChanged || bodyChanged) {
          // Modified
          const changeType = sigChanged && bodyChanged ? 'both' : sigChanged ? 'signature' : 'body';

          modified.push({ symbol, previousSymbol: prev, changeType });
        }
        // else: no change (same name, signature, body)
      }
    }

    // Find removed (by DNA)
    for (const symbol of parentSymbols) {
      if (!currentByDNA.has(symbol.dnaId)) {
        removed.push(symbol);
      }
    }

    return { added, removed, modified, renamed };
  }
  /**
   * Helper to read file content from disk
   */
  async getFileContent(filePath: string): Promise<string | null> {
    try {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      return null;
    } catch (e) {
      return null;
    }
  }
}
