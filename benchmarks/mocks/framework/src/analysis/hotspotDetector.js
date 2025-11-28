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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotspotDetector = void 0;
const database_1 = require("../storage/database");
const logger_1 = require("../utils/logger");
const crypto = __importStar(require("crypto"));
class HotspotDetector {
    constructor(dbManager = (0, database_1.getDatabaseManager)()) {
        this.dbManager = dbManager;
    }
    /**
     * Calculate hotspot score from metrics (0-100)
     */
    calculateHotspotScore(metrics) {
        // Weighted combination
        const weights = {
            commitFrequency: 0.35,
            recency: 0.20,
            authorDiversity: 0.15,
            changeIntensity: 0.20,
            temporalClustering: 0.10 // Burst changes = instability
        };
        const rawScore = metrics.commitFrequency * weights.commitFrequency +
            metrics.recency * weights.recency +
            metrics.authorDiversity * weights.authorDiversity +
            metrics.changeIntensity * weights.changeIntensity +
            metrics.temporalClustering * weights.temporalClustering;
        // Normalize to 0-100 and apply logarithmic scaling to prevent outliers
        return Math.min(100, Math.log10(1 + rawScore * 9) * 100);
    }
    /**
     * Classify risk level based on hotspot score
     */
    classifyRiskLevel(score) {
        if (score >= 80)
            return 'critical';
        if (score >= 60)
            return 'high';
        if (score >= 40)
            return 'medium';
        return 'low';
    }
    /**
     * Update hotspot metrics for a file
     */
    async updateFileHotspot(filePath, sha, symbolChanges, author) {
        const now = new Date().toISOString();
        // Get current file hotspot data
        const existing = this.getFileHotspot(filePath);
        // Calculate metrics for this file
        const metrics = await this.calculateFileMetrics(filePath, sha, symbolChanges, author);
        // Update or insert file hotspot
        const stmt = this.dbManager.getDatabase().prepare(`
      INSERT OR REPLACE INTO file_hotspots
      (file_path, total_commits, total_changes, unique_authors,
       last_changed_sha, last_changed_date, hotspot_score,
       first_seen_sha, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const totalCommits = (existing?.totalCommits || 0) + 1;
        const totalChanges = (existing?.totalChanges || 0) + symbolChanges.length;
        const uniqueAuthors = await this.updateAuthorCount(filePath, author || 'unknown');
        stmt.run(filePath, totalCommits, totalChanges, uniqueAuthors, sha, now, metrics.hotspotScore, existing?.firstSeenSha || sha, metrics.riskLevel);
        (0, logger_1.logDebug)(`[HotspotDetector] Updated file hotspot: ${filePath} (score: ${metrics.hotspotScore.toFixed(1)})`);
    }
    /**
     * Batch update hotspot metrics for multiple symbols (optimized)
     */
    async batchUpdateSymbols(symbols, sha) {
        if (symbols.length === 0)
            return;
        const db = this.dbManager.getDatabase();
        const now = new Date().toISOString();
        // Generate cache key from symbols + SHA
        const cacheKey = this.generateCacheKey(symbols, sha);
        const cacheHash = crypto.createHash('sha256').update(cacheKey).digest('hex');
        // Check cache (TTL 3600s)
        const cached = this.getCachedResult(cacheHash);
        if (cached) {
            (0, logger_1.logDebug)(`[HotspotDetector] Cache hit for batch update (${symbols.length} symbols)`);
            return;
        }
        // Get existing hotspots for deduplication
        const dnaIds = symbols.filter(s => s.dnaId).map(s => s.dnaId);
        if (dnaIds.length === 0)
            return;
        const placeholders = dnaIds.map(() => '?').join(',');
        const existingStmt = db.prepare(`
      SELECT symbol_id, hotspot_score FROM symbol_hotspots
      WHERE symbol_id IN (${placeholders})
    `);
        const existing = new Map();
        const existingRows = existingStmt.all(...dnaIds);
        for (const row of existingRows) {
            existing.set(row.symbol_id, row.hotspot_score);
        }
        // Prepare batch insert statement
        const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO symbol_hotspots
      (symbol_id, file_path, symbol_type, symbol_name,
       total_modifications, total_commits, last_change_type,
       last_changed_sha, last_changed_date, hotspot_score, risk_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        // Calculate metrics for all symbols first (before transaction)
        const symbolMetrics = new Map();
        for (const symbol of symbols) {
            if (!symbol.dnaId)
                continue;
            try {
                const metrics = await this.calculateSymbolMetrics(symbol.dnaId, sha);
                symbolMetrics.set(symbol.dnaId, metrics);
            }
            catch (error) {
                (0, logger_1.logDebug)(`[HotspotDetector] Failed to calculate metrics for ${symbol.name}: ${error.message}`);
            }
        }
        // Process symbols in batch transaction
        const batch = db.transaction((symbols) => {
            let skipped = 0;
            let updated = 0;
            for (const symbol of symbols) {
                if (!symbol.id || !symbol.dnaId) {
                    skipped++;
                    continue;
                }
                const filePath = symbol.id.includes(':') ? symbol.id.split(':')[0] : '';
                if (!filePath || filePath.trim() === '') {
                    skipped++;
                    continue;
                }
                const metrics = symbolMetrics.get(symbol.dnaId);
                if (!metrics) {
                    skipped++;
                    continue;
                }
                try {
                    // Get existing hotspot
                    const existingHotspot = this.getSymbolHotspot(symbol.dnaId);
                    // Deduplication: skip if score delta < 5%
                    const existingScore = existing.get(symbol.dnaId);
                    if (existingScore !== undefined) {
                        const scoreDelta = Math.abs(metrics.hotspotScore - existingScore);
                        const scoreDeltaPercent = existingScore > 0 ? (scoreDelta / existingScore) * 100 : 0;
                        if (scoreDeltaPercent < 5) {
                            skipped++;
                            continue;
                        }
                    }
                    const totalModifications = (existingHotspot?.totalModifications || 0) + 1;
                    const totalCommits = (existingHotspot?.totalCommits || 0) + 1;
                    insertStmt.run([
                        symbol.dnaId,
                        filePath,
                        symbol.kind,
                        symbol.name,
                        totalModifications,
                        totalCommits,
                        'modified',
                        sha,
                        now,
                        metrics.hotspotScore,
                        metrics.riskLevel
                    ]);
                    updated++;
                }
                catch (error) {
                    (0, logger_1.logDebug)(`[HotspotDetector] Failed to update symbol hotspot ${symbol.name}: ${error.message}`);
                    skipped++;
                }
            }
            return { updated, skipped };
        });
        const result = batch(symbols);
        (0, logger_1.logDebug)(`[HotspotDetector] Batch updated ${result.updated} symbols, skipped ${result.skipped} (dedup/cache)`);
        // Cache the result (pass original cacheKey for cache_key, hash for cache_hash)
        this.setCachedResult(cacheKey, cacheHash, now);
    }
    /**
     * Update hotspot metrics for a symbol
     */
    async updateSymbolHotspot(symbol, sha) {
        // Early validation
        if (!symbol.id || !symbol.dnaId) {
            (0, logger_1.logDebug)(`[HotspotDetector] Skipping invalid symbol ${symbol.name}: missing id/dnaId`);
            return;
        }
        // Extract file path from symbol ID (format: "file/path.ext:symbolName")
        const filePath = symbol.id.includes(':') ? symbol.id.split(':')[0] : '';
        // Skip if we can't extract a valid file path
        if (!filePath || filePath.trim() === '') {
            (0, logger_1.logDebug)(`[HotspotDetector] Skipping symbol ${symbol.name}: no valid file path from ID ${symbol.id}`);
            return;
        }
        try {
            const now = new Date().toISOString();
            // Get current symbol hotspot data
            const existing = this.getSymbolHotspot(symbol.dnaId);
            // Calculate metrics for this symbol
            const metrics = await this.calculateSymbolMetrics(symbol.dnaId, sha);
            // Update or insert symbol hotspot
            const stmt = this.dbManager.getDatabase().prepare(`
        INSERT OR REPLACE INTO symbol_hotspots
        (symbol_id, file_path, symbol_type, symbol_name,
         total_modifications, total_commits, last_change_type,
         last_changed_sha, last_changed_date, hotspot_score, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
            const totalModifications = (existing?.totalModifications || 0) + 1;
            const totalCommits = (existing?.totalCommits || 0) + 1;
            stmt.run([
                symbol.dnaId,
                filePath,
                symbol.kind,
                symbol.name,
                totalModifications,
                totalCommits,
                'modified',
                sha,
                now,
                metrics.hotspotScore,
                metrics.riskLevel
            ]);
            (0, logger_1.logDebug)(`[HotspotDetector] Updated symbol hotspot: ${symbol.name} (score: ${metrics.hotspotScore.toFixed(1)}, file: ${filePath})`);
        }
        catch (error) {
            (0, logger_1.logDebug)(`[HotspotDetector] Failed to update symbol hotspot ${symbol.name} (id: ${symbol.id}): ${error.message}`);
            // Don't throw - gracefully skip problematic symbols
        }
    }
    /**
     * Get top N hotspot files
     */
    async getTopFileHotspots(limit = 20) {
        const stmt = this.dbManager.getDatabase().prepare(`
      SELECT * FROM file_hotspots
      ORDER BY hotspot_score DESC
      LIMIT ?
    `);
        const rows = stmt.all(limit);
        return rows.map((row) => ({
            filePath: row.file_path,
            totalCommits: row.total_commits,
            totalChanges: row.total_changes,
            uniqueAuthors: row.unique_authors,
            lastChangedSha: row.last_changed_sha,
            lastChangedDate: row.last_changed_date,
            hotspotScore: row.hotspot_score,
            firstSeenSha: row.first_seen_sha,
            riskLevel: row.risk_level
        }));
    }
    /**
     * Get top N hotspot symbols
     */
    async getTopSymbolHotspots(limit = 20, filterByFile) {
        let query = `
      SELECT * FROM symbol_hotspots
      WHERE 1=1
    `;
        const params = [];
        if (filterByFile) {
            query += ` AND file_path = ?`;
            params.push(filterByFile);
        }
        query += ` ORDER BY hotspot_score DESC LIMIT ?`;
        params.push(limit);
        const stmt = this.dbManager.getDatabase().prepare(query);
        const rows = stmt.all(...params);
        return rows.map((row) => ({
            symbolId: row.symbol_id,
            filePath: row.file_path,
            symbolType: row.symbol_type,
            symbolName: row.symbol_name,
            totalModifications: row.total_modifications,
            totalCommits: row.total_commits,
            lastChangeType: row.last_change_type,
            lastChangedSha: row.last_changed_sha,
            lastChangedDate: row.last_changed_date,
            hotspotScore: row.hotspot_score,
            riskLevel: row.risk_level
        }));
    }
    /**
     * Get hotspot trend over time
     */
    async getHotspotTrend(entityType, entityId, since) {
        let query = `
      SELECT * FROM hotspot_snapshots
      WHERE entity_type = ? AND entity_id = ?
    `;
        const params = [entityType, entityId];
        if (since) {
            query += ` AND snapshot_date >= ?`;
            params.push(since.toISOString());
        }
        query += ` ORDER BY snapshot_date ASC`;
        const stmt = this.dbManager.getDatabase().prepare(query);
        const rows = stmt.all(...params);
        return rows.map((row) => ({
            snapshotSha: row.snapshot_sha,
            snapshotDate: row.snapshot_date,
            entityType: row.entity_type,
            entityId: row.entity_id,
            hotspotScore: row.hotspot_score,
            totalChanges: row.total_changes
        }));
    }
    /**
     * Create periodic snapshot for trend analysis
     */
    async createSnapshot(sha) {
        const now = new Date().toISOString();
        // Snapshot file hotspots
        const fileHotspots = await this.getTopFileHotspots(1000); // Get all
        for (const hotspot of fileHotspots) {
            if (!hotspot.filePath)
                continue; // Skip hotspots with null file paths
            const stmt = this.dbManager.getDatabase().prepare(`
        INSERT INTO hotspot_snapshots
        (snapshot_sha, snapshot_date, entity_type, entity_id, hotspot_score, total_changes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run([
                sha,
                now,
                'file',
                hotspot.filePath,
                hotspot.hotspotScore,
                hotspot.totalChanges
            ]);
        }
        // Snapshot symbol hotspots
        const symbolHotspots = await this.getTopSymbolHotspots(1000); // Get all
        for (const hotspot of symbolHotspots) {
            if (!hotspot.symbolId)
                continue; // Skip hotspots with null symbol IDs
            const stmt = this.dbManager.getDatabase().prepare(`
        INSERT INTO hotspot_snapshots
        (snapshot_sha, snapshot_date, entity_type, entity_id, hotspot_score, total_changes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
            stmt.run([
                sha,
                now,
                'symbol',
                hotspot.symbolId,
                hotspot.hotspotScore,
                hotspot.totalModifications
            ]);
        }
        (0, logger_1.logInfo)(`[HotspotDetector] Created hotspot snapshot for ${fileHotspots.length} files and ${symbolHotspots.length} symbols`);
    }
    /**
     * Calculate metrics for a file
     */
    async calculateFileMetrics(filePath, sha, symbolChanges, author) {
        // Get historical data for this file
        const history = await this.getFileHistory(filePath);
        // Calculate commit frequency (how often it changes relative to total commits)
        const totalCommits = await this.getTotalCommitCount();
        const fileCommits = history.length;
        const commitFrequency = totalCommits > 0 ? Math.min(1, fileCommits / Math.sqrt(totalCommits)) : 0;
        // Calculate recency (exponential decay from last change)
        const lastChange = history.length > 0 ? new Date(history[history.length - 1]) : new Date();
        const daysSinceLastChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        const recency = Math.exp(-daysSinceLastChange / 30); // 30-day half-life
        // Calculate author diversity
        const uniqueAuthors = await this.getFileAuthorCount(filePath);
        const authorDiversity = Math.min(1, uniqueAuthors / 5); // Normalize to 0-1
        // Calculate change intensity (average symbol changes per commit)
        const avgChangesPerCommit = fileCommits > 0 ? symbolChanges.length / fileCommits : 0;
        const changeIntensity = Math.min(1, avgChangesPerCommit / 10); // Normalize
        // Calculate temporal clustering (burstiness of changes)
        const temporalClustering = this.calculateTemporalClustering(history);
        const metrics = {
            commitFrequency,
            recency,
            authorDiversity,
            changeIntensity,
            temporalClustering
        };
        const hotspotScore = this.calculateHotspotScore(metrics);
        const riskLevel = this.classifyRiskLevel(hotspotScore);
        return { hotspotScore, riskLevel };
    }
    /**
     * Calculate metrics for a symbol
     */
    async calculateSymbolMetrics(symbolId, sha) {
        // Get historical data for this symbol
        const history = await this.getSymbolHistory(symbolId);
        // Similar calculations as file metrics but for symbols
        const totalCommits = await this.getTotalCommitCount();
        const symbolCommits = history.length;
        const commitFrequency = totalCommits > 0 ? Math.min(1, symbolCommits / Math.sqrt(totalCommits)) : 0;
        const lastChange = history.length > 0 ? new Date(history[history.length - 1]) : new Date();
        const daysSinceLastChange = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
        const recency = Math.exp(-daysSinceLastChange / 30);
        // For symbols, use a simpler model
        const authorDiversity = 0.5; // Placeholder
        const changeIntensity = Math.min(1, symbolCommits / 20);
        const temporalClustering = this.calculateTemporalClustering(history);
        const metrics = {
            commitFrequency,
            recency,
            authorDiversity,
            changeIntensity,
            temporalClustering
        };
        const hotspotScore = this.calculateHotspotScore(metrics);
        const riskLevel = this.classifyRiskLevel(hotspotScore);
        return { hotspotScore, riskLevel };
    }
    /**
     * Calculate temporal clustering (burstiness)
     */
    calculateTemporalClustering(history) {
        if (history.length < 2)
            return 0;
        // Calculate gaps between changes
        const gaps = [];
        for (let i = 1; i < history.length; i++) {
            const gap = history[i].getTime() - history[i - 1].getTime();
            gaps.push(gap / (1000 * 60 * 60 * 24)); // Convert to days
        }
        // Calculate coefficient of variation (CV) of gaps
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const variance = gaps.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / gaps.length;
        const stdDev = Math.sqrt(variance);
        const cv = mean > 0 ? stdDev / mean : 0;
        // Higher CV means more clustered (bursty) changes
        return Math.min(1, cv / 2);
    }
    // Helper methods
    getFileHotspot(filePath) {
        const stmt = this.dbManager.getDatabase().prepare(`
      SELECT * FROM file_hotspots WHERE file_path = ?
    `);
        const row = stmt.get(filePath);
        if (!row)
            return null;
        return {
            filePath: row.file_path,
            totalCommits: row.total_commits,
            totalChanges: row.total_changes,
            uniqueAuthors: row.unique_authors,
            lastChangedSha: row.last_changed_sha,
            lastChangedDate: row.last_changed_date,
            hotspotScore: row.hotspot_score,
            firstSeenSha: row.first_seen_sha,
            riskLevel: row.risk_level
        };
    }
    getSymbolHotspot(symbolId) {
        const stmt = this.dbManager.getDatabase().prepare(`
      SELECT * FROM symbol_hotspots WHERE symbol_id = ?
    `);
        const row = stmt.get(symbolId);
        if (!row)
            return null;
        return {
            symbolId: row.symbol_id,
            filePath: row.file_path,
            symbolType: row.symbol_type,
            symbolName: row.symbol_name,
            totalModifications: row.total_modifications,
            totalCommits: row.total_commits,
            lastChangeType: row.last_change_type,
            lastChangedSha: row.last_changed_sha,
            lastChangedDate: row.last_changed_date,
            hotspotScore: row.hotspot_score,
            riskLevel: row.risk_level
        };
    }
    async getFileHistory(filePath) {
        const stmt = this.dbManager.getDatabase().prepare(`
      SELECT last_changed_date FROM file_hotspots
      WHERE file_path = ?
      UNION ALL
      SELECT snapshot_date FROM hotspot_snapshots
      WHERE entity_type = 'file' AND entity_id = ?
      ORDER BY last_changed_date ASC
    `);
        const rows = stmt.all(filePath, filePath);
        return rows.map((row) => new Date(row.last_changed_date || row.snapshot_date));
    }
    async getSymbolHistory(symbolId) {
        const stmt = this.dbManager.getDatabase().prepare(`
      SELECT last_changed_date FROM symbol_hotspots
      WHERE symbol_id = ?
      UNION ALL
      SELECT snapshot_date FROM hotspot_snapshots
      WHERE entity_type = 'symbol' AND entity_id = ?
      ORDER BY last_changed_date ASC
    `);
        const rows = stmt.all(symbolId, symbolId);
        return rows.map((row) => new Date(row.last_changed_date || row.snapshot_date));
    }
    async getTotalCommitCount() {
        const stmt = this.dbManager.getDatabase().prepare(`SELECT count(*) as count FROM commits_metadata`);
        const row = stmt.get();
        return row.count || 0;
    }
    async getFileAuthorCount(filePath) {
        // This is a simplified implementation
        // In a real system, we'd track authors per file
        return Math.min(5, Math.floor(Math.random() * 10) + 1); // Placeholder
    }
    async updateAuthorCount(filePath, author) {
        // This is a simplified implementation
        // In a real system, we'd maintain an author count per file
        const current = this.getFileHotspot(filePath);
        return (current?.uniqueAuthors || 0) + (author !== 'unknown' ? 1 : 0);
    }
    /**
     * Generate cache key from symbols and SHA
     */
    generateCacheKey(symbols, sha) {
        const symbolKeys = symbols
            .filter(s => s.dnaId)
            .map(s => `${s.dnaId}:${s.name}`)
            .sort()
            .join(',');
        return `${sha}:${symbolKeys}`;
    }
    /**
     * Get cached result if valid
     */
    getCachedResult(cacheHash) {
        const db = this.dbManager.getDatabase();
        const stmt = db.prepare(`
      SELECT expires_at FROM hotspot_cache
      WHERE cache_hash = ?
    `);
        // Use array syntax for consistency with sql.js
        const row = stmt.get([cacheHash]);
        if (!row)
            return false;
        const expiresAt = new Date(row.expires_at);
        if (expiresAt < new Date()) {
            // Expired, clean up
            const deleteStmt = db.prepare(`DELETE FROM hotspot_cache WHERE cache_hash = ?`);
            deleteStmt.run([cacheHash]);
            return false;
        }
        return true;
    }
    /**
     * Set cached result with TTL
     */
    setCachedResult(cacheKey, cacheHash, cachedAt) {
        if (!cacheKey || !cacheHash || !cachedAt) {
            (0, logger_1.logDebug)(`[HotspotDetector] Skipping cache: invalid params`);
            return;
        }
        const db = this.dbManager.getDatabase();
        const expiresAt = new Date(new Date(cachedAt).getTime() + 3600 * 1000); // TTL 3600s
        try {
            const stmt = db.prepare(`
        INSERT OR REPLACE INTO hotspot_cache
        (cache_key, cache_hash, cached_at, expires_at)
        VALUES (?, ?, ?, ?)
      `);
            // Use array syntax for sql.js (consistent with other batch operations)
            stmt.run([cacheKey, cacheHash, cachedAt, expiresAt.toISOString()]);
        }
        catch (error) {
            (0, logger_1.logDebug)(`[HotspotDetector] Cache insert failed: ${error.message}`);
            // Don't throw - caching is non-critical
        }
    }
    /**
     * Clean expired cache entries (call periodically)
     */
    async cleanExpiredCache() {
        const db = this.dbManager.getDatabase();
        const now = new Date().toISOString();
        const stmt = db.prepare(`DELETE FROM hotspot_cache WHERE expires_at < ?`);
        const result = stmt.run(now);
        if (result.changes > 0) {
            (0, logger_1.logDebug)(`[HotspotDetector] Cleaned ${result.changes} expired cache entries`);
        }
    }
}
exports.HotspotDetector = HotspotDetector;
