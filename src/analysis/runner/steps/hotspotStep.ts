import { PipelineStep, PipelineState } from '../pipelineTypes';
import { HotspotDetector } from '../../hotspotDetector';
import { getDatabaseManager } from '../../../storage/database';
import { SymbolInfo } from '../../../types';
import { getCstTimelineManager } from '../../cstTimeline';
import { getExtensionConfig, isCstOnlyLanguage, detectLanguage } from '../../../utils/config';
import { isCstFact } from '../../../types/cstFacts';
import { logDebug } from '../../../utils/logger';

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

        // Update hybrid facts hotspots (CST facts)
        const config = getExtensionConfig();
        const enableCst = config.enableCstTracking ?? true;
        const enableAugment = config.enableCstAugmentation ?? false;

        if (enableCst || enableAugment) {
          const timelineManager = getCstTimelineManager();
          
          // Get all files in commit
          const filesStmt = db.prepare(`
            SELECT DISTINCT path FROM files WHERE sha = ?
          `);
          const fileRows = filesStmt.all(sha) as any[];

          for (const row of fileRows) {
            const filePath = row.path;
            const language = detectLanguage(filePath);
            if (!language) continue;

            const isCstOnly = isCstOnlyLanguage(language);
            if (!isCstOnly && !enableAugment) continue;

            try {
              const hybridFacts = await timelineManager.getPriorFacts(filePath, sha) || [];
              
              // Convert CST facts to SymbolInfo-like objects for hotspot scoring
              const cstSymbols: SymbolInfo[] = hybridFacts
                .filter(isCstFact)
                .map(fact => ({
                  id: fact.id,
                  dnaId: fact.dnaId,
                  name: fact.name,
                  kind: fact.kind as SymbolInfo['kind'],
                  signature: fact.signature,
                  location: fact.location
                }));

              // Update file hotspot with hybrid facts (frequent heading/property changes = doc/code hotspot)
              if (cstSymbols.length > 0) {
                await detector.updateFileHotspot(filePath, sha, cstSymbols);
              }

              // Update individual CST fact hotspots
              for (const sym of cstSymbols) {
                await detector.updateSymbolHotspot(sym, sha);
              }
            } catch (error) {
              logDebug(`[HotspotStep] Error updating hybrid hotspots for ${filePath}: ${error}`);
            }
          }
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
