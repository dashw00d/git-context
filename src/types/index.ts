import type { DriftFindings } from './drift';

export interface CommitInfo {
  sha: string;
  author: string;
  date: string;
  message: string;
  parent?: string;
}

export interface FileChange {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
  oldPath?: string;
}

export interface SymbolInfo {
  id: string; // DNA hash (stable identifier across renames/moves)
  dnaVersion?: 2; // Always 2 when assigned via assignDNAIds
  semanticId?: string; // Legacy field, kept for compatibility
  filePath: string; // File path where symbol is located
  name: string;
  kind: 'function' | 'class' | 'method' | 'const' | 'interface' | 'type' | 'variable';
  signature: string;
  bodyHash?: string;
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  docstring?: string;
}

export type SymbolDeltaChangeType =
  | 'added'
  | 'removed'
  | 'modified'
  | 'signature_changed'
  | 'body_changed';

export interface SymbolDelta {
  symbol: SymbolInfo;
  changeType: SymbolDeltaChangeType;
  previousSymbol?: SymbolInfo;
  modReason?: ModReason;
  diffSnippetPre?: string;
  diffSnippetPost?: string;
}

export interface EdgeInfo {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses';
  confidence?: number;
  isResolved?: boolean;
}

export interface EdgeDelta {
  edge: EdgeInfo;
  changeType: 'added' | 'removed';
}

export type RiskFlag =
  | 'breaking-api'
  | 'schema-migration'
  | 'refactor'
  | 'security'
  | 'performance'
  | 'auth'
  | 'payment';

export interface LLMResponse {
  summary_md: string;
  breaking_changes: string[];
  migration_notes: string[];
  refactor_clusters: string[];
  tests_needed: string[];
  questions_for_author: string[];
}

export interface AnalysisResult {
  commit: CommitInfo;
  files: FileChange[];
  symbols: {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  };
  edges: {
    added: EdgeInfo[];
    removed: EdgeInfo[];
  };
  risks: RiskFlag[];
  difftasticHighlights: string[];
  llmSummary?: LLMResponse;
  drift?: DriftFindings;
}

export interface CommitSummary {
  sha: string;
  author: string;
  date: string;
  message: string;
  summary_md: string;
  raw_llm_json: string;
  files_changed: number;
  symbols_added: number;
  symbols_removed: number;
  symbols_modified: number;
  edges_added: number;
  edges_removed: number;
  risks: string[];
}

export type NodeType = 'commit' | 'file' | 'category' | 'symbol' | 'risk';

export interface TreeItem extends TreeNodeBase {
  label: string;
  description?: string;
  tooltip?: string;
  children?: TreeItem[];
  command?: any;
  icon?: string;
  contextValue?: string;
}

export interface TreeNodeBase {
  id: string;
  type: NodeType;
}

export type ChangeType =
  | 'added'
  | 'modified'
  | 'signature_changed'
  | 'removed'
  | 'renamed'
  | 'moved';
export type ModReason =
  | 'body_changed'
  | 'signature_changed'
  | 'doc_changed'
  | 'visibility_changed'
  | 'annotation_changed';

export interface CommitMetadata {
  sha: string;
  author: string;
  date: string;
  message: string;
  parent?: string;
  filesChanged: FileChange[];
  loadedAt?: string;
}

export interface CommitAnalysis {
  sha: string;
  symbols: {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: SymbolDelta[];
  };
  edges: {
    added: EdgeInfo[];
    removed: EdgeInfo[];
  };
  risks: RiskFlag[];
  difftasticHighlights: DifftasticResult[];
  llmSummary?: LLMResponse;
  blastRadius: number;
  analyzedAt: string;
  pipelineVersion?: string;
  promptVersion?: string;
  model?: string;
}

export interface AnalysisOptions {
  skipDifftastic?: boolean;
  skipLLM?: boolean;
  skipQdrant?: boolean;
  forceReanalyze?: boolean;
  promptVersion?: string;
  model?: string;
}

