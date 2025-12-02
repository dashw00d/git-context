import { CockpitState } from '../types/cockpit';

export const selectAnalysisStatus = (state: CockpitState) => ({
  isAnalyzing: state.isAnalyzing,
  step: state.analysisStep,
  progress: state.analysisProgress,
  error: state.error,
});

export const selectSelection = (state: CockpitState) => ({
  commits: state.selectedCommitShas,
  staged: state.selectedStagedPaths,
  unstaged: state.selectedUnstagedPaths,
  workspaceScope: state.workspaceScope,
  files: state.selectedFiles,
});

export const selectBundle = (state: CockpitState) => ({
  summary: state.bundleSummary,
  facts: state.bundleFacts,
  view: state.bundleView,
  config: state.bundleConfig,
});

export const selectSymbols = (state: CockpitState) => ({
  symbols: state.symbols,
  filterText: state.symbolFilterText,
  kindFilter: state.symbolKindFilter,
  changeFilter: state.symbolChangeFilter,
});

export const selectReports = (state: CockpitState) => ({
  reports: state.reports,
  filterText: state.reportsFilterText,
  branchFilter: state.reportsBranchFilter,
  showPinnedOnly: state.reportsShowPinnedOnly,
});

export const selectLiveAnalysis = (state: CockpitState) => state.liveAnalysis;

export const selectNavigation = (state: CockpitState) => ({
  activeFrame: state.activeFrame,
  explorerData: state.explorerData,
  history: state.history,
});
