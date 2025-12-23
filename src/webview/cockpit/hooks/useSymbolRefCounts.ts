import * as React from 'react';
import { RefactorBundleFacts } from '../../../facts/types';

interface SymbolRefCounts {
  incoming: Map<string, number>; // symbolId → count of incoming refs
  outgoing: Map<string, number>; // symbolId → count of outgoing refs
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

    // Normalize the base filePath for comparison
    const normalizedTarget = filePath.replace(/\\/g, '/');

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

      const normalizedFrom = fromPath.replace(/\\/g, '/');
      const normalizedTo = toPath.replace(/\\/g, '/');

      // Count outgoing refs FROM this file's symbols
      if (normalizedFrom === normalizedTarget) {
        const symbolId = lastColonFrom !== -1 ? fromId.substring(lastColonFrom + 1) : fromId;
        outgoing.set(symbolId, (outgoing.get(symbolId) || 0) + 1);
      }

      // Count incoming refs TO this file's symbols
      if (normalizedTo === normalizedTarget) {
        const symbolId = lastColonTo !== -1 ? toId.substring(lastColonTo + 1) : toId;
        incoming.set(symbolId, (incoming.get(symbolId) || 0) + 1);
      }
    });

    // Note: scope.blastRadius is just an array of file paths, not an object with incoming/outgoing
    // Blast radius relationships are already captured in working.edges above

    return { incoming, outgoing };
  }, [bundleFacts, filePath]);
};
