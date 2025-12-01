/**
 * Blast Radius Calculator
 *
 * Adapter for the real blast radius calculation from dependencies.ts
 * Converts output to test-friendly format.
 */

import { DependencyExtractor } from '../analysis/dependencies';
import { SymbolInfo, EdgeInfo } from '../types';

export interface BlastRadiusMetrics {
  directImpact: number;
  indirectImpact: number;
  blastRadius: number;
  affectedSymbolIds: string[];
  highImpactDeps: number;
  lowImpactDeps: number;
  weightedBlastRadius: number;
  hasCircularDeps: boolean;
}

/**
 * Calculate blast radius metrics from symbol and edge data
 */
export function calculateBlastRadiusFromFacts(
  changedSymbolIds: Set<string>,
  edges: Array<{ from: string; to: string; type: string }>
): BlastRadiusMetrics {
  // Convert test data format to DependencyExtractor format
  const changedSymbols: SymbolInfo[] = Array.from(changedSymbolIds).map(id => ({
    id,
    dnaId: id, // Use id as dnaId for tests
    name: id.split(':').pop() || id,
    kind: 'function',
    signature: '',
    location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
  }));

  const allEdges: EdgeInfo[] = edges.map(edge => ({
    from: edge.from,
    to: edge.to,
    type: edge.type as any,
    confidence: 1.0,
  }));

  // Use real blast radius calculation
  const extractor = new DependencyExtractor();
  const blastRadiusResult = extractor.calculateBlastRadius(changedSymbols, allEdges);

  // Extract affected symbols from the result
  const affectedSymbols = new Set<string>();

  // Add all downstream callers (symbols that call the changed symbols)
  for (const callers of blastRadiusResult.downstreamCallers.values()) {
    callers.forEach(caller => affectedSymbols.add(caller.id));
  }

  // Remove the original changed symbols from the count (they don't "impact" themselves)
  changedSymbolIds.forEach(id => affectedSymbols.delete(id));

  const blastRadius = affectedSymbols.size;

  // Calculate edge-based metrics
  const { highImpactDeps, lowImpactDeps, weightedBlastRadius } = calculateEdgeMetrics(
    changedSymbolIds,
    edges
  );

  // Check for circular dependencies
  const hasCircularDeps = detectCircularDependencies(edges);

  return {
    directImpact: blastRadius,
    indirectImpact: 0, // Real implementation doesn't track levels yet
    blastRadius,
    affectedSymbolIds: Array.from(affectedSymbols),
    highImpactDeps,
    lowImpactDeps,
    weightedBlastRadius,
    hasCircularDeps,
  };
}

function calculateEdgeMetrics(
  changedSymbolIds: Set<string>,
  edges: Array<{ from: string; to: string; type: string }>
): { highImpactDeps: number; lowImpactDeps: number; weightedBlastRadius: number } {
  let highImpactDeps = 0;
  let lowImpactDeps = 0;
  let weightedBlastRadius = 0;

  // Weight edges based on their type
  const edgeWeights: Record<string, number> = {
    implements: 10, // High impact
    inherits: 8, // High impact
    calls: 5, // Medium impact
    references: 2, // Low impact
    imports: 1, // Low impact
  };

  for (const edge of edges) {
    if (changedSymbolIds.has(edge.to)) {
      const weight = edgeWeights[edge.type] || 1;
      weightedBlastRadius += weight;

      if (weight >= 8) {
        highImpactDeps++;
      } else {
        lowImpactDeps++;
      }
    }
  }

  return {
    highImpactDeps,
    lowImpactDeps,
    weightedBlastRadius,
  };
}

function detectCircularDependencies(
  edges: Array<{ from: string; to: string; type: string }>
): boolean {
  // Simple cycle detection using DFS
  const graph = buildAdjacencyList(edges);
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(node: string): boolean {
    if (recStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (hasCycle(node)) return true;
  }

  return false;
}

function buildAdjacencyList(
  edges: Array<{ from: string; to: string; type: string }>
): Map<string, string[]> {
  const graph = new Map<string, string[]>();

  for (const edge of edges) {
    if (!graph.has(edge.from)) {
      graph.set(edge.from, []);
    }
    graph.get(edge.from)!.push(edge.to);
  }

  return graph;
}
