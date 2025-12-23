import * as path from 'path';
import { analysisActions } from '../state/actionCreators';
import { getStore } from '../state/store';
import { BundleFactsDTO } from '../types/cockpit';
import { withTimeout } from '../utils/async';
import { logDebug, logError, logInfo } from '../utils/logger';
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

    // Check for composite ID (filePath::dnaHash) or legacy (filePath:symbolName)
    const compositeMatch = frameId.includes('::');
    const legacyMatch = !compositeMatch && frameId.match(/^(.+\.\w+):(.+)$/);

    const level: 'file' | 'symbol' = compositeMatch || legacyMatch ? 'symbol' : 'file';
    let targetPath = frameId;

    if (level === 'symbol') {
      if (compositeMatch) {
        targetPath = frameId.split('::')[0];
      } else if (legacyMatch) {
        targetPath = legacyMatch[1];
      }
    }

    // Normalize targetPath: ensure it is relative to gitRoot with forward slashes
    const { normalizeToRelative } = await import('../utils/path');
    const normalizedPath = normalizeToRelative(targetPath, gitRoot);
    if (normalizedPath !== targetPath) {
      logInfo(
        `[AnalysisService] Normalized targetPath: ${targetPath} -> ${normalizedPath} (gitRoot: ${gitRoot})`
      );
      targetPath = normalizedPath;
    } else {
      logDebug(`[AnalysisService] Using normalized targetPath: ${targetPath}`);
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
      let facts = state.bundleFacts as BundleFactsDTO;

      // Issue 2: Ensure comprehensive data by triggering pipeline if needed
      // If we don't have sufficient facts (e.g. missing edges/graph), run a targeted analysis
      if (
        !facts ||
        !facts.evidence?.['working.edges'] ||
        (facts.evidence['working.edges'].length === 0 && level === 'file')
      ) {
        logInfo(`[AnalysisService] Triggering targeted pipeline analysis for ${targetPath}`);
        const { GitOperations } = await import('../analysis/git');
        const git = new GitOperations();

        // Fetch recent commits for this file to build a mini-bundle
        const history = await git.getFileHistory(targetPath, 20);
        const shas = history.map((h: any) => h.hash).filter((h: string) => h);

        if (shas.length > 0) {
          // Use AnalysisCoordinator instead of calling pipeline directly
          const { getAnalysisCoordinator } = await import('./analysisCoordinator');
          const coordinator = getAnalysisCoordinator();
          const result = await coordinator.requestFrameAnalysis(shas);

          // Update local facts reference from the pipeline result
          if (result.bundleFacts) {
            facts = result.bundleFacts;
            // AnalysisCoordinator already dispatched BUNDLE_FACTS_UPDATED
          }
        }
      }

      const tier2Data = await withTimeout(
        analyzer.analyzeTier2(frameId, targetPath, facts),

        120000,

        'Tier 2 analysis'
      );

      const currentState = store.getState();

      // DEBUG: Log frame ID matching and lineCommits presence
      logInfo(`[AnalysisService] Tier 2 complete for frameId=${frameId}`);
      logInfo(`[AnalysisService] Active frame ID=${currentState.activeFrame.id}`);
      logInfo(`[AnalysisService] Frame IDs match: ${frameId === currentState.activeFrame.id}`);
      logInfo(`[AnalysisService] lineCommits count: ${tier2Data?.lineCommits?.length || 0}`);

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
