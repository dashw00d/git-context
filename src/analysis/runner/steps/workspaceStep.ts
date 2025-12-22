import { logDebug } from '../../../utils/logger';
import { WorkspaceIndexer } from '../../workspaceIndexer';
import { PipelineState, PipelineStep } from '../pipelineTypes';
import { updateState } from './utils';

export function createWorkspaceOverlayStep(workspaceIndexer: WorkspaceIndexer): PipelineStep {
  return {
    id: 'workspace_overlay',
    label: 'Analyze workspace changes',
    deps: [],

    async run(state: PipelineState) {
      logDebug('🟦 [WorkspaceStep] Starting run');

      // Set plan data for direct content access
      workspaceIndexer.setPlanData(state.plan);

      if (!state.includeWorkspace) {
        logDebug('🟦 [WorkspaceStep] No workspace, skipping');
        updateState(state, 'workspaceFacts', { staged: null, unstaged: null });
        return;
      }

      const timeline = state.explicitTimeline || [];
      const shouldProcessUnstaged = timeline.includes('workspace-unstaged');
      const shouldProcessStaged = timeline.includes('workspace-staged');

      if (!shouldProcessUnstaged && !shouldProcessStaged) {
        updateState(state, 'workspaceFacts', { staged: null, unstaged: null });
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

      updateState(state, 'workspaceFacts', {
        staged: stagedFacts,
        unstaged: unstagedFacts,
      });
      logDebug('🟦 [WorkspaceStep] Completed successfully');
    },
  };
}
