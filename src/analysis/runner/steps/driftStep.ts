import { PipelineStep, PipelineState } from '../pipelineTypes';
import { detectDrift } from '../../../facts/driftDetector';

export function createDriftStep(): PipelineStep {
  return {
    id: 'drift',
    label: 'Detect drift (missing/zombie/divergent)',
    deps: ['intended', 'working'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working) {
        throw new Error('Intended and working states required');
      }

      const drift = detectDrift(state.intended, state.working, state.selectedCommitShas);
      state.drift = drift;
    }
  };
}
