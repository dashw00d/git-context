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
        state.workspaceFacts = null;
        return;
      }

      // Priority: unstaged -> staged (unstaged is most recent work)
      let facts = await workspaceIndexer.analyzeWorkspace('unstaged');
      if (!facts) {
        facts = await workspaceIndexer.analyzeWorkspace('staged');
      }

      state.workspaceFacts = facts;
    }
  };
}
