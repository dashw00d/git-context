import { PipelineStep, PipelineState } from '../pipelineTypes';
import { computeScope } from '../../../facts/scope';

export function createScopeStep(): PipelineStep {
  return {
    id: 'scope',
    label: 'Calculate analysis scope',
    deps: [],

    async run(state: PipelineState) {
      const workspaceParts = state.includeWorkspace
        ? new Set<'staged' | 'unstaged'>(['staged', 'unstaged'])
        : undefined;

      const scope = await computeScope(state.selectedCommitShas, workspaceParts);
      state.scope = scope;
    }
  };
}
