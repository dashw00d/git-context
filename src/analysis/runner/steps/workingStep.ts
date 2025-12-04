import { getWorkingSnapshot } from '../../../facts/workingSnapshot';
import { PipelineState, PipelineStep } from '../pipelineTypes';

function updateState<K extends keyof PipelineState>(
  state: PipelineState,
  key: K,
  value: PipelineState[K]
) {
  (state as any)[key] = value;
}

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
      updateState(state, 'working', working);
    },
  };
}
