/* eslint-disable no-restricted-syntax */
import { getDatabaseManager } from '../../../storage/database';
import { prepare } from '../../../storage/statement-wrapper';
import { SymbolInfo } from '../../../types';
import { logDebug } from '../../../utils/logger';
import { describeVersionPosition } from '../../../utils/timeline';
import { GitOperations } from '../../git';
import { CrossVersionSymbolLineage, MovedBlockDetectorV2 } from '../../movedBlockDetector';
import { PipelineState, PipelineStep } from '../pipelineTypes';

/**
 * Helper to get removed/added symbols for a version
 */
async function getSymbolsForVersion(
  version: string,
  state: PipelineState,
  db: any,
  git: GitOperations
): Promise<{ removed: SymbolInfo[]; added: SymbolInfo[] }> {
  const removed: SymbolInfo[] = [];
  const added: SymbolInfo[] = [];

  if (version === 'workspace-unstaged' || version === 'workspace-staged') {
    return { removed, added };
  }

  const sha = version === 'HEAD' ? state.selectedCommitShas?.[0] || 'HEAD' : version;

  const symbolsStmt = prepare(`
    SELECT s.symbol_id, s.name, s.kind, s.path, s.signature, s.change_type,
           sv.dna_id
    FROM symbols s
    LEFT JOIN symbol_versions sv ON s.sha = sv.sha AND s.symbol_id = sv.symbol_id AND s.path = sv.path
    WHERE s.sha = ? AND s.change_type IN ('removed', 'added')
  `);
  const symbolRows = symbolsStmt.all(sha) as any[];

  for (const row of symbolRows) {
    try {
      let blobSha: string;

      if (row.change_type === 'removed') {
        const commitInfo = await git.getCommitInfo(sha);
        if (!commitInfo.parent) {
          continue;
        }
        blobSha = await git.getBlobSha(commitInfo.parent, row.path);
      } else {
        blobSha = await git.getBlobSha(sha, row.path);
      }

      const snapshotStmt = prepare(`
        SELECT symbols_json FROM file_snapshots
        WHERE blob_sha = ? AND file_path = ?
      `);
      const snapshot = snapshotStmt.get([blobSha, row.path]) as any;

      if (snapshot) {
        const symbols: SymbolInfo[] = JSON.parse(snapshot.symbols_json);
        const fullSymbol = symbols.find(s => s.id === row.symbol_id);

        if (fullSymbol) {
          const symbolWithDna: SymbolInfo = {
            ...fullSymbol,
            id: row.dna_id || fullSymbol.id, // id is now the DNA hash
            filePath: fullSymbol.filePath || row.path || '',
          };

          if (row.change_type === 'removed') {
            removed.push(symbolWithDna);
          } else if (row.change_type === 'added') {
            added.push(symbolWithDna);
          }
        }
      }
    } catch (error) {
      continue;
    }
  }

  return { removed, added };
}

export function createMovedBlockStep(): PipelineStep {
  return {
    id: 'moved_blocks',
    label: 'Detect moved code blocks',
    deps: ['index_commits'],

    async run(state: PipelineState) {
      const detector = new MovedBlockDetectorV2();
      const git = new GitOperations();
      const db = getDatabaseManager().getDatabase();
      const allMoved: any[] = [];
      const crossVersionLineage: CrossVersionSymbolLineage[] = [];

      for (const sha of state.selectedCommitShas) {
        const { removed, added } = await getSymbolsForVersion(sha, state, db, git);

        if (removed.length > 0 && added.length > 0) {
          const result = await detector.detectMovedBlocks(sha, removed, added);
          allMoved.push(...result.movedBlocks);
        }
      }

      if (state.explicitTimeline && state.explicitTimeline.length > 1) {
        logDebug(
          `[MovedBlockStep] Detecting cross-version moves across ${state.explicitTimeline.length} versions`
        );

        for (let i = 0; i < state.explicitTimeline.length - 1; i++) {
          const currentVersion = state.explicitTimeline[i];
          const nextVersion = state.explicitTimeline[i + 1];

          const currentSymbols = await getSymbolsForVersion(currentVersion, state, db, git);
          const nextSymbols = await getSymbolsForVersion(nextVersion, state, db, git);

          const matches = detector.matchByDna(nextSymbols.removed, currentSymbols.added);

          for (const match of matches) {
            let moveType: 'rename' | 'relocate' | 'refactor' = 'relocate';
            if (match.removed.id !== match.added.id && match.removed.id === match.added.id) {
              // id is now DNA hash
              moveType = 'rename';
            } else if (match.removed.filePath !== match.added.filePath) {
              // Use filePath instead of parsing id
              moveType = 'relocate';
            } else {
              moveType = 'refactor';
            }

            crossVersionLineage.push({
              symbolId: match.added.id,
              previousSymbolId: match.removed.id,
              sourceVersion: nextVersion,
              destVersion: currentVersion,
              moveType,
              versionDescription: `${describeVersionPosition(
                nextVersion,
                state.explicitTimeline
              )} → ${describeVersionPosition(currentVersion, state.explicitTimeline)}`,
            });
          }
        }

        logDebug(`[MovedBlockStep] Found ${crossVersionLineage.length} cross-version symbol moves`);
      }

      state.movedBlocks = allMoved.slice(0, 50);
      state.movedLineage = crossVersionLineage;
    },
  };
}
