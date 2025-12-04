import * as vscode from 'vscode';
import { logDebug } from '../../../utils/logger';
import { CommitIndexer } from '../../commitIndexer';
import { PipelineState, PipelineStep } from '../pipelineTypes';

export function createIndexCommitsStep(
  commitIndexer: CommitIndexer,
  concurrency: number = 8
): PipelineStep {
  return {
    id: 'index_commits',
    label: 'Index commits (snapshots + diffs)',
    deps: [],

    async run(state: PipelineState, token: vscode.CancellationToken) {
      logDebug('🟧 [IndexCommitsStep] Starting run');
      const shas = state.selectedCommitShas;

      if (!shas || shas.length === 0) {
        logDebug(
          '[IndexCommitsStep] No commits to index (workspace-only analysis), setting empty commitFacts'
        );
        state.commitFacts = [];
        return;
      }

      const startTime = Date.now();

      logDebug(
        `🟧 [IndexCommitsStep] Processing ${shas.length} commits with concurrency=${concurrency}`
      );
      logDebug(
        `[IndexCommits] Starting with concurrency=${concurrency} for ${shas.length} commits`
      );

      // Throttling state
      let lastReportTime = 0;
      const THROTTLE_MS = 100; // Max 10 updates/sec

      const facts = await commitIndexer.ensureCommitsIndexed(
        shas,
        concurrency,
        { token },
        event => {
          // 1. Check cancellation during progress
          if (token?.isCancellationRequested) {
            // The indexer might not support aborting mid-flight immediately,
            // but we can stop sending events.
            return;
          }

          // 2. Throttle Events
          const now = Date.now();
          if (now - lastReportTime > THROTTLE_MS || event.type === 'file_complete') {
            if (state.onEvent) {
              state.onEvent({
                type: 'progress',
                step: { id: 'index_commits', label: 'Index commits' } as any,
                state,
                data: {
                  file: event.file,
                  status: event.type === 'file_start' ? 'analyzing' : 'ready',
                },
                timestamp: new Date().toISOString(),
              });
            }
            lastReportTime = now;
          }
        }
      );

      const duration = Date.now() - startTime;
      logDebug(`🟧 [IndexCommitsStep] ensureCommitsIndexed returned`);
      logDebug(
        `[IndexCommits] Completed ${shas.length} commits in ${duration}ms (${(duration / shas.length).toFixed(0)}ms/commit avg)`
      );

      state.commitFacts = facts;
      logDebug('🟧 [IndexCommitsStep] Completed successfully');
    },
  };
}
