/* eslint-disable no-restricted-syntax */
import { getWorkingSnapshot } from '../../../facts/workingSnapshot';
import { logDebug, logError } from '../../../utils/logger';
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
        const message = 'Scope required for working snapshot';
        logError(message);
        state.partialReasons = state.partialReasons ?? [];
        state.partialReasons.push(message);
        updateState(state, 'working', null as any);
        return;
      }

      logDebug(`[WorkingStep] Scope paths: ${state.scope.allPaths.size}`);
      const working = await getWorkingSnapshot(state.scope.allPaths, state.liveOverrides);
      logDebug(`[WorkingStep] Generated working snapshot with ${working.symbolsById.size} symbols`);
      updateState(state, 'working', working);
    },
  };
}
