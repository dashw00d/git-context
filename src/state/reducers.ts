import { mergeFacts } from '../facts/factsMerger';
import { CockpitState, ContextFrame, ExplorerNode } from '../types/cockpit';
import { logDebug, logWarn } from '../utils/logger';
import { Action } from './actions';
import { normalizeBundleConfig } from './bundleConfig';
import { getCachedFrame, updateTierCache } from './cacheUtils';

function updateNodeStatus(
  nodes: ExplorerNode[],
  id: string,
  status: 'scanning' | 'analyzing' | 'ready' | 'error'
): ExplorerNode[] {
  return nodes.map(node => {
    if (node.id === id) {
      return { ...node, status };
    }
    if (node.children) {
      return { ...node, children: updateNodeStatus(node.children, id, status) };
    }
    return node;
  });
}

export const initialState: CockpitState = {
  repoName: null,
  branchName: null,
  workspaceScope: 'workspace',
  activeSection: 'commits',
  isAnalyzing: false,
  selectedCommitShas: [],
  selectedStagedPaths: [],
  selectedUnstagedPaths: [],
  commits: [],
  hasMoreCommits: false,
  commitsFilterText: '',
  commitsFilterScopes: { staged: true, unstaged: true, history: true },
  lastNCommits: 20,
  stagedFiles: [],
  unstagedFiles: [],
  bundleSummary: null,
  bundleFacts: null,
  bundleReportId: null,
  bundleView: null,
  bundleViewVersion: 0,
  symbols: [],
  symbolFilterText: '',
  symbolKindFilter: 'all',
  symbolChangeFilter: 'all',
  activeSymbolId: null,
  activeSymbolHistory: [],
  reports: [],
  reportsFilterText: '',
  reportsBranchFilter: 'all',
  reportsShowPinnedOnly: false,
  liveAnalysis: {
    isTracking: false,
    pendingChanges: 0,
    totalEdits: 0,
    status: 'idle',
    summary: null,
    facts: null,
  },
  bundleConfig: {
    mode: 'repo',
    roots: [],
    includeConnected: false,
    exclusions: [],
  },
  activeFrame: {
    level: 'bundle',
    id: 'root',
    name: 'Bundle Overview',
    status: 'ready',
  },
  history: [],
  explorerData: [],
  actionHistory: [],
  pipelineErrors: [],
  pipelineStepTimings: {},
  nodeMetrics: {},
  currentCommitIndex: undefined,
  ignoreNextFactsUpdate: false,
};

