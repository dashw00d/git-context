import { RefactorBundleFacts } from '../facts/types';
import { WorkspaceFacts } from './workspace';

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

  headInfo?: {
    sha: string;
    date: string;
    message: string;
    author: string;
  };

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

  /* Tier Analysis Caching */
  cachedTierResults?: Record<
    string,
    {
      tier1?: any;
      tier2?: any;
      tier3?: any;
      timestamp: number;
    }
  >;

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

/* ---------- Simplified Message Types (mirroring reportWebview.ts) ---------- */

export interface CockpitPayload {
  // Core bundle data
  bundleFacts?: RefactorBundleFacts | null;
  bundleSummary?: BundleSummaryDTO | null;
  bundleView?: BundleView | null;

  // Navigation & Explorer
  activeFrame?: ContextFrame;
  history?: ContextFrame[];
  explorerData?: ExplorerNode[];
  nodeMetrics?: Record<string, NodeMetrics>;

  // Analysis status
  isAnalyzing?: boolean;
  analysisStep?: string;
  analysisProgress?: number;
  error?: string | null;

  // Live analysis
  liveAnalysis?: {
    isTracking: boolean;
    pendingChanges: number;
    totalEdits: number;
    status: 'idle' | 'analyzing' | 'ready' | 'error';
    summary: LiveAnalysisSummary | null;
    facts: any;
  };

  // Repo context
  repoName?: string | null;
  branchName?: string | null;

  // Bundle config (used by BundleStage)
  bundleConfig?: BundleConfig;
  lastNCommits?: number;
  currentCommitIndex?: number; // Add this line

  // Optional extras
  commits?: CommitDTO[];
  hasMoreCommits?: boolean;
  llmOutputs?: any;
  retrievedHistory?: any;
  headInfo?: {
    sha: string;
    date: string;
    message: string;
    author: string;
  };
}

export type CockpitHostMessage =
  | { type: 'setData'; payload: CockpitPayload }
  | { type: 'setProgress'; payload: { isAnalyzing: boolean; step?: string; progress?: number } }
  | { type: 'focusSection'; payload: { section: CockpitSectionKey } }
  | { type: 'assistantResponse'; payload: { text: string } }
  | { type: 'updateExplorerTree'; payload: ExplorerNode[] }
  | { type: 'updateFrame'; payload: { frame: ContextFrame; data: any } };

export type CockpitClientMessage =
  | { type: 'ready' }
  | {
      type: 'runAnalysis';
      mode: 'selection' | 'lastN' | 'staged' | 'unstaged' | 'changes';
      lastN?: number;
      force?: boolean;
    }
  | { type: 'openReport'; reportId: string }
  | { type: 'regenerateReport'; reportId: string }
  | { type: 'togglePinReport'; reportId: string }
  | { type: 'deleteReport'; reportId: string }
  | { type: 'navigateToFrame'; frame: ContextFrame }
  | { type: 'navigateBack' }
  | { type: 'switchBundle'; id: string }
  | {
      type: 'askAssistant';
      payload: {
        text?: string;
        frame?: ContextFrame;
        symbolId?: string;
        filePath?: string;
        drift?: any;
      };
    }
  | {
      type: 'applyRefactorSuggestion';
      payload: { symbolId: string; suggestedName: string; filePath?: string };
    }
  | { type: 'openSymbolInEditor'; symbolId: string }
  | { type: 'analyzeFrame'; frameId: string }
  | { type: 'getExplorerTree' }
  | { type: 'getBundleData' }
  | { type: 'updateBundleConfig'; config: Partial<BundleConfig> }
  | { type: 'setLastNCommits'; value: number }
  | { type: 'updateCommitIndex'; value: number }
  | { type: 'clearError' }
  | { type: 'getHeadInfo' };
