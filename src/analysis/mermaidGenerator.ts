import { EdgeInfo, SymbolInfo } from '../types';

/**
 * Generate Mermaid graph visualizations for dependency graphs
 */
export class MermaidGenerator {
  /**
   * Generate Mermaid graph from edges and symbols
   */
  generateGraph(edges: EdgeInfo[], symbols: SymbolInfo[], options: {
    maxNodes?: number;
    showConfidence?: boolean;
    highlightChanged?: string[];
  } = {}): string {
    const { maxNodes = 50, showConfidence = false, highlightChanged = [] } = options;

    // Filter to most relevant edges
    const filteredEdges = this.filterRelevantEdges(edges, maxNodes);

    // Build node and edge definitions
    const nodes = new Set<string>();
    const edgeDefinitions: string[] = [];

    for (const edge of filteredEdges) {
      nodes.add(this.formatNodeId(edge.from));
      nodes.add(this.formatNodeId(edge.to));

      const style = this.getEdgeStyle(edge, showConfidence);
      const label = this.getEdgeLabel(edge, showConfidence);

      edgeDefinitions.push(`${this.formatNodeId(edge.from)} -->|"${label}"| ${this.formatNodeId(edge.to)}`);
    }

    // Generate Mermaid code
    let mermaid = 'graph TD\n';

    // Add node styling for changed symbols
    const changedNodeIds = highlightChanged.map(id => this.formatNodeId(id));
    for (const nodeId of changedNodeIds) {
      if (nodes.has(nodeId)) {
        mermaid += `    ${nodeId}:::changed\n`;
      }
    }

    // Add edges
    for (const edgeDef of edgeDefinitions) {
      mermaid += `    ${edgeDef}\n`;
    }

    // Add styling
    mermaid += '\n    classDef changed fill:#ff6b6b,stroke:#d63031,color:#fff\n';

    return mermaid;
  }

  /**
   * Generate blast radius visualization
   */
  generateBlastRadiusGraph(
    changedSymbols: SymbolInfo[],
    blastRadius: {
      downstreamCallers: Map<string, any[]>;
      upstreamDependencies: Map<string, any[]>;
      impactScore: Map<string, number>;
    }
  ): string {
    let mermaid = 'graph TD\n';

    // Add changed symbols as central nodes
    for (const symbol of changedSymbols) {
      const nodeId = this.formatNodeId(symbol.id);
      const impact = blastRadius.impactScore.get(symbol.id) || 0;
      mermaid += `    ${nodeId}["${symbol.name}<br/>Impact: ${impact}"]:::changed\n`;
    }

    // Add downstream callers
    for (const [symbolId, callers] of blastRadius.downstreamCallers) {
      const sourceId = this.formatNodeId(symbolId);
      // Note: In a full implementation, we'd resolve caller names
      mermaid += `    Caller${callers.length} --> ${sourceId}\n`;
    }

    // Add upstream dependencies
    for (const [symbolId, dependencies] of blastRadius.upstreamDependencies) {
      const targetId = this.formatNodeId(symbolId);
      // Note: In a full implementation, we'd resolve dependency names
      mermaid += `    ${targetId} --> Dep${dependencies.length}\n`;
    }

    mermaid += '\n    classDef changed fill:#ff6b6b,stroke:#d63031,color:#fff\n';

    return mermaid;
  }

  /**
   * Filter edges to most relevant ones for visualization
   */
  private filterRelevantEdges(edges: EdgeInfo[], maxNodes: number): EdgeInfo[] {
    // Sort by confidence and keep only high-confidence edges
    const sortedEdges = edges
      .filter(edge => (edge.confidence || 0) > 0.5)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    // Limit to prevent overwhelming graphs
    return sortedEdges.slice(0, maxNodes * 2); // Allow ~2 edges per node
  }

  /**
   * Format symbol ID for Mermaid node ID
   */
  private formatNodeId(symbolId: string): string {
    // Mermaid node IDs must start with letters, no special chars
    return 'N' + symbolId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  }

  /**
   * Get edge styling based on type and confidence
   */
  private getEdgeStyle(edge: EdgeInfo, showConfidence: boolean): string {
    let style = '';

    // Different line styles for different edge types
    switch (edge.type) {
      case 'imports':
        style = 'stroke:#2ecc71,stroke-width:2px';
        break;
      case 'calls':
        style = 'stroke:#3498db,stroke-width:2px';
        break;
      case 'extends':
        style = 'stroke:#e74c3c,stroke-width:3px';
        break;
      case 'implements':
        style = 'stroke:#f39c12,stroke-width:3px,stroke-dasharray:5,5';
        break;
      default:
        style = 'stroke:#95a5a6,stroke-width:1px';
    }

    return style;
  }

  /**
   * Get edge label
   */
  private getEdgeLabel(edge: EdgeInfo, showConfidence: boolean): string {
    let label = edge.type;

    if (showConfidence && edge.confidence !== undefined) {
      label += ` (${Math.round(edge.confidence * 100)}%)`;
    }

    if (!edge.isResolved) {
      label += ' (?)';
    }

    return label;
  }
}
