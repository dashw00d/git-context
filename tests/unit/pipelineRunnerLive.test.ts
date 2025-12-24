import { describe, expect, it } from 'vitest';
import { runPipeline } from '../../src/analysis/runner/pipelineRunner';
import { PipelineStep } from '../../src/analysis/runner/pipelineTypes';

const failingOptionalStep: PipelineStep = {
  id: 'hotspots',
  label: 'Hotspots (optional in live)',
  deps: [],
  async run() {
    throw new Error('skip in live');
  },
};

const noopStep: PipelineStep = {
  id: 'scope',
  label: 'Scope',
  deps: [],
  async run() {
    return;
  },
};

describe('runPipeline cheap live handling', () => {
  it('completes even when optional live steps fail', async () => {
    const result = await runPipeline(
      [failingOptionalStep, noopStep],
      {
        selectedCommitShas: [],
        includeWorkspace: false,
        mode: 'cheap_live',
      }
    );

    expect(result.errors.length).toBe(1);
    expect(result.completedSteps.has('scope')).toBe(true);
    expect(result.currentStepId).toBeUndefined();
  });
});
