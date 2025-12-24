import { logDebug, logInfo } from '../../../utils/logger';
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

      // Plan data is now passed directly to analyzeWorkspace

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
          const unstagedStartTime = Date.now();
          logDebug('🟦 [WorkspaceStep] Starting unstaged analysis');
          unstagedFacts = await workspaceIndexer.analyzeWorkspace('unstaged', state.plan);
          const unstagedDuration = Date.now() - unstagedStartTime;
          logInfo(`[WorkspaceStep] 🕐 Unstaged analysis: ${unstagedDuration}ms`);
        } else if (version === 'workspace-staged' && shouldProcessStaged) {
          const stagedStartTime = Date.now();
          logDebug('🟦 [WorkspaceStep] Starting staged analysis');
          stagedFacts = await workspaceIndexer.analyzeWorkspace('staged', state.plan);
          const stagedDuration = Date.now() - stagedStartTime;
          logInfo(`[WorkspaceStep] 🕐 Staged analysis: ${stagedDuration}ms`);
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
