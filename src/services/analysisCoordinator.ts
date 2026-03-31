import { getStore } from '../state/store';
import { logDebug, logError, logInfo } from '../utils/logger';
import { getRefactorPipeline } from './pipelineFactory';
import { getReportService } from './reportService';
import type { RefactorPipeline } from '../analysis/refactorPipeline';
import type { PipelineState } from '../analysis/runner/pipelineTypes';
import type { FileChange } from '../types';
import type { CancellationToken } from 'vscode';

/**
 * AnalysisCoordinator - Single entry point for all analysis requests
 *
 * This coordinator ensures all analysis flows through Redux and has proper
 * state management. It prevents bypasses and provides a clean API for:
 * - Full bundle analysis (commits)
 * - Frame analysis (single file/symbol deep dive)
 * - Live analysis (workspace changes)
 *
 * All analysis should go through this coordinator, not directly to the pipeline.
 */
export class AnalysisCoordinator {
  private static instance: AnalysisCoordinator;
  private pipeline: RefactorPipeline | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): AnalysisCoordinator {
    if (!AnalysisCoordinator.instance) {
      AnalysisCoordinator.instance = new AnalysisCoordinator();
    }
    return AnalysisCoordinator.instance;
  }

  /**
   * Get or initialize the pipeline
   */
  private async getPipeline(): Promise<RefactorPipeline> {
    if (!this.pipeline) {
      this.pipeline = await getRefactorPipeline();
    }
    return this.pipeline;
  }

  /**
   * Request full bundle analysis
   *
   * This is the main analysis path for commits. It:
   * 1. Dispatches ANALYSIS_REQUESTED
   * 2. Delegates to reportService which handles Redux state updates
   * 3. Returns when analysis completes
   *
   * @param shas - Commit SHAs to analyze
   * @param scope - Analysis scope ('full' | 'quick')
   * @param options - Analysis options (force, cancellation token)
   */
  async requestBundleAnalysis(
    shas: string[],
    scope: 'full' | 'partial' | 'staged' | 'unstaged' = 'full',
    options?: {
      force?: boolean;
      cancellationToken?: CancellationToken;
    }
  ): Promise<void> {
    logInfo(`[AnalysisCoordinator] Requesting bundle analysis for ${shas.length} commits`);

    // Dispatch request action
    getStore().dispatch({
      type: 'ANALYSIS_REQUESTED',
      payload: { selection: shas, force: options?.force },
    });

    // Delegate to reportService (which handles state updates)
    const reportService = await getReportService();
    await reportService.generateReport(shas, scope, options);

    logDebug('[AnalysisCoordinator] Bundle analysis complete');
  }

  /**
   * Request frame-level analysis (single file or symbol deep dive)
   *
   * This analyzes a subset of the codebase for detailed inspection.
   * Used by the frame navigation system.
   *
   * @param shas - Commit SHAs to analyze
   */
  async requestFrameAnalysis(shas: string[]): Promise<PipelineState> {
    logInfo(`[AnalysisCoordinator] Requesting frame analysis for ${shas.length} commits`);

    // For frame analysis, we use the pipeline directly but with progress tracking
    const pipeline = await this.getPipeline();

    // Dispatch started action
    getStore().dispatch({
      type: 'ANALYSIS_STARTED',
      payload: { step: 'Frame Analysis' },
    });

    try {
      const result = await pipeline.analyzeBundle(
        shas,
        true, // includeWorkspace
        undefined, // workspaceParts
        undefined, // onEvent
        undefined // token
      );

      if (result.bundleFacts) {
        getStore().dispatch({
          type: 'ANALYSIS_COMPLETED',
          payload: {
            facts: result.bundleFacts,
            summary: result.bundleSummary || {
              id: `frm-${Date.now()}`,
              commitCount: shas.length,
              fileCount: (result.bundleFacts?.scope?.files as number) || 0,
              symbolCount: (result.bundleFacts?.working?.symbols as number) || 0,
            },
            reportId: `frm-${Date.now()}`,
          },
        });
      }

      return result;
    } catch (error) {
      getStore().dispatch({
        type: 'ANALYSIS_FAILED',
        payload: { error: error instanceof Error ? error.message : String(error) },
      });
      // Re-throw to let caller handle (frame analysis is typically user-initiated)
      // eslint-disable-next-line no-restricted-syntax
      throw error;
    }
  }

  /**
   * Request background analysis (initial hydration)
   *
   * Used by AnalysisController for background loading.
   * Similar to frame analysis but with different semantics.
   *
   * @param shas - Commit SHAs to analyze
   */
  async requestBackgroundAnalysis(shas: string[]): Promise<PipelineState> {
    logDebug(`[AnalysisCoordinator] Requesting background analysis for ${shas.length} commits`);

    try {
      // For background analysis, delegate to frame analysis
      // (they have the same implementation pattern)
      return await this.requestFrameAnalysis(shas);
    } catch (error) {
      logError('[AnalysisCoordinator] Background analysis failed', error);
      // Re-throw to let caller handle
      // eslint-disable-next-line no-restricted-syntax
      throw error;
    }
  }

  /**
   * Request live analysis (workspace changes)
   *
   * Analyzes uncommitted changes against the current bundle.
   * This is handled by LiveAnalysisEngine which has its own state management.
   *
   * Note: This is a pass-through for now since LiveAnalysisEngine
   * already manages its own state correctly via Redux.
   */
  async requestLiveAnalysis(): Promise<void> {
    logDebug('[AnalysisCoordinator] Live analysis should be triggered via LiveAnalysisEngine');
    // LiveAnalysisEngine.analyze() already dispatches the right actions
    // This is just here for API completeness
  }

  /**
   * Request single-file analysis with priority (for click-triggered analysis)
   *
   * This uses reserved on-demand workers and persists results to DB
   * via the same shared persistence layer as quick/full scans.
   *
   * @param filePath - Relative file path to analyze
   * @param sha - Commit SHA (defaults to HEAD)
   */
  async requestFileAnalysis(filePath: string, sha?: string): Promise<void> {
    const { logInfo, logDebug } = await import('../utils/logger');
    const { GitOperations } = await import('../analysis/git');
    const { DatabaseWriteQueue } = await import('../storage/databaseWriteQueue');
    const { getPathService } = await import('./pathService');

    const pathService = getPathService();
    const normalizedPath = pathService.toRelative(filePath);

    logInfo(`[AnalysisCoordinator] Requesting priority file analysis for ${normalizedPath} (original: ${filePath})`);

    const pipeline = await this.getPipeline();
    const git = new GitOperations();

    // Resolve SHA if not provided
    const targetSha = sha || (await git.getHeadSha());

    // Create FileChange object for processFile
    const fileChange: FileChange = {
      path: normalizedPath,
      status: 'M', // Assume modified for click analysis
      newSha: await git.getBlobSha(targetSha, normalizedPath),
      oldSha: undefined,
    };

    // Process with priority flag
    await pipeline.commitIndexer.processFile(
      fileChange,
      targetSha,
      null, // parentSha
      undefined, // plan
      true // priority: true - uses reserved workers
    );

    // Flush writes to ensure persistence
    await DatabaseWriteQueue.getInstance().flushAll();

    logDebug(`[AnalysisCoordinator] Priority file analysis complete for ${normalizedPath}`);
  }
}

/**
 * Get the singleton AnalysisCoordinator instance
 */
export function getAnalysisCoordinator(): AnalysisCoordinator {
  return AnalysisCoordinator.getInstance();
}
