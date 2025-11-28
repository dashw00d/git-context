import { PipelineStep, PipelineState } from '../pipelineTypes';
import { HotspotDetectorV2 } from '../../hotspotDetector';
import { getDatabaseManager } from '../../../storage/database';
import { SymbolInfo } from '../../../types';
import { getCstTimelineManager } from '../../cstTimeline';
import { getExtensionConfig, isCstOnlyLanguage, detectLanguage } from '../../../utils/config';
import { isCstFact } from '../../../types/cstFacts';
import { logDebug } from '../../../utils/logger';
import { GitOperations } from '../../git';

function extractFileFromSymbolId(symbolId: string): string | null {
  const parts = symbolId.split(':');
  return parts.length >= 2 ? parts[0] : null;
}

export function createHotspotStep(): PipelineStep {
  return {
    id: 'hotspots',
    label: 'Update hotspot metrics',
    deps: ['index_commits'],

    async run(state: PipelineState) {
      const detector = new HotspotDetectorV2(); // V2 detector with BaseDetector enhancements
      const db = getDatabaseManager().getDatabase();

      if (state.selectedCommitShas.length === 0) {
        state.hotspots = [];
        return;
      }

      // Batch query all symbols across all commits
      const placeholders = state.selectedCommitShas.map(() => '?').join(',');
      const symbolsStmt = db.prepare(`
        SELECT s.symbol_id, s.name, s.kind, s.path, s.change_type, s.signature,
               sv.dna_id, s.sha
        FROM symbols s
        LEFT JOIN symbol_versions sv ON s.sha = sv.sha AND s.symbol_id = sv.symbol_id AND s.path = sv.path
        WHERE s.sha IN (${placeholders})
      `);
      const allSymbolRows = symbolsStmt.all(...state.selectedCommitShas) as any[];

      // Group symbols by SHA
      const symbolsBySha = new Map<string, { rows: any[]; symbols: SymbolInfo[] }>();
      for (const row of allSymbolRows) {
        if (!symbolsBySha.has(row.sha)) {
          symbolsBySha.set(row.sha, { rows: [], symbols: [] });
        }
        const group = symbolsBySha.get(row.sha)!;
        group.rows.push(row);
      }

      // Convert to SymbolInfo objects and group by file
      const fileUpdates = new Map<string, { sha: string; symbols: SymbolInfo[] }[]>();
      const symbolsByShaForBatch = new Map<string, SymbolInfo[]>();

      for (const sha of state.selectedCommitShas) {
        const group = symbolsBySha.get(sha);
        if (!group) continue;

        // Convert rows to SymbolInfo objects once
        const symbols: SymbolInfo[] = group.rows.map(row => ({
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

        // Store symbols for batch update
        symbolsByShaForBatch.set(sha, symbols);

        // Group by file for file hotspots
        const byFile = new Map<string, SymbolInfo[]>();
        for (let i = 0; i < symbols.length; i++) {
          const sym = symbols[i];
          const row = group.rows[i];
          const file = extractFileFromSymbolId(sym.id) || row.path;
          if (file) {
            if (!byFile.has(file)) byFile.set(file, []);
            byFile.get(file)!.push(sym);
          }
        }

        // Collect file updates for batching
        for (const [filePath, fileSymbols] of byFile) {
          if (!fileUpdates.has(filePath)) {
            fileUpdates.set(filePath, []);
          }
          fileUpdates.get(filePath)!.push({ sha, symbols: fileSymbols });
        }
      }

      // Batch update file hotspots (process all updates per file together)
      for (const [filePath, updates] of fileUpdates) {
        // Process updates sequentially per file (file hotspot needs sequential updates)
        for (const update of updates) {
          await detector.updateFileHotspot(filePath, update.sha, update.symbols);
        }
      }

      // Batch update symbol hotspots using existing batch method
      for (const [sha, symbols] of symbolsByShaForBatch) {
        await detector.batchUpdateSymbols(symbols, sha);
      }

      // Update hybrid facts hotspots (CST facts) - batch file queries
      const config = getExtensionConfig();
      const enableCst = config.enableCstTracking ?? true;
      const enableAugment = config.enableCstAugmentation ?? false;

      if (enableCst || enableAugment) {
        const timelineManager = getCstTimelineManager();
        
        // Batch query all files across all commits
        const filesStmt = db.prepare(`
          SELECT DISTINCT path, sha FROM files WHERE sha IN (${placeholders})
        `);
        const allFileRows = filesStmt.all(...state.selectedCommitShas) as any[];

        // Group files by SHA
        const filesBySha = new Map<string, string[]>();
        for (const row of allFileRows) {
          if (!filesBySha.has(row.sha)) {
            filesBySha.set(row.sha, []);
          }
          filesBySha.get(row.sha)!.push(row.path);
        }

        for (const sha of state.selectedCommitShas) {
          const filePaths = filesBySha.get(sha) || [];
          for (const filePath of filePaths) {
            const language = detectLanguage(filePath);
            if (!language) continue;

            const isCstOnly = isCstOnlyLanguage(language);
            if (!isCstOnly && !enableAugment) continue;

            try {
              const hybridFacts = await timelineManager.getPriorFacts(filePath, sha) || [];
              
              if (hybridFacts.length > 0) {
                logDebug(`[HotspotStep] Retrieved ${hybridFacts.length} hybrid facts for ${filePath}@${sha.substring(0, 8)}`);
              }
              
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
                // Batch update CST symbol hotspots
                await detector.batchUpdateSymbols(cstSymbols, sha);
              }
            } catch (error) {
              logDebug(`[HotspotStep] Error updating hybrid hotspots for ${filePath}: ${error}`);
            }
          }
        }
      }

      // Store top hotspots in state
      const fileHotspots = await detector.getTopFileHotspots(25);
      const symbolHotspots = await detector.getTopSymbolHotspots(25);

      // Enhance file hotspots with timeline version tracking
      if (state.explicitTimeline && state.explicitTimeline.length > 0) {
        const git = new GitOperations();
        
        for (const hotspot of fileHotspots) {
          const touchedVersions: string[] = [];
          
          // Check which timeline versions modified this file
          for (const version of state.explicitTimeline) {
            let wasTouched = false;
            
            if (version === 'workspace-unstaged' || version === 'workspace-staged') {
              // Check if file is in workspace changes
              const workspaceFiles = version === 'workspace-unstaged'
                ? await git.getUnstagedFiles()
                : await git.getStagedFiles();
              wasTouched = workspaceFiles.some(f => f.path === hotspot.filePath);
            } else {
              // Check if file was changed in this commit
              const sha = version === 'HEAD' 
                ? (state.selectedCommitShas?.[state.selectedCommitShas.length - 1] || 'HEAD')
                : version;
              const commitFiles = git.getFileChanges(sha);
              wasTouched = commitFiles.some(f => f.path === hotspot.filePath);
            }
            
            if (wasTouched) {
              touchedVersions.push(version);
            }
          }
          
          if (touchedVersions.length > 0) {
            hotspot.touchedInVersions = touchedVersions;
            hotspot.touchedInVersionsDescription = `${touchedVersions.length}/${state.explicitTimeline.length} versions`;
          }
        }
      }

      state.hotspots = [
        ...fileHotspots,
        ...symbolHotspots
      ];
    }
  };
}
