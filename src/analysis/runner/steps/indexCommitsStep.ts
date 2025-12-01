/* eslint-disable no-restricted-syntax */
import { CommitIndexer } from '../../commitIndexer';
import { PipelineStep, PipelineState } from '../pipelineTypes';

export function createIndexCommitsStep(
  commitIndexer: CommitIndexer,
  concurrency: number = 4
): PipelineStep {
  return {
    id: 'index_commits',
    label: 'Index commits (snapshots + diffs)',
    deps: [],

    async run(state: PipelineState) {
      const shas = state.selectedCommitShas;
      const facts = await commitIndexer.ensureCommitsIndexed(shas, concurrency);
      state.commitFacts = facts;
    },
  };
}
