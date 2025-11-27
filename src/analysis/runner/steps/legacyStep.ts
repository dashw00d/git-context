import { PipelineStep, PipelineState } from '../pipelineTypes';
import { auditLegacy } from '../../../facts/legacyAudit';

export function createLegacyStep(): PipelineStep {
  return {
    id: 'legacy',
    label: 'Audit legacy code',
    deps: ['intended', 'working', 'scope'],

    async run(state: PipelineState) {
      if (!state.intended || !state.working || !state.scope) {
        throw new Error('Intended, working, and scope required');
      }

      const legacy = await auditLegacy(state.intended, state.working, state.scope);
      state.legacy = legacy;
    }
  };
}
