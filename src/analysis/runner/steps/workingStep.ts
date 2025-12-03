import { getWorkingSnapshot } from '../../../facts/workingSnapshot';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createWorkingStep(): PipelineStep {
  return {
    id: 'working',
    label: 'Build working snapshot',
    deps: ['scope'],

    async run(state: PipelineState) {
      if (!state.scope?.allPaths) {
        throw new Error('Scope required for working snapshot');
      }

      const working = await getWorkingSnapshot(state.scope.allPaths, state.liveOverrides);
      state.working = working;
    },
  };
}
