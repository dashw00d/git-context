import { LRUCache } from 'lru-cache';
import { DatabaseWriteQueue } from '../storage/databaseWriteQueue';
import { prepare } from '../storage/statement-wrapper';
import { EdgeInfo, SymbolInfo } from '../types';
import { detectLanguage, getExtensionConfig } from '../utils/config';
import { logDebug } from '../utils/logger';
import { DependencyExtractor } from './dependencies';
import { assignDNAIds } from './symbolDna';
import { SymbolExtractor } from './symbols';

export interface FileSnapshot {
  blobSha: string;
  filePath: string;
  language: string;
  symbols: SymbolInfo[];
  edges: EdgeInfo[];
  shapeHash?: string;
  bodyHash?: string;
  _cacheSize?: number;
}

export class SnapshotManager {
  private snapshotCache: LRUCache<string, FileSnapshot> | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;
  private writeQueue = DatabaseWriteQueue.getInstance();

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
        return;
      }
      this.snapshotCache = new LRUCache<string, FileSnapshot>({
        max: config.snapshotCacheSize || 1000,
        ttl: (config.snapshotCacheTTL || 3600) * 1000,
        updateAgeOnGet: true,
        sizeCalculation: (value: FileSnapshot, key: string) => {
          return key.length + (value._cacheSize || 100000);
        },
        maxSize: 100 * 1024 * 1024,
        dispose: (value: FileSnapshot, key: string) => {
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
    const cacheKey = `${blobSha}:${filePath}`;
    this.initCache();
    const lruCached = this.snapshotCache?.get(cacheKey);
    if (lruCached) {
      logDebug(`[Snapshot] LRU cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
      this.cacheHits++;
      return lruCached;
    }

    const cached = this.getCachedSnapshot(blobSha, filePath);
    if (cached) {
      logDebug(`[Snapshot] DB cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
      this.cacheHits++;

      this.snapshotCache?.set(cacheKey, cached);
      return cached;
    }

    this.cacheMisses++;

    logDebug(`[Snapshot] Creating snapshot for ${filePath}@${blobSha.substring(0, 8)}`);
    const language = this.detectLanguage(filePath);
    logDebug(`[Snapshot] Detected language: ${language} for ${filePath}`);

    const { symbols, bodyTexts } = await this.symbolExtractor.extractSymbolsWithBodies(
      content,
      filePath,
      language
    );
    logDebug(`[Snapshot] Extracted ${symbols.length} symbols and ${bodyTexts.length} body texts for ${filePath}`);

    const symbolsWithDNA = await assignDNAIds(symbols, bodyTexts, language);
    logDebug(`[Snapshot] Assigned DNA IDs to ${symbolsWithDNA.length} symbols for ${filePath}`);

    const edges = this.dependencyExtractor.extractDependencies(content, filePath, symbolsWithDNA);
    logDebug(`[Snapshot] Extracted ${edges.length} edges for ${filePath}`);

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

    snapshot._cacheSize = JSON.stringify(snapshot).length;

    // Queue snapshot for batch write
    this.writeQueue.queue({ type: 'snapshot', data: snapshot });

    const lruCacheKey = `${blobSha}:${filePath}`;
    this.snapshotCache?.set(lruCacheKey, snapshot);

    return snapshot;
  }

  /**
   * Flush any pending snapshot writes (call at end of processing)
   * Now handled by centralized DatabaseWriteQueue
   */
  flushSnapshotQueue(): void {
    // No-op: flushing is handled by DatabaseWriteQueue.flushAll()
    // Kept for backward compatibility
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

    snapshot._cacheSize = JSON.stringify(snapshot).length;

    return snapshot;
  }

  private detectLanguage(filePath: string): string {
    return detectLanguage(filePath) || 'unknown';
  }

  private computeShapeHash(symbols: SymbolInfo[]): string {
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

    const parentByDNA = new Map(parentSymbols.map(s => [s.id, s])); // id is now the DNA hash
    const currentByDNA = new Map(currentSymbols.map(s => [s.id, s])); // id is now the DNA hash

    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: Array<{
      symbol: SymbolInfo;
      previousSymbol: SymbolInfo;
      changeType: 'signature' | 'body' | 'both';
    }> = [];
    const renamed: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo }> = [];

    for (const symbol of currentSymbols) {
      const prev = parentByDNA.get(symbol.id); // id is now the DNA hash

      if (!prev) {
        added.push(symbol);
      } else {
        const sigChanged = prev.signature !== symbol.signature;
        const bodyChanged = prev.bodyHash !== symbol.bodyHash;
        const nameChanged = prev.name !== symbol.name;

        if (nameChanged && !sigChanged && !bodyChanged) {
          renamed.push({ symbol, previousSymbol: prev });
        } else if (sigChanged || bodyChanged) {
          const changeType = sigChanged && bodyChanged ? 'both' : sigChanged ? 'signature' : 'body';

          modified.push({ symbol, previousSymbol: prev, changeType });
        }
      }
    }

    for (const symbol of parentSymbols) {
      if (!currentByDNA.has(symbol.id)) {
        // id is now the DNA hash
        removed.push(symbol);
      }
    }

    return { added, removed, modified, renamed };
  }

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
