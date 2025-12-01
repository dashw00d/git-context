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

export type Action =
  // Analysis
  | { type: 'ANALYSIS_REQUESTED'; payload: { selection: string[]; force?: boolean } }
  | { type: 'ANALYSIS_STARTED'; payload: { step: string } }
  | { type: 'ANALYSIS_STEP_UPDATED'; payload: { step: string; progress?: number } }
  | {
      type: 'ANALYSIS_COMPLETED';
      payload: {
        facts: BundleFactsDTO;
        summary: BundleSummaryDTO;
        reportId: string;
        history?: any;
      };
    }
  | { type: 'ANALYSIS_FAILED'; payload: { error: string } }
  | { type: 'ANALYSIS_CANCELLED' }
  | {
      type: 'ANALYSIS_PROGRESS_UPDATED';
      payload: { isAnalyzing?: boolean; step?: string; progress?: number };
    }
  | { type: 'ERROR_CLEARED' }
  | { type: 'ERROR_SET'; payload: { error: string } }

  // Selection
  | { type: 'SELECTION_TOGGLED'; payload: { sha: string } }
  | { type: 'SELECTION_CLEARED' }
  | { type: 'SELECTION_SET'; payload: { shas: string[] } }
  | { type: 'STAGED_SELECTION_UPDATED'; payload: { paths: string[] } }
  | { type: 'UNSTAGED_SELECTION_UPDATED'; payload: { paths: string[] } }
  | {
      type: 'SELECTION_UPDATED';
      payload: {
        selectedCommitShas: string[];
        selectedStagedPaths: string[];
        selectedUnstagedPaths: string[];
        selectedFiles?: string[];
        workspaceScope: 'workspace' | 'staged' | 'unstaged' | undefined;
      };
    }

  // Commits Data
  | { type: 'COMMITS_UPDATED'; payload: { commits: CommitDTO[]; hasMore: boolean } }
  | { type: 'COMMITS_DATA_UPDATED'; payload: { commits: CommitDTO[] } }
  | {
      type: 'WORKSPACE_FILES_UPDATED';
      payload: { staged: StagedFileDTO[]; unstaged: UnstagedFileDTO[] };
    }

  // UI State
  | { type: 'SECTION_CHANGED'; payload: { section: CockpitSectionKey } }
  | { type: 'COMMITS_FILTER_TEXT_CHANGED'; payload: { text: string } }
  | {
      type: 'COMMITS_FILTER_SCOPES_CHANGED';
      payload: { scopes: { staged: boolean; unstaged: boolean; history: boolean } };
    }
  | { type: 'LAST_N_COMMITS_CHANGED'; payload: { n: number } }

  // Bundle
  | { type: 'BUNDLE_CLEARED' }
  | { type: 'BUNDLE_VIEW_UPDATED'; payload: { view: BundleView } }
  | { type: 'BUNDLE_VIEW_CLEARED' }
  | {
      type: 'BUNDLE_FACTS_UPDATED';
      payload: {
        facts: BundleFactsDTO;
        summary?: BundleSummaryDTO | null;
      };
    }
  | { type: 'BUNDLE_CONFIG_UPDATED'; payload: { config: any } }

  // Symbols
  | { type: 'SYMBOLS_UPDATED'; payload: { symbols: SymbolDTO[] } }
  | { type: 'SYMBOL_FILTER_TEXT_CHANGED'; payload: { text: string } }
  | { type: 'SYMBOL_KIND_FILTER_CHANGED'; payload: { kind: string } }
  | { type: 'SYMBOL_CHANGE_FILTER_CHANGED'; payload: { change: SymbolChangeType | 'all' } }

  // Reports
  | { type: 'REPORTS_UPDATED'; payload: { reports: ReportDTO[] } }
  | { type: 'REPORTS_FILTER_TEXT_CHANGED'; payload: { text: string } }
  | { type: 'REPORTS_BRANCH_FILTER_CHANGED'; payload: { branch: string } }
  | { type: 'REPORTS_PINNED_FILTER_CHANGED'; payload: { showPinnedOnly: boolean } }

  // Context
  | {
      type: 'REPO_CONTEXT_UPDATED';
      payload: { repoName: string | null; branchName: string | null };
    }

  // Legacy / Migration
  | { type: 'LEGACY_STATE_UPDATED'; payload: { partial: any; reason?: string } }
  | {
      type: 'REFRESH_REQUESTED';
      payload: { scope: 'all' | 'commits' | 'bundle' | 'symbols' | 'reports' };
    }
  | { type: 'LIVE_STATE_UPDATED'; payload: { status: 'idle' | 'analyzing' | 'error' } }
  | { type: 'RESET_ALL_STATE' }

  // Navigation (Centralized)
  | { type: 'NAVIGATE_TO'; payload: { frame: ContextFrame } }
  | { type: 'NAVIGATE_BACK' }
  | { type: 'EXPLORER_UPDATED'; payload: { nodes: ExplorerNode[] } }
  | { type: 'FRAME_DATA_UPDATED'; payload: { frameId: string; data: any } }

  // Frame Analysis (Tiered Loading)
  | { type: 'FRAME_ANALYSIS_TIER_1_COMPLETE'; payload: { frameId: string; data: any } }
  | { type: 'FRAME_ANALYSIS_TIER_2_COMPLETE'; payload: { frameId: string; data: any } }
  | { type: 'FRAME_ANALYSIS_TIER_3_COMPLETE'; payload: { frameId: string; data: any } }
  | {
      type: 'FRAME_ANALYSIS_TIER_FAILED';
      payload: { frameId: string; tier: number; error: string };
    };
