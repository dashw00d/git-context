export interface SearchResult {
    name: string;
    path: string;
    sha: string;
    summary_snippet: string;
    rank: number;
}
export declare class SearchIndex {
    searchSymbols(query: string, limit?: number): SearchResult[];
    searchSymbolsByName(name: string, limit?: number): SearchResult[];
    searchSymbolsByPath(path: string, limit?: number): SearchResult[];
    updateSummarySnippet(symbolId: number, snippet: string): void;
    rebuildIndex(): void;
}
export declare function getSearchIndex(): SearchIndex;
//# sourceMappingURL=index.d.ts.map