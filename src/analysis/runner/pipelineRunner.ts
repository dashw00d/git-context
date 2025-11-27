import { PipelineStep, PipelineState, PipelineEventHandler } from './pipelineTypes';

export async function runPipeline(
  steps: PipelineStep[],
  initialState: Omit<PipelineState, 'completedSteps' | 'errors'>,
  onEvent?: PipelineEventHandler
): Promise<PipelineState> {
  const state: PipelineState = {
    ...initialState,
    completedSteps: new Set<string>(),
    errors: []
  };

  for (const step of steps) {
    state.currentStepId = step.id;
    onEvent?.({ type: 'start', step, state });

    try {
      await Promise.resolve(step.run(state));
      state.completedSteps.add(step.id);
      onEvent?.({ type: 'complete', step, state });
    } catch (error) {
      state.errors.push({ stepId: step.id, error });
      onEvent?.({ type: 'error', step, error, state });
      break; // Stop on first error (or continue for best-effort mode)
    }
  }

  state.currentStepId = null;
  onEvent?.({ type: 'finished', state });
  return state;
}
