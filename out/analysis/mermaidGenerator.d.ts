import { EdgeInfo, SymbolInfo } from '../types';
/**
 * Generate Mermaid graph visualizations for dependency graphs
 */
export declare class MermaidGenerator {
    /**
     * Generate Mermaid graph from edges and symbols
     */
    generateGraph(edges: EdgeInfo[], symbols: SymbolInfo[], options?: {
        maxNodes?: number;
        showConfidence?: boolean;
        highlightChanged?: string[];
    }): string;
    /**
     * Generate blast radius visualization
     */
    generateBlastRadiusGraph(changedSymbols: SymbolInfo[], blastRadius: {
        downstreamCallers: Map<string, any[]>;
        upstreamDependencies: Map<string, any[]>;
        impactScore: Map<string, number>;
    }): string;
    /**
     * Filter edges to most relevant ones for visualization
     */
    private filterRelevantEdges;
    /**
     * Format symbol ID for Mermaid node ID
     */
    private formatNodeId;
    /**
     * Get edge styling based on type and confidence
     */
    private getEdgeStyle;
    /**
     * Get edge label
     */
    private getEdgeLabel;
}
//# sourceMappingURL=mermaidGenerator.d.ts.map