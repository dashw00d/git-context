import { LiveDiffTracker } from '../liveTracker';
import { CockpitOrchestrator } from '../state/cockpitOrchestrator';
import { getRefactorPipeline } from '../services/pipelineFactory';
import { logInfo, logDebug, logError } from '../utils/logger';

export class LiveAnalysisEngine {
    private tracker: LiveDiffTracker;
    private orchestrator: CockpitOrchestrator;
    private isAnalyzing = false;

    constructor(tracker: LiveDiffTracker, orchestrator: CockpitOrchestrator) {
        this.tracker = tracker;
        this.orchestrator = orchestrator;
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

        const state = this.orchestrator.getState();
        if (!state.bundleFacts) {
            logDebug('[LiveAnalysis] No active bundle, skipping analysis');
            return;
        }

        this.isAnalyzing = true;
        this.orchestrator.updateLiveState({ status: 'analyzing' });

        try {
            logInfo('[LiveAnalysis] Starting live analysis...');
            const startTime = Date.now();

            // 1. Get Live Content
            const liveOverrides = this.tracker.getDirtyContent();

            // 2. Run Analysis via Pipeline
            const pipeline = await getRefactorPipeline();
            const result = await pipeline.analyzeLive(liveOverrides, state.bundleFacts);

            // 3. Extract Results
            const drift = result.drift;
            const legacy = result.legacy;

            if (!drift || !legacy) {
                throw new Error('Pipeline failed to produce drift/legacy results');
            }

            // 4. Update State
            this.orchestrator.updateLiveState({
                status: 'idle',
                summary: {
                    missing: drift.missing_symbols.length,
                    zombies: drift.zombie_symbols.length,
                    drift: drift.divergent_symbols.length,
                    dead: legacy.dead.length,
                    hybridDrifts: drift.hybridDrifts?.length || 0
                },
                facts: {
                    drift,
                    legacy
                }
            });

            logInfo(`[LiveAnalysis] Analysis complete in ${Date.now() - startTime}ms`);

        } catch (error) {
            logError('[LiveAnalysis] Failed', error);
            this.orchestrator.updateLiveState({ status: 'error' });
        } finally {
            this.isAnalyzing = false;
        }
    }
}
