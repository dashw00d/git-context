import { PipelineStep, PipelineState } from '../pipelineTypes';
import { buildRefactorBundleFacts } from '../../../facts/factsAssembler';

export function createBundleFactsStep(): PipelineStep {
  return {
    id: 'bundle_facts',
    label: 'Aggregate bundle facts',

    async run(state: PipelineState) {
      if (!state.commitFacts || state.commitFacts.length === 0) {
        throw new Error('No commit facts available');
      }

      // Build bundle facts from commit analyses
      // Pass commit SHAs when available for enhanced functionality
      const bundleFacts = await buildRefactorBundleFacts(
        state.commitFacts,
        state.workspaceFacts,
        {
          commitShas: state.selectedCommitShas
        }
      );

      state.bundleFacts = bundleFacts;
    }
  };
}
