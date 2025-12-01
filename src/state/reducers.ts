import { CockpitState } from '../types/cockpit';
import { Action } from './actions';

export const initialState: CockpitState = {
  repoName: null,
  branchName: null,
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
};

export function cockpitReducer(state: CockpitState = initialState, action: Action): CockpitState {
  switch (action.type) {
    case 'ANALYSIS_REQUESTED':
      return { ...state, isAnalyzing: true, error: null };
    case 'ANALYSIS_STARTED':
      return { ...state, isAnalyzing: true, analysisStep: action.payload.step, error: null };
    case 'ANALYSIS_STEP_UPDATED':
      return {
        ...state,
        analysisStep: action.payload.step,
        analysisProgress: action.payload.progress,
      };
    case 'ANALYSIS_COMPLETED':
      return {
        ...state,
        isAnalyzing: false,
        analysisStep: undefined,
        bundleFacts: action.payload.facts,
        bundleSummary: action.payload.summary,
        bundleReportId: action.payload.reportId,
        retrievedHistory: action.payload.history,
        pipelineErrors: [],
      };
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
    case 'SELECTION_SET':
      return { ...state, selectedCommitShas: action.payload.shas };
    case 'STAGED_SELECTION_UPDATED':
      return { ...state, selectedStagedPaths: action.payload.paths };
    case 'UNSTAGED_SELECTION_UPDATED':
      return { ...state, selectedUnstagedPaths: action.payload.paths };
    case 'SELECTION_UPDATED':
      return {
        ...state,
        selectedCommitShas: action.payload.selectedCommitShas,
        selectedStagedPaths: action.payload.selectedStagedPaths,
        selectedUnstagedPaths: action.payload.selectedUnstagedPaths,
        selectedFiles: action.payload.selectedFiles,
        workspaceScope: action.payload.workspaceScope,
      };

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
      };
    case 'BUNDLE_VIEW_UPDATED':
      return { ...state, bundleView: action.payload.view };
    case 'BUNDLE_VIEW_CLEARED':
      return { ...state, bundleView: null };
    case 'BUNDLE_FACTS_UPDATED':
      return {
        ...state,
        bundleFacts: action.payload.facts,
        bundleSummary: action.payload.summary ?? state.bundleSummary,
      };
    case 'BUNDLE_CONFIG_UPDATED':
      return { ...state, bundleConfig: action.payload.config };

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

    // Navigation
    case 'NAVIGATE_TO':
      // Persist bundle tiered data when returning to the overview
      const targetFrame =
        action.payload.frame.level === 'bundle' && state.bundleView
          ? {
              ...action.payload.frame,
              data: { ...state.bundleView, ...(action.payload.frame.data || {}) },
            }
          : action.payload.frame;
      return {
        ...state,
        history: [...state.history, state.activeFrame],
        activeFrame: targetFrame,
      };
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

    // Tiered Frame Analysis - Progressive loading
    case 'FRAME_ANALYSIS_TIER_1_COMPLETE':
    case 'FRAME_ANALYSIS_TIER_2_COMPLETE':
    case 'FRAME_ANALYSIS_TIER_3_COMPLETE': {
      if (state.activeFrame.id === action.payload.frameId) {
        return {
          ...state,
          activeFrame: {
            ...state.activeFrame,
            status: 'ready',
            data: { ...state.activeFrame.data, ...action.payload.data },
          },
        };
      }
      return state;
    }
    case 'FRAME_ANALYSIS_TIER_FAILED': {
      // Log tier failure but keep existing data
      const nextStatus = action.payload.tier === 1 ? 'error' : 'ready';
      if (state.activeFrame.id === action.payload.frameId) {
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
      return state;
    }
    case 'FRAME_DATA_UPDATED': {
      if (state.activeFrame.id === action.payload.frameId) {
        return {
          ...state,
          activeFrame: { ...state.activeFrame, data: action.payload.data },
        };
      }
      return state;
    }

    case 'LEGACY_STATE_UPDATED':
      return { ...state, ...action.payload.partial };

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

    default:
      return state;
  }
}
