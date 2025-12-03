import { analysisActions } from '../state/actionCreators';
import { getStore } from '../state/store';
import { BundleFactsDTO } from '../types/cockpit';
import { withTimeout } from '../utils/async';
import { logError, logInfo } from '../utils/logger';
import { PipelineDebugger } from '../utils/pipelineDebugger';
import { FrameAnalyzer } from '../webview/cockpit/services/FrameAnalyzer';

export class AnalysisService {
  private static instance: AnalysisService;
  private pipelineDebugger = new PipelineDebugger();

  private constructor() {
    //empty
  }

  static getInstance(): AnalysisService {
    if (!AnalysisService.instance) {
      AnalysisService.instance = new AnalysisService();
    }
    return AnalysisService.instance;
  }

  async analyzeFrame(
    frameId: string,
    view?: any,
    onTierComplete?: (tier: number, frameId: string) => void
  ) {
    const store = getStore();
    const state = store.getState();
    const activeFrame = state.activeFrame.id;

    store.dispatch(analysisActions.progress(true, 'Analyzing frame...'));

    // We need a view to pass to FrameAnalyzer if it needs it (e.g. for webview communication)
    // But FrameAnalyzer mostly returns data.
    // If the existing FrameAnalyzer requires a view, we might need to refactor or pass it in.
    const analyzer = new FrameAnalyzer(view);

    const gitRoot = (await import('../utils/config')).getGitRoot();
    if (!gitRoot) {
      store.dispatch(analysisActions.progress(false));
      return;
    }

    const symbolMatch = frameId.match(/^(.+\.\w+):(.+)$/);
    const level: 'file' | 'symbol' = symbolMatch ? 'symbol' : 'file';
    let targetPath = frameId;
    if (level === 'symbol' && symbolMatch) {
      targetPath = symbolMatch[1];
    }

    let tier1Data: any;
    this.pipelineDebugger.startTier(frameId, 1, activeFrame);
    try {
      const facts = state.bundleFacts as BundleFactsDTO;
      tier1Data = await withTimeout(
        analyzer.analyzeTier1(frameId, targetPath, gitRoot, facts),
        120000,
        'Tier 1 analysis'
      );
      const currentState = store.getState();
      this.pipelineDebugger.completeTier(frameId, 1, tier1Data, currentState.activeFrame.id);
      store.dispatch({
        type: 'FRAME_ANALYSIS_TIER_1_COMPLETE',
        payload: { frameId, data: tier1Data },
      });
      if (onTierComplete) {
        onTierComplete(1, frameId);
      }
    } catch (error) {
      this.pipelineDebugger.failTier(frameId, 1, String(error));
      logError(`[Tier 1] Failed for ${frameId}`, error);
      store.dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 1, error: String(error) },
      });
      store.dispatch(analysisActions.progress(false));
      return;
    }

    store.dispatch(analysisActions.progress(true, 'Analyzing relationships...'));
    this.pipelineDebugger.startTier(frameId, 2, store.getState().activeFrame.id);
    try {
      const facts = state.bundleFacts as BundleFactsDTO;
      const tier2Data = await withTimeout(
        analyzer.analyzeTier2(frameId, targetPath, facts),
        120000,
        'Tier 2 analysis'
      );
      const currentState = store.getState();
      this.pipelineDebugger.completeTier(frameId, 2, tier2Data, currentState.activeFrame.id);
      store.dispatch({
        type: 'FRAME_ANALYSIS_TIER_2_COMPLETE',
        payload: { frameId, data: tier2Data },
      });
      if (onTierComplete) {
        onTierComplete(2, frameId);
      }
    } catch (error) {
      this.pipelineDebugger.failTier(frameId, 2, String(error));
      logError(`[Tier 2] Failed for ${frameId}`, error);
      store.dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 2, error: String(error) },
      });
    }

    store.dispatch(analysisActions.progress(true, 'Generating insights...'));
    this.pipelineDebugger.startTier(frameId, 3, store.getState().activeFrame.id);
    try {
      const content = tier1Data?.content || '';
      const facts = state.bundleFacts as BundleFactsDTO;
      const tier3Data = await withTimeout(
        analyzer.analyzeTier3(frameId, targetPath, content, facts),
        120000,
        'Tier 3 analysis'
      );
      const currentState = store.getState();
      this.pipelineDebugger.completeTier(frameId, 3, tier3Data, currentState.activeFrame.id);
      store.dispatch({
        type: 'FRAME_ANALYSIS_TIER_3_COMPLETE',
        payload: { frameId, data: tier3Data },
      });
      if (onTierComplete) {
        onTierComplete(3, frameId);
      }
      logInfo(`[AnalysisService] Analyzed frame ${frameId} (${level})`);
    } catch (error) {
      this.pipelineDebugger.failTier(frameId, 3, String(error));
      logError(`[Tier 3] Failed for ${frameId}`, error);
      store.dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 3, error: String(error) },
      });
    }

    store.dispatch(analysisActions.progress(false));
  }
}

export function getAnalysisService(): AnalysisService {
  return AnalysisService.getInstance();
}
