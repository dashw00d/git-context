import { ensureDatabaseInitialized } from '../storage/database';
import { prepare } from '../storage/statement-wrapper';
import { logError } from '../utils/logger';
import { ServiceBase, ServiceConfig } from './base/ServiceBase';
import type { MovedBlock } from '../analysis/movedBlockDetector';
import type { Hotspot } from '../contracts/llmContext';
import type {
  CommitListItem,
  CommitMetadata,
  CommitSearchOptions,
} from '../services/commitService';
import type { EdgeInfo, SymbolInfo } from '../types';

export interface SymbolWithDNA extends SymbolInfo {
  dna: string;
}

export interface SymbolHistory {
  symbol_dna_id: string;
  sha: string;
  file_path: string;
  name: string;
  kind: string;
  signature: string;
  body_hash: string;
  change_type: string;
  impact_score: number;
  created_at: string;
}

export interface CommitFacts {
  sha: string;
  fact_type: string;
  data: any;
}

/**
 * Centralized database service extending ServiceBase with caching and error handling
 * Consolidates all database operations across commits, symbols, edges, hotspots, and moved blocks
 */
export class DatabaseService extends ServiceBase {
  constructor(config: ServiceConfig = {}) {
    super(config);
  }

  async getCommitMetadata(sha: string): Promise<CommitMetadata | null> {
    return this.queryWithCache(`commit_meta_${sha}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM commits_metadata WHERE sha = ?');
        const result = stmt.get(sha) as any;
        stmt.free?.();

        if (!result) {
          return null;
        }

        return {
          sha: result.sha,
          author: result.author,
          date: new Date(result.date),
          message: result.message,
          parent: result.parent,
          filesChanged: result.files_changed,
        };
      } catch (error) {
        logError(`Failed to get commit metadata for ${sha}`, error);
        return null;
      }
    });
  }

  async getRecentCommits(limit = 20, offset = 0): Promise<CommitListItem[]> {
    return this.queryWithCache(`commits_recent_${limit}_${offset}`, async () => {
      try {
        await ensureDatabaseInitialized();

        const stmt = prepare(`
      SELECT m.sha, m.author, m.date, m.message,
             COALESCE(a.symbols_added, 0) + COALESCE(a.symbols_modified, 0) + COALESCE(a.symbols_removed, 0) as changes
      FROM commits_metadata m
      LEFT JOIN commits_analysis a ON m.sha = a.sha
      ORDER BY m.date DESC
      LIMIT ? OFFSET ?
        `);

        const commits = stmt.all(limit, offset) as any[];
        stmt.free?.();

        return commits.map(c => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          date: new Date(c.date),
          changes: c.changes || 0,
        }));
      } catch (error) {
        logError('Failed to get recent commits', error);
        return [];
      }
    });
  }

  async countCommits(): Promise<number> {
    return this.queryWithCache('commits_count', async () => {
      try {
        await ensureDatabaseInitialized();
        const result = prepare('SELECT COUNT(*) as count FROM commits_metadata').get() as {
          count: number;
        };
        return result.count;
      } catch (error) {
        logError('Failed to count commits', error);
        return 0;
      }
    });
  }

  async isAnalyzed(sha: string): Promise<boolean> {
    try {
      await ensureDatabaseInitialized();
      // Verify actual data exists, not just metadata
      // Check that commit is marked complete AND has symbols
      const analysisResult = prepare(
        'SELECT status FROM commits_analysis WHERE sha = ? AND status = ? LIMIT 1'
      ).get(sha, 'complete');
      if (!analysisResult) {
        return false;
      }

      // Verify symbols actually exist (commit is useless without symbols)
      const symbolResult = prepare('SELECT 1 FROM symbols WHERE sha = ? LIMIT 1').get(sha);
      return !!symbolResult;
    } catch (error) {
      logError(`Failed to check if commit ${sha} is analyzed`, error);
      return false;
    }
  }

  async searchCommits(options: CommitSearchOptions = {}): Promise<CommitListItem[]> {
    const cacheKey = `commits_search_${JSON.stringify(options)}`;
    return this.queryWithCache(cacheKey, async () => {
      try {
        await ensureDatabaseInitialized();

        const { limit = 20, offset = 0, filterText, shas } = options;

        // Use simpler query that doesn't require potentially missing columns
        // The wrapper returns [] on error, so we can't catch schema errors
        let query = `
      SELECT m.sha, m.author, m.date, m.message, m.files_changed, a.risks
      FROM commits_metadata m
      LEFT JOIN commits_analysis a ON m.sha = a.sha
        `;

        const conditions: string[] = [];
        const params: any[] = [];

        if (filterText && filterText.trim()) {
          conditions.push('(m.message LIKE ? OR m.sha LIKE ?)');
          const searchTerm = `%${filterText.trim()}%`;
          params.push(searchTerm, searchTerm);
        }

        if (shas && shas.length > 0) {
          const placeholders = shas.map(() => '?').join(',');
          conditions.push(`m.sha IN (${placeholders})`);
          params.push(...shas);
        }

        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY m.date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const stmt = prepare(query);
        const commits = stmt.all(...params) as any[];
        stmt.free?.();

        return commits.map(c => ({
          sha: c.sha,
          message: c.message,
          author: c.author,
          date: new Date(c.date),
          changes: c.files_changed || 0,
          structuralChangeScore: 0, // Not available in simplified query
          risks: c.risks ? JSON.parse(c.risks) : [],
        }));
      } catch (error: any) {
        logError('Failed to search commits', error);
        return [];
      }
    });
  }

  async getCommitAnalysis(sha: string): Promise<any | null> {
    return this.queryWithCache(`commit_analysis_${sha}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM commits_analysis WHERE sha = ?');
        const result = stmt.get(sha) as any;
        stmt.free?.();
        return result || null;
      } catch (error) {
        this.handleDbError(error, 'getCommitAnalysis');
        return null;
      }
    });
  }

  async getFilesByCommit(sha: string): Promise<any[]> {
    return this.queryWithCache(`files_commit_${sha}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM files WHERE sha = ?');
        const results = stmt.all(sha) as any[];
        stmt.free?.();
        return results;
      } catch (error) {
        this.handleDbError(error, 'getFilesByCommit');
        return [];
      }
    });
  }

  async querySymbolsByDNA(dnaHash: string): Promise<SymbolWithDNA[]> {
    return this.queryWithCache(`symbols_dna_${dnaHash}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare(`
          SELECT s.*, sv.dna_id as dna
          FROM symbol_versions sv
          JOIN symbols s ON sv.sha = s.sha AND sv.dna_id = s.dna_id AND sv.path = s.path
          WHERE sv.dna_id = ?
        `);
        const results = stmt.all(dnaHash) as any[];
        stmt.free?.();

        return results.map(row => ({
          id: row.dna_id, // id is now the DNA hash
          semanticId: row.symbol_id, // Keep symbol_id as semanticId for reference
          filePath: row.path || '',
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
        this.handleDbError(error, 'querySymbolsByDNA');
        return [];
      }
    });
  }

  async getSymbolsByCommit(sha: string): Promise<SymbolInfo[]> {
    return this.queryWithCache(`symbols_commit_${sha}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM symbols WHERE sha = ?');
        const results = stmt.all(sha) as any[];
        stmt.free?.();

        return results.map(row => ({
          id: row.dna_id || row.symbol_id, // id is now the DNA hash
          filePath: row.path || '',
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

  async getSymbolHistory(dnaId: string): Promise<SymbolHistory[]> {
    return this.queryWithCache(`symbol_history_${dnaId}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare(
          'SELECT * FROM symbol_history WHERE symbol_dna_id = ? ORDER BY created_at DESC'
        );
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

  async queryEdgesByCommit(sha: string): Promise<EdgeInfo[]> {
    return this.queryWithCache(`edges_commit_${sha}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM edges WHERE sha = ?');
        const results = stmt.all(sha) as any[];
        stmt.free?.();

        return results.map(row => ({
          from: row.from_symbol_id,
          to: row.to_symbol_id,
          type: row.edge_type as EdgeInfo['type'],
          confidence: row.confidence,
          isResolved: !!row.is_resolved,
        }));
      } catch (error) {
        this.handleDbError(error, 'queryEdgesByCommit');
        return [];
      }
    });
  }

  async queryHotspots(limit: number = 25): Promise<Hotspot[]> {
    return this.queryWithCache(`hotspots_${limit}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare(`
          SELECT symbol_id, total_modifications as change_count,
                 last_changed_date as last_changed, hotspot_score as risk_score
          FROM symbol_hotspots
          ORDER BY hotspot_score DESC
          LIMIT ?
        `);
        const results = stmt.all(limit) as any[];
        stmt.free?.();

        return results.map(row => ({
          symbol_id: row.symbol_id,
          change_count: row.change_count,
          last_changed: row.last_changed,
          risk_score: row.risk_score,
        }));
      } catch (error) {
        this.handleDbError(error, 'queryHotspots');
        return [];
      }
    });
  }

  async queryMovedBlocks(sha: string): Promise<MovedBlock[]> {
    return this.queryWithCache(`moved_blocks_${sha}`, async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM moved_blocks WHERE commit_sha = ?');
        const results = stmt.all(sha) as any[];
        stmt.free?.();

        return results.map(row => ({
          commitSha: row.commit_sha,
          sourceFile: row.source_file,
          sourceSymbolId: row.source_symbol_id,
          sourceStartLine: row.source_start_line,
          sourceEndLine: row.source_end_line,
          sourceContentHash: row.source_content_hash,
          destFile: row.dest_file,
          destSymbolId: row.dest_symbol_id,
          destStartLine: row.dest_start_line,
          destEndLine: row.dest_end_line,
          destContentHash: row.dest_content_hash,
          similarityScore: row.similarity_score,
          blockType: row.block_type,
          moveReason: row.move_reason,
          lineCount: row.line_count,
        }));
      } catch (error) {
        this.handleDbError(error, 'queryMovedBlocks');
        return [];
      }
    });
  }

  async insertCommitFacts(facts: CommitFacts[]): Promise<void> {
    await this.executeInTransaction(async () => {
      try {
        const stmt = prepare(`
          INSERT OR IGNORE INTO hybrid_facts (commit_sha, fact_type, data, created_at)
          VALUES (?, ?, ?, ?)
        `);

        const now = new Date().toISOString();
        for (const fact of facts) {
          stmt.run(fact.sha, fact.fact_type, JSON.stringify(fact.data), now);
        }
        stmt.free?.();
      } catch (error) {
        this.handleDbError(error, 'insertCommitFacts');
      }
    });
  }

  async insertSymbolHistory(history: SymbolHistory[]): Promise<void> {
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
      } catch (error) {
        this.handleDbError(error, 'insertSymbolHistory');
      }
    });
  }

  async createBundle(name: string, config: any): Promise<string> {
    return this.executeInTransaction(async () => {
      try {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const stmt = prepare(`
          INSERT INTO bundles (id, name, created_at, updated_at, config_json)
          VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(id, name, now, now, JSON.stringify(config));
        stmt.free?.();

        if (config.files && Array.isArray(config.files)) {
          const fileStmt = prepare(`
            INSERT INTO bundle_files (bundle_id, file_path)
            VALUES (?, ?)
          `);
          for (const file of config.files) {
            fileStmt.run(id, file);
          }
          fileStmt.free?.();
        }

        this.cache?.delete('bundles_list');

        return id;
      } catch (error) {
        this.handleDbError(error, 'createBundle');
        logError('Failed to create bundle after error handling:', error);
        return '';
      }
    });
  }

  async getBundles(): Promise<any[]> {
    return this.queryWithCache('bundles_list', async () => {
      try {
        await ensureDatabaseInitialized();
        const stmt = prepare('SELECT * FROM bundles ORDER BY updated_at DESC');
        const results = stmt.all() as any[];
        stmt.free?.();

        return results.map(b => ({
          ...b,
          config: JSON.parse(b.config_json || '{}'),
        }));
      } catch (error) {
        this.handleDbError(error, 'getBundles');
        return [];
      }
    });
  }

  async getBundle(id: string): Promise<any | null> {
    return this.queryWithCache(`bundle_${id}`, async () => {
      try {
        await ensureDatabaseInitialized();

        const stmt = prepare('SELECT * FROM bundles WHERE id = ?');
        const bundle = stmt.get(id) as any;
        stmt.free?.();

        if (!bundle) return null;

        return {
          ...bundle,
          config: JSON.parse(bundle.config_json || '{}'),
        };
      } catch (error) {
        this.handleDbError(error, 'getBundle');
        return null;
      }
    });
  }

  async deleteBundle(id: string): Promise<void> {
    await this.executeInTransaction(async () => {
      try {
        const stmt = prepare('DELETE FROM bundles WHERE id = ?');
        stmt.run(id);
        stmt.free?.();

        this.cache?.delete(`bundle_${id}`);
        this.cache?.delete('bundles_list');
      } catch (error) {
        this.handleDbError(error, 'deleteBundle');
      }
    });
  }

  async updateBundle(id: string, updates: { name?: string; config?: any }): Promise<void> {
    await this.executeInTransaction(async () => {
      try {
        const now = new Date().toISOString();

        const sets: string[] = ['updated_at = ?'];
        const params: any[] = [now];

        if (updates.name) {
          sets.push('name = ?');
          params.push(updates.name);
        }

        if (updates.config) {
          sets.push('config_json = ?');
          params.push(JSON.stringify(updates.config));
        }

        params.push(id);

        const stmt = prepare(`UPDATE bundles SET ${sets.join(', ')} WHERE id = ?`);
        stmt.run(...params);
        stmt.free?.();

        if (updates.config && updates.config.files) {
          const delStmt = prepare('DELETE FROM bundle_files WHERE bundle_id = ?');
          delStmt.run(id);
          delStmt.free?.();

          const fileStmt = prepare(`
            INSERT INTO bundle_files (bundle_id, file_path)
            VALUES (?, ?)
          `);
          for (const file of updates.config.files) {
            fileStmt.run(id, file);
          }
          fileStmt.free?.();
        }

        this.cache?.delete(`bundle_${id}`);
        this.cache?.delete('bundles_list');
      } catch (error) {
        this.handleDbError(error, 'updateBundle');
      }
    });
  }
}

let databaseServiceInstance: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
}

export type { CommitListItem, CommitMetadata, CommitSearchOptions } from './commitService';
