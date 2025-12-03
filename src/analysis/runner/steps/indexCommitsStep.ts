/* eslint-disable no-restricted-syntax */

import { logDebug } from '../../../utils/logger';
import { CommitIndexer } from '../../commitIndexer';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createIndexCommitsStep(
  commitIndexer: CommitIndexer,
  concurrency: number = 8
): PipelineStep {
  return {
    id: 'index_commits',
    label: 'Index commits (snapshots + diffs)',
    deps: [],

    async run(state: PipelineState) {
      console.error('🟧 [IndexCommitsStep] Starting run');
      const shas = state.selectedCommitShas;

      const startTime = Date.now();

      console.error(
        `🟧 [IndexCommitsStep] Processing ${shas.length} commits with concurrency=${concurrency}`
      );
      logDebug(
        `[IndexCommits] Starting with concurrency=${concurrency} for ${shas.length} commits`
      );

      const facts = await commitIndexer.ensureCommitsIndexed(
        shas,
        concurrency,
        undefined,
        event => {
          if (state.onEvent) {
            state.onEvent({
              type: 'progress',
              step: { id: 'index_commits', label: 'Index commits' } as any,
              state,
              data: {
                file: event.file,
                status: event.type === 'file_start' ? 'analyzing' : 'ready',
              },
              timestamp: new Date().toISOString(),
            });
          }
        }
      );

      const duration = Date.now() - startTime;
      console.error(`🟧 [IndexCommitsStep] ensureCommitsIndexed returned`);
      logDebug(
        `[IndexCommits] Completed ${shas.length} commits in ${duration}ms (${(duration / shas.length).toFixed(0)}ms/commit avg)`
      );

      state.commitFacts = facts;
      console.error('🟧 [IndexCommitsStep] Completed successfully');
    },
  };
}
