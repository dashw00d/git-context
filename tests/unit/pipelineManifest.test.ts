import { describe, expect, it } from 'vitest';
import { buildPipelineSteps } from '../../src/analysis/runner/pipelineManifest';

const stubCtx = {
  commitIndexer: {} as any,
  workspaceIndexer: {} as any,
  embeddingIndexer: {} as any,
  storyEngine: {} as any,
  concurrency: 4,
};

describe('pipeline manifest', () => {
  it('includes embedding/history/llm steps by default', () => {
    const steps = buildPipelineSteps(stubCtx);
    const ids = steps.map(s => s.id);

    expect(ids).toContain('embedding_index');
    expect(ids).toContain('retrieve_history');
    expect(ids).toContain('llm_story');
  });

  it('omits embedding-dependent steps when skipped', () => {
    const steps = buildPipelineSteps({ ...stubCtx, skipEmbedding: true, skipLLM: true });
    const ids = steps.map(s => s.id);

    expect(ids).not.toContain('embedding_index');
    expect(ids).not.toContain('retrieve_history');
    expect(ids).not.toContain('llm_story');
  });
});
