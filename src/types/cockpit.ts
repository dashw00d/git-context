import { WorkspaceFacts } from '../analysis/workspaceIndexer';
import { RefactorBundleFacts } from '../facts/types';

/** Which section (accordion) is active/open in the cockpit sidebar */
export type CockpitSectionKey = 'commits' | 'bundle' | 'symbols' | 'reports' | 'live';

export interface BundleConfig {
  mode: 'repo' | 'module' | 'changes' | 'custom';
  roots: string[];
  includeConnected: boolean;
  exclusions: string[];
}

/* ---------- DTOs shared between host and cockpit ---------- */

export interface CommitDTO {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  authoredAt: string;
  changes: number;
  inBundle: boolean;
  scope: 'staged' | 'unstaged' | 'history';
  analyzed?: boolean;
  files?: Array<{ path: string; status: FileStatus }>;
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown' | string;

export interface StagedFileDTO {
  path: string;
  status: FileStatus;
}

export interface UnstagedFileDTO {
  path: string;
  status: FileStatus;
}

export interface BundleSummaryDTO {
  id: string;
  commitCount: number;
  fileCount: number;
  symbolCount: number;
  createdAt?: string;
  debtScore?: number;
}

export type BundleFactsDTO = RefactorBundleFacts | null;

export interface BundleView {
  tier?: 'structure' | 'hybrid' | 'semantics';
  summary?: {
    commits: number;
    files: number;
    symbols: number;
    staged?: number;
    unstaged?: number;
  };
  hotspots?: Array<{
    path: string;
    name?: string;
    score: number;
    size?: number;
    added?: number;
    removed?: number;
    count?: number;
    status?: string;
  }>;
  treemap?: any[];
  risks?: Array<{ path: string; name?: string; issue: string; detail?: string }>;
  skeleton?: { mode?: string; roots?: string[]; files?: string[] };
  virtualCommits?: {
    staged: any[];
    unstaged: any[];
    stats: {
      staged: { added: number; removed: number };
      unstaged: { added: number; removed: number };
    };
  };
  isPartial?: boolean;
  error?: string;
}

export interface SymbolDTO {
  id: string;
  name: string;
  path: string;
  kind: string;
  language: string;
  changeType?: SymbolChangeType;
  commitCount: number;
  lastChangedAt: string;
}

export type SymbolChangeType = 'added' | 'modified' | 'removed';

export interface SymbolHistoryEntryDTO {
  sha: string;
  shortSha: string;
  message: string;
  when: string;
  changeType: SymbolChangeType;
}

export interface ReportDTO {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  branch?: string;
  pinned?: boolean;
  bundleSummary?: BundleSummaryDTO;
  criticalCount?: number;
}

/* ---------- Cockpit sidebar state (host → cockpit) ---------- */

export interface NodeMetrics {
  riskScore: number;
  churnScore: number;
  lastModified: number;
  driftCount: number;
  incomingRefs: number;
  outgoingRefs: number;
  authors: string[];
  ageDays: number;
}

export interface CockpitState {
  /* Global context */
  repoName: string | null;
  branchName: string | null;
  workspaceScope?: 'workspace' | 'staged' | 'unstaged';
  metrics?: {
    debtScore?: number;
    symbolCount?: number;
    fileCount?: number;
  };

  /* Phase 1: Data Foundation */
  nodeMetrics: Record<string, NodeMetrics>;
  currentCommitIndex?: number; // Index in selectedCommitShas array

  /** Which accordion should be open by default / last */
  activeSection: CockpitSectionKey;

  /* Analysis status for header + bundle section */
  isAnalyzing: boolean;
  analysisStep?: string;
  analysisProgress?: number;
  error?: string | null;

  /* Pipeline execution state */
  currentStepId?: string | null;
  pipelineErrors?: Array<{ stepId: string; error: string }>;
  pipelineStepTimings?: Record<string, number>;

  /* Historical context (NEW) */
  retrievedHistory?: {
    similarCommits: Array<any>;
    similarSymbols: Array<any>;
    relatedRefactors: Array<any>;
    symbolEvolution: Record<string, Array<any>>;
  };

  /* Workspace analysis results */
  workspaceFacts?: WorkspaceFacts | null;

  /* LLM Analysis results (legacy/compat) */
  llmOutputs?: any;

  /* Selections */
  selectedCommitShas: string[];
  selectedStagedPaths: string[];
  selectedUnstagedPaths: string[];

  /* Commits & selection section */
  commits: CommitDTO[];
  hasMoreCommits: boolean;
  commitsFilterText: string;
  commitsFilterScopes: {
    staged: boolean;
    unstaged: boolean;
    history: boolean;
  };
  lastNCommits: number;

  stagedFiles: StagedFileDTO[];
  unstagedFiles: UnstagedFileDTO[];

  /* Active bundle section */
  bundleSummary?: BundleSummaryDTO | null;
  bundleFacts: BundleFactsDTO;
  bundleReportId: string | null;
  bundleView: BundleView | null;
  bundleViewVersion: number;

  /* Symbols section */
  symbols: SymbolDTO[];
  symbolFilterText: string;
  symbolKindFilter: string | 'all';
  symbolChangeFilter: 'all' | SymbolChangeType;
  activeSymbolId: string | null;
  activeSymbolHistory: SymbolHistoryEntryDTO[];

  /* Saved reports section */
  reports: ReportDTO[];
  reportsFilterText: string;
  reportsBranchFilter: string | 'all';
  reportsShowPinnedOnly: boolean;

  /** Temporary property while we bridge to the new contract */
  selectedFiles?: string[];

