import { logError } from '../../../utils/logger';
import { BundleStoryEngine } from '../../bundleStoryEngine';
import { PipelineState, PipelineStep } from '../pipelineTypes';

function updateState<K extends keyof PipelineState>(
  state: PipelineState,
  key: K,
  value: PipelineState[K]
) {
  (state as any)[key] = value;
}

export function createStoryStep(storyEngine: BundleStoryEngine): PipelineStep {
  return {
    id: 'llm_story',
    label: 'Generate story + drift + plan',
    deps: ['bundle_facts', 'retrieve_history', 'embedding_index'],

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        logError('[StoryStep] Bundle facts required for story generation');
        return;
      }

      const llmOutputs = await storyEngine.generateStory(
        state.bundleFacts,
        state.commitFacts || [],
        state.history
      );

      updateState(state, 'llmOutputs', llmOutputs);

      const metadata = llmOutputs?.llmAnalysis?.metadata;
      if (metadata) {
        updateState(state, 'llmMetrics', {
          durationMs: metadata.durationMs ?? 0,
          totalTokens: metadata.totalTokens ?? 0,
          totalCalls: metadata.totalCalls ?? 0,
          healthScore: metadata.healthScore,
          validatedEvidenceCount: metadata.validatedEvidenceCount,
          skipped: false,
        });
      }
    },
  };
}
