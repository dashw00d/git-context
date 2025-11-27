import { Database } from 'sql.js';
import { SymbolInfo, EdgeInfo } from '../types';
import { SymbolExtractor } from './symbols';
import { DependencyExtractor } from './dependencies';
import { assignDNAIds, computeBodyHash } from './symbolDna';
import { logDebug } from '../utils/logger';

export interface FileSnapshot {
  blobSha: string;
  filePath: string;
  language: string;
  symbols: SymbolInfo[];
  edges: EdgeInfo[];
  shapeHash?: string;
  bodyHash?: string;
}

export class SnapshotManager {
  constructor(
    private db: Database,
    private symbolExtractor: SymbolExtractor,
    private dependencyExtractor: DependencyExtractor
  ) {}

  /**
   * Get or create snapshot for a blob (content-addressed caching)
   */
  async getOrCreateSnapshot(
    filePath: string,
    blobSha: string,
    content: string
  ): Promise<FileSnapshot> {
    // Check cache
    const cached = this.getCachedSnapshot(blobSha, filePath);
    if (cached) {
      logDebug(`[Snapshot] Cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
      return cached;
    }

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
    const symbolsWithDNA = assignDNAIds(symbols, bodyTexts);

    const edges = this.dependencyExtractor.extractDependencies(
      content,
      filePath,
      symbolsWithDNA
    );

    const shapeHash = this.computeShapeHash(symbolsWithDNA);
    const bodyHash = this.computeAggregateBodyHash(symbolsWithDNA);

    const snapshot: FileSnapshot = {
      blobSha,
      filePath,
      language,
      symbols: symbolsWithDNA,
      edges,
      shapeHash,
      bodyHash
    };

    // Store to cache
    this.storeSnapshot(snapshot);

    return snapshot;
  }

  private getCachedSnapshot(blobSha: string, filePath: string): FileSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM file_snapshots
      WHERE blob_sha = ? AND file_path = ?
    `);
    const row = stmt.get([blobSha, filePath]) as any;
    if (!row) return null;

    return {
      blobSha: row.blob_sha,
      filePath: row.file_path,
      language: row.language,
      symbols: JSON.parse(row.symbols_json),
      edges: JSON.parse(row.edges_json),
      shapeHash: row.shape_hash,
      bodyHash: row.body_hash
    };
  }

  private storeSnapshot(snapshot: FileSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_snapshots
      (blob_sha, file_path, language, symbols_json, edges_json, shape_hash, body_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      snapshot.blobSha,
      snapshot.filePath,
      snapshot.language,
      JSON.stringify(snapshot.symbols),
      JSON.stringify(snapshot.edges),
      snapshot.shapeHash || '',
      snapshot.bodyHash || '',
      new Date().toISOString()
    ]);
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'php':
        return 'php';
      default:
        return 'unknown';
    }
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
    return crypto.createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 16);
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
    modified: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo; changeType: 'signature' | 'body' | 'both' }>;
    renamed: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo }>;
  } {
    const parentSymbols = parentSnapshot?.symbols || [];
    const currentSymbols = currentSnapshot.symbols;

    // Map by DNA ID (stable across renames)
    const parentByDNA = new Map(parentSymbols.map(s => [s.dnaId, s]));
    const currentByDNA = new Map(currentSymbols.map(s => [s.dnaId, s]));

    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo; changeType: 'signature' | 'body' | 'both' }> = [];
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
          const changeType = sigChanged && bodyChanged ? 'both'
            : sigChanged ? 'signature'
            : 'body';

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
}
