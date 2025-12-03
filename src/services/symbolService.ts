import { ensureDatabaseInitialized } from '../storage/database';
import { prepare } from '../storage/statement-wrapper';
import type { SymbolInfo } from '../types';
import { logDebug } from '../utils/logger';
import { ServiceBase, ServiceConfig } from './base/ServiceBase';
import type { SymbolHistory, SymbolWithDNA } from './databaseService';

/**
 * Specialized service for symbol database operations
 * Extends ServiceBase with symbol-specific caching and operations
 */
export class SymbolService extends ServiceBase {
  constructor(config: ServiceConfig = {}) {
    super({
      enableCache: true,
      cacheSize: 2000,
      cacheTTL: 1800000,
      enableTransactions: true,
      ...config,
    });
  }

  /**
   * Get symbols by their stable DNA hash
   * Used for tracking symbol evolution across renames/commits
   */
  async getSymbolsByDNA(dnaHash: string): Promise<SymbolWithDNA[]> {
    return this.queryWithCache(`symbols_dna_${dnaHash}`, async () => {
      try {
        await ensureDatabaseInitialized();

        const stmt = prepare(`
          SELECT s.*, sv.dna_id as dna, sv.sha, sv.path, sv.name, sv.kind,
                 sv.signature_hash, sv.body_hash,
                 ROW_NUMBER() OVER (PARTITION BY sv.dna_id ORDER BY sv.sha DESC) as rn
          FROM symbol_versions sv
          JOIN symbols s ON sv.sha = s.sha AND sv.symbol_id = s.symbol_id
          WHERE sv.dna_id = ?
        `);

        const results = stmt.all(dnaHash) as any[];
        stmt.free?.();

        return results
          .filter(row => row.rn === 1)
          .map(row => ({
            id: row.symbol_id,
            dnaId: row.dna_id,
            semanticId: row.semantic_id,
            name: row.name,
            kind: row.kind as SymbolInfo['kind'],
            signature: row.signature,
            bodyHash: row.body_hash,
            location: {
              start: {
                line: row.start_line || 0,
                column: row.start_column || 0,
              },
              end: { line: row.end_line || 0, column: row.end_column || 0 },
            },
            dna: row.dna,
          }));
      } catch (error) {
        this.handleDbError(error, 'getSymbolsByDNA');
        return [];
      }
    });
  }

