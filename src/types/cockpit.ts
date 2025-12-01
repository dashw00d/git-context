import { RefactorBundleFacts } from '../facts/types';
import { WorkspaceFacts } from '../analysis/workspaceIndexer';

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
  shortSha: string;           // precomputed, e.g. sha.slice(0, 8)
  message: string;            // first line of commit message
  author: string;
  authoredAt: string;         // ISO8601
  changes: number;            // total change count or files changed
  inBundle: boolean;          // belongs to current active bundle
  scope: 'staged' | 'unstaged' | 'history'; // derive from source
  analyzed?: boolean;         // whether this commit has been analyzed
  files?: Array<{ path: string; status: FileStatus }>; // files changed in this commit
}

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed' | 'unknown';

export interface StagedFileDTO {
  path: string;
  status: FileStatus;
}

export interface UnstagedFileDTO {
  path: string;
  status: FileStatus;
}

export interface BundleSummaryDTO {
  id: string;                 // bundle/report identifier
  commitCount: number;
  fileCount: number;
  symbolCount: number;
  createdAt?: string;         // ISO8601
  debtScore?: number;         // 0–100, optional refactor debt
}

// If you want strong typing, alias to your existing RefactorBundleFacts
export type BundleFactsDTO = RefactorBundleFacts | null;

export interface SymbolDTO {
  id: string;                 // symbol_id or "path:name"
  name: string;
  path: string;
  kind: string;               // "function" | "class" | ...
  language: string;           // "php" | "ts" | "tsx" | ...
  changeType?: SymbolChangeType;
  commitCount: number;
  lastChangedAt: string;      // ISO8601
}

export type SymbolChangeType = 'added' | 'modified' | 'removed';

export interface SymbolHistoryEntryDTO {
  sha: string;
  shortSha: string;
  message: string;
  when: string;               // ISO8601
  changeType: SymbolChangeType;
}

export interface ReportDTO {
  id: string;
  title: string;
  summary: string;
  createdAt: string;          // ISO8601
  branch?: string;
  pinned?: boolean;
  bundleSummary?: BundleSummaryDTO;
  criticalCount?: number;
}

/* ---------- Cockpit sidebar state (host → cockpit) ---------- */

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

  /** Which accordion should be open by default / last */
  activeSection: CockpitSectionKey;

  /* Analysis status for header + bundle section */
  isAnalyzing: boolean;
  analysisStep?: string;        // e.g. "Diffing", "Building facts"
  analysisProgress?: number;    // e.g. 0–1 or 0–100
  error?: string | null;        // Error message to display to user

  /* Pipeline execution state */
  currentStepId?: string | null;
  pipelineErrors?: Array<{ stepId: string; error: string }>;

  /* Historical context (NEW) */
  retrievedHistory?: {
    similarCommits: Array<any>;
    similarSymbols: Array<any>;
    relatedRefactors: Array<any>;
    symbolEvolution: Record<string, Array<any>>;  // Map serialized as object
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
  hasMoreCommits: boolean;      // whether "Load more commits" should show
  commitsFilterText: string;
  commitsFilterScopes: {
    staged: boolean;
    unstaged: boolean;
    history: boolean;
  };
  lastNCommits: number;         // current N for "Analyze last N commits"

  stagedFiles: StagedFileDTO[];
  unstagedFiles: UnstagedFileDTO[];

  /* Active bundle section */
  bundleSummary: BundleSummaryDTO | null;
  bundleFacts: BundleFactsDTO;  // used by full report webview, not rendered in cockpit
  bundleReportId: string | null;       // id of currently active report, if any

  /* Symbols section */
  symbols: SymbolDTO[];
  symbolFilterText: string;
  symbolKindFilter: string | 'all';
  symbolChangeFilter: 'all' | SymbolChangeType;
  activeSymbolId: string | null;
  activeSymbolHistory: SymbolHistoryEntryDTO[];  // history of selected symbol

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
    pendingChanges: number; // lines/symbols
    totalEdits: number;
    status: 'idle' | 'analyzing' | 'ready' | 'error';
    summary: LiveAnalysisSummary | null;
    facts: any; // Relaxed type for now, or define LiveFactsDTO
  };

  /* Bundle Scope Configuration */
  bundleConfig: BundleConfig;

  /* Navigation State (Centralized) */
  activeFrame: ContextFrame;
  history: ContextFrame[];
  explorerData: ExplorerNode[];
}

export type ZoomLevel = 'bundle' | 'blast_radius' | 'file' | 'symbol';
export type AnalysisStatus = 'ready' | 'scanning' | 'unknown';

export interface ContextFrame {
  level: ZoomLevel;
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  status: AnalysisStatus;
  data?: any; // Hydrated data (metadata, timeline, symbols, etc.)
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
  hybridDrifts?: number; // Hybrid facts (CST) drift count
}

/* ---------- Cockpit → Host messages ---------- */

export type CockpitClientMessage =
  /* Global / navigation */
  | {
    type: 'setActiveSection';
    section: CockpitSectionKey;
  }
  | {
    type: 'resetAll';        // "Reset All" button in header
  }

  /* Analysis entrypoints from header or bundle section */
  | {
    type: 'generateReport';
    mode: 'selection' | 'lastN' | 'staged' | 'unstaged';
    lastN?: number;          // required when mode === 'lastN'
    force?: boolean;         // force reanalysis
  }
  | {
    type: 'cancelAnalysis';
  }

  /* Commits & selection section */
  | {
    type: 'toggleCommit';
    sha: string;
  }
  | {
    type: 'addCommitBySha';
    shaOrRef: string;        // SHA or branch name
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

  /* Active bundle section */
  | {
    type: 'bundleRegenerate';
  }
  | {
    type: 'bundleClear';
  }
  | {
    type: 'bundleExport';    // export JSON for LLM
  }
  | {
    /** Open / focus the full report webview for current bundleReportId */
    type: 'openActiveReport';
  }
  | {
    type: 'bundleCancel';
  }

  /* Symbols section */
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
    type: 'applyRefactorSuggestion';
    payload: { symbolId: string; suggestedName: string; filePath?: string };
  }

  /* Saved reports section */
  | {
    type: 'openReport';
    reportId: string;        // host loads that report + opens full report webview
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

  /* Deep links into full report webview (triggered from cockpit UI) */
  | {
    /** Ask the full report webview to scroll to a section (e.g. "overview", "incompleteness") */
    type: 'scrollReportToSection';
    sectionId: string;
  }
  | {
    /** Ask host to open an "evidence" target in editor (file/line/symbol) */
    type: 'openEvidence';
    evidenceId: string;      // whatever your report webview emits
  }

  /* Live Analysis */
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
  };

/* ---------- Host → Cockpit messages ---------- */

export type CockpitHostMessage =
  | { type: 'updateState'; payload: CockpitState }
  | { type: 'analysisProgress'; payload: { isAnalyzing: boolean; step?: string; progress?: number } }
  | { type: 'focusSection'; payload: { section: CockpitSectionKey } }
  | { type: 'updateExplorerTree'; payload: any[] }
  | { type: 'updateFrame'; payload: { frame: any; data: any } }
  | { type: 'updateBundle'; payload: any };
