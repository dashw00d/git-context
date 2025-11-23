import * as path from 'path';
import * as fs from 'fs';
import initSqlJs, { Database, Statement } from 'sql.js';
import { DATABASE_SCHEMA, CURRENT_VERSION } from './schema';
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

    this.dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.sqlite');
    console.log(`DatabaseManager initialized with path: ${this.dbPath}`);
  }

  getDatabase(): any {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }

    // Return a proxy to intercept prepare calls and wrap statements
    return {
      prepare: (sql: string) => {
        // Return a wrapper that creates a fresh statement for each operation
        // This is necessary because sql.js statements can't be reused
        return {
          run: (...params: any[]) => {
            try {
              const stmt = this.db!.prepare(sql);
              stmt.bind(params);
              stmt.step();
              stmt.free(); // Free the statement immediately
              this.save();
              return { changes: 0, lastInsertRowid: 0 };
            } catch (error) {
              console.error('Statement.run() error:', error);
              console.error('SQL:', sql);
              console.error('Params:', params);
              throw error;
            }
          },
          get: (...params: any[]) => {
            try {
              const stmt = this.db!.prepare(sql);
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
              throw error;
            }
          },
          all: (...params: any[]) => {
            try {
              const stmt = this.db!.prepare(sql);
              stmt.bind(params);
              const results: any[] = [];
              while (stmt.step()) {
                results.push(stmt.getAsObject());
              }
              stmt.free();
              return results;
            } catch (error) {
              console.error('Statement.all() error:', error);
              throw error;
            }
          }
        };
      },
      exec: (sql: string) => {
        this.db!.exec(sql);
        this.save();
      },
      pragma: (sql: string) => {
        // sql.js might not support all pragmas, but we can try
        try {
          this.db!.exec(`PRAGMA ${sql}`);
        } catch (e) {
          console.warn('PRAGMA failed:', e);
        }
      },
      transaction: (fn: () => any) => {
        return () => {
          this.db!.exec('BEGIN TRANSACTION');
          try {
            const result = fn();
            this.db!.exec('COMMIT');
            this.save();
            return result;
          } catch (e) {
            this.db!.exec('ROLLBACK');
            throw e;
          }
        };
      }
    };
  }

  async initialize(): Promise<void> {
    if (this.db) return;

    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      // Load WASM
      // In production (out/storage/database.js), __dirname is .../out/storage
      // We want .../out/sql-wasm.wasm
      const wasmPath = path.join(__dirname, '..', 'sql-wasm.wasm');
      const SQL = await initSqlJs({
        locateFile: () => wasmPath
      });

      // Load existing DB if it exists
      if (fs.existsSync(this.dbPath)) {
        const filebuffer = fs.readFileSync(this.dbPath);
        this.db = new SQL.Database(filebuffer);
      } else {
        this.db = new SQL.Database();
      }

      this.initializeSchema();
    } catch (error) {
      console.error('Failed to initialize sql.js:', error);
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  private initializeSchema(): void {
    if (!this.db) return;

    // Run schema
    this.db.exec(DATABASE_SCHEMA);
    this.save();
  }

  save(): void {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
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

// Helper to ensure initialization
export async function ensureDatabaseInitialized(): Promise<void> {
  const manager = getDatabaseManager();
  await manager.initialize();
}

export function getDatabase(): any {
  return getDatabaseManager().getDatabase();
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
