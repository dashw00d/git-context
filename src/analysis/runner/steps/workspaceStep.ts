import { PipelineStep, PipelineState } from '../pipelineTypes';
import { WorkspaceIndexer } from '../../workspaceIndexer';

export function createWorkspaceOverlayStep(
  workspaceIndexer: WorkspaceIndexer
): PipelineStep {
  return {
    id: 'workspace_overlay',
    label: 'Analyze workspace changes',
    deps: [],

    async run(state: PipelineState) {
      if (!state.includeWorkspace) {
        state.workspaceFacts = { staged: null, unstaged: null };
        return;
      }

      // Analyze both staged and unstaged separately
      const stagedFacts = await workspaceIndexer.analyzeWorkspace('staged');
      const unstagedFacts = await workspaceIndexer.analyzeWorkspace('unstaged');

      state.workspaceFacts = {
        staged: stagedFacts,
        unstaged: unstagedFacts
      };
    }
  };
}
