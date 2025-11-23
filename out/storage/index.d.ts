import { SymbolContext } from '../contracts/llmContext';
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
        calls: string[];
        called_by: string[];
        imports: string[];
    };
    diff_snippets?: {
        pre?: string;
        post?: string;
    };
}
export declare class SearchIndex {
    searchSymbols(query: string, limit?: number): SearchResult[];
    searchSymbolsByName(name: string, limit?: number): SearchResult[];
    searchSymbolsByPath(path: string, limit?: number): SearchResult[];
    updateSummarySnippet(symbolId: number, snippet: string): void;
    rebuildIndex(): void;
    /**
     * Get full context for a symbol (for LLM queries)
     * Returns symbol information, history, and related symbols
     */
    getSymbolContext(symbolId: string, limitHistory?: number): SymbolContextForLLM | null;
    /**
     * Get symbol history across commits
     */
    getSymbolHistory(symbolId: string, limit?: number): Array<{
        sha: string;
        commit_message: string;
        date: string;
        change_type: string;
        mod_reason?: string;
        path: string;
    }>;
    /**
     * Get related symbols (calls, called by, imports)
     */
    getRelatedSymbols(symbolId: string): {
        calls: string[];
        called_by: string[];
        imports: string[];
    };
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
    }>;
}
export declare function getSearchIndex(): SearchIndex;
//# sourceMappingURL=index.d.ts.map