  /**
   * Get all symbols for a specific commit
   * Used for commit analysis and symbol extraction
   */
  async getSymbolsByCommit(sha: string): Promise<SymbolInfo[]> {
    return this.queryWithCache(`symbols_commit_${sha}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM symbols WHERE sha = ?');
        const results = stmt.all(sha) as any[];
        stmt.free?.();

        return results.map(row => ({
          id: row.symbol_id,
          dnaId: row.dna_id,
          semanticId: row.semantic_id,
          name: row.name,
          kind: row.kind as SymbolInfo['kind'],
          signature: row.signature,
          bodyHash: row.body_hash,
          location: {
            start: { line: row.start_line || 0, column: row.start_column || 0 },
            end: { line: row.end_line || 0, column: row.end_column || 0 },
          },
        }));
      } catch (error) {
        this.handleDbError(error, 'getSymbolsByCommit');
        return [];
      }
    });
  }

  /**
   * Get complete history of a symbol by its DNA ID
   * Shows how a symbol has evolved over time
   */
  async getSymbolHistory(dnaId: string): Promise<SymbolHistory[]> {
    return this.queryWithCache(`symbol_history_${dnaId}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare(`
          SELECT * FROM symbol_history
          WHERE symbol_dna_id = ?
          ORDER BY created_at DESC
        `);
        const results = stmt.all(dnaId) as any[];
        stmt.free?.();

        return results.map(row => ({
          symbol_dna_id: row.symbol_dna_id,
          sha: row.sha,
          file_path: row.file_path,
          name: row.name,
          kind: row.kind,
          signature: row.signature,
          body_hash: row.body_hash,
          change_type: row.change_type,
          impact_score: row.impact_score,
          created_at: row.created_at,
        }));
      } catch (error) {
        this.handleDbError(error, 'getSymbolHistory');
        return [];
      }
    });
  }

  /**
   * Find symbols by name pattern across all commits
   * Useful for symbol search and refactoring analysis
   */
  async findSymbolsByName(namePattern: string, limit = 50): Promise<SymbolWithDNA[]> {
    const cacheKey = `symbols_name_${namePattern}_${limit}`;
    return this.queryWithCache(cacheKey, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare(`
          SELECT DISTINCT s.*, sv.dna_id as dna
          FROM symbols s
          JOIN symbol_versions sv ON s.sha = sv.sha AND s.symbol_id = sv.symbol_id
          WHERE s.name LIKE ?
          ORDER BY s.name
          LIMIT ?
        `);

        const results = stmt.all(`%${namePattern}%`, limit) as any[];
        stmt.free?.();

        return results.map(row => ({
          id: row.symbol_id,
          dnaId: row.dna_id,
          semanticId: row.semantic_id,
          name: row.name,
          kind: row.kind as SymbolInfo['kind'],
          signature: row.signature,
          bodyHash: row.body_hash,
          location: {
            start: { line: row.start_line || 0, column: row.start_column || 0 },
            end: { line: row.end_line || 0, column: row.end_column || 0 },
          },
          dna: row.dna,
        }));
      } catch (error) {
        this.handleDbError(error, 'findSymbolsByName');
        return [];
      }
    });
  }

  /**
   * Get symbols that have been modified in recent commits
   * Useful for identifying active development areas
   */
  async getRecentlyModifiedSymbols(commitCount = 10): Promise<SymbolWithDNA[]> {
    return this.queryWithCache(`symbols_recent_${commitCount}`, async () => {
      try {
        await ensureDatabaseInitialized();

        const commitStmt = prepare(`
          SELECT sha FROM commits_metadata
          ORDER BY date DESC
          LIMIT ?
        `);
        const commits = commitStmt.all(commitCount) as { sha: string }[];
        commitStmt.free?.();

        if (commits.length === 0) return [];

        const shaList = commits.map(c => c.sha);
        const placeholders = shaList.map(() => '?').join(',');

        const symbolStmt = prepare(`
          SELECT DISTINCT s.*, sv.dna_id as dna
          FROM symbols s
          JOIN symbol_versions sv ON s.sha = sv.sha AND s.symbol_id = sv.symbol_id
          WHERE s.sha IN (${placeholders})
          ORDER BY s.name
        `);

        const results = symbolStmt.all(...shaList) as any[];
        symbolStmt.free?.();

        return results.map(row => ({
          id: row.symbol_id,
          dnaId: row.dna_id,
          semanticId: row.semantic_id,
          name: row.name,
          kind: row.kind as SymbolInfo['kind'],
          signature: row.signature,
          bodyHash: row.body_hash,
          location: {
            start: { line: row.start_line || 0, column: row.start_column || 0 },
            end: { line: row.end_line || 0, column: row.end_column || 0 },
          },
          dna: row.dna,
        }));
      } catch (error) {
        this.handleDbError(error, 'getRecentlyModifiedSymbols');
        return [];
      }
    });
  }

  /**
   * Store symbol history records
   * Used during commit indexing to track symbol evolution
   */
  async storeSymbolHistory(history: SymbolHistory[]): Promise<void> {
    await this.executeInTransaction(async () => {
      try {
        const stmt = prepare(`
          INSERT OR IGNORE INTO symbol_history
          (symbol_dna_id, sha, file_path, name, kind, signature, body_hash, change_type, impact_score, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of history) {
          stmt.run(
            item.symbol_dna_id,
            item.sha,
            item.file_path,
            item.name,
            item.kind,
            item.signature,
            item.body_hash,
            item.change_type,
            item.impact_score,
            item.created_at
          );
        }
        stmt.free?.();

        logDebug(`[SymbolService] Stored ${history.length} symbol history records`);
      } catch (error) {
        this.handleDbError(error, 'storeSymbolHistory');
      }
    });
  }

  async getSymbolStats(): Promise<{
    totalSymbols: number;
    uniqueDNA: number;
    mostCommonKinds: Array<{ kind: string; count: number }>;
  }> {
    return this.queryWithCache('symbol_stats', async () => {
      try {
        await ensureDatabaseInitialized();

        const totalStmt = prepare('SELECT COUNT(*) as count FROM symbols');
        const total = (totalStmt.get() as { count: number }).count;
        totalStmt.free?.();

        const dnaStmt = prepare('SELECT COUNT(DISTINCT dna_id) as count FROM symbol_versions');
        const dna = (dnaStmt.get() as { count: number }).count;
        dnaStmt.free?.();

        const kindsStmt = prepare(`
          SELECT kind, COUNT(*) as count
          FROM symbols
          GROUP BY kind
          ORDER BY count DESC
          LIMIT 10
        `);
        const kinds = kindsStmt.all() as Array<{ kind: string; count: number }>;
        kindsStmt.free?.();

        return {
          totalSymbols: total,
          uniqueDNA: dna,
          mostCommonKinds: kinds,
        };
      } catch (error) {
        this.handleDbError(error, 'getSymbolStats');
        return { totalSymbols: 0, uniqueDNA: 0, mostCommonKinds: [] };
      }
    });
  }
}

let symbolServiceInstance: SymbolService | null = null;

export function getSymbolService(): SymbolService {
  if (!symbolServiceInstance) {
    symbolServiceInstance = new SymbolService();
  }
  return symbolServiceInstance;
}