  /* Live Analysis State */
  liveAnalysis: {
    isTracking: boolean;
    pendingChanges: number;
    totalEdits: number;
    status: 'idle' | 'analyzing' | 'ready' | 'error';
    summary: LiveAnalysisSummary | null;
    facts: any;
  };

  /* Bundle Scope Configuration */
  bundleConfig: BundleConfig;

  /* Navigation State (Centralized) */
  activeFrame: ContextFrame;
  history: ContextFrame[];
  explorerData: ExplorerNode[];

  actionHistory?: Array<{ type: string; payload?: any; timestamp: string }>;
}

export type ZoomLevel = 'bundle' | 'folder' | 'blast_radius' | 'file' | 'symbol';
export type AnalysisStatus = 'ready' | 'scanning' | 'analyzing' | 'unknown' | 'error';

export interface ContextFrame {
  level: ZoomLevel;
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  status: AnalysisStatus;
  data?: any;
  breadcrumbs?: string[];
  tier?: 'structure' | 'hybrid' | 'semantics';
}

export interface ExplorerNode {
  id: string;
  name: string;
  description?: string;
  type: 'file' | 'symbol' | 'folder';
  status: AnalysisStatus;
  children?: ExplorerNode[];
}

export interface LiveAnalysisSummary {
  missing: number;
  zombies: number;
  drift: number;
  dead: number;
  hybridDrifts?: number;
}

export type CockpitClientMessage =
  | {
      type: 'setActiveSection';
      section: CockpitSectionKey;
    }
  | {
      type: 'resetAll';
    }
  | {
      type: 'generateReport';
      mode: 'selection' | 'lastN' | 'staged' | 'unstaged' | 'changes';
      lastN?: number;
      force?: boolean;
    }
  | {
      type: 'cancelAnalysis';
    }
  | {
      type: 'toggleCommit';
      sha: string;
    }
  | {
      type: 'addCommitBySha';
      shaOrRef: string;
    }
  | {
      type: 'loadMoreCommits';
    }
  | {
      type: 'setCommitsFilterText';
      text: string;
    }
  | {
      type: 'setCommitsFilterScopes';
      scopes: {
        staged?: boolean;
        unstaged?: boolean;
        history?: boolean;
      };
    }
  | {
      type: 'selectAllStaged';
    }
  | {
      type: 'selectAllUnstaged';
    }
  | {
      type: 'clearSelection';
    }
  | {
      type: 'compareFilesToCommit';
      sha: string;
    }
  | {
      type: 'bundleRegenerate';
    }
  | {
      type: 'bundleClear';
    }
  | {
      type: 'bundleExport';
    }
  | {
      type: 'openActiveReport';
    }
  | {
      type: 'bundleCancel';
    }
  | {
      type: 'setSymbolFilterText';
      text: string;
    }
  | {
      type: 'setSymbolKindFilter';
      kind: string | 'all';
    }
  | {
      type: 'setSymbolChangeFilter';
      change: 'all' | SymbolChangeType;
    }
  | {
      type: 'openSymbolHistory';
      symbolId: string;
    }
  | {
      type: 'openSymbolInEditor';
      symbolId: string;
    }
  | {
      type: 'applyRefactorSuggestion';
      payload: { symbolId: string; suggestedName: string; filePath?: string };
    }
  | {
      type: 'askAssistant';
      payload?: any;
    }
  | {
      type: 'openReport';
      reportId: string;
    }
  | {
      type: 'regenerateReport';
      reportId: string;
    }
  | {
      type: 'deleteReport';
      reportId: string;
    }
  | {
      type: 'openSuperReport';
    }
  | {
      type: 'setLastNCommits';
      value: number;
    }
  | {
      type: 'togglePinReport';
      reportId: string;
    }
  | {
      type: 'setReportsFilterText';
      text: string;
    }
  | {
      type: 'setReportsBranchFilter';
      branch: string | 'all';
    }
  | {
      type: 'setReportsShowPinnedOnly';
      value: boolean;
    }
  | {
      type: 'scrollReportToSection';
      sectionId: string;
    }
  | {
      type: 'openEvidence';
      evidenceId: string;
    }
  | {
      type: 'generateLiveReport';
    }
  | {
      type: 'startLiveAnalysis';
    }
  | {
      type: 'getExplorerTree';
    }
  | {
      type: 'analyzeFrame';
      frameId: string;
    }
  | {
      type: 'getBundleData';
    }
  | {
      type: 'createBundle';
      name: string;
      config: BundleConfig;
    }
  | {
      type: 'deleteBundle';
      id: string;
    }
  | {
      type: 'switchBundle';
      id: string;
    }
  | {
      type: 'updateBundleConfig';
      config: Partial<BundleConfig>;
    }
  | {
      type: 'ready';
    }
  | { type: 'clearError' }
  | { type: 'navigateToFrame'; frame: ContextFrame }
  | { type: 'navigateBack' }
  | { type: 'updateCommitIndex'; value: number };

export type CockpitHostMessage =
  | { type: 'updateState'; payload: CockpitState }
  | {
      type: 'analysisProgress';
      payload: { isAnalyzing: boolean; step?: string; progress?: number };
    }
  | { type: 'focusSection'; payload: { section: CockpitSectionKey } }
  | { type: 'assistantResponse'; payload: { text: string } }
  | { type: 'updateExplorerTree'; payload: ExplorerNode[] }
  | { type: 'updateFrame'; payload: { frame: ContextFrame; data: any } }
  | {
      type: 'updateBundle';
      payload: {
        view?: BundleView | null;
        summary?: BundleSummaryDTO | null;
        facts?: BundleFactsDTO;
      };
    };
