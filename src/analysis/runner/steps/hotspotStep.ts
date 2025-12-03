/* eslint-disable no-restricted-syntax */
import { prepare } from '../../../storage/statement-wrapper';
import { SymbolInfo } from '../../../types';
import { isCstFact } from '../../../types/cstFacts';
import { detectLanguage, getExtensionConfig, isCstOnlyLanguage } from '../../../utils/config';
import { logDebug } from '../../../utils/logger';
import { getCstTimelineManager } from '../../cstTimeline';
import { GitOperations } from '../../git';
import { HotspotDetectorV2 } from '../../hotspotDetector';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createHotspotStep(): PipelineStep {
  return {
    id: 'hotspots',
    label: 'Update hotspot metrics',
    deps: ['index_commits'],

    async run(state: PipelineState) {
      const detector = new HotspotDetectorV2();

      if (state.selectedCommitShas.length === 0) {
        state.hotspots = [];
        return;
      }

      const placeholders = state.selectedCommitShas.map(() => '?').join(',');
      const symbolsStmt = prepare(`
        SELECT s.symbol_id, s.name, s.kind, s.path, s.change_type, s.signature,
               sv.dna_id, s.sha
        FROM symbols s
        LEFT JOIN symbol_versions sv ON s.sha = sv.sha AND s.symbol_id = sv.symbol_id AND s.path = sv.path
        WHERE s.sha IN (${placeholders})
      `);
      const allSymbolRows = symbolsStmt.all(...state.selectedCommitShas) as any[];

      const symbolsBySha = new Map<string, { rows: any[]; symbols: SymbolInfo[] }>();
      for (const row of allSymbolRows) {
        if (!symbolsBySha.has(row.sha)) {
          symbolsBySha.set(row.sha, { rows: [], symbols: [] });
        }
        const group = symbolsBySha.get(row.sha)!;
        group.rows.push(row);
      }

      const fileUpdates = new Map<string, { sha: string; symbols: SymbolInfo[] }[]>();
      const symbolsByShaForBatch = new Map<string, SymbolInfo[]>();

      for (const sha of state.selectedCommitShas) {
        const group = symbolsBySha.get(sha);
        if (!group) continue;

        const symbols: SymbolInfo[] = group.rows.map(row => ({
          id: row.dna_id || row.symbol_id, // id is now the DNA hash
          filePath: row.path || '',
          name: row.name,
          kind: row.kind as SymbolInfo['kind'],
          signature: row.signature || '',
          location: {
            start: { line: 0, column: 0 }, // Placeholder - not used by hotspot detector
            end: { line: 0, column: 0 },
          },
        }));

        symbolsByShaForBatch.set(sha, symbols);

        const byFile = new Map<string, SymbolInfo[]>();
        for (let i = 0; i < symbols.length; i++) {
          const sym = symbols[i];
          const row = group.rows[i];
          const file = sym.filePath || row.path;
          if (file) {
            if (!byFile.has(file)) byFile.set(file, []);
            byFile.get(file)!.push(sym);
          }
        }

        for (const [filePath, fileSymbols] of byFile) {
          if (!fileUpdates.has(filePath)) {
            fileUpdates.set(filePath, []);
          }
          fileUpdates.get(filePath)!.push({ sha, symbols: fileSymbols });
        }
      }

      for (const [filePath, updates] of fileUpdates) {
        for (const update of updates) {
          await detector.updateFileHotspot(filePath, update.sha, update.symbols);
        }
      }

      for (const [sha, symbols] of symbolsByShaForBatch) {
        await detector.batchUpdateSymbols(symbols, sha);
      }

      const config = getExtensionConfig();
      const enableCst = config.enableCstTracking ?? true;
      const enableAugment = config.enableCstAugmentation ?? false;

      if (enableCst || enableAugment) {
        const timelineManager = getCstTimelineManager();

        const filesStmt = prepare(`
          SELECT DISTINCT path, sha FROM files WHERE sha IN (${placeholders})
        `);
        const allFileRows = filesStmt.all(...state.selectedCommitShas) as any[];

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
              const hybridFacts = (await timelineManager.getPriorFacts(filePath, sha)) || [];

              if (hybridFacts.length > 0) {
                logDebug(
                  `[HotspotStep] Retrieved ${
                    hybridFacts.length
                  } hybrid facts for ${filePath}@${sha.substring(0, 8)}`
                );
              }

              const cstSymbols: SymbolInfo[] = hybridFacts.filter(isCstFact).map(fact => ({
                id: fact.id, // id is now the DNA hash
                filePath: fact.filePath || '',
                name: fact.name,
                kind: fact.kind as SymbolInfo['kind'],
                signature: fact.signature,
                location: fact.location,
              }));

              if (cstSymbols.length > 0) {
                await detector.updateFileHotspot(filePath, sha, cstSymbols);

                await detector.batchUpdateSymbols(cstSymbols, sha);
              }
            } catch (error) {
              logDebug(`[HotspotStep] Error updating hybrid hotspots for ${filePath}: ${error}`);
            }
          }
        }
      }

      const fileHotspots = await detector.getTopFileHotspots(25);
      const symbolHotspots = await detector.getTopSymbolHotspots(25);

      try {
        const git = new GitOperations();

        const gitChurn = await git.getHotspots(100);
        const churnMap = new Map(gitChurn.map(h => [h.path, h]));

        for (const hotspot of fileHotspots) {
          const churn = churnMap.get(hotspot.filePath);
          if (churn) {
            (hotspot as any).added = churn.added;
            (hotspot as any).removed = churn.removed;
          }
        }
      } catch (error) {
        logDebug(`[HotspotStep] Failed to enrich hotspots with git stats: ${error}`);
      }

      if (state.explicitTimeline && state.explicitTimeline.length > 0) {
        const git = new GitOperations();

        for (const hotspot of fileHotspots) {
          const touchedVersions: string[] = [];

          for (const version of state.explicitTimeline) {
            let wasTouched = false;

            if (version === 'workspace-unstaged' || version === 'workspace-staged') {
              const workspaceFiles =
                version === 'workspace-unstaged'
                  ? await git.getUnstagedFiles()
                  : await git.getStagedFiles();
              wasTouched = workspaceFiles.some(f => f.path === hotspot.filePath);
            } else {
              const sha =
                version === 'HEAD'
                  ? state.selectedCommitShas?.[state.selectedCommitShas.length - 1] || 'HEAD'
                  : version;
              const commitFiles = await git.getFileChanges(sha);
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

      const mappedFileHotspots = fileHotspots.map(h => ({
        path: h.filePath,
        score: h.hotspotScore,
        added: (h as any).added,
        removed: (h as any).removed,
        touchedInVersions: h.touchedInVersions,
        touchedInVersionsDescription: h.touchedInVersionsDescription,
      }));

      const mappedSymbolHotspots = symbolHotspots.map(h => ({
        path: h.filePath,
        name: h.symbolName,
        score: h.hotspotScore,
      }));

      state.hotspots = [...mappedFileHotspots, ...mappedSymbolHotspots];
    },
  };
}
