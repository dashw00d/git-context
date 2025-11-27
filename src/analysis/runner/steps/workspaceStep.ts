import { PipelineStep, PipelineState } from '../pipelineTypes';
import { WorkspaceIndexer } from '../../workspaceIndexer';

export function createWorkspaceOverlayStep(
  workspaceIndexer: WorkspaceIndexer
): PipelineStep {
  return {
    id: 'workspace_overlay',
    label: 'Analyze workspace changes',

    async run(state: PipelineState) {
      if (!state.includeWorkspace) {
        state.workspaceFacts = null;
        return;
      }

      const facts = await workspaceIndexer.analyzeWorkspace('staged');
      state.workspaceFacts = facts;
    }
  };
}
