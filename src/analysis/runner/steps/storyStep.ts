import { BundleStoryEngine } from '../../bundleStoryEngine';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createStoryStep(storyEngine: BundleStoryEngine): PipelineStep {
  return {
    id: 'llm_story',
    label: 'Generate story + drift + plan',
    deps: ['bundle_facts', 'retrieve_history', 'embedding_index'],

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        throw new Error('Bundle facts required');
      }

      const llmOutputs = await storyEngine.generateStory(
        state.bundleFacts,
        state.commitFacts || [],
        state.history
      );

      state.llmOutputs = llmOutputs;

      const metadata = llmOutputs?.llmAnalysis?.metadata;
      if (metadata) {
        state.llmMetrics = {
          durationMs: metadata.durationMs ?? 0,
          totalTokens: metadata.totalTokens ?? 0,
          totalCalls: metadata.totalCalls ?? 0,
          healthScore: metadata.healthScore,
          validatedEvidenceCount: metadata.validatedEvidenceCount,
          skipped: false,
        };
      }
    },
  };
}
