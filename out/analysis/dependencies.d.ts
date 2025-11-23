import { SymbolInfo, EdgeInfo } from '../types';
export declare class DependencyExtractor {
    private readonly MAX_DEPTH;
    /**
     * Extract dependency edges from file content
     */
    extractDependencies(content: string, filePath: string, symbols: SymbolInfo[], depth?: number): EdgeInfo[];
    /**
     * Extract import/require edges from file content
     */
    private extractImports;
    /**
     * Extract function calls from a symbol's content
     */
    private extractCallsFromSymbol;
    /**
     * Compare two sets of edges and determine changes
     */
    compareEdges(previous: EdgeInfo[], current: EdgeInfo[]): {
        added: EdgeInfo[];
        removed: EdgeInfo[];
    };
    /**
     * Extract edges for an entire commit
     */
    extractCommitEdges(sha: string, symbols: {
        added: SymbolInfo[];
        removed: SymbolInfo[];
        modified: any[];
    }, fileContents: Map<string, string>): {
        added: EdgeInfo[];
        removed: EdgeInfo[];
    };
    /**
     * Calculate graph metrics
     */
    calculateMetrics(edges: EdgeInfo[]): {
        fanIn: Map<string, number>;
        fanOut: Map<string, number>;
    };
}
//# sourceMappingURL=dependencies.d.ts.map