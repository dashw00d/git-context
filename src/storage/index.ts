import { getDatabase } from './database';

export interface SearchResult {
  name: string;
  path: string;
  sha: string;
  summary_snippet: string;
  rank: number;
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
}

// Singleton instance
let searchIndex: SearchIndex | null = null;

export function getSearchIndex(): SearchIndex {
  if (!searchIndex) {
    searchIndex = new SearchIndex();
  }
  return searchIndex;
}
