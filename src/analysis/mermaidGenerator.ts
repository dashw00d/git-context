import { EdgeInfo, SymbolInfo } from '../types';
import { getDefaultThreshold } from '../utils/edgeThresholds';

export class MermaidGenerator {
  generateGraph(
    edges: EdgeInfo[],
    symbols: SymbolInfo[],
    options: {
      maxNodes?: number;
      showConfidence?: boolean;
      highlightChanged?: string[];
    } = {
      //empty
    }
  ): string {
    const { maxNodes = 50, showConfidence = false, highlightChanged = [] } = options;

    const filteredEdges = this.filterRelevantEdges(edges, maxNodes);

    const nodes = new Set<string>();
    const edgeDefinitions: string[] = [];

    for (const edge of filteredEdges) {
      nodes.add(this.formatNodeId(edge.from));
      nodes.add(this.formatNodeId(edge.to));

      const label = this.getEdgeLabel(edge, showConfidence);

      edgeDefinitions.push(
        `${this.formatNodeId(edge.from)} -->|"${label}"| ${this.formatNodeId(edge.to)}`
      );
    }

    let mermaid = 'graph TD\n';

    const changedNodeIds = highlightChanged.map(id => this.formatNodeId(id));
    for (const nodeId of changedNodeIds) {
      if (nodes.has(nodeId)) {
        mermaid += `    ${nodeId}:::changed\n`;
      }
    }

    for (const edgeDef of edgeDefinitions) {
      mermaid += `    ${edgeDef}\n`;
    }

    mermaid += '\n    classDef changed fill:#ff6b6b,stroke:#d63031,color:#fff\n';

    return mermaid;
  }

  generateBlastRadiusGraph(
    changedSymbols: SymbolInfo[],
    blastRadius: {
      downstreamCallers: Map<string, any[]>;
      upstreamDependencies: Map<string, any[]>;
      impactScore: Map<string, number>;
    }
  ): string {
    let mermaid = 'graph TD\n';

    for (const symbol of changedSymbols) {
      const nodeId = this.formatNodeId(symbol.id);
      const impact = blastRadius.impactScore.get(symbol.id) || 0;
      mermaid += `    ${nodeId}["${symbol.name}<br/>Impact: ${impact}"]:::changed\n`;
    }

    for (const [symbolId, callers] of blastRadius.downstreamCallers) {
      const sourceId = this.formatNodeId(symbolId);

      mermaid += `    Caller${callers.length} --> ${sourceId}\n`;
    }

    for (const [symbolId, dependencies] of blastRadius.upstreamDependencies) {
      const targetId = this.formatNodeId(symbolId);

      mermaid += `    ${targetId} --> Dep${dependencies.length}\n`;
    }

    mermaid += '\n    classDef changed fill:#ff6b6b,stroke:#d63031,color:#fff\n';

    return mermaid;
  }

  private filterRelevantEdges(edges: EdgeInfo[], maxNodes: number): EdgeInfo[] {
    const threshold = getDefaultThreshold();
    const sortedEdges = edges
      .filter(edge => (edge.confidence || 0) > threshold)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return sortedEdges.slice(0, maxNodes * 2);
  }

  private formatNodeId(symbolId: string): string {
    return 'N' + symbolId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
  }

  private getEdgeStyle(edge: EdgeInfo): string {
    let style = '';

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
