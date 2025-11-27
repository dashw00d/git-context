import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database, Statement } from 'sql.js';
import { DATABASE_SCHEMA, CURRENT_VERSION, MIGRATIONS } from './schema';
import { getGitRoot } from '../utils/config';

// Wrapper to mimic better-sqlite3 API
interface DatabaseStatement {
  run: (params?: any[]) => { changes: number; lastInsertRowid: number };
  get: (...params: any[]) => any;
  all: (...params: any[]) => any[];
}

class StatementWrapper {
  constructor(private stmt: Statement, private dbManager: DatabaseManager) { }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    try {
      this.stmt.bind(params);
      this.stmt.step();
      this.stmt.reset(); // CRITICAL: Reset statement for reuse
      this.dbManager.save();
      return { changes: 0, lastInsertRowid: 0 }; // sql.js doesn't easily provide these
    } catch (error) {
      console.error('StatementWrapper.run() error:', error);
      console.error('Params:', params);
      throw error;
    }
  }

  get(...params: any[]): any {
    try {
      this.stmt.bind(params);
      if (this.stmt.step()) {
        const result = this.stmt.getAsObject();
        this.stmt.reset();
        return result;
      }
      this.stmt.reset();
      return undefined;
    } catch (error) {
      console.error('StatementWrapper.get() error:', error);
      throw error;
    }
  }

  all(...params: any[]): any[] {
    try {
      this.stmt.bind(params);
      const results: any[] = [];
      while (this.stmt.step()) {
        results.push(this.stmt.getAsObject());
      }
      this.stmt.reset();
      return results;
    } catch (error) {
      console.error('StatementWrapper.all() error:', error);
      throw error;
    }
  }
}

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;
  private transactionDepth = 0;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
      console.log(`DatabaseManager initialized with custom path: ${this.dbPath}`);
      return;
    }

    const gitRoot = getGitRoot();
    if (!gitRoot) {
      throw new Error('Not in a git repository');
    }

    this.dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.db');
    console.log(`DatabaseManager initialized with path: ${this.dbPath}`);
  }

  getDatabase(): any {
    if (!this.db) {
      // Return null instead of throwing - allows callers to check gracefully
      console.warn('Database not initialized. Call initialize() first.');
      return null;
    }

    // Return a proxy to intercept prepare calls and wrap statements
    return {
      prepare: (sql: string): DatabaseStatement => {
        // Return a wrapper that creates a fresh statement for each operation
        // This is necessary because sql.js statements can't be reused
        return {
          run: (params?: any[]) => {
            try {
              if (!this.db) {
                throw new Error('Database not initialized');
              }
              const stmt = this.db.prepare(sql);
              if (params && params.length > 0) {
                stmt.bind(params);
              }
              stmt.step();
              stmt.free(); // Free the statement immediately
              this.save();
              return { changes: 0, lastInsertRowid: 0 };
            } catch (error) {
              console.error('Statement.run() error:', error);
              console.error('SQL:', sql);
              console.error('Params:', params);
              // Don't throw - return error result instead
              return { changes: 0, lastInsertRowid: 0 };
            }
          },
          get: (...params: any[]) => {
            try {
              if (!this.db) {
                return undefined;
              }
              const stmt = this.db.prepare(sql);
              stmt.bind(params);
              if (stmt.step()) {
                const result = stmt.getAsObject();
                stmt.free();
                return result;
              }
              stmt.free();
              return undefined;
            } catch (error) {
              console.error('Statement.get() error:', error);
              return undefined; // Return undefined instead of throwing
            }
          },
          all: (...params: any[]) => {
            try {
              if (!this.db) {
                return [];
              }
              const stmt = this.db.prepare(sql);
              stmt.bind(params);
              const results: any[] = [];
              while (stmt.step()) {
                results.push(stmt.getAsObject());
              }
              stmt.free();
              return results;
            } catch (error) {
              console.error('Statement.all() error:', error);
              return []; // Return empty array instead of throwing
            }
          }
        };
      },
      exec: (sql: string) => {
        try {
          if (!this.db) {
            console.warn('Database not initialized, cannot exec:', sql);
            return;
          }
          this.db.exec(sql);
          this.save();
        } catch (error) {
          console.error('Database.exec() error:', error);
        }
      },
      pragma: (sql: string) => {
        // sql.js might not support all pragmas, but we can try
        try {
          if (!this.db) return;
          this.db.exec(`PRAGMA ${sql}`);
        } catch (e) {
          console.warn('PRAGMA failed:', e);
        }
      },
      transaction: (fn: (...args: any[]) => any) => {
        return (...args: any[]) => {
          if (!this.db) {
            console.warn('Database not initialized, cannot start transaction');
            return fn(...args);
          }

          // Nested transaction support: flatten
          if (this.transactionDepth > 0) {
            return fn(...args);
          }

          try {
            this.transactionDepth++;
            this.db.exec('BEGIN TRANSACTION');
            const result = fn(...args);
            this.db.exec('COMMIT');
            this.transactionDepth--;
            this.save(); // Save only after top-level transaction commits
            return result;
          } catch (e) {
            try {
              this.db.exec('ROLLBACK');
            } catch (rollbackError) {
              console.error('Rollback failed:', rollbackError);
            }
            this.transactionDepth = 0; // Reset depth on error
            throw e;
          }
        };
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.db) return;

    const startTime = Date.now();
    console.log('[DB-INIT] Starting database initialization...');

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.error('Failed to create database directory:', error);
        throw new Error(`Failed to create database directory: ${error}`);
      }
    }

    try {
      // Load WASM
      console.log('[DB-INIT] Loading SQL.js WASM...');
      const wasmStartTime = Date.now();
      // In production (out/storage/database.js), __dirname is .../out/storage
      // We want .../out/sql-wasm.wasm
      const wasmPath = path.join(__dirname, '..', 'sql-wasm.wasm');
      const SQL = await initSqlJs({
        locateFile: () => wasmPath
      });
      console.log(`[DB-INIT] WASM loaded in ${Date.now() - wasmStartTime}ms`);

      // Load existing DB if it exists
      if (fs.existsSync(this.dbPath)) {
        console.log('[DB-INIT] Loading existing database file...');
        const loadStartTime = Date.now();
        try {
          const filebuffer = fs.readFileSync(this.dbPath);
          this.db = new SQL.Database(filebuffer);
          console.log(`[DB-INIT] Database file loaded in ${Date.now() - loadStartTime}ms (${filebuffer.length} bytes)`);
        } catch (error: any) {
          // If file is locked, corrupted, or has I/O errors, create a new one
          if (error.code === 'EACCES' || error.code === 'EBUSY' || error.errno === 10) {
            console.warn('Database file is locked or has I/O error, will retry later:', error);
            // Don't create a new DB if file is just locked - throw to retry later
            throw new Error(`Database file is locked or inaccessible: ${error.message}`);
          }
          console.warn('Failed to load existing database, creating new one:', error);
          // For other errors (corruption, etc.), create a new database
          this.db = new SQL.Database();
        }
      } else {
        this.db = new SQL.Database();
      }

      if (this.db) {
        console.log('[DB-INIT] Initializing schema...');
        const schemaStartTime = Date.now();
        this.initializeSchema();
        console.log(`[DB-INIT] Schema initialized in ${Date.now() - schemaStartTime}ms`);
      }
      console.log(`[DB-INIT] Total initialization time: ${Date.now() - startTime}ms`);
    } catch (error) {
      console.error('Failed to initialize sql.js:', error);
      // Re-throw to allow callers to handle gracefully
      throw error;
    }
  }

  private getCurrentVersion(): number {
    if (!this.db) return 0;
    try {
      const result = this.db.exec("SELECT MAX(version) as max_version FROM migration_log");
      if (result.length > 0 && result[0].values.length > 0 && result[0].values[0][0] !== null) {
        return result[0].values[0][0] as number;
      }
    } catch (error) {
      // migration_log table doesn't exist yet (fresh DB)
    }
    return 0;
  }

  private initializeSchema(): void {
    if (!this.db) return;

    // Ensure base schema is applied (creates migration_log table)
    console.log('[DB-INIT] Ensuring base schema...');
    this.db.exec(DATABASE_SCHEMA);

    // Get current version from migration_log
    const currentVersion = this.getCurrentVersion();
    console.log(`[DB-INIT] Current version: ${currentVersion}, target: ${CURRENT_VERSION}`);

    // Run initial schema if needed (v1 = DATABASE_SCHEMA)
    if (currentVersion === 0) {
      console.log('[DB-INIT] Fresh database, base schema applied');
      // Mark v1 as applied for fresh databases
      try {
        this.db.exec(`INSERT OR IGNORE INTO migration_log (version, name, applied_at) VALUES (1, 'base_schema', datetime('now'))`);
      } catch (e) {
        // Ignore if migration_log doesn't exist yet (shouldn't happen)
      }
      // Update currentVersion to skip v1 migration
      const updatedVersion = this.getCurrentVersion();
      if (updatedVersion === 1) {
        console.log('[DB-INIT] Marked base schema (v1) as applied');
      }
    }

    // Run migrations in transaction
    // Note: v1 is the base schema (DATABASE_SCHEMA), so we start from v2
    if (currentVersion < CURRENT_VERSION) {
      this.db.exec('BEGIN TRANSACTION');
      try {
        // Start from v2 (index 1) since v1 is the base schema
        const startVersion = Math.max(2, currentVersion + 1);
        for (let v = startVersion; v <= CURRENT_VERSION; v++) {
          const migrationIndex = v - 1; // v2 = index 1, v12 = index 11, etc.
          if (migrationIndex < MIGRATIONS.length) {
            console.log(`[DB-INIT] Running migration v${v}...`);
            try {
              this.db.exec(MIGRATIONS[migrationIndex]);
              this.save();
            } catch (error: any) {
              // If migration fails due to duplicate column, that's okay (idempotent)
              if (error.message && (
                error.message.includes('duplicate column') ||
                error.message.includes('already exists')
              )) {
                console.log(`[DB-INIT] Migration v${v} already applied (${error.message})`);
                // Still log the migration as applied
                try {
                  this.db.exec(`INSERT OR IGNORE INTO migration_log (version, name, applied_at) VALUES (${v}, 'migration_v${v}', datetime('now'))`);
                } catch (e) {
                  // Ignore if already logged
                }
              } else {
                console.error(`[DB-INIT] Migration v${v} failed:`, error);
                throw error;
              }
            }
          } else {
            console.warn(`[DB-INIT] No migration script found for v${v}`);
          }
        }
        this.db.exec('COMMIT');
        console.log(`[DB-INIT] Migrated to v${CURRENT_VERSION}`);
      } catch (error) {
        try {
          this.db.exec('ROLLBACK');
        } catch (rollbackError: any) {
          // Ignore "no transaction is active" error, as it might have been the cause of the original error
          // or the transaction might have never started
          if (!rollbackError.message?.includes('no transaction is active')) {
            console.error('[DB-INIT] Rollback failed:', rollbackError);
          }
        }
        console.error('[DB-INIT] Migration failed, rolled back:', error);
        // Don't throw - allow graceful degradation
      }
    }

    // Final audit
    const gaps = this.auditSchemaGaps();
    if (gaps.length > 0) {
      console.warn('[DB-INIT] Schema gaps detected (manual fix may be needed):', gaps);
    }

    // Set pragma version for compatibility
    try {
      this.db.exec(`PRAGMA user_version = ${CURRENT_VERSION}`);
      this.save();
    } catch (error) {
      console.warn('[DB-INIT] Failed to set version pragma:', error);
    }

    // Cleanup stale metadata
    DatabaseHelpers.cleanupStaleMetadata(this.db);
  }

  public auditSchemaGaps(): string[] {
    if (!this.db) return [];

    const expected: Record<string, string[]> = {
      file_snapshots: ['body_hash'],
      commits_analysis: ['status', 'structural_change_score', 'files_changed', 'hotspots_json'],
    };

    const gaps: string[] = [];

    for (const [table, cols] of Object.entries(expected)) {
      try {
        const info = this.db.exec(`PRAGMA table_info(${table})`);
        if (info.length === 0 || !info[0].values) {
          gaps.push(`${table}: table not found`);
          continue;
        }

        const existingCols = info[0].values.map((row: any) => row[1] as string);
        const missing = cols.filter(c => !existingCols.includes(c));

        if (missing.length > 0) {
          gaps.push(`${table} missing: ${missing.join(', ')}`);
        }
      } catch (error: any) {
        gaps.push(`${table}: ${error.message}`);
      }
    }

    return gaps;
  }

  save(): void {
    if (!this.db) return;
    if (this.transactionDepth > 0) return; // Don't save during transaction

    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);

      // Check if directory still exists before writing
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.dbPath, buffer);
    } catch (error: any) {
      // Handle I/O errors gracefully - don't crash if file is locked
      if (error.code === 'EACCES' || error.code === 'EBUSY' || error.errno === 10) {
        console.warn('Database file is locked, save will be retried on next operation:', error);
        // Don't throw - allow operations to continue
        return;
      }
      console.error('Failed to save database:', error);
      // For other errors, log but don't throw to prevent cascading failures
    }
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
let dbManager: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  if (!dbManager) {
    dbManager = new DatabaseManager();
  }
  return dbManager;
}

