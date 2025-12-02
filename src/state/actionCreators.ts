import {
  BundleFactsDTO,
  BundleSummaryDTO,
  BundleView,
  CockpitSectionKey,
  CommitDTO,
  ContextFrame,
  ExplorerNode,
  ReportDTO,
  StagedFileDTO,
  SymbolChangeType,
  SymbolDTO,
  UnstagedFileDTO,
} from '../types/cockpit';
import { Action } from './actions';

export const analysisActions = {
  request: (selection: string[], force?: boolean): Action => ({
    type: 'ANALYSIS_REQUESTED',
    payload: { selection, force },
  }),
  start: (step: string): Action => ({ type: 'ANALYSIS_STARTED', payload: { step } }),
  stepUpdated: (step: string, progress?: number): Action => ({
    type: 'ANALYSIS_STEP_UPDATED',
    payload: { step, progress },
  }),
  progress: (isAnalyzing?: boolean, step?: string, progress?: number): Action => ({
    type: 'ANALYSIS_PROGRESS_UPDATED',
    payload: { isAnalyzing, step, progress },
  }),
  complete: (
    facts: BundleFactsDTO,
    summary: BundleSummaryDTO,
    reportId: string,
    history?: any
  ): Action => ({
    type: 'ANALYSIS_COMPLETED',
    payload: { facts, summary, reportId, history },
  }),
  fail: (error: string): Action => ({ type: 'ANALYSIS_FAILED', payload: { error } }),
  cancel: (): Action => ({ type: 'ANALYSIS_CANCELLED' }),
  clearError: (): Action => ({ type: 'ERROR_CLEARED' }),
  setError: (error: string): Action => ({ type: 'ERROR_SET', payload: { error } }),
};

export const selectionActions = {
  toggle: (sha: string): Action => ({ type: 'SELECTION_TOGGLED', payload: { sha } }),
  clear: (): Action => ({ type: 'SELECTION_CLEARED' }),
  set: (shas: string[]): Action => ({ type: 'SELECTION_SET', payload: { shas } }),
  update: (
    selectedCommitShas: string[],
    selectedStagedPaths: string[],
    selectedUnstagedPaths: string[],
    workspaceScope: 'workspace' | 'staged' | 'unstaged' | undefined,
    selectedFiles?: string[]
  ): Action => ({
    type: 'SELECTION_UPDATED',
    payload: {
      selectedCommitShas,
      selectedStagedPaths,
      selectedUnstagedPaths,
      selectedFiles,
      workspaceScope,
    },
  }),
  updateStaged: (paths: string[]): Action => ({
    type: 'STAGED_SELECTION_UPDATED',
    payload: { paths },
  }),
  updateUnstaged: (paths: string[]): Action => ({
    type: 'UNSTAGED_SELECTION_UPDATED',
    payload: { paths },
  }),
};

export const commitActions = {
  update: (commits: CommitDTO[], hasMore: boolean): Action => ({
    type: 'COMMITS_UPDATED',
    payload: { commits, hasMore },
  }),
  updateData: (commits: CommitDTO[]): Action => ({
    type: 'COMMITS_DATA_UPDATED',
    payload: { commits },
  }),
  updateWorkspaceFiles: (staged: StagedFileDTO[], unstaged: UnstagedFileDTO[]): Action => ({
    type: 'WORKSPACE_FILES_UPDATED',
    payload: { staged, unstaged },
  }),
  setFilterText: (text: string): Action => ({
    type: 'COMMITS_FILTER_TEXT_CHANGED',
    payload: { text },
  }),
  setFilterScopes: (scopes: { staged: boolean; unstaged: boolean; history: boolean }): Action => ({
    type: 'COMMITS_FILTER_SCOPES_CHANGED',
    payload: { scopes },
  }),
  setLastN: (n: number): Action => ({ type: 'LAST_N_COMMITS_CHANGED', payload: { n } }),
};

export const bundleActions = {
  clear: (): Action => ({ type: 'BUNDLE_CLEARED' }),
  viewUpdated: (view: BundleView, version?: number): Action => ({
    type: 'BUNDLE_VIEW_UPDATED',
    payload: { view, version },
  }),
  viewCleared: (): Action => ({ type: 'BUNDLE_VIEW_CLEARED' }),
  factsUpdated: (facts: BundleFactsDTO, summary?: BundleSummaryDTO | null): Action => ({
    type: 'BUNDLE_FACTS_UPDATED',
    payload: { facts, summary },
  }),
  configUpdated: (config: any): Action => ({ type: 'BUNDLE_CONFIG_UPDATED', payload: { config } }),
  switchStart: (): Action => ({ type: 'BUNDLE_SWITCH_START' }),
};

