import { getDatabase } from './database';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';
import { getQdrantClient } from './qdrantClient';
import { generateEmbedding, symbolToEmbeddingText, stringToPointId } from './embeddings';
import { NamingConvention, suggestConventionName } from '../analysis/namingConventions';

export interface SearchResult {
  name: string;
  path: string;
  sha: string;
  summary_snippet: string;
  rank: number;
}

export interface CommitSearchResult {
  sha: string;
  message: string;
  author: string;
  date: string;
  similarity: number;
  risks: string[];
}

export interface SymbolSearchFilters {
  kind?: string;           // function, class, method, etc.
  pathPattern?: string;    // e.g., "auth/**"
  changeType?: string;     // added, modified, removed
  minSimilarity?: number;  // 0.0-1.0
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
  private qdrant = getQdrantClient();

  /**
   * Enhanced search with Qdrant fallback to LIKE
   */
  async searchSymbols(query: string, limit: number = 50): Promise<SearchResult[]> {
    // Try Qdrant semantic search first
    if (await this.qdrant.isEnabled()) {
      try {
        return await this.searchSymbolsSemantic(query, limit);
      } catch (error) {
        console.warn('[Search] Qdrant search failed, falling back to LIKE:', error);
      }
    }

    // Fallback to original LIKE search
    return this.searchSymbolsLike(query, limit);
  }

  /**
   * Semantic search using Qdrant
   */
  private async searchSymbolsSemantic(query: string, limit: number): Promise<SearchResult[]> {
    const client = await this.qdrant.getClient();
    if (!client) {
      throw new Error('Qdrant client not available');
    }
    const queryEmbedding = await generateEmbedding(query);

    const results = await client.search('symbols', {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      score_threshold: 0.3 // Minimum similarity threshold
    });

    // Convert Qdrant results to SearchResult format
    const db = getDatabase();
    const searchResults: SearchResult[] = [];

    for (const result of results) {
      const payload = result.payload as any;
      const symbolId = payload.symbol_id as string;

      // Get full symbol details from SQLite
      const stmt = db.prepare(`
        SELECT name, path, sha, '' as summary_snippet
        FROM symbols
        WHERE symbol_id = ?
        ORDER BY sha DESC
        LIMIT 1
      `);
      const symbol = stmt.get(symbolId) as any;

      if (symbol) {
        searchResults.push({
          name: symbol.name,
          path: symbol.path,
          sha: symbol.sha,
          summary_snippet: symbol.summary_snippet || '',
          rank: result.score || 0
        });
      }
    }

    return searchResults;
  }

