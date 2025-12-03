import { WorkspaceIndexer } from '../../workspaceIndexer';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createWorkspaceOverlayStep(workspaceIndexer: WorkspaceIndexer): PipelineStep {
  return {
    id: 'workspace_overlay',
    label: 'Analyze workspace changes',
    deps: [],

    async run(state: PipelineState) {
      if (!state.includeWorkspace) {
        state.workspaceFacts = { staged: null, unstaged: null };
        return;
      }

      const timeline = state.explicitTimeline || [];
      const shouldProcessUnstaged = timeline.includes('workspace-unstaged');
      const shouldProcessStaged = timeline.includes('workspace-staged');

      if (!shouldProcessUnstaged && !shouldProcessStaged) {
        state.workspaceFacts = { staged: null, unstaged: null };
        return;
      }

      let stagedFacts = null;
      let unstagedFacts = null;

      for (const version of timeline) {
        if (version === 'workspace-unstaged' && shouldProcessUnstaged) {
          unstagedFacts = await workspaceIndexer.analyzeWorkspace('unstaged');
        } else if (version === 'workspace-staged' && shouldProcessStaged) {
          stagedFacts = await workspaceIndexer.analyzeWorkspace('staged');
        }

        if (version !== 'workspace-unstaged' && version !== 'workspace-staged') {
          break;
        }
      }

      state.workspaceFacts = {
        staged: stagedFacts,
        unstaged: unstagedFacts,
      };
    },
  };
}
