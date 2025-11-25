import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database, Statement } from 'sql.js';
import { DATABASE_SCHEMA, CURRENT_VERSION, MIGRATIONS } from './schema';
import { getGitRoot } from '../utils/config';

// Wrapper to mimic better-sqlite3 API
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

  constructor() {
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
      prepare: (sql: string) => {
        // Return a wrapper that creates a fresh statement for each operation
        // This is necessary because sql.js statements can't be reused
        return {
          run: (...params: any[]) => {
            try {
              if (!this.db) {
                throw new Error('Database not initialized');
              }
              const stmt = this.db.prepare(sql);
              stmt.bind(params);
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
      transaction: (fn: () => any) => {
        return () => {
          if (!this.db) {
            console.warn('Database not initialized, cannot start transaction');
            return fn();
          }
          try {
            this.db.exec('BEGIN TRANSACTION');
            const result = fn();
            this.db.exec('COMMIT');
            this.save();
            return result;
          } catch (e) {
            try {
              this.db.exec('ROLLBACK');
            } catch (rollbackError) {
              console.error('Rollback failed:', rollbackError);
            }
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

  private initializeSchema(): void {
    if (!this.db) return;

    // Check current version
    let currentVersion = 0;
    try {
      const versionResult = this.db.exec("SELECT value FROM pragma_user_version");
      if (versionResult.length > 0 && versionResult[0].values.length > 0) {
        currentVersion = versionResult[0].values[0][0] as number;
      }
    } catch (error) {
      // No version table yet, start from 0
      console.log('[DB-INIT] No version found, starting fresh');
    }

    // Run initial schema if needed
    if (currentVersion === 0) {
      console.log('[DB-INIT] Running initial schema...');
      this.db.exec(DATABASE_SCHEMA);
      currentVersion = 1;
    }

    // Run migrations
    for (let version = currentVersion; version < CURRENT_VERSION; version++) {
      const migrationIndex = version; // Migration index matches version (version 1 = migration[1])
      if (migrationIndex < MIGRATIONS.length) {
        console.log(`[DB-INIT] Running migration ${version + 1}...`);
        try {
          this.db.exec(MIGRATIONS[migrationIndex]);
          this.save();
        } catch (error: any) {
          // If migration fails due to columns already existing, that's okay (idempotent)
          if (error.message && error.message.includes('duplicate column')) {
            console.log(`[DB-INIT] Migration ${version + 1} already applied (columns exist)`);
          } else {
            console.error(`[DB-INIT] Migration ${version + 1} failed:`, error);
            throw error;
          }
        }
      }
    }

    // Set version
    try {
      this.db.exec(`PRAGMA user_version = ${CURRENT_VERSION}`);
      this.save();
    } catch (error) {
      console.warn('[DB-INIT] Failed to set version pragma:', error);
    }
  }

  save(): void {
    if (!this.db) return;

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
       edges_added, edges_removed, risks, blast_radius, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      analysis.analyzedAt || new Date().toISOString()
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
   * Check if commit is analyzed
   */
  isCommitAnalyzed(db: any, sha: string): boolean {
    const stmt = db.prepare(`
      SELECT 1 FROM commits_analysis WHERE sha = ? LIMIT 1
    `);
    const result = stmt.get(sha);
    return !!result;
  }
};

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