export const symbolActions = {
  update: (symbols: SymbolDTO[]): Action => ({ type: 'SYMBOLS_UPDATED', payload: { symbols } }),
  setFilterText: (text: string): Action => ({
    type: 'SYMBOL_FILTER_TEXT_CHANGED',
    payload: { text },
  }),
  setKindFilter: (kind: string): Action => ({
    type: 'SYMBOL_KIND_FILTER_CHANGED',
    payload: { kind },
  }),
  setChangeFilter: (change: SymbolChangeType | 'all'): Action => ({
    type: 'SYMBOL_CHANGE_FILTER_CHANGED',
    payload: { change },
  }),
};

export const reportActions = {
  update: (reports: ReportDTO[]): Action => ({ type: 'REPORTS_UPDATED', payload: { reports } }),
  setFilterText: (text: string): Action => ({
    type: 'REPORTS_FILTER_TEXT_CHANGED',
    payload: { text },
  }),
  setBranchFilter: (branch: string): Action => ({
    type: 'REPORTS_BRANCH_FILTER_CHANGED',
    payload: { branch },
  }),
  setPinnedOnly: (showPinnedOnly: boolean): Action => ({
    type: 'REPORTS_PINNED_FILTER_CHANGED',
    payload: { showPinnedOnly },
  }),
};

export const uiActions = {
  setActiveSection: (section: CockpitSectionKey): Action => ({
    type: 'SECTION_CHANGED',
    payload: { section },
  }),
  updateRepoContext: (repoName: string | null, branchName: string | null): Action => ({
    type: 'REPO_CONTEXT_UPDATED',
    payload: { repoName, branchName },
  }),
  requestRefresh: (scope: 'all' | 'commits' | 'bundle' | 'symbols' | 'reports'): Action => ({
    type: 'REFRESH_REQUESTED',
    payload: { scope },
  }),
  resetAll: (): Action => ({ type: 'RESET_ALL_STATE' }),
};

export const liveActions = {
  update: (payload: {
    status?: 'idle' | 'analyzing' | 'ready' | 'error';
    summary?: any;
    facts?: any;
    pendingChanges?: number;
    totalEdits?: number;
  }): Action => ({ type: 'LIVE_ANALYSIS_UPDATED', payload }),
  updateLegacy: (payload: { status: 'idle' | 'analyzing' | 'error' }): Action => ({
    type: 'LIVE_STATE_UPDATED',
    payload,
  }),
};

export const pipelineActions = {
  health: (payload: {
    currentStepId?: string | null;
    pipelineErrors?: Array<{ stepId: string; error: string }>;
    stepTimings?: Record<string, number>;
  }): Action => ({ type: 'PIPELINE_HEALTH_UPDATED', payload }),
};

export const navigationActions = {
  navigateTo: (frame: ContextFrame): Action => ({ type: 'NAVIGATE_TO', payload: { frame } }),
  navigateBack: (): Action => ({ type: 'NAVIGATE_BACK' }),
  updateExplorer: (nodes: ExplorerNode[]): Action => ({
    type: 'EXPLORER_UPDATED',
    payload: { nodes },
  }),
  updateFrameData: (frameId: string, data: any): Action => ({
    type: 'FRAME_DATA_UPDATED',
    payload: { frameId, data },
  }),
};

export const frameAnalysisActions = {
  tier1Complete: (frameId: string, data: any): Action => ({
    type: 'FRAME_ANALYSIS_TIER_1_COMPLETE',
    payload: { frameId, data },
  }),
  tier2Complete: (frameId: string, data: any): Action => ({
    type: 'FRAME_ANALYSIS_TIER_2_COMPLETE',
    payload: { frameId, data },
  }),
  tier3Complete: (frameId: string, data: any): Action => ({
    type: 'FRAME_ANALYSIS_TIER_3_COMPLETE',
    payload: { frameId, data },
  }),
  tierFailed: (frameId: string, tier: number, error: string): Action => ({
    type: 'FRAME_ANALYSIS_TIER_FAILED',
    payload: { frameId, tier, error },
  }),
};

export const workspaceActions = {
  updateWorkspaceFacts: (workspaceFacts: any): Action => ({
    type: 'WORKSPACE_FACTS_UPDATED',
    payload: { workspaceFacts },
  }),
};
