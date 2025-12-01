/**
 * Symbol Counter
 *
 * Pure functions for counting symbols by status and type.
 * Extracted from commitIndexer.ts for testability.
 */

export interface SymbolMetrics {
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  totalSymbols: number;
  symbolsByType: Record<string, number>;
  symbolsByStatus: Record<string, number>;
}

/**
 * Count symbols from a list of symbol objects with status information
 */
export function countSymbols(
  symbols: Array<{
    id: string;
    type: string;
    status: 'added' | 'modified' | 'removed';
  }>
): SymbolMetrics {
  const symbolsAdded = symbols.filter(s => s.status === 'added').length;
  const symbolsModified = symbols.filter(s => s.status === 'modified').length;
  const symbolsRemoved = symbols.filter(s => s.status === 'removed').length;
  const totalSymbols = symbols.length;

  // Count by type
  const symbolsByType: Record<string, number> = {};
  symbols.forEach(s => {
    symbolsByType[s.type] = (symbolsByType[s.type] || 0) + 1;
  });

  // Count by status
  const symbolsByStatus: Record<string, number> = {
    added: symbolsAdded,
    modified: symbolsModified,
    removed: symbolsRemoved,
  };

  return {
    symbolsAdded,
    symbolsModified,
    symbolsRemoved,
    totalSymbols,
    symbolsByType,
    symbolsByStatus,
  };
}

/**
 * Count symbols from symbol diff results (like those from snapshotManager.compareSnapshots)
 */
export function countSymbolsFromDiff(diff: {
  added: Array<{ id: string; type: string }>;
  modified: Array<{ id: string; type: string }>;
  removed: Array<{ id: string; type: string }>;
}): SymbolMetrics {
  const symbolsAdded = diff.added.length;
  const symbolsModified = diff.modified.length;
  const symbolsRemoved = diff.removed.length;
  const totalSymbols = symbolsAdded + symbolsModified + symbolsRemoved;

  // Count by type across all categories
  const symbolsByType: Record<string, number> = {};
  const allSymbols = [...diff.added, ...diff.modified, ...diff.removed];

  allSymbols.forEach(s => {
    symbolsByType[s.type] = (symbolsByType[s.type] || 0) + 1;
  });

  const symbolsByStatus: Record<string, number> = {
    added: symbolsAdded,
    modified: symbolsModified,
    removed: symbolsRemoved,
  };

  return {
    symbolsAdded,
    symbolsModified,
    symbolsRemoved,
    totalSymbols,
    symbolsByType,
    symbolsByStatus,
  };
}
