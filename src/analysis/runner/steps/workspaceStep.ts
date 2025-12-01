/* eslint-disable no-restricted-syntax */
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

      // Check explicitTimeline to determine which workspace versions to process
      const timeline = state.explicitTimeline || [];
      const shouldProcessUnstaged = timeline.includes('workspace-unstaged');
      const shouldProcessStaged = timeline.includes('workspace-staged');

      // Skip if no workspace versions in timeline
      if (!shouldProcessUnstaged && !shouldProcessStaged) {
        state.workspaceFacts = { staged: null, unstaged: null };
        return;
      }

      // Process only versions in timeline (in timeline order for cache warming)
      let stagedFacts = null;
      let unstagedFacts = null;

      // Process in timeline order (newest first) for optimal cache warming
      for (const version of timeline) {
        if (version === 'workspace-unstaged' && shouldProcessUnstaged) {
          unstagedFacts = await workspaceIndexer.analyzeWorkspace('unstaged');
        } else if (version === 'workspace-staged' && shouldProcessStaged) {
          stagedFacts = await workspaceIndexer.analyzeWorkspace('staged');
        }
        // Continue through timeline (HEAD, commits) - workspace processing stops here
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
