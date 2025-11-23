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
exports.closeDatabase = exports.getDatabase = exports.ensureDatabaseInitialized = exports.getDatabaseManager = exports.DatabaseManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const sql_js_1 = __importDefault(require("sql.js"));
const schema_1 = require("./schema");
const config_1 = require("../utils/config");
// Wrapper to mimic better-sqlite3 API
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
    constructor() {
        this.db = null;
        const gitRoot = (0, config_1.getGitRoot)();
        if (!gitRoot) {
            throw new Error('Not in a git repository');
        }
        this.dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.sqlite');
        console.log(`DatabaseManager initialized with path: ${this.dbPath}`);
    }
    getDatabase() {
        if (!this.db) {
            throw new Error('Database not initialized. Call initialize() first.');
        }
        // Return a proxy to intercept prepare calls and wrap statements
        return {
            prepare: (sql) => {
                // Return a wrapper that creates a fresh statement for each operation
                // This is necessary because sql.js statements can't be reused
                return {
                    run: (...params) => {
                        try {
                            const stmt = this.db.prepare(sql);
                            stmt.bind(params);
                            stmt.step();
                            stmt.free(); // Free the statement immediately
                            this.save();
                            return { changes: 0, lastInsertRowid: 0 };
                        }
                        catch (error) {
                            console.error('Statement.run() error:', error);
                            console.error('SQL:', sql);
                            console.error('Params:', params);
                            throw error;
                        }
                    },
                    get: (...params) => {
                        try {
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
                            throw error;
                        }
                    },
                    all: (...params) => {
                        try {
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
                            throw error;
                        }
                    }
                };
            },
            exec: (sql) => {
                this.db.exec(sql);
                this.save();
            },
            pragma: (sql) => {
                // sql.js might not support all pragmas, but we can try
                try {
                    this.db.exec(`PRAGMA ${sql}`);
                }
                catch (e) {
                    console.warn('PRAGMA failed:', e);
                }
            },
            transaction: (fn) => {
                return () => {
                    this.db.exec('BEGIN TRANSACTION');
                    try {
                        const result = fn();
                        this.db.exec('COMMIT');
                        this.save();
                        return result;
                    }
                    catch (e) {
                        this.db.exec('ROLLBACK');
                        throw e;
                    }
                };
            }
        };
    }
    async initialize() {
        if (this.db)
            return;
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
            const SQL = await (0, sql_js_1.default)({
                locateFile: () => wasmPath
            });
            // Load existing DB if it exists
            if (fs.existsSync(this.dbPath)) {
                const filebuffer = fs.readFileSync(this.dbPath);
                this.db = new SQL.Database(filebuffer);
            }
            else {
                this.db = new SQL.Database();
            }
            this.initializeSchema();
        }
        catch (error) {
            console.error('Failed to initialize sql.js:', error);
            throw new Error(`Failed to initialize database: ${error}`);
        }
    }
    initializeSchema() {
        if (!this.db)
            return;
        // Run schema
        this.db.exec(schema_1.DATABASE_SCHEMA);
        this.save();
    }
    save() {
        if (this.db) {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            fs.writeFileSync(this.dbPath, buffer);
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
// Helper to ensure initialization
async function ensureDatabaseInitialized() {
    const manager = getDatabaseManager();
    await manager.initialize();
}
exports.ensureDatabaseInitialized = ensureDatabaseInitialized;
function getDatabase() {
    return getDatabaseManager().getDatabase();
}
exports.getDatabase = getDatabase;
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
//# sourceMappingURL=database.js.map