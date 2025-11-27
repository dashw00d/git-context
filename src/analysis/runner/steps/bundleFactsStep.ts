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
      const bundleFacts = buildRefactorBundleFacts(
        state.commitFacts,
        state.workspaceFacts
      );

      state.bundleFacts = bundleFacts;
    }
  };
}
