import { logError } from '../../../utils/logger';
import { EmbeddingIndexer } from '../../embeddingIndexer';
import { PipelineState, PipelineStep } from '../pipelineTypes';
import { updateState } from './utils';

export function createEmbeddingStep(embeddingIndexer: EmbeddingIndexer): PipelineStep {
  return {
    id: 'embedding_index',
    label: 'Index embeddings',
    deps: ['bundle_facts'],

    async run(state: PipelineState) {
      if (!state.commitFacts) return;

      try {
        const metrics = await embeddingIndexer.indexCommits(state.commitFacts);
        updateState(state, 'embeddingMetrics', metrics);
      } catch (error) {
        updateState(state, 'embeddingMetrics', {
          commitCount: state.commitFacts.length,
          commitShardCount: 0,
          symbolShardCount: 0,
          themeShardCount: 0,
          durationMs: 0,
          skipped: true,
          reason: error instanceof Error ? error.message : String(error),
        });
        logError('[EmbeddingStep] Failed to index embeddings', error);
      }
    },
  };
}