export function cockpitReducer(state: CockpitState = initialState, action: Action): CockpitState {
  switch (action.type) {
    case 'ANALYSIS_REQUESTED':
      return { ...state, isAnalyzing: true, error: null };
    case 'ANALYSIS_STARTED':
      return {
        ...state,
        isAnalyzing: true,
        analysisStep: action.payload.step,
        analysisProgress: 0,
        error: null,
      };
    case 'ANALYSIS_STEP_UPDATED':
      return {
        ...state,
        analysisStep: action.payload.step,
        analysisProgress: action.payload.progress,
      };
    case 'ANALYSIS_COMPLETED': {
      const newShas = state.selectedCommitShas;
      const newIndex =
        state.currentCommitIndex === undefined && newShas.length > 0
          ? newShas.length - 1
          : state.currentCommitIndex;

      // Merge with existing bundleFacts if present (e.g., from quick scan)
      // This ensures quick scan symbols are preserved when background analysis completes
      const mergedFacts =
        state.bundleFacts && action.payload.facts
          ? mergeFacts(state.bundleFacts, action.payload.facts)
          : action.payload.facts;

      return {
        ...state,
        isAnalyzing: false,
        analysisStep: undefined,
        bundleFacts: mergedFacts,
        bundleSummary: action.payload.summary ?? state.bundleSummary,
        bundleReportId: action.payload.reportId,
        retrievedHistory: action.payload.history,
        pipelineErrors: [],
        currentCommitIndex: newIndex,
      };
    }
    case 'ANALYSIS_FAILED':
      return { ...state, isAnalyzing: false, error: action.payload.error };
    case 'ANALYSIS_CANCELLED':
      return { ...state, isAnalyzing: false, analysisStep: undefined };
    case 'ANALYSIS_PROGRESS_UPDATED':
      return {
        ...state,
        isAnalyzing: action.payload.isAnalyzing ?? state.isAnalyzing,
        analysisStep: action.payload.step ?? state.analysisStep,
        analysisProgress: action.payload.progress ?? state.analysisProgress,
      };
    case 'ERROR_CLEARED':
      return { ...state, error: null };
    case 'ERROR_SET':
      return { ...state, error: action.payload.error };

    case 'SELECTION_TOGGLED': {
      const sha = action.payload.sha;
      const selected = new Set(state.selectedCommitShas);
      if (selected.has(sha)) selected.delete(sha);
      else selected.add(sha);
      return { ...state, selectedCommitShas: Array.from(selected) };
    }
    case 'SELECTION_CLEARED':
      return {
        ...state,
        selectedCommitShas: [],
        selectedStagedPaths: [],
        selectedUnstagedPaths: [],
      };
    case 'SELECTION_SET': {
      const newShas = action.payload.shas;
      const newIndex =
        state.currentCommitIndex === undefined && newShas.length > 0
          ? newShas.length - 1
          : state.currentCommitIndex;
      return {
        ...state,
        selectedCommitShas: newShas,
        currentCommitIndex: newIndex,
      };
    }
    case 'STAGED_SELECTION_UPDATED':
      return { ...state, selectedStagedPaths: action.payload.paths };
    case 'UNSTAGED_SELECTION_UPDATED':
      return { ...state, selectedUnstagedPaths: action.payload.paths };
    case 'SELECTION_UPDATED': {
      const newShas = action.payload.selectedCommitShas;
      const newIndex =
        state.currentCommitIndex === undefined && newShas.length > 0
          ? newShas.length - 1
          : state.currentCommitIndex;
      return {
        ...state,
        selectedCommitShas: newShas,
        selectedStagedPaths: action.payload.selectedStagedPaths,
        selectedUnstagedPaths: action.payload.selectedUnstagedPaths,
        selectedFiles: action.payload.selectedFiles,
        workspaceScope: action.payload.workspaceScope,
        currentCommitIndex: newIndex,
      };
    }

    case 'COMMITS_UPDATED':
      return { ...state, commits: action.payload.commits, hasMoreCommits: action.payload.hasMore };
    case 'COMMITS_DATA_UPDATED':
      return { ...state, commits: action.payload.commits };
    case 'WORKSPACE_FILES_UPDATED':
      return {
        ...state,
        stagedFiles: action.payload.staged,
        unstagedFiles: action.payload.unstaged,
      };

    case 'SECTION_CHANGED':
      return { ...state, activeSection: action.payload.section };
    case 'COMMITS_FILTER_TEXT_CHANGED':
      return { ...state, commitsFilterText: action.payload.text };
    case 'COMMITS_FILTER_SCOPES_CHANGED':
      return { ...state, commitsFilterScopes: action.payload.scopes };
    case 'LAST_N_COMMITS_CHANGED':
      return { ...state, lastNCommits: action.payload.n };

    case 'BUNDLE_CLEARED':
      return {
        ...state,
        bundleFacts: null,
        bundleSummary: null,
        bundleReportId: null,
        bundleView: null,
        bundleViewVersion: 0,
      };
    case 'BUNDLE_SWITCH_START':
      return {
        ...state,
        bundleFacts: null,
        bundleSummary: null,
        bundleView: null,
        explorerData: [],

        activeFrame: {
          level: 'bundle',
          id: 'root',
          name: 'Loading...',
          status: 'scanning',
        },
        history: [],
      };
    case 'BUNDLE_VIEW_UPDATED': {
      const shouldUpdateFrameData =
        state.activeFrame.level === 'bundle' && state.activeFrame.id === 'root';

      const incomingVersion = action.payload.version ?? state.bundleViewVersion + 1;
      if (incomingVersion < state.bundleViewVersion) {
        logWarn(
          `[Reducer] Dropping stale bundle view update (version ${incomingVersion} < ${state.bundleViewVersion})`
        );
        return state;
      }

      return {
        ...state,
        bundleView: action.payload.view,
        bundleViewVersion: incomingVersion,
        activeFrame: shouldUpdateFrameData
          ? {
              ...state.activeFrame,
              data: { ...state.activeFrame.data, ...action.payload.view },
            }
          : state.activeFrame,
      };
    }
    case 'BUNDLE_VIEW_CLEARED':
      return { ...state, bundleView: null };
    case 'BUNDLE_FACTS_UPDATED':
      return {
        ...state,
        bundleFacts:
          state.bundleFacts && action.payload.facts
            ? mergeFacts(state.bundleFacts, action.payload.facts)
            : action.payload.facts,
        bundleSummary: action.payload.summary ?? state.bundleSummary,
      };
    case 'BUNDLE_CONFIG_UPDATED':
      return { ...state, bundleConfig: normalizeBundleConfig(action.payload.config) };

    case 'SYMBOLS_UPDATED':
      return { ...state, symbols: action.payload.symbols };
    case 'SYMBOL_FILTER_TEXT_CHANGED':
      return { ...state, symbolFilterText: action.payload.text };
    case 'SYMBOL_KIND_FILTER_CHANGED':
      return { ...state, symbolKindFilter: action.payload.kind };
    case 'SYMBOL_CHANGE_FILTER_CHANGED':
      return { ...state, symbolChangeFilter: action.payload.change };

    case 'REPORTS_UPDATED':
      return { ...state, reports: action.payload.reports };
    case 'REPORTS_FILTER_TEXT_CHANGED':
      return { ...state, reportsFilterText: action.payload.text };
    case 'REPORTS_BRANCH_FILTER_CHANGED':
      return { ...state, reportsBranchFilter: action.payload.branch };
    case 'REPORTS_PINNED_FILTER_CHANGED':
      return { ...state, reportsShowPinnedOnly: action.payload.showPinnedOnly };

    case 'REPO_CONTEXT_UPDATED':
      return { ...state, repoName: action.payload.repoName, branchName: action.payload.branchName };

    case 'NAVIGATE_TO': {
      const cleanFrame: ContextFrame = {
        ...action.payload.frame,
        data: action.payload.frame.data || undefined,
      };

      const shouldPushHistory = state.activeFrame.id !== cleanFrame.id;

      const { frame, isHit, isStale } = getCachedFrame(
        state.cachedTierResults,
        cleanFrame.id,
        cleanFrame
      );

      logDebug(
        `[Reducer] Navigating to ${cleanFrame.id}, cache ${
          isHit ? (isStale ? 'stale' : 'hit') : 'miss'
        }`
      );

      return {
        ...state,
        history: shouldPushHistory ? [...state.history, state.activeFrame] : state.history,
        activeFrame: isStale ? cleanFrame : frame,
      };
    }
    case 'NAVIGATE_BACK': {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      return {
        ...state,
        activeFrame: previous,
        history: state.history.slice(0, -1),
      };
    }
    case 'EXPLORER_UPDATED':
      return { ...state, explorerData: action.payload.nodes };
    case 'EXPLORER_NODE_UPDATED':
      return {
        ...state,
        explorerData: updateNodeStatus(
          state.explorerData,
          action.payload.id,
          action.payload.status
        ),
      };
    case 'PIPELINE_HEALTH_UPDATED': {
      const nextTimings = action.payload.stepTimings
        ? { ...(state as any).pipelineStepTimings, ...action.payload.stepTimings }
        : (state as any).pipelineStepTimings;
      return {
        ...state,
        currentStepId: action.payload.currentStepId ?? state.currentStepId,
        pipelineErrors: action.payload.pipelineErrors ?? state.pipelineErrors,
        pipelineStepTimings: nextTimings,
      };
    }

    case 'FRAME_ANALYSIS_TIER_1_COMPLETE':
    case 'FRAME_ANALYSIS_TIER_2_COMPLETE':
    case 'FRAME_ANALYSIS_TIER_3_COMPLETE': {
      const tierNum =
        action.type === 'FRAME_ANALYSIS_TIER_1_COMPLETE'
          ? 1
          : action.type === 'FRAME_ANALYSIS_TIER_2_COMPLETE'
            ? 2
            : 3;
      const tier = tierNum === 1 ? 'structure' : tierNum === 2 ? 'hybrid' : 'semantics';

      if (state.activeFrame.id !== action.payload.frameId) {
        logWarn(
          `[Reducer] Caching tier ${tierNum} data for ${action.payload.frameId} (current frame: ${state.activeFrame.id})`
        );

        return {
          ...state,
          cachedTierResults: updateTierCache(
            state.cachedTierResults,
            action.payload.frameId,
            tierNum,
            action.payload.data
          ),
        };
      }

      // DEBUG: Log successful merge including lineCommits
      logDebug(
        `[Reducer] Merging tier ${tierNum} data for ${action.payload.frameId}. lineCommits: ${action.payload.data?.lineCommits?.length || 0}`
      );

      return {
        ...state,
        activeFrame: {
          ...state.activeFrame,
          status: 'ready',
          tier,
          data: { ...state.activeFrame.data, ...action.payload.data },
        },
      };
    }
    case 'FRAME_ANALYSIS_TIER_FAILED': {
      if (state.activeFrame.id !== action.payload.frameId) {
        logWarn(
          `[Reducer] Dropping stale tier failure for ${action.payload.frameId} (current frame: ${state.activeFrame.id})`
        );
        return state;
      }

      const nextStatus = action.payload.tier === 1 ? 'error' : 'ready';
      const errors = state.activeFrame.data?.errors || [];
      return {
        ...state,
        activeFrame: {
          ...state.activeFrame,
          status: nextStatus,
          data: {
            ...state.activeFrame.data,
            errors: [...errors, { tier: action.payload.tier, error: action.payload.error }],
          },
        },
      };
    }
    case 'FRAME_DATA_UPDATED': {
      if (state.activeFrame.id !== action.payload.frameId) {
        logWarn(
          `[Reducer] Dropping stale frame data for ${action.payload.frameId} (current frame: ${state.activeFrame.id})`
        );
        return state;
      }

      return {
        ...state,

        activeFrame: {
          ...state.activeFrame,
          data: { ...state.activeFrame.data, ...action.payload.data },
        },
      };
    }

    case 'LIVE_ANALYSIS_UPDATED':
      return {
        ...state,
        liveAnalysis: {
          ...state.liveAnalysis,
          status: action.payload.status ?? state.liveAnalysis.status,
          summary:
            action.payload.summary !== undefined
              ? action.payload.summary
              : state.liveAnalysis.summary,
          facts:
            action.payload.facts !== undefined ? action.payload.facts : state.liveAnalysis.facts,
          pendingChanges: action.payload.pendingChanges ?? state.liveAnalysis.pendingChanges,
          totalEdits: action.payload.totalEdits ?? state.liveAnalysis.totalEdits,
          isTracking: action.payload.isTracking ?? state.liveAnalysis.isTracking,
        },
      };

    case 'WORKSPACE_FACTS_UPDATED':
      return { ...state, workspaceFacts: action.payload.workspaceFacts };

    case 'LIVE_STATE_UPDATED':
      return {
        ...state,
        liveAnalysis: {
          ...state.liveAnalysis,
          status: action.payload.status,
        },
      };

    case 'RESET_ALL_STATE':
      return initialState;

    case 'NODE_METRICS_UPDATED':
      return { ...state, nodeMetrics: action.payload.metrics };
    case 'COMMIT_INDEX_UPDATED':
      return { ...state, currentCommitIndex: action.payload.index };

    case 'IGNORE_NEXT_FACTS_UPDATE':
      return { ...state, ignoreNextFactsUpdate: true };
    case 'FACTS_UPDATE_IGNORED':
      return { ...state, ignoreNextFactsUpdate: false };

    default:
      return state;
  }
}
