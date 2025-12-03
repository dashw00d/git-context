import { computeScope } from '../../../facts/scope';
import { GitOperations } from '../../git';
import { PipelineState, PipelineStep } from '../pipelineTypes';

function updateState<K extends keyof PipelineState>(
  state: PipelineState,
  key: K,
  value: PipelineState[K]
) {
  (state as any)[key] = value;
}

export function createScopeStep(git?: GitOperations): PipelineStep {
  return {
    id: 'scope',
    label: 'Calculate analysis scope',
    deps: [],

    async run(state: PipelineState) {
      console.error('🟩 [ScopeStep] Starting run');
      // Use workspaceParts from state (set by ReportService based on scope parameter)
      // Don't override it - this allows staged-only or unstaged-only analysis
      const workspaceParts = state.workspaceParts;

      console.error('🟩 [ScopeStep] Calling computeScope...');
      const scope = await computeScope(
        state.selectedCommitShas,
        workspaceParts,
        state.explicitTimeline,
        state.liveOverrides?.keys(),
        git
      );
      console.error('🟩 [ScopeStep] computeScope returned, updating state');
      updateState(state, 'scope', scope);
      console.error('🟩 [ScopeStep] Completed successfully');
    },
  };
}
