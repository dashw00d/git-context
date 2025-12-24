import * as React from 'react';
import { RefactorBundleFacts } from '../../../facts/types';
import { logDebug } from '../../../utils/logger';

/**
 * Extract base name from a kind_name format (e.g., "function_handleClick" -> "handleClick")
 */
function extractBaseName(symbolId: string): string | null {
  const match = symbolId.match(/^(function|method|class|variable|object|property)_(.+)$/);
  return match ? match[2] : null;
}

interface SymbolRefCounts {
  incoming: Map<string, number>; // symbolId (DNA hash) → count of incoming refs
  outgoing: Map<string, number>; // symbolId (DNA hash) → count of outgoing refs
}

export const useSymbolRefCounts = (
  bundleFacts: RefactorBundleFacts | null | undefined,
  filePath: string
): SymbolRefCounts => {
  return React.useMemo(() => {
    const incoming = new Map<string, number>();
    const outgoing = new Map<string, number>();

    if (!bundleFacts || !filePath) {
      return { incoming, outgoing };
    }

    // Parse edges from evidence
    // Format can be: "from_symbol_id -> to_symbol_id (edge_type)" or object with from/to
    const edges = bundleFacts.evidence?.['working.edges'] || [];

    // Build symbol lookup maps for this file
    // Maps name -> DNA hash for symbols in this file
    const nameToHash = new Map<string, string>();
    const rawSymbols = (bundleFacts.evidence?.['working.symbols'] as any[]) || [];
    const normalizedTarget = filePath;

    // Parse working.symbols to build name -> hash mapping
    rawSymbols.forEach((s: any) => {
      if (typeof s === 'object' && s.filePath && s.id && s.name) {
        const symPath = s.filePath || '';
        if (symPath === normalizedTarget) {
          // Map name to DNA hash for symbols in this file
          nameToHash.set(s.name, s.id);
        }
      }
    });

    // Debug logging
    if (edges.length === 0) {
      logDebug(
        `[useSymbolRefCounts] No edges found in bundleFacts for ${filePath} (normalized: ${normalizedTarget})`
      );
    } else {
      logDebug(
        `[useSymbolRefCounts] Found ${edges.length} edges, ${nameToHash.size} symbols mapped for ${normalizedTarget}`
      );
    }

    let matchCount = 0;
    let incomingMatches = 0;
    let outgoingMatches = 0;
    let resolvedByName = 0;

    // Helper to resolve a symbol ID from edge to DNA hash
    const resolveToHash = (rawSymbolId: string): string => {
      // If it's already a hash (no kind_ prefix), return as-is
      const baseName = extractBaseName(rawSymbolId);
      if (!baseName) {
        return rawSymbolId; // Already a hash or unknown format
      }
      // Try to resolve name to hash
      const hash = nameToHash.get(baseName);
      if (hash) {
        resolvedByName++;
        return hash;
      }
      return rawSymbolId; // Return original if can't resolve
    };

    // Process edges array
    edges.forEach((edge: any) => {
      let fromId: string | undefined;
      let toId: string | undefined;

      if (typeof edge === 'string') {
        // String format: "from -> to (type)"
        const match = edge.match(/^(.+?)\s*->\s*(.+?)\s*\((.+)\)$/);
        if (!match) return;
        [, fromId, toId] = match;
      } else if (edge.from && edge.to) {
        // Object format
        fromId = edge.from;
        toId = edge.to;
      } else {
        return;
      }

      if (!fromId || !toId) return;

      // Use lastIndexOf(':') to safely handle Windows paths and composite IDs
      const lastColonFrom = fromId.lastIndexOf(':');
      const lastColonTo = toId.lastIndexOf(':');

      const fromPath = lastColonFrom !== -1 ? fromId.substring(0, lastColonFrom) : fromId;
      const toPath = lastColonTo !== -1 ? toId.substring(0, lastColonTo) : toId;

      // Normalize edge paths using the same method as target path (browser-compatible)
      const normalizedFrom = fromPath;
      const normalizedTo = toPath;

      // Count outgoing refs FROM this file's symbols
      if (normalizedFrom === normalizedTarget) {
        const rawSymbolId = lastColonFrom !== -1 ? fromId.substring(lastColonFrom + 1) : fromId;
        const symbolId = resolveToHash(rawSymbolId);
        outgoing.set(symbolId, (outgoing.get(symbolId) || 0) + 1);
        outgoingMatches++;
        matchCount++;
      }

      // Count incoming refs TO this file's symbols
      if (normalizedTo === normalizedTarget) {
        const rawSymbolId = lastColonTo !== -1 ? toId.substring(lastColonTo + 1) : toId;
        const symbolId = resolveToHash(rawSymbolId);
        incoming.set(symbolId, (incoming.get(symbolId) || 0) + 1);
        incomingMatches++;
        matchCount++;
      }
    });

    // Debug logging for match results
    if (edges.length > 0) {
      logDebug(
        `[useSymbolRefCounts] Matched ${matchCount} edges (${incomingMatches} incoming, ${outgoingMatches} outgoing, ${resolvedByName} resolved by name) for ${normalizedTarget}`
      );
      if (matchCount === 0 && edges.length > 0) {
        // Log sample edge paths for debugging mismatches
        const sampleEdges = edges.slice(0, 3);
        logDebug(
          `[useSymbolRefCounts] No matches found. Sample edge paths: ${JSON.stringify(
            sampleEdges.map((e: any) => {
              if (typeof e === 'string') {
                const match = e.match(/^(.+?)\s*->\s*(.+?)\s*\(/);
                if (match) {
                  const from = match[1];
                  const to = match[2];
                  const fromPath =
                    from.lastIndexOf(':') !== -1 ? from.substring(0, from.lastIndexOf(':')) : from;
                  const toPath =
                    to.lastIndexOf(':') !== -1 ? to.substring(0, to.lastIndexOf(':')) : to;
                  return { from: fromPath, to: toPath };
                }
              }
              return e;
            })
          )} vs target: ${normalizedTarget}`
        );
      }
    }

    // Note: scope.blastRadius is just an array of file paths, not an object with incoming/outgoing
    // Blast radius relationships are already captured in working.edges above

    return { incoming, outgoing };
  }, [bundleFacts, filePath]);
};
