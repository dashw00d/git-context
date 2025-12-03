import { logWarn } from '../../../utils/logger';
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

      const timeoutMs = 15000;
      const historyPromise = (storyEngine as any).retrieveHistory(
        null,
        state.bundleFacts,
        state.commitFacts || []
      );

      const historyResult = await Promise.race([
        historyPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`retrieve_history timed out after ${timeoutMs}ms`)),
            timeoutMs
          )
        ),
      ]);

      const history = (historyResult as any).history;
      const metrics = (historyResult as any).metrics;

      if (!history || !metrics) {
        logWarn('[HistoryStep] Missing history or metrics from story engine');
        throw new Error('History retrieval returned no data');
      }

      state.history = history;
      state.historyMetrics = metrics;
    },
  };
}
