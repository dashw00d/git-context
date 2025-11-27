/**
 * Workspace Facts Adapter
 *
 * Adapter for WorkspaceIndexer logic
 * Provides workspace facts calculation for tests
 */

import { WorkspaceFacts } from '../analysis/workspaceIndexer';
import { SymbolInfo, EdgeInfo } from '../types';

export interface WorkspaceMetrics {
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  edgesAdded: number;
  edgesRemoved: number;
  totalSymbols: number;
  totalEdges: number;
  filesChanged: number;
  blastRadius: number;
  structuralChangeScore: number;
}

/**
 * Calculate workspace facts from symbols and edges
 * Simplified calculation for tests - real WorkspaceIndexer.analyzeWorkspace requires
 * full git/database context. This provides test metrics based on symbol/edge data.
 */
export function calculateWorkspaceFactsFromSymbols(
  symbols: Array<SymbolInfo & { status?: 'added' | 'modified' | 'removed' }>,
  edges: EdgeInfo[],
  filesChanged: number = 1
): WorkspaceMetrics {
  // Count symbols by status (workspace changes are typically all "added" or "modified")
  const symbolsAdded = symbols.filter(s => (s as any).status === 'added').length;
  const symbolsModified = symbols.filter(s => (s as any).status === 'modified').length;
  const symbolsRemoved = symbols.filter(s => (s as any).status === 'removed').length;
  const totalSymbols = symbols.length;

  // Count edges (workspace edges are typically new)
  const totalEdges = edges.length;
  const edgesAdded = edges.length;
  const edgesRemoved = 0;

  // Calculate blast radius (simplified)
  const blastRadius = symbols.length * 2;

  // Calculate structural change score (simplified)
  const structuralChangeScore = Math.min(symbols.length / 10, 1.0);

  return {
    symbolsAdded,
    symbolsModified,
    symbolsRemoved,
    edgesAdded,
    edgesRemoved,
    totalSymbols,
    totalEdges,
    filesChanged,
    blastRadius,
    structuralChangeScore
  };
}

/**
 * Create WorkspaceFacts from metrics
 */
export function createWorkspaceFacts(metrics: WorkspaceMetrics): WorkspaceFacts {
  return {
    workspaceHash: 'test-workspace-hash',
    headSha: 'test-head-sha',
    symbolsAdded: metrics.symbolsAdded,
    symbolsModified: metrics.symbolsModified,
    symbolsRemoved: metrics.symbolsRemoved,
    edgesAdded: metrics.edgesAdded,
    edgesRemoved: metrics.edgesRemoved,
    risks: [], // Simplified
    filesChanged: metrics.filesChanged,
    structuralChangeScore: metrics.structuralChangeScore,
    blastRadius: metrics.blastRadius
  };
}
