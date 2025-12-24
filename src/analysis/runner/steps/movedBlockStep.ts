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
    LEFT JOIN symbol_versions sv ON s.sha = sv.sha AND s.dna_id = sv.dna_id AND s.path = sv.path
    WHERE s.sha = ? AND s.change_type IN ('removed', 'added')
  `);
  const symbolRows = symbolsStmt.all(sha) as any[];

  if (symbolRows.length === 0) {
    return { removed, added };
  }

  // Batch fetch blob SHAs to avoid thousands of git ls-tree calls
  const pathMap = new Map<string, { blobSha: string; rows: any[] }>();

  // Group rows by commit (for removed) or current commit (for added)
  const removedRows = symbolRows.filter(r => r.change_type === 'removed');
  const addedRows = symbolRows.filter(r => r.change_type === 'added');

  // Get parent commit for removed symbols
  let parentSha: string | undefined;
  if (removedRows.length > 0) {
    const commitInfo = await git.getCommitInfo(sha);
    parentSha = commitInfo.parent;
  }

  // Batch fetch blob SHAs for removed symbols (at parent commit)
  if (parentSha && removedRows.length > 0) {
    const paths = removedRows.map(r => r.path);
    const blobShas = await git.getBlobShas(parentSha, paths);

    for (const row of removedRows) {
      const blobSha = blobShas.get(row.path);
      if (blobSha) {
        const key = `${blobSha}:${row.path}`;
        if (!pathMap.has(key)) {
          pathMap.set(key, { blobSha, rows: [] });
        }
        pathMap.get(key)!.rows.push(row);
      }
    }
  }

  // Batch fetch blob SHAs for added symbols (at current commit)
  if (addedRows.length > 0) {
    const paths = addedRows.map(r => r.path);
    const blobShas = await git.getBlobShas(sha, paths);

    for (const row of addedRows) {
      const blobSha = blobShas.get(row.path);
      if (blobSha) {
        const key = `${blobSha}:${row.path}`;
        if (!pathMap.has(key)) {
          pathMap.set(key, { blobSha, rows: [] });
        }
        pathMap.get(key)!.rows.push(row);
      }
    }
  }

  // Batch fetch snapshots
  const uniqueBlobs = Array.from(new Set(Array.from(pathMap.values()).map(v => v.blobSha)));

  if (uniqueBlobs.length === 0) return { removed, added };

  // Fetch all snapshots for these blobs in chunks to avoid parameter limits
  const chunkSize = 50;
  const loadedSnapshots = new Map<string, any>();

  for (let i = 0; i < uniqueBlobs.length; i += chunkSize) {
    const chunk = uniqueBlobs.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const snapshotStmt = prepare(`
      SELECT blob_sha, file_path, symbols_json FROM file_snapshots
      WHERE blob_sha IN (${placeholders})
    `);

    const chunkRows = snapshotStmt.all(...chunk) as any[];
    for (const row of chunkRows) {
      // We might have multiple entries for same blob_sha (different paths)
      // We prefer the one matching our file path if possible, or just any.
      // Since content is same, symbols should be same.
      // We store by blob_sha + file_path for exact match,
      // but also maybe just blob_sha if we trust content?
      // The existing code queried by (blob_sha, file_path).
      // Let's store by composite key.
      loadedSnapshots.set(`${row.blob_sha}:${row.file_path}`, row);
    }
  }

  for (const [_, { blobSha, rows }] of pathMap) {
    const filePath = rows[0].path;
    // Try exact match first
    const snapshot = loadedSnapshots.get(`${blobSha}:${filePath}`);

    // If not found by exact path, try to find ANY snapshot with this blobSha?
    // The original code was strict: WHERE blob_sha = ? AND file_path = ?
    // If that returned nothing, it skipped. So we should stick to strict match.

    if (snapshot) {
      const symbols: SymbolInfo[] = JSON.parse(snapshot.symbols_json);
      const symbolMap = new Map(symbols.map(s => [s.id, s]));

      for (const row of rows) {
        const fullSymbol = symbolMap.get(row.symbol_id);
        if (fullSymbol) {
          const symbolWithDna: SymbolInfo = {
            ...fullSymbol,
            id: row.dna_id || fullSymbol.id,
            filePath: fullSymbol.filePath || row.path || '',
          };

          if (row.change_type === 'removed') {
            removed.push(symbolWithDna);
          } else if (row.change_type === 'added') {
            added.push(symbolWithDna);
          }
        }
      }
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

        // Iterate from Oldest -> Newest (reverse of standard git log order)
        // explicitTimeline is usually [Newest, ..., Oldest]
        for (let i = state.explicitTimeline.length - 1; i > 0; i--) {
          const currentVersion = state.explicitTimeline[i]; // Older
          const nextVersion = state.explicitTimeline[i - 1]; // Newer

          const currentSymbols = await getSymbolsForVersion(currentVersion, state, db, git);
          const nextSymbols = await getSymbolsForVersion(nextVersion, state, db, git);

          // Match Removed in Current (Old) -> Added in Next (New)
          const matches = detector.matchByDna(currentSymbols.removed, nextSymbols.added);

          for (const match of matches) {
            let moveType: 'rename' | 'relocate' | 'refactor' = 'relocate';
            if (match.removed.name !== match.added.name) {
              moveType = 'rename';
            } else if (match.removed.filePath !== match.added.filePath) {
              moveType = 'relocate';
            } else {
              moveType = 'refactor';
            }

            crossVersionLineage.push({
              symbolId: match.added.id,
              previousSymbolId: match.removed.id,
              sourceVersion: currentVersion,
              destVersion: nextVersion,
              moveType,
              versionDescription: `${describeVersionPosition(
                currentVersion,
                state.explicitTimeline
              )} → ${describeVersionPosition(nextVersion, state.explicitTimeline)}`,
            });
          }
        }

        logDebug(`[MovedBlockStep] Found ${crossVersionLineage.length} cross-version symbol moves`);
      }

      state.movedBlocks = allMoved.slice(0, 50);
      state.movedLineage = crossVersionLineage;

      // Also query database for existing moves involving files in scope
      if (state.scope?.allPaths && state.scope.allPaths.size > 0) {
        try {
          const allPaths = Array.from(state.scope.allPaths);
          logDebug(
            `[MovedBlockStep] Querying DB for existing moves involving ${allPaths.length} files`
          );

          for (const filePath of allPaths) {
            const dbMoves = await detector.getFileMoves(filePath);
            if (dbMoves.length > 0) {
              // Merge with allMoved, avoiding duplicates
              for (const move of dbMoves) {
                if (
                  !allMoved.some(
                    m =>
                      m.commitSha === move.commitSha &&
                      m.sourceFile === move.sourceFile &&
                      m.destFile === move.destFile &&
                      m.sourceStartLine === move.sourceStartLine
                  )
                ) {
                  allMoved.push(move);
                }
              }
            }
          }

          // Also fetch lineage for all working symbols in scope
          if (state.working?.symbolsById) {
            logDebug(
              `[MovedBlockStep] Querying DB for lineage of ${state.working.symbolsById.size} symbols`
            );
            for (const symbolId of state.working.symbolsById.keys()) {
              const dbLineage = await detector.getSymbolLineage(symbolId);
              for (const entry of dbLineage) {
                if (
                  !crossVersionLineage.some(
                    l =>
                      l.symbolId === entry.symbolId && l.previousSymbolId === entry.previousSymbolId
                  )
                ) {
                  crossVersionLineage.push({
                    symbolId: entry.symbolId,
                    previousSymbolId: entry.previousSymbolId,
                    sourceVersion: entry.commitSha,
                    destVersion: entry.commitSha, // Approximation
                    moveType:
                      entry.moveType === 'symbol_rename'
                        ? 'rename'
                        : entry.moveType === 'file_rename'
                          ? 'relocate'
                          : 'refactor',
                  });
                }
              }
            }
          }

          state.movedBlocks = allMoved.slice(0, 50);
          state.movedLineage = crossVersionLineage;
          logDebug(
            `[MovedBlockStep] Final count: ${state.movedBlocks.length} moved blocks, ${state.movedLineage.length} lineage entries`
          );
        } catch (e) {
          logDebug(`[MovedBlockStep] Failed to query existing moves: ${e}`);
        }
      }
    },
  };
}
