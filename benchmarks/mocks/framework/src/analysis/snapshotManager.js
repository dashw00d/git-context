"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnapshotManager = void 0;
const symbolDna_1 = require("./symbolDna");
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
const lru_cache_1 = require("lru-cache");
class SnapshotManager {
    constructor(db, symbolExtractor, dependencyExtractor) {
        this.db = db;
        this.symbolExtractor = symbolExtractor;
        this.dependencyExtractor = dependencyExtractor;
        this.snapshotCache = null;
        this.cacheHits = 0;
        this.cacheMisses = 0;
        const config = (0, config_1.getExtensionConfig)();
        if (config.snapshotCacheEnabled !== false) {
            this.initCache();
        }
    }
    initCache() {
        if (!this.snapshotCache) {
            const config = (0, config_1.getExtensionConfig)();
            if (config.snapshotCacheEnabled === false) {
                return; // Cache is disabled, don't create it
            }
            this.snapshotCache = new lru_cache_1.LRUCache({
                max: config.snapshotCacheSize || 50,
                ttl: (config.snapshotCacheTTL || 3600) * 1000,
                updateAgeOnGet: true,
                sizeCalculation: (value, key) => {
                    // Rough estimate: key length + JSON size
                    return key.length + JSON.stringify(value).length;
                },
                maxSize: 10 * 1024 * 1024,
                dispose: (value, key) => {
                    (0, logger_1.logDebug)(`[Snapshot] Evicted ${key.substring(0, 20)}... (size: ${JSON.stringify(value).length}B)`);
                }
            });
        }
    }
    /**
     * Clear the cache (useful for error recovery or reset)
     */
    clearCache() {
        this.snapshotCache?.clear();
        this.snapshotCache = null;
    }
    /**
     * Get cache statistics for observability
     */
    getCacheStats() {
        const total = this.cacheHits + this.cacheMisses;
        const hitRate = total > 0 ? this.cacheHits / total : 0;
        return {
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            hitRate: hitRate
        };
    }
    /**
     * Get or create snapshot for a blob (content-addressed caching)
     */
    async getOrCreateSnapshot(filePath, blobSha, content) {
        // Check LRU cache first
        const cacheKey = `${blobSha}:${filePath}`;
        this.initCache();
        const lruCached = this.snapshotCache?.get(cacheKey);
        if (lruCached) {
            (0, logger_1.logDebug)(`[Snapshot] LRU cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
            this.cacheHits++;
            return lruCached;
        }
        // Check database cache
        const cached = this.getCachedSnapshot(blobSha, filePath);
        if (cached) {
            (0, logger_1.logDebug)(`[Snapshot] DB cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
            this.cacheHits++;
            // Also cache in LRU for faster access
            this.snapshotCache?.set(cacheKey, cached);
            return cached;
        }
        this.cacheMisses++;
        // Parse with Tree-sitter
        (0, logger_1.logDebug)(`[Snapshot] Creating snapshot for ${filePath}@${blobSha.substring(0, 8)}`);
        const language = this.detectLanguage(filePath);
        // Extract symbols WITH body text
        const { symbols, bodyTexts } = await this.symbolExtractor.extractSymbolsWithBodies(content, filePath, language);
        // Assign DNA IDs
        const symbolsWithDNA = (0, symbolDna_1.assignDNAIds)(symbols, bodyTexts);
        const edges = this.dependencyExtractor.extractDependencies(content, filePath, symbolsWithDNA);
        const shapeHash = this.computeShapeHash(symbolsWithDNA);
        const bodyHash = this.computeAggregateBodyHash(symbolsWithDNA);
        const snapshot = {
            blobSha,
            filePath,
            language,
            symbols: symbolsWithDNA,
            edges,
            shapeHash,
            bodyHash
        };
        // Store to cache
        this.storeSnapshot(snapshot);
        // Also cache in LRU cache for faster access
        const lruCacheKey = `${blobSha}:${filePath}`;
        this.snapshotCache?.set(lruCacheKey, snapshot);
        return snapshot;
    }
    getCachedSnapshot(blobSha, filePath) {
        const stmt = this.db.prepare(`
      SELECT * FROM file_snapshots
      WHERE blob_sha = ? AND file_path = ?
    `);
        const row = stmt.get([blobSha, filePath]);
        if (!row)
            return null;
        return {
            blobSha: row.blob_sha,
            filePath: row.file_path,
            language: row.language,
            symbols: JSON.parse(row.symbols_json),
            edges: JSON.parse(row.edges_json),
            shapeHash: row.shape_hash,
            bodyHash: row.body_hash
        };
    }
    storeSnapshot(snapshot) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_snapshots
      (blob_sha, file_path, language, symbols_json, edges_json, shape_hash, body_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run([
            snapshot.blobSha,
            snapshot.filePath,
            snapshot.language,
            JSON.stringify(snapshot.symbols),
            JSON.stringify(snapshot.edges),
            snapshot.shapeHash || '',
            snapshot.bodyHash || '',
            new Date().toISOString()
        ]);
    }
    detectLanguage(filePath) {
        return (0, config_1.detectLanguage)(filePath) || 'unknown';
    }
    computeShapeHash(symbols) {
        // Simple shape hash: serialize kind + signature (ignore names)
        const shape = symbols
            .map(s => `${s.kind}:${s.signature}`)
            .sort()
            .join('|');
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(shape).digest('hex').substring(0, 16);
    }
    computeAggregateBodyHash(symbols) {
        const combined = symbols
            .map(s => s.bodyHash || '')
            .filter(Boolean)
            .sort()
            .join('|');
        const crypto = require('crypto');
        return crypto.createHash('sha256')
            .update(combined)
            .digest('hex')
            .substring(0, 16);
    }
    /**
     * Compare snapshots using DNA IDs (handles renames)
     */
    compareSnapshots(parentSnapshot, currentSnapshot) {
        const parentSymbols = parentSnapshot?.symbols || [];
        const currentSymbols = currentSnapshot.symbols;
        // Map by DNA ID (stable across renames)
        const parentByDNA = new Map(parentSymbols.map(s => [s.dnaId, s]));
        const currentByDNA = new Map(currentSymbols.map(s => [s.dnaId, s]));
        const added = [];
        const removed = [];
        const modified = [];
        const renamed = [];
        // Find added and modified (by DNA)
        for (const symbol of currentSymbols) {
            const prev = parentByDNA.get(symbol.dnaId);
            if (!prev) {
                added.push(symbol);
            }
            else {
                // Same DNA - check for modifications
                const sigChanged = prev.signature !== symbol.signature;
                const bodyChanged = prev.bodyHash !== symbol.bodyHash;
                const nameChanged = prev.name !== symbol.name;
                if (nameChanged && !sigChanged && !bodyChanged) {
                    // Pure rename (same signature + body, different name)
                    renamed.push({ symbol, previousSymbol: prev });
                }
                else if (sigChanged || bodyChanged) {
                    // Modified
                    const changeType = sigChanged && bodyChanged ? 'both'
                        : sigChanged ? 'signature'
                            : 'body';
                    modified.push({ symbol, previousSymbol: prev, changeType });
                }
                // else: no change (same name, signature, body)
            }
        }
        // Find removed (by DNA)
        for (const symbol of parentSymbols) {
            if (!currentByDNA.has(symbol.dnaId)) {
                removed.push(symbol);
            }
        }
        return { added, removed, modified, renamed };
    }
}
exports.SnapshotManager = SnapshotManager;
