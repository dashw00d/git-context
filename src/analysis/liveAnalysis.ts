import { LiveDiffTracker } from '../liveTracker';
import { getRefactorPipeline } from '../services/pipelineFactory';
import { getStore } from '../state/store';
import { logDebug, logError, logInfo } from '../utils/logger';

export class LiveAnalysisEngine {
  private tracker: LiveDiffTracker;
  private isAnalyzing = false;

  constructor(tracker: LiveDiffTracker, _orchestrator?: unknown) {
    this.tracker = tracker;
    // Note: _orchestrator param kept for backwards compatibility but not used
  }

  public stop(): void {
    this.tracker.stopTracking();
  }

  public start(): void {
    this.tracker.startTracking();
  }

  /**
   * Run analysis on current live state
   */
  public async analyze(): Promise<void> {
    if (this.isAnalyzing) {
      logDebug('[LiveAnalysis] Analysis already in progress, skipping');
      return;
    }

    const store = getStore();
    const state = store.getState();
    if (!state.bundleFacts) {
      logDebug('[LiveAnalysis] No active bundle, skipping analysis');
      return;
    }

    this.isAnalyzing = true;
    store.dispatch({ type: 'LIVE_ANALYSIS_UPDATED', payload: { status: 'analyzing' } });

    try {
      logInfo('[LiveAnalysis] Starting live analysis...');
      const startTime = Date.now();

      const liveOverrides = this.tracker.getDirtyContent();

      const pipeline = await getRefactorPipeline();
      const result = await pipeline.analyzeLive(liveOverrides, state.bundleFacts);

      const drift = result.drift;
      const legacy = result.legacy;

      if (!drift || !legacy) {
        logError('Pipeline failed to produce drift/legacy results');
        return;
      }

      store.dispatch({
        type: 'LIVE_ANALYSIS_UPDATED',
        payload: {
          status: 'idle',
          summary: {
            missing: drift.missing_symbols.length,
            zombies: drift.zombie_symbols.length,
            drift: drift.divergent_symbols.length,
            dead: legacy.dead.length,
            hybridDrifts: drift.hybridDrifts?.length || 0,
          },
          facts: {
            drift,
            legacy,
          },
        },
      });

      logInfo(`[LiveAnalysis] Analysis complete in ${Date.now() - startTime}ms`);
    } catch (error) {
      logError('[LiveAnalysis] Failed', error);
      store.dispatch({ type: 'LIVE_ANALYSIS_UPDATED', payload: { status: 'error' } });
    } finally {
      this.isAnalyzing = false;
    }
  }
}
