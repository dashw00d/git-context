"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.DatabaseHelpers = exports.getDatabase = exports.ensureDatabaseInitialized = exports.getDatabaseManager = exports.DatabaseManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const sql_js_1 = __importDefault(require("sql.js"));
const schema_1 = require("./schema");
const config_1 = require("../utils/config");
class StatementWrapper {
    constructor(stmt, dbManager) {
        this.stmt = stmt;
        this.dbManager = dbManager;
    }
    run(...params) {
        try {
            this.stmt.bind(params);
            this.stmt.step();
            this.stmt.reset(); // CRITICAL: Reset statement for reuse
            this.dbManager.save();
            return { changes: 0, lastInsertRowid: 0 }; // sql.js doesn't easily provide these
        }
        catch (error) {
            console.error('StatementWrapper.run() error:', error);
            console.error('Params:', params);
            throw error;
        }
    }
    get(...params) {
        try {
            this.stmt.bind(params);
            if (this.stmt.step()) {
                const result = this.stmt.getAsObject();
                this.stmt.reset();
                return result;
            }
            this.stmt.reset();
            return undefined;
        }
        catch (error) {
            console.error('StatementWrapper.get() error:', error);
            throw error;
        }
    }
    all(...params) {
        try {
            this.stmt.bind(params);
            const results = [];
            while (this.stmt.step()) {
                results.push(this.stmt.getAsObject());
            }
            this.stmt.reset();
            return results;
        }
        catch (error) {
            console.error('StatementWrapper.all() error:', error);
            throw error;
        }
    }
}
class DatabaseManager {
    constructor(customPath) {
        this.db = null;
        this.transactionDepth = 0;
        if (customPath) {
            this.dbPath = customPath;
            console.log(`DatabaseManager initialized with custom path: ${this.dbPath}`);
            return;
        }
        const gitRoot = (0, config_1.getGitRoot)();
        if (!gitRoot) {
            throw new Error('Not in a git repository');
        }
        this.dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.db');
        console.log(`DatabaseManager initialized with path: ${this.dbPath}`);
    }
    getDatabase() {
        if (!this.db) {
            // Return null instead of throwing - allows callers to check gracefully
            console.warn('Database not initialized. Call initialize() first.');
            return null;
        }
        // Return a proxy to intercept prepare calls and wrap statements
        return {
            prepare: (sql) => {
                // Return a wrapper that creates a fresh statement for each operation
                // This is necessary because sql.js statements can't be reused
                return {
                    run: (params) => {
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
                        }
                        catch (error) {
                            console.error('Statement.run() error:', error);
                            console.error('SQL:', sql);
                            console.error('Params:', params);
                            // Don't throw - return error result instead
                            return { changes: 0, lastInsertRowid: 0 };
                        }
                    },
                    get: (...params) => {
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
                        }
                        catch (error) {
                            console.error('Statement.get() error:', error);
                            return undefined; // Return undefined instead of throwing
                        }
                    },
                    all: (...params) => {
                        try {
                            if (!this.db) {
                                return [];
                            }
                            const stmt = this.db.prepare(sql);
                            stmt.bind(params);
                            const results = [];
                            while (stmt.step()) {
                                results.push(stmt.getAsObject());
                            }
                            stmt.free();
                            return results;
                        }
                        catch (error) {
                            console.error('Statement.all() error:', error);
                            return []; // Return empty array instead of throwing
                        }
                    }
                };
            },
            exec: (sql) => {
                try {
                    if (!this.db) {
                        console.warn('Database not initialized, cannot exec:', sql);
                        return;
                    }
                    this.db.exec(sql);
                    this.save();
                }
                catch (error) {
                    console.error('Database.exec() error:', error);
                }
            },
            pragma: (sql) => {
                // sql.js might not support all pragmas, but we can try
                try {
                    if (!this.db)
                        return;
                    this.db.exec(`PRAGMA ${sql}`);
                }
                catch (e) {
                    console.warn('PRAGMA failed:', e);
                }
            },
            transaction: (fn) => {
                return (...args) => {
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
                    }
                    catch (e) {
                        try {
                            this.db.exec('ROLLBACK');
                        }
                        catch (rollbackError) {
                            console.error('Rollback failed:', rollbackError);
                        }
                        this.transactionDepth = 0; // Reset depth on error
                        throw e;
                    }
                };
            }
        };
    }
    async initialize() {
        if (this.db)
            return;
        const startTime = Date.now();
        console.log('[DB-INIT] Starting database initialization...');
        // Ensure directory exists
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            }
            catch (error) {
                console.error('Failed to create database directory:', error);
                throw new Error(`Failed to create database directory: ${error}`);
            }
        }
        try {
            // Load WASM
            console.log('[DB-INIT] Loading SQL.js WASM...');
            const wasmStartTime = Date.now();
            // In production (out/storage/database.js), __dirname is .../out/storage
            // We want .../out/wasm/sql-wasm.wasm
            const wasmPath = path.join(__dirname, '..', 'wasm', 'sql-wasm.wasm');
            // Fallback to old location for migration
            const oldWasmPath = path.join(__dirname, '..', 'sql-wasm.wasm');
            const SQL = await (0, sql_js_1.default)({
                locateFile: () => {
                    // Check new location first, then fallback to old
                    if (fs.existsSync(wasmPath)) {
                        return wasmPath;
                    }
                    return oldWasmPath;
                }
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
                }
                catch (error) {
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
            }
            else {
                this.db = new SQL.Database();
            }
            if (this.db) {
                console.log('[DB-INIT] Initializing schema...');
                const schemaStartTime = Date.now();
                this.initializeSchema();
                console.log(`[DB-INIT] Schema initialized in ${Date.now() - schemaStartTime}ms`);
            }
            console.log(`[DB-INIT] Total initialization time: ${Date.now() - startTime}ms`);
        }
        catch (error) {
            console.error('Failed to initialize sql.js:', error);
            // Re-throw to allow callers to handle gracefully
            throw error;
        }
    }
    initializeSchema() {
        if (!this.db)
            return;
        console.log('[DB-INIT] Running modular schema migration...');
        const wrappedDb = this.getDatabase();
        const gaps = (0, schema_1.migrateDatabase)(wrappedDb);
        if (gaps.length > 0) {
            console.warn('[DB-INIT] Migration gaps detected:', gaps);
        }
        // Final audit
        const auditGaps = (0, schema_1.auditAllModules)(wrappedDb);
        if (auditGaps.length > 0) {
            console.warn('[DB-INIT] Schema audit gaps:', auditGaps);
        }
        // Cleanup stale metadata
        exports.DatabaseHelpers.cleanupStaleMetadata(this.db);
    }
    auditSchemaGaps() {
        if (!this.db)
            return [];
        return (0, schema_1.auditAllModules)(this.db);
    }
    save() {
        if (!this.db)
            return;
        if (this.transactionDepth > 0)
            return; // Don't save during transaction
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            // Check if directory still exists before writing
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dbPath, buffer);
        }
        catch (error) {
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
    close() {
        if (this.db) {
            this.save();
            this.db.close();
            this.db = null;
        }
    }
}
exports.DatabaseManager = DatabaseManager;
// Singleton instance
let dbManager = null;
function getDatabaseManager() {
    if (!dbManager) {
        dbManager = new DatabaseManager();
    }
    return dbManager;
}
exports.getDatabaseManager = getDatabaseManager;
// Helper to ensure initialization with retry logic
async function ensureDatabaseInitialized() {
    const manager = getDatabaseManager();
    try {
        await manager.initialize();
    }
    catch (error) {
        // If database is locked (SQLITE_IOERR), retry once after a short delay
        if (error.message && error.message.includes('locked')) {
            console.warn('Database locked, retrying initialization...');
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
                await manager.initialize();
            }
            catch (retryError) {
                console.error('Database initialization failed after retry:', retryError);
                // Don't throw - allow graceful degradation
                return;
            }
        }
        else {
            console.error('Database initialization failed:', error);
            // Don't throw - allow graceful degradation
            return;
        }
    }
}
exports.ensureDatabaseInitialized = ensureDatabaseInitialized;
function getDatabase() {
    return getDatabaseManager().getDatabase();
}
exports.getDatabase = getDatabase;
/**
 * Database helper functions for the new schema
 */
