import { PipelineStep, PipelineState } from '../pipelineTypes';
import { CommitIndexer } from '../../commitIndexer';

export function createIndexCommitsStep(
  commitIndexer: CommitIndexer,
  concurrency: number = 4
): PipelineStep {
  return {
    id: 'index_commits',
    label: 'Index commits (snapshots + diffs)',

    async run(state: PipelineState) {
      const shas = state.selectedCommitShas;
      const facts = await commitIndexer.ensureCommitsIndexed(shas, concurrency);
      state.commitFacts = facts;
    }
  };
}
