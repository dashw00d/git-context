"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchIndex = exports.SearchIndex = void 0;
const database_1 = require("./database");
class SearchIndex {
    searchSymbols(query, limit = 50) {
        const db = (0, database_1.getDatabase)();
        // Simple LIKE search
        // Note: This is less powerful than FTS but works with standard sql.js
        const stmt = db.prepare(`
      SELECT name, path, sha, '' as summary_snippet, 0 as rank
      FROM symbols
      WHERE name LIKE ? OR path LIKE ?
      ORDER BY name
      LIMIT ?
    `);
        const likeQuery = `%${query}%`;
        return stmt.all(likeQuery, likeQuery, limit);
    }
    searchSymbolsByName(name, limit = 20) {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare(`
      SELECT name, path, sha, '' as summary_snippet, 0 as rank
      FROM symbols
      WHERE name LIKE ?
      ORDER BY name
      LIMIT ?
    `);
        return stmt.all(`%${name}%`, limit);
    }
    searchSymbolsByPath(path, limit = 20) {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare(`
      SELECT name, path, sha, '' as summary_snippet, 0 as rank
      FROM symbols
      WHERE path LIKE ?
      ORDER BY path
      LIMIT ?
    `);
        return stmt.all(`%${path}%`, limit);
    }
    // Update summary snippets - no-op for now as we removed the FTS table
    updateSummarySnippet(symbolId, snippet) {
        // No-op
    }
    // Rebuild FTS index - no-op
    rebuildIndex() {
        // No-op
    }
    /**
     * Get full context for a symbol (for LLM queries)
     * Returns symbol information, history, and related symbols
     */
    getSymbolContext(symbolId, limitHistory = 10) {
        const db = (0, database_1.getDatabase)();
        // Get latest symbol information
        const symbolStmt = db.prepare(`
      SELECT id, symbol_id, name, kind, path, signature_pre, signature_post,
             loc_pre, loc_post, change_type, mod_reason, diff_snippet_pre, diff_snippet_post
      FROM symbols
      WHERE symbol_id = ?
      ORDER BY sha DESC
      LIMIT 1
    `);
        const symbol = symbolStmt.get(symbolId);
        if (!symbol) {
            return null;
        }
        // Get commit history for this symbol
        const historyStmt = db.prepare(`
      SELECT s.sha, c.message, c.date, s.change_type, s.mod_reason
      FROM symbols s
      JOIN commits c ON s.sha = c.sha
      WHERE s.symbol_id = ?
      ORDER BY c.date DESC
      LIMIT ?
    `);
        const history = historyStmt.all(symbolId, limitHistory);
        // Get related symbols (edges)
        const callsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'calls'
      LIMIT 20
    `);
        const calls = callsStmt.all(symbolId);
        const calledByStmt = db.prepare(`
      SELECT DISTINCT from_symbol_id
      FROM edges
      WHERE to_symbol_id = ? AND edge_type = 'calls'
      LIMIT 20
    `);
        const calledBy = calledByStmt.all(symbolId);
        const importsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'imports'
      LIMIT 20
    `);
        const imports = importsStmt.all(symbolId);
        return {
            symbol: {
                id: symbol.id,
                symbol_id: symbol.symbol_id,
                name: symbol.name,
                kind: symbol.kind,
                signature: symbol.signature_post || symbol.signature_pre,
                loc_pre: symbol.loc_pre ? JSON.parse(symbol.loc_pre) : undefined,
                loc_post: symbol.loc_post ? JSON.parse(symbol.loc_post) : undefined,
                mod_reason: symbol.mod_reason,
                diff_snippet_pre: symbol.diff_snippet_pre,
                diff_snippet_post: symbol.diff_snippet_post
            },
            history: history.map(h => ({
                sha: h.sha,
                commit_message: h.message,
                date: h.date,
                change_type: h.change_type,
                mod_reason: h.mod_reason
            })),
            related: {
                calls: calls.map(c => c.to_symbol_id),
                called_by: calledBy.map(c => c.from_symbol_id),
                imports: imports.map(i => i.to_symbol_id)
            },
            diff_snippets: symbol.diff_snippet_pre || symbol.diff_snippet_post ? {
                pre: symbol.diff_snippet_pre,
                post: symbol.diff_snippet_post
            } : undefined
        };
    }
    /**
     * Get symbol history across commits
     */
    getSymbolHistory(symbolId, limit = 20) {
        const db = (0, database_1.getDatabase)();
        const stmt = db.prepare(`
      SELECT s.sha, c.message, c.date, s.change_type, s.mod_reason, s.path
      FROM symbols s
      JOIN commits c ON s.sha = c.sha
      WHERE s.symbol_id = ?
      ORDER BY c.date DESC
      LIMIT ?
    `);
        return stmt.all(symbolId, limit);
    }
    /**
     * Get related symbols (calls, called by, imports)
     */
    getRelatedSymbols(symbolId) {
        const db = (0, database_1.getDatabase)();
        const callsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'calls'
      LIMIT 50
    `);
        const calls = callsStmt.all(symbolId);
        const calledByStmt = db.prepare(`
      SELECT DISTINCT from_symbol_id
      FROM edges
      WHERE to_symbol_id = ? AND edge_type = 'calls'
      LIMIT 50
    `);
        const calledBy = calledByStmt.all(symbolId);
        const importsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'imports'
      LIMIT 50
    `);
        const imports = importsStmt.all(symbolId);
        return {
            calls: calls.map(c => c.to_symbol_id),
            called_by: calledBy.map(c => c.from_symbol_id),
            imports: imports.map(i => i.to_symbol_id)
        };
    }
    /**
     * Get symbols formatted for LLM consumption
     * Returns a compact representation suitable for prompt injection
     */
    getSymbolsForLLM(symbolIds) {
        const db = (0, database_1.getDatabase)();
        if (symbolIds.length === 0) {
            return [];
        }
        const placeholders = symbolIds.map(() => '?').join(',');
        const stmt = db.prepare(`
      SELECT symbol_id, name, kind, path, signature_post, signature_pre,
             COUNT(*) as recent_changes
      FROM symbols
      WHERE symbol_id IN (${placeholders})
      GROUP BY symbol_id
      ORDER BY recent_changes DESC
    `);
        const results = stmt.all(...symbolIds);
        return results.map(r => ({
            id: r.symbol_id,
            name: r.name,
            kind: r.kind,
            path: r.path,
            signature: r.signature_post || r.signature_pre,
            recent_changes: r.recent_changes
        }));
    }
}
exports.SearchIndex = SearchIndex;
// Singleton instance
let searchIndex = null;
function getSearchIndex() {
    if (!searchIndex) {
        searchIndex = new SearchIndex();
    }
    return searchIndex;
}
exports.getSearchIndex = getSearchIndex;
//# sourceMappingURL=index.js.map