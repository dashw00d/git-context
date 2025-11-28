"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCstTimelineManager = exports.CstTimelineManager = void 0;
const cstFacts_1 = require("../types/cstFacts");
const database_1 = require("../storage/database");
const symbolDna_1 = require("./symbolDna");
const logger_1 = require("../utils/logger");
/**
 * Manager for CST timeline tracking (hybrid facts evolution)
 */
class CstTimelineManager {
    /**
     * Save hybrid facts for a file at a specific version
     */
    async saveFacts(filePath, commitSha, facts, prevHash) {
        const db = (0, database_1.getDatabase)();
        if (!db) {
            (0, logger_1.logDebug)('[CstTimeline] Database not initialized, skipping save');
            return;
        }
        // Ensure hybrid_facts table exists
        this.ensureTableExists(db);
        // Compute file hash for this version
        const fileHash = this.computeFileHash(facts);
        // Get prior facts if prevHash provided
        const priorFacts = prevHash ? await this.getFactsByHash(filePath, prevHash) : null;
        // Compute deltas for each fact
        const factsWithDeltas = facts.map(fact => {
            const delta = this.computeDelta(fact, priorFacts);
            return { fact, delta };
        });
        // Update timelines
        for (const { fact, delta } of factsWithDeltas) {
            await this.appendToTimeline(filePath, commitSha, fact, delta, fileHash);
        }
        (0, logger_1.logDebug)(`[CstTimeline] Saved ${facts.length} hybrid facts for ${filePath}@${commitSha.substring(0, 8)}`);
    }
    /**
     * Get prior facts for a file at a specific version
     */
    async getPriorFacts(filePath, commitSha) {
        const db = (0, database_1.getDatabase)();
        if (!db)
            return null;
        this.ensureTableExists(db);
        try {
            // Get all facts for this file/version
            const stmt = db.prepare(`
        SELECT serialized_fact FROM hybrid_facts
        WHERE file_path = ? AND version = ?
        ORDER BY created_at DESC
      `);
            const rows = stmt.all([filePath, commitSha]);
            if (!rows || rows.length === 0)
                return null;
            // Deserialize all facts
            return rows.map(row => JSON.parse(row.serialized_fact));
        }
        catch (error) {
            (0, logger_1.logDebug)(`[CstTimeline] Error getting prior facts: ${error}`);
            return null;
        }
    }
    /**
     * Batch retrieve prior facts for multiple files at a specific version
     * More efficient than calling getPriorFacts() multiple times
     */
    async getPriorFactsBatch(filePaths, version) {
        const db = (0, database_1.getDatabase)();
        if (!db || filePaths.length === 0)
            return new Map();
        this.ensureTableExists(db);
        try {
            // Use IN clause for batch retrieval
            const placeholders = filePaths.map(() => '?').join(',');
            const stmt = db.prepare(`
        SELECT file_path, serialized_fact 
        FROM hybrid_facts
        WHERE file_path IN (${placeholders}) AND version = ?
        ORDER BY file_path, created_at DESC
      `);
            const rows = stmt.all([...filePaths, version]);
            if (!rows || rows.length === 0)
                return new Map();
            // Group by file path
            const factsByFile = new Map();
            for (const row of rows) {
                if (!factsByFile.has(row.file_path)) {
                    factsByFile.set(row.file_path, []);
                }
                factsByFile.get(row.file_path).push(JSON.parse(row.serialized_fact));
            }
            return factsByFile;
        }
        catch (error) {
            (0, logger_1.logDebug)(`[CstTimeline] Error getting prior facts batch: ${error}`);
            return new Map();
        }
    }
    /**
     * Get facts by file hash
     */
    async getFactsByHash(filePath, hash) {
        const db = (0, database_1.getDatabase)();
        if (!db)
            return null;
        try {
            // Get all facts for this file/hash
            const stmt = db.prepare(`
        SELECT serialized_fact FROM hybrid_facts
        WHERE file_path = ? AND hash = ?
        ORDER BY created_at DESC
      `);
            const rows = stmt.all([filePath, hash]);
            if (!rows || rows.length === 0)
                return null;
            // Deserialize all facts
            return rows.map(row => JSON.parse(row.serialized_fact));
        }
        catch (error) {
            (0, logger_1.logDebug)(`[CstTimeline] Error getting facts by hash: ${error}`);
            return null;
        }
    }
    /**
     * Append entry to fact timeline
     */
    async appendToTimeline(filePath, version, fact, delta, fileHash) {
        const db = (0, database_1.getDatabase)();
        if (!db)
            return;
        const dnaId = (0, symbolDna_1.computeHybridDna)(fact);
        const timelineEntry = {
            version,
            dna: dnaId,
            delta
        };
        // Get existing timeline or create new
        let timeline = [];
        if ((0, cstFacts_1.isCstFact)(fact)) {
            // For CST facts, use existing timeline
            timeline = [...fact.timeline, timelineEntry];
        }
        else {
            // For symbols, create new timeline entry
            timeline = [timelineEntry];
        }
        // Update or insert fact
        const stmt = db.prepare(`
      INSERT OR REPLACE INTO hybrid_facts
      (file_path, version, fact_id, dna_id, serialized_fact, timeline_json, hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run([
            filePath,
            version,
            fact.id,
            dnaId,
            JSON.stringify(fact),
            JSON.stringify(timeline),
            fileHash,
            new Date().toISOString()
        ]);
    }
    /**
     * Compute delta between current fact and prior facts
     */
    computeDelta(fact, priorFacts) {
        if (!priorFacts || priorFacts.length === 0) {
            return {
                type: 'added',
                newDna: (0, symbolDna_1.computeHybridDna)(fact)
            };
        }
        // Find matching fact in prior version (by DNA or name)
        const priorFact = priorFacts.find(p => p.dnaId === fact.dnaId ||
            (p.name === fact.name && this.sameKind(p, fact)));
        if (!priorFact) {
            return {
                type: 'added',
                newDna: (0, symbolDna_1.computeHybridDna)(fact)
            };
        }
        // Check if removed (fact exists in prior but not in current)
        // This is handled at file level, so here we assume it's modified if it exists
        // Check if modified (DNA changed or location changed)
        const dnaChanged = priorFact.dnaId !== fact.dnaId;
        const locationChanged = priorFact.location.start.line !== fact.location.start.line ||
            priorFact.location.start.column !== fact.location.start.column;
        if (dnaChanged || locationChanged) {
            return {
                type: 'modified',
                oldDna: priorFact.dnaId,
                newDna: fact.dnaId,
                locationDelta: locationChanged ? {
                    oldLine: priorFact.location.start.line,
                    newLine: fact.location.start.line
                } : undefined
            };
        }
        // No change
        return {
            type: 'modified',
            oldDna: priorFact.dnaId,
            newDna: fact.dnaId
        };
    }
    /**
     * Check if two facts are the same kind
     */
    sameKind(fact1, fact2) {
        if ((0, cstFacts_1.isCstFact)(fact1) && (0, cstFacts_1.isCstFact)(fact2)) {
            return fact1.kind === fact2.kind;
        }
        if (!(0, cstFacts_1.isCstFact)(fact1) && !(0, cstFacts_1.isCstFact)(fact2)) {
            return fact1.kind === fact2.kind;
        }
        return false;
    }
    /**
     * Compute file hash from facts
     */
    computeFileHash(facts) {
        const crypto = require('crypto');
        const serialized = JSON.stringify(facts.map(f => ({
            id: f.id,
            dnaId: f.dnaId,
            name: f.name,
            kind: f.kind
        })));
        return crypto.createHash('sha256')
            .update(serialized)
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Ensure hybrid_facts table exists
     */
    ensureTableExists(db) {
        try {
            // Check if table exists
            const checkStmt = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='hybrid_facts'
      `);
            const exists = checkStmt.get();
            if (!exists) {
                // Create table
                const createStmt = db.prepare(`
          CREATE TABLE IF NOT EXISTS hybrid_facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            version TEXT NOT NULL,
            fact_id TEXT NOT NULL,
            dna_id TEXT NOT NULL,
            serialized_fact TEXT NOT NULL,
            timeline_json TEXT NOT NULL,
            hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(file_path, version, fact_id)
          )
        `);
                createStmt.run();
                // Create indexes
                const idx1 = db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_file_version 
          ON hybrid_facts(file_path, version)
        `);
                idx1.run();
                const idx2 = db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_dna 
          ON hybrid_facts(dna_id)
        `);
                idx2.run();
                const idx3 = db.prepare(`
          CREATE INDEX IF NOT EXISTS idx_hybrid_facts_hash 
          ON hybrid_facts(file_path, hash)
        `);
                idx3.run();
                (0, logger_1.logDebug)('[CstTimeline] Created hybrid_facts table');
            }
        }
        catch (error) {
            (0, logger_1.logDebug)(`[CstTimeline] Error ensuring table exists: ${error}`);
        }
    }
}
exports.CstTimelineManager = CstTimelineManager;
// Singleton instance
let timelineManagerInstance = null;
function getCstTimelineManager() {
    if (!timelineManagerInstance) {
        timelineManagerInstance = new CstTimelineManager();
    }
    return timelineManagerInstance;
}
exports.getCstTimelineManager = getCstTimelineManager;
