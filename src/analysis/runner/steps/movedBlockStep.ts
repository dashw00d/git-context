import { PipelineStep, PipelineState } from '../pipelineTypes';
import { MovedBlockDetectorV2, CrossVersionSymbolLineage } from '../../movedBlockDetector';
import { getDatabaseManager } from '../../../storage/database';
import { SymbolInfo } from '../../../types';
import { GitOperations } from '../../git';
import { logDebug } from '../../../utils/logger';
import { describeVersionPosition } from '../../../utils/timeline';

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

  // For workspace versions, skip for now (would need snapshot manager comparison)
  if (version === 'workspace-unstaged' || version === 'workspace-staged') {
    return { removed, added };
  }

  // For HEAD, use the newest commit SHA
  const sha = version === 'HEAD' 
    ? (state.selectedCommitShas?.[state.selectedCommitShas.length - 1] || 'HEAD')
    : version;

  // Get symbols with change types
  const symbolsStmt = db.prepare(`
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
      
      // For deleted symbols, get blob SHA from parent commit
      if (row.change_type === 'removed') {
        const commitInfo = await git.getCommitInfo(sha);
        if (!commitInfo.parent) {
          continue; // Can't get parent, skip
        }
        blobSha = await git.getBlobSha(commitInfo.parent, row.path);
      } else {
        // For added symbols, get blob SHA from current commit
        blobSha = await git.getBlobSha(sha, row.path);
      }
      
      // Get snapshot with full symbol data
      const snapshotStmt = db.prepare(`
        SELECT symbols_json FROM file_snapshots
        WHERE blob_sha = ? AND file_path = ?
      `);
      const snapshot = snapshotStmt.get([blobSha, row.path]) as any;
      
      if (snapshot) {
        const symbols: SymbolInfo[] = JSON.parse(snapshot.symbols_json);
        const fullSymbol = symbols.find(s => s.id === row.symbol_id);
        
        if (fullSymbol) {
          // Ensure dnaId is set
          const symbolWithDna: SymbolInfo = {
            ...fullSymbol,
            dnaId: row.dna_id || fullSymbol.dnaId || fullSymbol.id
          };
          
          if (row.change_type === 'removed') {
            removed.push(symbolWithDna);
          } else if (row.change_type === 'added') {
            added.push(symbolWithDna);
          }
        }
      }
    } catch (error) {
      // Skip symbols where we can't get full data
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
      const detector = new MovedBlockDetectorV2(); // V2 detector with BaseDetector enhancements
      const db = getDatabaseManager().getDatabase();
      const git = new GitOperations();
      const allMoved: any[] = [];
      const crossVersionLineage: CrossVersionSymbolLineage[] = [];

      // 1. Original single-commit move detection (keep for backward compatibility)
      for (const sha of state.selectedCommitShas) {
        const { removed, added } = await getSymbolsForVersion(sha, state, db, git);

        if (removed.length > 0 && added.length > 0) {
          const result = await detector.detectMovedBlocks(sha, removed, added);
          allMoved.push(...result.movedBlocks);
        }
      }

      // 2. Cross-version move detection (loop through timeline pairs)
      if (state.explicitTimeline && state.explicitTimeline.length > 1) {
        logDebug(`[MovedBlockStep] Detecting cross-version moves across ${state.explicitTimeline.length} versions`);
        
        for (let i = 0; i < state.explicitTimeline.length - 1; i++) {
          const currentVersion = state.explicitTimeline[i];  // Newer version
          const nextVersion = state.explicitTimeline[i + 1];  // Older version

          // Get symbols for both versions
          const currentSymbols = await getSymbolsForVersion(currentVersion, state, db, git);
          const nextSymbols = await getSymbolsForVersion(nextVersion, state, db, git);

          // Match removed symbols from older version (nextVersion) with added symbols from newer version (currentVersion)
          // This finds symbols that were moved: removed in older commit, added in newer commit
          const matches = detector.matchByDna(nextSymbols.removed, currentSymbols.added);

          // Generate lineage entries
          for (const match of matches) {
            // Determine move type
            let moveType: 'rename' | 'relocate' | 'refactor' = 'relocate';
            if (match.removed.id !== match.added.id && match.removed.dnaId === match.added.dnaId) {
              moveType = 'rename';
            } else if (match.removed.id.split(':')[0] !== match.added.id.split(':')[0]) {
              moveType = 'relocate';
            } else {
              moveType = 'refactor';
            }

            crossVersionLineage.push({
              symbolId: match.added.id,
              previousSymbolId: match.removed.id,
              sourceVersion: nextVersion,  // Older version where it was removed
              destVersion: currentVersion,  // Newer version where it was added
              moveType,
              versionDescription: `${describeVersionPosition(nextVersion, state.explicitTimeline)} → ${describeVersionPosition(currentVersion, state.explicitTimeline)}`
            });
          }
        }

        logDebug(`[MovedBlockStep] Found ${crossVersionLineage.length} cross-version symbol moves`);
      }

      state.movedBlocks = allMoved.slice(0, 50); // Top moves
      state.movedLineage = crossVersionLineage;
    }
  };
}
