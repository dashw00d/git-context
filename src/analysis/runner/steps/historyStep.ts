/* eslint-disable no-restricted-syntax */
import { BundleStoryEngine } from '../../bundleStoryEngine';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createHistoryRetrievalStep(storyEngine: BundleStoryEngine): PipelineStep {
  return {
    id: 'retrieve_history',
    label: 'Retrieve cross-time history',
    deps: ['bundle_facts', 'embedding_index'],

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        throw new Error('Bundle facts required');
      }

      // Use internal method to just retrieve history (and metrics)
      const { history, metrics } = await (storyEngine as any).retrieveHistory(
        null, // Will generate embedding internally
        state.bundleFacts,
        state.commitFacts || []
      );

      state.history = history;
      state.historyMetrics = metrics;
    },
  };
}
