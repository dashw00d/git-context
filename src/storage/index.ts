import { getDatabase } from './database';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';

export interface SearchResult {
  name: string;
  path: string;
  sha: string;
  summary_snippet: string;
  rank: number;
}

export interface SymbolContextForLLM {
  symbol: SymbolContext;
  history: Array<{
    sha: string;
    commit_message: string;
    date: string;
    change_type: string;
    mod_reason?: string;
  }>;
  related: {
    calls: string[];      // Symbols this calls
    called_by: string[];  // Symbols that call this
    imports: string[];    // Symbols this imports
  };
  diff_snippets?: {
    pre?: string;
    post?: string;
  };
}

export class SearchIndex {
  searchSymbols(query: string, limit: number = 50): SearchResult[] {
    const db = getDatabase();

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
    return stmt.all(likeQuery, likeQuery, limit) as SearchResult[];
  }

  searchSymbolsByName(name: string, limit: number = 20): SearchResult[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT name, path, sha, '' as summary_snippet, 0 as rank
      FROM symbols
      WHERE name LIKE ?
      ORDER BY name
      LIMIT ?
    `);
    return stmt.all(`%${name}%`, limit) as SearchResult[];
  }

  searchSymbolsByPath(path: string, limit: number = 20): SearchResult[] {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT name, path, sha, '' as summary_snippet, 0 as rank
      FROM symbols
      WHERE path LIKE ?
      ORDER BY path
      LIMIT ?
    `);
    return stmt.all(`%${path}%`, limit) as SearchResult[];
  }

  // Update summary snippets - no-op for now as we removed the FTS table
  updateSummarySnippet(symbolId: number, snippet: string): void {
    // No-op
  }

  // Rebuild FTS index - no-op
  rebuildIndex(): void {
    // No-op
  }

  /**
   * Get full context for a symbol (for LLM queries)
   * Returns symbol information, history, and related symbols
   */
  getSymbolContext(symbolId: string, limitHistory: number = 10): SymbolContextForLLM | null {
    const db = getDatabase();

    // Get latest symbol information
    const symbolStmt = db.prepare(`
      SELECT id, symbol_id, name, kind, path, signature_pre, signature_post,
             loc_pre, loc_post, change_type, mod_reason, diff_snippet_pre, diff_snippet_post
      FROM symbols
      WHERE symbol_id = ?
      ORDER BY sha DESC
      LIMIT 1
    `);
    const symbol = symbolStmt.get(symbolId) as any;

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
    const history = historyStmt.all(symbolId, limitHistory) as any[];

    // Get related symbols (edges)
    const callsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'calls'
      LIMIT 20
    `);
    const calls = callsStmt.all(symbolId) as any[];

    const calledByStmt = db.prepare(`
      SELECT DISTINCT from_symbol_id
      FROM edges
      WHERE to_symbol_id = ? AND edge_type = 'calls'
      LIMIT 20
    `);
    const calledBy = calledByStmt.all(symbolId) as any[];

    const importsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'imports'
      LIMIT 20
    `);
    const imports = importsStmt.all(symbolId) as any[];

    return {
      symbol: {
        id: symbol.id,
        symbol_id: symbol.symbol_id,
        name: symbol.name,
        kind: symbol.kind,
        signature: symbol.signature_post || symbol.signature_pre,
        loc_pre: symbol.loc_pre ? JSON.parse(symbol.loc_pre) : undefined,
        loc_post: symbol.loc_post ? JSON.parse(symbol.loc_post) : undefined,
        mod_reason: symbol.mod_reason as any,
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
  getSymbolHistory(symbolId: string, limit: number = 20): Array<{
    sha: string;
    commit_message: string;
    date: string;
    change_type: string;
    mod_reason?: string;
    path: string;
  }> {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT s.sha, c.message, c.date, s.change_type, s.mod_reason, s.path
      FROM symbols s
      JOIN commits c ON s.sha = c.sha
      WHERE s.symbol_id = ?
      ORDER BY c.date DESC
      LIMIT ?
    `);
    return stmt.all(symbolId, limit) as any[];
  }

  /**
   * Get related symbols (calls, called by, imports)
   */
  getRelatedSymbols(symbolId: string): {
    calls: string[];
    called_by: string[];
    imports: string[];
  } {
    const db = getDatabase();

    const callsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'calls'
      LIMIT 50
    `);
    const calls = callsStmt.all(symbolId) as any[];

    const calledByStmt = db.prepare(`
      SELECT DISTINCT from_symbol_id
      FROM edges
      WHERE to_symbol_id = ? AND edge_type = 'calls'
      LIMIT 50
    `);
    const calledBy = calledByStmt.all(symbolId) as any[];

    const importsStmt = db.prepare(`
      SELECT DISTINCT to_symbol_id
      FROM edges
      WHERE from_symbol_id = ? AND edge_type = 'imports'
      LIMIT 50
    `);
    const imports = importsStmt.all(symbolId) as any[];

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
  getSymbolsForLLM(symbolIds: string[]): Array<{
    id: string;
    name: string;
    kind: string;
    path: string;
    signature?: string;
    recent_changes: number;
  }> {
    const db = getDatabase();
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
    const results = stmt.all(...symbolIds) as any[];

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

// Singleton instance
let searchIndex: SearchIndex | null = null;

export function getSearchIndex(): SearchIndex {
  if (!searchIndex) {
    searchIndex = new SearchIndex();
  }
  return searchIndex;
}
