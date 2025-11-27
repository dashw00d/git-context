import { PipelineStep, PipelineState } from '../pipelineTypes';
import { BundleStoryEngine } from '../../bundleStoryEngine';

export function createHistoryRetrievalStep(
  storyEngine: BundleStoryEngine
): PipelineStep {
  return {
    id: 'retrieve_history',
    label: 'Retrieve cross-time history',
    deps: ['bundle_facts'],

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        throw new Error('Bundle facts required');
      }

      // Use internal method to just retrieve history
      const history = await (storyEngine as any).retrieveHistory(
        null,  // Will generate embedding internally
        state.bundleFacts,
        state.commitFacts || []
      );

      state.history = history;
    }
  };
}