  /**
   * Original LIKE-based search (fallback)
   */
  private searchSymbolsLike(query: string, limit: number): SearchResult[] {
    const db = getDatabase();
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

  async searchSymbolsByName(name: string, limit: number = 20): Promise<SearchResult[]> {
    // Use enhanced search which handles Qdrant fallback
    return await this.searchSymbols(name, limit);
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

  /**
   * Hybrid search: semantic search with metadata filters (Qdrant feature)
   */
  async searchSymbolsHybrid(
    query: string,
    filters: SymbolSearchFilters = {},
    limit: number = 50
  ): Promise<SearchResult[]> {
    if (!(await this.qdrant.isEnabled())) {
      // Fallback: apply filters to LIKE search
      const results = this.searchSymbolsLike(query, limit);
      return results.filter(r => {
        if (filters.pathPattern) {
          const pattern = filters.pathPattern.replace(/\*\*/g, '');
          if (!r.path.includes(pattern)) return false;
        }
        return true;
      });
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return this.searchSymbolsLike(query, limit);
    }

    const queryEmbedding = await generateEmbedding(query);

    // Build Qdrant filter
    const must: any[] = [];
    if (filters.kind) {
      must.push({ key: 'kind', match: { value: filters.kind } });
    }
    if (filters.changeType) {
      must.push({ key: 'change_type', match: { value: filters.changeType } });
    }
    if (filters.pathPattern) {
      // Use text match for path filtering (remove glob patterns)
      const pathFilter = filters.pathPattern.replace(/\*\*/g, '').replace(/\*/g, '');
      must.push({ key: 'path', match: { text: pathFilter } });
    }

    const results = await client.search('symbols', {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      score_threshold: filters.minSimilarity || 0.3,
      filter: must.length > 0 ? { must } : undefined
    });

    // Convert to SearchResult format
    return results.map(result => {
      const payload = result.payload as any;
      return {
        name: payload.name,
        path: payload.path,
        sha: payload.sha,
        summary_snippet: '',
        rank: result.score || 0
      };
    });
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
      JOIN commits_metadata c ON s.sha = c.sha
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
      JOIN commits_metadata c ON s.sha = c.sha
      WHERE s.symbol_id = ?
      ORDER BY c.date DESC
      LIMIT ?
    `);
    return stmt.all(symbolId, limit) as any[];
  }

  /**
   * Find similar symbols (Qdrant-only feature)
   */
  async findSimilarSymbols(symbolId: string, limit: number = 10): Promise<SearchResult[]> {
    if (!(await this.qdrant.isEnabled())) {
      return []; // Not available without Qdrant
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return [];
    }
    
    // Get symbol's vector from Qdrant (use hashed ID)
    const pointId = stringToPointId(symbolId);
    const point = await client.retrieve('symbols', {
      ids: [pointId],
      with_vector: true
    });

    if (!point || point.length === 0) {
      return [];
    }

    const vector = point[0].vector as number[];

    // Search for similar symbols
    const results = await client.search('symbols', {
      vector,
      limit: limit + 1, // +1 to exclude self
      with_payload: true,
      score_threshold: 0.5
    });

    // Filter out self and convert
    const db = getDatabase();
    const searchResults: SearchResult[] = [];

    for (const result of results) {
      const payload = result.payload as any;
      if (payload.symbol_id === symbolId) continue; // Skip self

      const stmt = db.prepare(`
        SELECT name, path, sha, '' as summary_snippet
        FROM symbols
        WHERE symbol_id = ?
        ORDER BY sha DESC
        LIMIT 1
      `);
      const symbol = stmt.get(payload.symbol_id) as any;

      if (symbol) {
        searchResults.push({
          name: symbol.name,
          path: symbol.path,
          sha: symbol.sha,
          summary_snippet: symbol.summary_snippet || '',
          rank: result.score || 0
        });
      }
    }

    return searchResults;
  }

  /**
   * Find similar commits (Qdrant-only feature)
   */
  async findSimilarCommits(sha: string, limit: number = 5): Promise<CommitSearchResult[]> {
    if (!(await this.qdrant.isEnabled())) {
      return [];
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return [];
    }

    // Get commit's vector from Qdrant
    const pointId = stringToPointId(sha);
    const point = await client.retrieve('commits', {
      ids: [pointId],
      with_vector: true
    });

    if (!point || point.length === 0) {
      return [];
    }

    const vector = point[0].vector as number[];

    // Search for similar commits
    const results = await client.search('commits', {
      vector,
      limit: limit + 1, // +1 to exclude self
      with_payload: true,
      score_threshold: 0.5
    });

    return results
      .filter(r => (r.payload as any).sha !== sha)
      .map(r => ({
        sha: (r.payload as any).sha,
        message: (r.payload as any).message,
        author: (r.payload as any).author,
        date: (r.payload as any).date,
        similarity: r.score || 0,
        risks: (r.payload as any).risks || []
      }));
  }

  /**
   * Search commits semantically (Qdrant-only feature)
   */
  async searchCommits(query: string, limit: number = 10): Promise<CommitSearchResult[]> {
    if (!(await this.qdrant.isEnabled())) {
      return [];
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return [];
    }

    const queryEmbedding = await generateEmbedding(query);

    const results = await client.search('commits', {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      score_threshold: 0.3
    });

    return results.map(r => ({
      sha: (r.payload as any).sha,
      message: (r.payload as any).message,
      author: (r.payload as any).author,
      date: (r.payload as any).date,
      similarity: r.score || 0,
      risks: (r.payload as any).risks || []
    }));
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

  /**
   * Store refactor patterns in Qdrant (Qdrant-only feature)
   */
  async storePatterns(patterns: Array<{
    name: string;
    description: string;
    examples: string[];
    count: number;
    pct: number;
  }>, bundleShas: string[]): Promise<void> {
    if (!(await this.qdrant.isEnabled())) {
      return;
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return;
    }

    // Ensure collections exist before storing
    await this.qdrant.ensureCollections();

    const points: any[] = [];

    for (const pattern of patterns) {
      // Create embedding from pattern name + description + examples
      const embeddingText = [
        pattern.name,
        pattern.description,
        ...pattern.examples
      ].filter(Boolean).join(' ');

      const embedding = await generateEmbedding(embeddingText);
      const patternId = `${pattern.name}_${pattern.examples.join('_')}`;
      const pointId = stringToPointId(patternId);

      points.push({
        id: pointId,
        vector: embedding,
        payload: {
          pattern_id: patternId,
          name: pattern.name,
          description: pattern.description,
          examples: pattern.examples,
          count: pattern.count,
          pct: pattern.pct,
          bundle_shas: bundleShas
        }
      });
    }

    if (points.length > 0) {
      await client.upsert('patterns', {
        wait: true,
        points
      });
      console.log(`[Qdrant] Stored ${points.length} patterns`);
    }
  }

  /**
   * Search for similar patterns (Qdrant-only feature)
   */
  async findSimilarPatterns(query: string, limit: number = 10): Promise<Array<{
    name: string;
    description: string;
    examples: string[];
    similarity: number;
  }>> {
    if (!(await this.qdrant.isEnabled())) {
      return [];
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return [];
    }

    const queryEmbedding = await generateEmbedding(query);

    const results = await client.search('patterns', {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      score_threshold: 0.4
    });

    return results.map(r => {
      const payload = r.payload as any;
      return {
        name: payload.name,
        description: payload.description,
        examples: payload.examples || [],
        similarity: r.score || 0
      };
    });
  }

  /**
   * Get recommended symbols based on current context (Qdrant-only feature)
   */
  async getRecommendedSymbols(symbolIds: string[], limit: number = 10): Promise<SearchResult[]> {
    if (!(await this.qdrant.isEnabled()) || symbolIds.length === 0) {
      return [];
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return [];
    }

    // Get average vector of provided symbols
    const vectors: number[][] = [];
    for (const symbolId of symbolIds.slice(0, 5)) { // Limit to 5 for performance
      const pointId = stringToPointId(symbolId);
      const point = await client.retrieve('symbols', {
        ids: [pointId],
        with_vector: true
      });
      if (point && point.length > 0) {
        vectors.push(point[0].vector as number[]);
      }
    }

    if (vectors.length === 0) {
      return [];
    }

    // Average the vectors
    const avgVector = new Array(vectors[0].length).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < vec.length; i++) {
        avgVector[i] += vec[i];
      }
    }
    for (let i = 0; i < avgVector.length; i++) {
      avgVector[i] /= vectors.length;
    }

    // Search for similar symbols
    const results = await client.search('symbols', {
      vector: avgVector,
      limit: limit + symbolIds.length, // Extra to filter out provided symbols
      with_payload: true,
      score_threshold: 0.5
    });

    // Filter out provided symbols and convert
    const providedSet = new Set(symbolIds);
    const db = getDatabase();
    const recommendations: SearchResult[] = [];

    for (const result of results) {
      const payload = result.payload as any;
      if (providedSet.has(payload.symbol_id)) continue;

      const stmt = db.prepare(`
        SELECT name, path, sha, '' as summary_snippet
        FROM symbols
        WHERE symbol_id = ?
        ORDER BY sha DESC
        LIMIT 1
      `);
      const symbol = stmt.get(payload.symbol_id) as any;

      if (symbol && recommendations.length < limit) {
        recommendations.push({
          name: symbol.name,
          path: symbol.path,
          sha: symbol.sha,
          summary_snippet: symbol.summary_snippet || '',
          rank: result.score || 0
        });
      }
    }

    return recommendations;
  }

  /**
   * Get recommended commits for current refactor bundle (Qdrant-only feature)
   */
  async getRecommendedCommits(bundleShas: string[], limit: number = 5): Promise<CommitSearchResult[]> {
    if (!(await this.qdrant.isEnabled()) || bundleShas.length === 0) {
      return [];
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return [];
    }

    // Get average vector of bundle commits
    const vectors: number[][] = [];
    for (const sha of bundleShas.slice(0, 5)) { // Limit to 5 for performance
      const pointId = stringToPointId(sha);
      const point = await client.retrieve('commits', {
        ids: [pointId],
        with_vector: true
      });
      if (point && point.length > 0) {
        vectors.push(point[0].vector as number[]);
      }
    }

    if (vectors.length === 0) {
      return [];
    }

    // Average the vectors
    const avgVector = new Array(vectors[0].length).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < vec.length; i++) {
        avgVector[i] += vec[i];
      }
    }
    for (let i = 0; i < avgVector.length; i++) {
      avgVector[i] /= vectors.length;
    }

    // Search for similar commits
    const results = await client.search('commits', {
      vector: avgVector,
      limit: limit + bundleShas.length, // Extra to filter out bundle commits
      with_payload: true,
      score_threshold: 0.5
    });

    // Filter out bundle commits
    const bundleSet = new Set(bundleShas);
    return results
      .filter(r => !bundleSet.has((r.payload as any).sha))
      .slice(0, limit)
      .map(r => ({
        sha: (r.payload as any).sha,
        message: (r.payload as any).message,
        author: (r.payload as any).author,
        date: (r.payload as any).date,
        similarity: r.score || 0,
        risks: (r.payload as any).risks || []
      }));
  }

  /**
   * Get recommended patterns for current refactor (Qdrant-only feature)
   */
  async getRecommendedPatterns(bundleSummary: string, limit: number = 5): Promise<Array<{
    name: string;
    description: string;
    examples: string[];
    similarity: number;
  }>> {
    if (!(await this.qdrant.isEnabled())) {
      return [];
    }

    // Use bundle summary as query
    return await this.findSimilarPatterns(bundleSummary, limit);
  }

  /**
   * Get convention adoption timeline (Qdrant optional, uses SQLite)
   */
  async getConventionTimeline(
    convention: NamingConvention,
    sinceSha?: string
  ): Promise<Array<{
    sha: string;
    date: string;
    adoptionPercent: number;
    newSymbols: number;
    driftSymbols: number;
  }>> {
    const db = getDatabase();
    
    let query = `
      SELECT
        c.sha,
        c.date,
        COUNT(DISTINCT s.id) as total_symbols,
        SUM(CASE WHEN s.naming_convention = ? THEN 1 ELSE 0 END) as convention_symbols
      FROM commits_metadata c
      LEFT JOIN symbols s ON s.sha = c.sha
    `;
    
    const params: any[] = [convention];
    
    if (sinceSha) {
      query += ` WHERE c.sha >= ?`;
      params.push(sinceSha);
    }
    
    query += `
      GROUP BY c.sha, c.date
      ORDER BY c.date ASC
    `;
    
    const stmt = db.prepare(query);
    const results = stmt.all(...params) as Array<{
      sha: string;
      date: string;
      total_symbols: number;
      convention_symbols: number;
    }>;
    
    // Calculate cumulative adoption
    let cumulativeTotal = 0;
    let cumulativeConvention = 0;
    
    return results.map(r => {
      cumulativeTotal += r.total_symbols;
      cumulativeConvention += r.convention_symbols;
      const adoptionPercent = cumulativeTotal > 0 
        ? (cumulativeConvention / cumulativeTotal) * 100 
        : 0;
      
      return {
        sha: r.sha,
        date: r.date,
        adoptionPercent,
        newSymbols: r.total_symbols,
        driftSymbols: r.total_symbols - r.convention_symbols
      };
    });
  }

  /**
   * Find symbols still using old convention after transition (Qdrant optional)
   */
  async findConventionLaggers(
    oldConvention: NamingConvention,
    newConvention: NamingConvention,
    sinceSha?: string
  ): Promise<Array<{
    symbolId: string;
    name: string;
    path: string;
    convention: NamingConvention;
    lastModified: string;
    suggestedName: string;
  }>> {
    const db = getDatabase();
    
    let query = `
      SELECT 
        s.symbol_id,
        s.name,
        s.path,
        s.naming_convention,
        c.date as last_modified
      FROM symbols s
      JOIN commits_metadata c ON s.sha = c.sha
      WHERE s.naming_convention = ?
    `;
    
    const params: any[] = [oldConvention];
    
    if (sinceSha) {
      query += ` AND c.sha >= ?`;
      params.push(sinceSha);
    }
    
    query += `
      ORDER BY c.date DESC
    `;
    
    const stmt = db.prepare(query);
    const results = stmt.all(...params) as Array<{
      symbol_id: string;
      name: string;
      path: string;
      naming_convention: string;
      last_modified: string;
    }>;
    
    return results.map(r => ({
      symbolId: r.symbol_id,
      name: r.name,
      path: r.path,
      convention: r.naming_convention as NamingConvention,
      lastModified: r.last_modified,
      suggestedName: suggestConventionName(r.name, newConvention)
    }));
  }

  /**
   * Get file convention history over time
   */
  async getFileConventionHistory(path: string): Promise<Array<{
    sha: string;
    date: string;
    dominantConvention: NamingConvention | null;
    driftPercent: number;
    symbolCount: number;
  }>> {
    const db = getDatabase();
    
    const stmt = db.prepare(`
      SELECT 
        fc.sha,
        c.date,
        fc.dominant_convention,
        fc.drift_percent,
        fc.symbol_count
      FROM file_conventions fc
      JOIN commits_metadata c ON fc.sha = c.sha
      WHERE fc.path = ?
      ORDER BY c.date ASC
    `);
    
    const results = stmt.all(path) as Array<{
      sha: string;
      date: string;
      dominant_convention: string | null;
      drift_percent: number;
      symbol_count: number;
    }>;
    
    return results.map(r => ({
      sha: r.sha,
      date: r.date,
      dominantConvention: r.dominant_convention as NamingConvention | null,
      driftPercent: r.drift_percent,
      symbolCount: r.symbol_count
    }));
  }

  /**
   * Find semantically similar symbols with different naming conventions (Qdrant-only)
   */
  async findConventionInconsistencies(limit: number = 50): Promise<Array<{
    cluster: string;
    symbols: Array<{
      name: string;
      convention: NamingConvention;
      path: string;
      similarity: number;
    }>;
    suggestedConvention: NamingConvention;
  }>> {
    if (!(await this.qdrant.isEnabled())) {
      return [];
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return [];
    }

    // Get all symbols from database with conventions
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT DISTINCT symbol_id, name, naming_convention, path
      FROM symbols
      WHERE naming_convention IS NOT NULL AND naming_convention != 'unknown'
      ORDER BY sha DESC
    `);
    const symbols = stmt.all() as Array<{
      symbol_id: string;
      name: string;
      naming_convention: string;
      path: string;
    }>;

    if (symbols.length === 0) {
      return [];
    }

    // Group symbols by semantic similarity using Qdrant
    const clusters = new Map<string, Array<{
      name: string;
      convention: NamingConvention;
      path: string;
      similarity: number;
    }>>();

    // For each symbol, find similar ones
    for (const symbol of symbols.slice(0, limit)) {
      const pointId = stringToPointId(symbol.symbol_id);
      
      try {
        const point = await client.retrieve('symbols', {
          ids: [pointId],
          with_vector: true
        });

        if (!point || point.length === 0) continue;

        const vector = point[0].vector as number[];
        const results = await client.search('symbols', {
          vector,
          limit: 10,
          with_payload: true,
          score_threshold: 0.7
        });

        // Group by convention differences
        for (const result of results) {
          const payload = result.payload as any;
          if (payload.symbol_id === symbol.symbol_id) continue;

          const otherConvention = payload.naming_convention || 'unknown';
          if (otherConvention === symbol.naming_convention) continue; // Same convention, skip

          // Create cluster key based on semantic similarity
          const clusterKey = `${symbol.symbol_id}_${payload.symbol_id}`;
          
          if (!clusters.has(clusterKey)) {
            clusters.set(clusterKey, []);
          }

          clusters.get(clusterKey)!.push({
            name: payload.name,
            convention: otherConvention as NamingConvention,
            path: payload.path,
            similarity: result.score || 0
          });
        }
      } catch (error) {
        // Skip if Qdrant lookup fails
        continue;
      }
    }

    // Convert clusters to result format
    return Array.from(clusters.entries())
      .filter(([, symbols]) => symbols.length > 0)
      .map(([clusterKey, clusterSymbols]) => {
        // Find dominant convention in cluster
        const conventionCounts = new Map<NamingConvention, number>();
        for (const s of clusterSymbols) {
          conventionCounts.set(s.convention, (conventionCounts.get(s.convention) || 0) + 1);
        }
        const dominant = Array.from(conventionCounts.entries())
          .sort(([, a], [, b]) => b - a)[0]?.[0] || 'camelCase';

        return {
          cluster: clusterKey,
          symbols: clusterSymbols,
          suggestedConvention: dominant
        };
      })
      .slice(0, limit);
  }

  /**
   * Get convention recommendation based on similar refactors (Qdrant-only)
   */
  async getConventionRecommendations(bundleShas: string[]): Promise<{
    recommendedConvention: NamingConvention;
    confidence: number;
    similarRefactors: Array<{
      sha: string;
      convention: NamingConvention;
      similarity: number;
    }>;
  } | null> {
    if (!(await this.qdrant.isEnabled()) || bundleShas.length === 0) {
      return null;
    }

    const client = await this.qdrant.getClient();
    if (!client) {
      return null;
    }

    // Get average vector of bundle commits
    const vectors: number[][] = [];
    for (const sha of bundleShas.slice(0, 5)) {
      const pointId = stringToPointId(sha);
      try {
        const point = await client.retrieve('commits', {
          ids: [pointId],
          with_vector: true
        });
        if (point && point.length > 0) {
          vectors.push(point[0].vector as number[]);
        }
      } catch {
        continue;
      }
    }

    if (vectors.length === 0) {
      return null;
    }

    // Average the vectors
    const avgVector = new Array(vectors[0].length).fill(0);
    for (const vec of vectors) {
      for (let i = 0; i < vec.length; i++) {
        avgVector[i] += vec[i];
      }
    }
    for (let i = 0; i < avgVector.length; i++) {
      avgVector[i] /= vectors.length;
    }

    // Find similar commits
    const results = await client.search('commits', {
      vector: avgVector,
      limit: 10,
      with_payload: true,
      score_threshold: 0.5
    });

    // Get convention from symbols in similar commits
    const db = getDatabase();
    const conventionCounts = new Map<NamingConvention, number>();
    const similarRefactors: Array<{
      sha: string;
      convention: NamingConvention;
      similarity: number;
    }> = [];

    for (const result of results) {
      const payload = result.payload as any;
      const sha = payload.sha;
      
      // Get dominant convention from this commit's symbols
      const conventionStmt = db.prepare(`
        SELECT naming_convention, COUNT(*) as count
        FROM symbols
        WHERE sha = ? AND naming_convention IS NOT NULL AND naming_convention != 'unknown'
        GROUP BY naming_convention
        ORDER BY count DESC
        LIMIT 1
      `);
      const conventionResult = conventionStmt.get(sha) as { naming_convention: string } | undefined;
      
      if (conventionResult) {
        const convention = conventionResult.naming_convention as NamingConvention;
        conventionCounts.set(convention, (conventionCounts.get(convention) || 0) + 1);
        similarRefactors.push({
          sha,
          convention,
          similarity: result.score || 0
        });
      }
    }

    if (conventionCounts.size === 0) {
      return null;
    }

    // Find most common convention
    const dominant = Array.from(conventionCounts.entries())
      .sort(([, a], [, b]) => b - a)[0];

    return {
      recommendedConvention: dominant[0],
      confidence: dominant[1] / conventionCounts.size,
      similarRefactors
    };
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
