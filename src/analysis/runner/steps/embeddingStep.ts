import { PipelineStep, PipelineState } from '../pipelineTypes';
import { EmbeddingIndexer } from '../../embeddingIndexer';

export function createEmbeddingStep(
  embeddingIndexer: EmbeddingIndexer
): PipelineStep {
  return {
    id: 'embedding_index',
    label: 'Index embeddings',

    async run(state: PipelineState) {
      if (!state.commitFacts) return;

      await embeddingIndexer.indexCommits(state.commitFacts);
    }
  };
}
