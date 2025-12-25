import { GitOperations } from '../analysis/git';
import { EdgeContext, SymbolContext } from '../contracts/llmContext';
import { SymbolDelta, SymbolInfo } from '../types';
import { logInfo } from '../utils/logger';
import { WorkingSnapshot } from './workingSnapshot';

/**
 * Convert symbol deltas from extractWorkingTreeSymbols to WorkingSnapshot format
 * This bridges the gap between change-based analysis and the snapshot-based report system
 */
export function convertDeltasToSnapshot(deltas: {
  added: SymbolInfo[];
  removed: SymbolInfo[];
  modified: SymbolDelta[];
}): WorkingSnapshot {
  const symbolsById = new Map<string, SymbolContext>();
  const symbolsByFile = new Map<string, SymbolContext[]>();
  const analyzedPaths = new Set<string>();

  const addSymbol = (symbol: SymbolInfo) => {
    const ctx: SymbolContext = {
      id: 0, // Placeholder for working snapshot (not from database)
      symbol_id: symbol.id, // id is now the DNA hash
      name: symbol.name,
      kind: symbol.kind,
      signature: symbol.signature,
      dnaId: symbol.id, // Keep for compatibility
      filePath: symbol.filePath, // Store file path
      loc_pre: symbol.location
        ? {
            start: {
              line: symbol.location.start.line,
              column: symbol.location.start.column,
            },
            end: {
              line: symbol.location.end.line,
              column: symbol.location.end.column,
            },
          }
        : undefined,
    };

    symbolsById.set(symbol.id, ctx);

    // Normalize path for consistent Map/Set operations
    const filePath = symbol.filePath;
    const normalizedPath = filePath ? GitOperations.normalizePath(filePath) : '';
    if (!symbolsByFile.has(normalizedPath)) {
      symbolsByFile.set(normalizedPath, []);
    }
    symbolsByFile.get(normalizedPath)!.push(ctx);
    analyzedPaths.add(normalizedPath);
  };

  for (const symbol of deltas.added) {
    addSymbol(symbol);
  }

  for (const delta of deltas.modified) {
    addSymbol(delta.symbol);
  }

  const edges: EdgeContext[] = [];

  logInfo(
    `Converted ${deltas.added.length} added, ${deltas.modified.length} modified symbols to snapshot`
  );
  logInfo(`Removed ${deltas.removed.length} symbols (excluded from working snapshot)`);
  logInfo(`Total symbols in snapshot: ${symbolsById.size}`);
  logInfo(`Files analyzed: ${analyzedPaths.size}`);

  return {
    symbolsById,
    symbolsByFile,
    edges,
    analyzedPaths,
  };
}
