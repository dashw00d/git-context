/**
 * Workspace Facts Adapter
 *
 * TEST-ONLY ADAPTER: Simplified workspace facts calculation for tests
 *
 * IMPORTANT: This is a simplified version for test fixtures that don't have git/database access.
 * The real pipeline uses WorkspaceIndexer.analyzeWorkspace() (called by workspaceStep.ts).
 *
 * Real function: WorkspaceIndexer.analyzeWorkspace(mode) in src/analysis/workspaceIndexer.ts
 * Runner step: createWorkspaceOverlayStep() in src/analysis/runner/steps/workspaceStep.ts
 *
 * This adapter provides test metrics based on symbol/edge data without requiring
 * git operations or file system access. For production, use WorkspaceIndexer.analyzeWorkspace() directly.
 */

import { WorkspaceFacts } from '../analysis/workspaceIndexer';
import { EdgeInfo, SymbolInfo } from '../types';

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
    structuralChangeScore,
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
    blastRadius: metrics.blastRadius,
  };
}
