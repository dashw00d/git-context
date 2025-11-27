import { PipelineStep, PipelineState } from '../pipelineTypes';
import { MovedBlockDetector } from '../../movedBlockDetector';
import { getDatabaseManager } from '../../../storage/database';
import { SymbolInfo } from '../../../types';
import { GitOperations } from '../../git';

export function createMovedBlockStep(): PipelineStep {
  return {
    id: 'moved_blocks',
    label: 'Detect moved code blocks',
    deps: ['index_commits'],

    async run(state: PipelineState) {
      const detector = new MovedBlockDetector(); // Self-sufficient
      const db = getDatabaseManager().getDatabase();
      const git = new GitOperations();
      const allMoved: any[] = [];

      // Query DB directly for symbols per commit
      for (const sha of state.selectedCommitShas) {
        // Get symbols with change types
        const symbolsStmt = db.prepare(`
          SELECT s.symbol_id, s.name, s.kind, s.path, s.signature, s.change_type,
                 sv.dna_id
          FROM symbols s
          LEFT JOIN symbol_versions sv ON s.sha = sv.sha AND s.symbol_id = sv.symbol_id AND s.path = sv.path
          WHERE s.sha = ? AND s.change_type IN ('removed', 'added')
        `);
        const symbolRows = symbolsStmt.all(sha) as any[];

        // Get full symbol data from file_snapshots for location info
        const deletedSymbols: SymbolInfo[] = [];
        const addedSymbols: SymbolInfo[] = [];

        for (const row of symbolRows) {
          try {
            let blobSha: string;
            
            // For deleted symbols, get blob SHA from parent commit
            if (row.change_type === 'removed') {
              const commitInfo = git.getCommitInfo(sha);
              if (!commitInfo.parent) {
                continue; // Can't get parent, skip
              }
              blobSha = git.getBlobSha(commitInfo.parent, row.path);
            } else {
              // For added symbols, get blob SHA from current commit
              blobSha = git.getBlobSha(sha, row.path);
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
                  deletedSymbols.push(symbolWithDna);
                } else if (row.change_type === 'added') {
                  addedSymbols.push(symbolWithDna);
                }
              }
            }
          } catch (error) {
            // Skip symbols where we can't get full data (file might not exist, snapshot missing, etc.)
            continue;
          }
        }

        if (deletedSymbols.length > 0 && addedSymbols.length > 0) {
          const result = await detector.detectMovedBlocks(sha, deletedSymbols, addedSymbols);
          allMoved.push(...result.movedBlocks);
        }
      }

      state.movedBlocks = allMoved.slice(0, 50); // Top moves
    }
  };
}
