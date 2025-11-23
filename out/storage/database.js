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
exports.getDatabase = exports.ensureDatabaseInitialized = exports.getDatabaseManager = exports.DatabaseManager = void 0;
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
        this.stmt.run(params);
        this.dbManager.save();
        return { changes: 0, lastInsertRowid: 0 }; // sql.js doesn't easily provide these
    }
    get(...params) {
        this.stmt.bind(params);
        if (this.stmt.step()) {
            return this.stmt.getAsObject();
        }
        return undefined;
    }
    all(...params) {
        this.stmt.bind(params);
        const results = [];
        while (this.stmt.step()) {
            results.push(this.stmt.getAsObject());
        }
        return results;
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
                const stmt = this.db.prepare(sql);
                return new StatementWrapper(stmt, this);
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
//# sourceMappingURL=database.js.map