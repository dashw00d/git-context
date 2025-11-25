// src/types/cockpit.ts

/** Which section (accordion) is active/open in the cockpit sidebar */
export type CockpitSectionKey = 'commits' | 'bundle' | 'symbols' | 'reports';

/* ---------- DTOs shared between host and cockpit ---------- */

export interface CommitDTO {
  sha: string;
  shortSha: string;           // precomputed, e.g. sha.slice(0, 8)
  message: string;            // first line of commit message
  author: string;
  authoredAt: string;         // ISO8601
  changes: number;            // total change count or files changed
  inBundle: boolean;          // belongs to current active bundle
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
export type BundleFactsDTO = any;

export interface SymbolDTO {
  id: string;                 // symbol_id or "path:name"
  name: string;
  path: string;
  kind: string;               // "function" | "class" | ...
  language: string;           // "php" | "ts" | "tsx" | ...
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
}

/* ---------- Cockpit sidebar state (host → cockpit) ---------- */

export interface CockpitState {
  /* Global context */
  repoName: string | null;
  branchName: string | null;

  /** Which accordion should be open by default / last */
  activeSection: CockpitSectionKey;

  /* Analysis status for header + bundle section */
  isAnalyzing: boolean;
  analysisStep?: string;        // e.g. "Diffing", "Building facts"
  analysisProgress?: number;    // e.g. 0–1 or 0–100

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
  bundleFacts: BundleFactsDTO | null;  // used by full report webview, not rendered in cockpit
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
}

/* ---------- Host → Cockpit messages ---------- */

export type CockpitHostMessage =
  | {
      /** Full-state sync; primary way host updates the cockpit */
      type: 'updateState';
      payload: CockpitState;
    }
  | {
      /** Optional: fine-grained analysis progress updates */
      type: 'analysisProgress';
      payload: {
        isAnalyzing: boolean;
        step?: string;
        progress?: number;
      };
    }
  | {
      /** Optional: ask cockpit to focus/open a particular section accordion */
      type: 'focusSection';
      payload: {
        section: CockpitSectionKey;
      };
    };

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
    };