exports.DatabaseHelpers = {
    /**
     * Insert commit metadata
     */
    insertCommitMetadata(db, metadata) {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO commits_metadata
      (sha, author, date, message, parent, files_changed, loaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(metadata.sha, metadata.author, metadata.date, metadata.message, metadata.parent || null, metadata.filesChanged?.length || 0, metadata.loadedAt || new Date().toISOString());
    },
    /**
     * Insert commit analysis results
     */
    insertCommitAnalysis(db, analysis) {
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, summary_md, raw_llm_json, symbols_added, symbols_removed, symbols_modified,
       edges_added, edges_removed, risks, blast_radius, analyzed_at, 
       pipeline_version, prompt_version, model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const llmJson = analysis.llmSummary ? JSON.stringify(analysis.llmSummary) : null;
        const risksJson = JSON.stringify(analysis.risks || []);
        stmt.run(analysis.sha, analysis.llmSummary?.summary_md || '', llmJson, analysis.symbols?.added?.length || 0, analysis.symbols?.removed?.length || 0, analysis.symbols?.modified?.length || 0, analysis.edges?.added?.length || 0, analysis.edges?.removed?.length || 0, risksJson, analysis.blastRadius || 0, analysis.analyzedAt || new Date().toISOString(), analysis.pipelineVersion || '1.0', analysis.promptVersion || '1.0', analysis.model || null);
    },
    /**
     * Get commit metadata
     */
    getCommitMetadata(db, sha) {
        const stmt = db.prepare(`
      SELECT * FROM commits_metadata WHERE sha = ?
    `);
        return stmt.get(sha);
    },
    /**
     * Get commit analysis results
     */
    getCommitAnalysis(db, sha) {
        const stmt = db.prepare(`
      SELECT * FROM commits_analysis WHERE sha = ?
    `);
        return stmt.get(sha);
    },
    /**
     * Check if commit is analyzed with compatible version
     */
    isCommitAnalyzed(db, sha, minPipelineVersion) {
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
        if (!row)
            return false;
        // Compare versions (simple major.minor comparison)
        const analyzed = row.pipeline_version || '0.0';
        return compareVersions(analyzed, minPipelineVersion) >= 0;
    },
    /**
     * Cleanup stale metadata (0 changes, old, no analysis)
     */
    cleanupStaleMetadata(db) {
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
        }
        catch (error) {
            console.error('[DB-CLEANUP] Failed to cleanup stale metadata:', error);
        }
    }
};
/**
 * Simple semver comparison: returns -1 if a < b, 0 if equal, 1 if a > b
 */
function compareVersions(a, b) {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal < bVal)
            return -1;
        if (aVal > bVal)
            return 1;
    }
    return 0;
}
/**
 * Close database connection and cleanup resources.
 * Should be called on extension deactivation.
 */
function closeDatabase() {
    if (dbManager) {
        dbManager.close();
        dbManager = null;
    }
}
exports.closeDatabase = closeDatabase;
