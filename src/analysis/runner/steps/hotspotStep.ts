import { PipelineStep, PipelineState } from '../pipelineTypes';
import { HotspotDetector } from '../../hotspotDetector';
import { getDatabaseManager } from '../../../storage/database';
import { SymbolInfo } from '../../../types';

function extractFileFromSymbolId(symbolId: string): string | null {
  const parts = symbolId.split(':');
  return parts.length >= 2 ? parts[0] : null;
}

export function createHotspotStep(): PipelineStep {
  return {
    id: 'hotspots',
    label: 'Update hotspot metrics',
    deps: [],

    async run(state: PipelineState) {
      const detector = new HotspotDetector(); // Self-sufficient
      const db = getDatabaseManager().getDatabase();

      // Query DB directly for symbols per commit, joining with symbol_versions to get dna_id
      for (const sha of state.selectedCommitShas) {
        const symbolsStmt = db.prepare(`
          SELECT s.symbol_id, s.name, s.kind, s.path, s.change_type, s.signature,
                 sv.dna_id
          FROM symbols s
          LEFT JOIN symbol_versions sv ON s.sha = sv.sha AND s.symbol_id = sv.symbol_id AND s.path = sv.path
          WHERE s.sha = ?
        `);
        const symbolRows = symbolsStmt.all(sha) as any[];

        // Convert to SymbolInfo objects (minimal - detector will skip if dnaId missing)
        const symbols: SymbolInfo[] = symbolRows.map(row => ({
          id: row.symbol_id,
          dnaId: row.dna_id || row.symbol_id, // Fallback to symbol_id if dna_id not available
          name: row.name,
          kind: row.kind as SymbolInfo['kind'],
          signature: row.signature || '',
          location: {
            start: { line: 0, column: 0 }, // Placeholder - not used by hotspot detector
            end: { line: 0, column: 0 }
          }
        }));

        // Group by file for file hotspots
        const byFile = new Map<string, SymbolInfo[]>();
        for (let i = 0; i < symbols.length; i++) {
          const sym = symbols[i];
          const row = symbolRows[i];
          const file = extractFileFromSymbolId(sym.id) || row.path;
          if (file) {
            if (!byFile.has(file)) byFile.set(file, []);
            byFile.get(file)!.push(sym);
          }
        }

        // Update file hotspots
        for (const [filePath, fileSymbols] of byFile) {
          await detector.updateFileHotspot(filePath, sha, fileSymbols);
        }

        // Update symbol hotspots (detector will skip symbols without dnaId)
        for (const sym of symbols) {
          await detector.updateSymbolHotspot(sym, sha);
        }
      }

      // Store top hotspots in state
      state.hotspots = [
        ...(await detector.getTopFileHotspots(25)),
        ...(await detector.getTopSymbolHotspots(25))
      ];
    }
  };
}
