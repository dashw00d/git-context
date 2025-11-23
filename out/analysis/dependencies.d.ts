import { SymbolInfo, EdgeInfo, FileChange } from '../types';
import { GitOperations } from './git';
export declare class DependencyExtractor {
    private readonly MAX_DEPTH;
    private resolvedSymbols;
    /**
     * Extract dependency edges from file content with confidence scoring
     */
    extractDependencies(content: string, filePath: string, symbols: SymbolInfo[], depth?: number): EdgeInfo[];
    /**
     * Extract import/require edges from file content with confidence
     */
    private extractImports;
    /**
     * Extract function calls from a symbol's content with confidence
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
    }, fileContents: Map<string, string>, files: FileChange[], git: GitOperations): Promise<{
        added: EdgeInfo[];
        removed: EdgeInfo[];
    }>;
    /**
     * Calculate graph metrics
     */
    calculateMetrics(edges: EdgeInfo[]): {
        fanIn: Map<string, number>;
        fanOut: Map<string, number>;
    };
    /**
     * Calculate blast radius for changed symbols
     */
    calculateBlastRadius(changedSymbols: SymbolInfo[], allEdges: EdgeInfo[]): {
        downstreamCallers: Map<string, SymbolInfo[]>;
        upstreamDependencies: Map<string, SymbolInfo[]>;
        impactScore: Map<string, number>;
    };
    /**
     * Check if a symbol ID is known/resolvable
     */
    private isSymbolKnown;
    /**
     * Check if an edge target is resolved
     */
    private isEdgeResolved;
    /**
     * Calculate confidence for an edge
     */
    private calculateEdgeConfidence;
}
//# sourceMappingURL=dependencies.d.ts.map