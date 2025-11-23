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