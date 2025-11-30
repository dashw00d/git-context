import { SymbolInfo, SymbolDelta } from '../types';
import { SymbolContext, EdgeContext } from '../contracts/llmContext';
import { WorkingSnapshot } from './workingSnapshot';

/**
 * Convert symbol deltas from extractWorkingTreeSymbols to WorkingSnapshot format
 * This bridges the gap between change-based analysis and the snapshot-based report system
 */
export function convertDeltasToSnapshot(
    deltas: {
        added: SymbolInfo[];
        removed: SymbolInfo[];
        modified: SymbolDelta[];
    },
): WorkingSnapshot {
    const symbolsById = new Map<string, SymbolContext>();
    const symbolsByFile = new Map<string, SymbolContext[]>();
    const analyzedPaths = new Set<string>();

    // Helper to add symbol to maps
    const addSymbol = (symbol: SymbolInfo) => {
        const ctx: SymbolContext = {
            id: 0, // Placeholder for working snapshot (not from database)
            symbol_id: symbol.id,
            name: symbol.name,
            kind: symbol.kind,
            signature: symbol.signature,
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

        // Extract file path from symbol ID (format: "path:semanticId")
        const filePath = symbol.id.split(':')[0];
        if (!symbolsByFile.has(filePath)) {
            symbolsByFile.set(filePath, []);
        }
        symbolsByFile.get(filePath)!.push(ctx);
        analyzedPaths.add(filePath);
    };

    // Process added symbols
    for (const symbol of deltas.added) {
        addSymbol(symbol);
    }

    // Process modified symbols (use current state, not pre-state)
    for (const delta of deltas.modified) {
        addSymbol(delta.symbol);
    }

    // Note: Removed symbols are intentionally NOT included in working snapshot
    // They existed in HEAD but not in working tree, so they shouldn't appear
    // in the "working" state used for drift detection

    // For now, return empty edges - these can be added later via DependencyExtractor
    // if needed for more complete analysis
    const edges: EdgeContext[] = [];

    console.log(
        `[DELTA-SNAPSHOT] Converted ${deltas.added.length} added, ${deltas.modified.length} modified symbols to snapshot`
    );
    console.log(
        `[DELTA-SNAPSHOT] Removed ${deltas.removed.length} symbols (excluded from working snapshot)`
    );
    console.log(`[DELTA-SNAPSHOT] Total symbols in snapshot: ${symbolsById.size}`);
    console.log(`[DELTA-SNAPSHOT] Files analyzed: ${analyzedPaths.size}`);

    return {
        symbolsById,
        symbolsByFile,
        edges,
        analyzedPaths,
    };
}
