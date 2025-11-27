import { PipelineStep, PipelineState } from '../pipelineTypes';
import { buildIntendedMap } from '../../../facts/intendedMap';

export function createIntendedStep(): PipelineStep {
  return {
    id: 'intended',
    label: 'Build intended state map',
    deps: [],

    async run(state: PipelineState) {
      const intended = await buildIntendedMap(state.selectedCommitShas);
      state.intended = intended;
    }
  };
}
