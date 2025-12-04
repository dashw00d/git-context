import { withTimeout } from '../../../utils/async';
import { logError } from '../../../utils/logger';
import { BundleStoryEngine } from '../../bundleStoryEngine';
import { PipelineState, PipelineStep } from '../pipelineTypes';
import { updateState } from './utils';

export function createHistoryRetrievalStep(storyEngine: BundleStoryEngine): PipelineStep {
  return {
    id: 'retrieve_history',
    label: 'Retrieve cross-time history',
    deps: ['bundle_facts', 'embedding_index'],

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        logError('[HistoryStep] Bundle facts required for history retrieval');
        return;
      }

      const timeoutMs = 15000;
      const historyPromise = (storyEngine as any).retrieveHistory(
        null,
        state.bundleFacts,
        state.commitFacts || []
      );

      const historyResult = await withTimeout(historyPromise, timeoutMs, 'retrieve_history');

      const history = (historyResult as any).history;
      const metrics = (historyResult as any).metrics;

      if (!history || !metrics) {
        logError('[HistoryStep] History retrieval returned no data');
        return;
      }

      updateState(state, 'history', history);
      updateState(state, 'historyMetrics', metrics);
    },
  };
}
