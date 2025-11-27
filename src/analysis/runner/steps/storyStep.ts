import { PipelineStep, PipelineState } from '../pipelineTypes';
import { BundleStoryEngine } from '../../bundleStoryEngine';

export function createStoryStep(
  storyEngine: BundleStoryEngine
): PipelineStep {
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
        state.commitFacts || []
      );

      state.llmOutputs = llmOutputs;
    }
  };
}