export interface StagedAnalysis {
  files: FileChange[];
  symbols: {
    added: SymbolInfo[];
    modified: SymbolDelta[];
  };
  edges: {
    added: EdgeInfo[];
  };
  risks: RiskFlag[];
  blastRadius: number;
}

export interface DifftasticResult {
  file: string;
  highlights: string[];
}

export interface ExtensionConfig {
  openRouterApiKey?: string;
  openRouterModel: string;
  apiEndpoint: string;
  difftasticPath?: string;
  defaultCommitCount: number;
  tokensPerStep?: { [key: string]: number };
  customPrompts?: {
    [key: string]: string;
  } | null;
  customIgnorePaths?: string[] | null;
  rerankingWeights?: {
    drift: number;
    hotspot: number;
    theme: number;
  };

  qdrantUrl?: string;
  qdrantApiKey?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  allowedExtensions?: string[];
  maxFileSize?: number;
  perProjectQdrantCollections?: boolean;

  enableCstTracking?: boolean;
  enableCstAugmentation?: boolean;
  cstLanguages?: string[];

  snapshotCacheEnabled?: boolean;
  snapshotCacheSize?: number;
  snapshotCacheTTL?: number;

  excludedPrefixes?: string[];

  detectorThresholds?: {
    similarityMin?: number;
    confidenceMin?: number;
    changeThreshold?: number;
    maxGroupSize?: number;
    scoreWeight?: number;
  };
}

export const ContextValues = {
  WORKSPACE_GROUP: 'workspace-group',
  WORKSPACE_FULL: 'workspace-full',
  WORKSPACE_STAGED: 'workspace-staged',
  WORKSPACE_UNSTAGED: 'workspace-unstaged',
  WORKSPACE_FILE: 'workspace-file',

  REFACTOR_BUNDLE_PROGRESS: 'refactor-bundle-progress',
  REFACTOR_BUNDLE_GROUPING: 'refactor-bundle-grouping',
  REFACTOR_BUNDLE_GROUPING_ITEM: 'refactor-bundle-grouping-item',
  REFACTOR_BUNDLE_ITEM: 'refactor-bundle-item',
  REFACTOR_FINDING: 'refactor-finding',
  BUNDLE_FILE: 'bundle-file',
  BUNDLE_SYMBOL: 'bundle-symbol',
  BUNDLE_HOTSPOT_FILE: 'bundle-hotspot-file',

  COMMIT: 'commit',
  COMMIT_HEAD: 'commit head',
  COMMIT_IN_BUNDLE: 'commit inRefactorBundle',
  COMMIT_IN_BUNDLE_HEAD: 'commit inRefactorBundle head',

  TIMELINE_ITEM: 'timeline-item',
  LOAD_MORE: 'load-more',

  SELECTION_HEADER: 'selection-header',
  SELECTION_ITEM: 'selection-item',
  SELECTION_FILE: 'selection-file',
  SELECTION_COMMIT: 'selection-commit',
  ACTION_ADD_COMMIT: 'action-add-commit',

  SAVED_REPORT: 'saved-report',
  REPORT_WORKSPACE_SUMMARY: 'report-workspace-summary',
  REPORT_COMMIT_SUMMARY: 'report-commit-summary',
  REPORT_FILE: 'report-file',
  REPORT_FINDING: 'report-finding',

  EMPTY_STATE: 'empty-state',
  NO_DATA_PLACEHOLDER: 'no-data-placeholder',
  SEPARATOR: 'separator',
  INITIALIZE_PLACEHOLDER: 'initialize-placeholder',
  ACTIVE_BUNDLE: 'activeBundle',
  SELECTED_COMMITS_GROUP: 'selected-commits-group',
  RECENT_COMMITS_GROUP: 'recent-commits-group',
} as const;

export type ContextValue = (typeof ContextValues)[keyof typeof ContextValues];

export { isCstFact, isSymbolInfo } from './cstFacts';
export type { CstFact, CstFactKind, DeltaChange, HybridFact } from './cstFacts';
