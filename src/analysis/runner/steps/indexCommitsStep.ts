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
      const shas = state.selectedCommitShas;

      const startTime = Date.now();

      logDebug(
        `[IndexCommits] Starting with concurrency=${concurrency} for ${shas.length} commits`
      );

      const facts = await commitIndexer.ensureCommitsIndexed(shas, concurrency);

      const duration = Date.now() - startTime;
      logDebug(
        `[IndexCommits] Completed ${shas.length} commits in ${duration}ms (${(duration / shas.length).toFixed(0)}ms/commit avg)`
      );

      state.commitFacts = facts;
    },
  };
}