// Helper to ensure initialization with retry logic
export async function ensureDatabaseInitialized(): Promise<void> {
  const manager = getDatabaseManager();
  try {
    await manager.initialize();
  } catch (error: any) {
    // If database is locked (SQLITE_IOERR), retry once after a short delay
    if (error.message && error.message.includes('locked')) {
      console.warn('Database locked, retrying initialization...');
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        await manager.initialize();
      } catch (retryError) {
        console.error('Database initialization failed after retry:', retryError);
        // Don't throw - allow graceful degradation
        return;
      }
    } else {
      console.error('Database initialization failed:', error);
      // Don't throw - allow graceful degradation
      return;
    }
  }
}

export function getDatabase(): any {
  return getDatabaseManager().getDatabase();
}

/**
 * Database helper functions for the new schema
 */
export const DatabaseHelpers = {
  /**
   * Insert commit metadata
   */
  insertCommitMetadata(db: any, metadata: any): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO commits_metadata
      (sha, author, date, message, parent, files_changed, loaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      metadata.sha,
      metadata.author,
      metadata.date,
      metadata.message,
      metadata.parent || null,
      metadata.filesChanged?.length || 0,
      metadata.loadedAt || new Date().toISOString()
    );
  },

  /**
   * Insert commit analysis results
   */
  insertCommitAnalysis(db: any, analysis: any): void {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, summary_md, raw_llm_json, symbols_added, symbols_removed, symbols_modified,
       edges_added, edges_removed, risks, blast_radius, analyzed_at, 
       pipeline_version, prompt_version, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const llmJson = analysis.llmSummary ? JSON.stringify(analysis.llmSummary) : null;
    const risksJson = JSON.stringify(analysis.risks || []);

    stmt.run(
      analysis.sha,
      analysis.llmSummary?.summary_md || '',
      llmJson,
      analysis.symbols?.added?.length || 0,
      analysis.symbols?.removed?.length || 0,
      analysis.symbols?.modified?.length || 0,
      analysis.edges?.added?.length || 0,
      analysis.edges?.removed?.length || 0,
      risksJson,
      analysis.blastRadius || 0,
      analysis.analyzedAt || new Date().toISOString(),
      analysis.pipelineVersion || '1.0',
      analysis.promptVersion || '1.0',
      analysis.model || null
    );
  },

  /**
   * Get commit metadata
   */
  getCommitMetadata(db: any, sha: string): any {
    const stmt = db.prepare(`
      SELECT * FROM commits_metadata WHERE sha = ?
    `);
    return stmt.get(sha);
  },

  /**
   * Get commit analysis results
   */
  getCommitAnalysis(db: any, sha: string): any {
    const stmt = db.prepare(`
      SELECT * FROM commits_analysis WHERE sha = ?
    `);
    return stmt.get(sha);
  },

  /**
   * Check if commit is analyzed with compatible version
   */
  isCommitAnalyzed(db: any, sha: string, minPipelineVersion?: string): boolean {
    if (!minPipelineVersion) {
      // If no version specified, just check if analyzed
      const stmt = db.prepare(`
        SELECT 1 FROM commits_analysis WHERE sha = ? LIMIT 1
      `);
      return !!stmt.get(sha);
    }

    // Check if analyzed with compatible version
    const stmt = db.prepare(`
      SELECT pipeline_version FROM commits_analysis WHERE sha = ?
    `);
    const row = stmt.get(sha);
    if (!row) return false;

    // Compare versions (simple major.minor comparison)
    const analyzed = row.pipeline_version || '0.0';
    return compareVersions(analyzed, minPipelineVersion) >= 0;
  },

  /**
   * Cleanup stale metadata (0 changes, old, no analysis)
   */
  cleanupStaleMetadata(db: any): void {
    try {
      // Delete commits with 0 files changed, loaded > 7 days ago, and no analysis
      // SQLite datetime('now', '-7 days') works if dates are ISO strings
      const stmt = db.prepare(`
        DELETE FROM commits_metadata 
        WHERE files_changed = 0 
          AND loaded_at < datetime('now', '-7 days')
          AND sha NOT IN (SELECT sha FROM commits_analysis)
      `);
      const result = stmt.run();
      if (result.changes > 0) {
        console.log(`[DB-CLEANUP] Removed ${result.changes} stale commit metadata entries`);
      }
    } catch (error) {
      console.error('[DB-CLEANUP] Failed to cleanup stale metadata:', error);
    }
  }
};

/**
 * Simple semver comparison: returns -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }
  return 0;
}

/**
 * Close database connection and cleanup resources.
 * Should be called on extension deactivation.
 */
export function closeDatabase(): void {
  if (dbManager) {
    dbManager.close();
    dbManager = null;
  }
}
