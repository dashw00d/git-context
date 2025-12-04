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

      // Extract file path from symbol ID (format: "filePath:symbolName" or "filePath:symbolName:hash")
      const fromFile = fromId.split(':')[0];
      const toFile = toId.split(':')[0];

      // Count outgoing refs FROM this file's symbols
      if (fromFile === filePath) {
        const symbolId = fromId.split(':').slice(1).join(':') || fromId;
        outgoing.set(symbolId, (outgoing.get(symbolId) || 0) + 1);
      }

      // Count incoming refs TO this file's symbols
      if (toFile === filePath) {
        const symbolId = toId.split(':').slice(1).join(':') || toId;
        incoming.set(symbolId, (incoming.get(symbolId) || 0) + 1);
      }
    });

    // Also check blastRadius for additional refs
    const blastIncoming = bundleFacts.evidence?.['scope.blastRadius']?.incoming || [];
    const blastOutgoing = bundleFacts.evidence?.['scope.blastRadius']?.outgoing || [];

    blastIncoming.forEach((ref: any) => {
      const toPath = ref.to?.split(':')[0] || ref.to;
      if (toPath === filePath) {
        const symbolId = ref.to?.split(':').slice(1).join(':') || ref.to || '';
        if (symbolId) {
          incoming.set(symbolId, (incoming.get(symbolId) || 0) + 1);
        }
      }
    });

    blastOutgoing.forEach((ref: any) => {
      const fromPath = ref.from?.split(':')[0] || ref.from;
      if (fromPath === filePath) {
        const symbolId = ref.from?.split(':').slice(1).join(':') || ref.from || '';
        if (symbolId) {
          outgoing.set(symbolId, (outgoing.get(symbolId) || 0) + 1);
        }
      }
    });

    return { incoming, outgoing };
  }, [bundleFacts, filePath]);
};
