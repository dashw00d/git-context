/**
 * Edge Counter
 *
 * Extracts edge counting logic from commitIndexer.ts
 * Provides metrics for edge analysis in tests
 */

import { EdgeInfo } from '../types';

export interface EdgeMetrics {
  edgesAdded: number;
  edgesRemoved: number;
  totalEdges: number;
  edgesByType: Record<string, number>;
  edgesByConfidence: {
    high: number; // >= 0.8
    medium: number; // 0.5-0.8
    low: number; // < 0.5
  };
}

/**
 * Count edges from a list of edges (typically from a single commit)
 */
export function countEdges(edges: EdgeInfo[]): EdgeMetrics {
  const edgesByType: Record<string, number> = {};
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;

  for (const edge of edges) {
    // Count by type
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;

    // Count by confidence
    const confidence = edge.confidence ?? 1.0; // Default to high if not specified
    if (confidence >= 0.8) {
      highConfidence++;
    } else if (confidence >= 0.5) {
      mediumConfidence++;
    } else {
      lowConfidence++;
    }
  }

  return {
    edgesAdded: edges.length, // For single commit/file context, all edges are "added"
    edgesRemoved: 0, // Would need diff context for removals
    totalEdges: edges.length,
    edgesByType,
    edgesByConfidence: {
      high: highConfidence,
      medium: mediumConfidence,
      low: lowConfidence,
    },
  };
}

/**
 * Compare two edge sets to calculate added/removed edges
 * Uses the same comparison logic as commitIndexer.ts for edge diffing
 */
export function compareEdgeSets(parentEdges: EdgeInfo[], currentEdges: EdgeInfo[]): EdgeMetrics {
  // Create edge ID sets for comparison
  const parentEdgeIds = new Set(parentEdges.map(e => `${e.from}-${e.to}-${e.type}`));
  const currentEdgeIds = new Set(currentEdges.map(e => `${e.from}-${e.to}-${e.type}`));

  // Find added and removed edges
  const addedEdges = currentEdges.filter(e => !parentEdgeIds.has(`${e.from}-${e.to}-${e.type}`));
  const removedEdges = parentEdges.filter(e => !currentEdgeIds.has(`${e.from}-${e.to}-${e.type}`));

  // Count by type across all edges
  const allEdges = [...addedEdges, ...currentEdges]; // Include both added and current for type stats
  const edgesByType: Record<string, number> = {};
  let highConfidence = 0;
  let mediumConfidence = 0;
  let lowConfidence = 0;

  for (const edge of allEdges) {
    edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;

    const confidence = edge.confidence ?? 1.0;
    if (confidence >= 0.8) {
      highConfidence++;
    } else if (confidence >= 0.5) {
      mediumConfidence++;
    } else {
      lowConfidence++;
    }
  }

  return {
    edgesAdded: addedEdges.length,
    edgesRemoved: removedEdges.length,
    totalEdges: currentEdges.length,
    edgesByType,
    edgesByConfidence: {
      high: highConfidence,
      medium: mediumConfidence,
      low: lowConfidence,
    },
  };
}
