import type { DriftFindings } from '../facts/driftDetector';

// Git commit information
export interface CommitInfo {
  sha: string;
  author: string;
  date: string;
  message: string;
  parent?: string;
}

// File change information
export interface FileChange {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U'; // Added, Modified, Deleted, Renamed, Copied, Unmerged
  oldPath?: string;
}

// Symbol information extracted from code
export interface SymbolInfo {
  id: string; // MUST be stable DNA-based ID
  dnaId: string; // Explicit DNA hash for tracking across renames (v1)
  dnaIdV2?: string; // Enhanced DNA with AST n-grams (v2)
  dnaVersion?: 1 | 2; // Which DNA version is authoritative
  semanticId?: string; // Path-independent ID (e.g., class:MyClass)
  name: string;
  kind: 'function' | 'class' | 'method' | 'const' | 'interface' | 'type' | 'variable';
  signature: string;
  bodyHash?: string; // NEW: Hash of function body for change detection
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  docstring?: string;
}

// Symbol change types
export type SymbolChangeType =
  | 'added'
  | 'removed'
  | 'modified'
  | 'signature_changed'
  | 'body_changed';

// Symbol delta between commits
export interface SymbolDelta {
  symbol: SymbolInfo;
  changeType: SymbolChangeType;
  previousSymbol?: SymbolInfo;
  modReason?: ModReason;
  diffSnippetPre?: string;
  diffSnippetPost?: string;
}

// Dependency edge types
export interface EdgeInfo {
  from: string; // symbol ID
  to: string; // symbol ID
  type: 'imports' | 'calls' | 'extends' | 'implements' | 'uses';
  confidence?: number; // 0.0 to 1.0
  isResolved?: boolean;
}

// Edge delta between commits
export interface EdgeDelta {
  edge: EdgeInfo;
  changeType: 'added' | 'removed';
}

// Risk flags for commits
export type RiskFlag =
  | 'breaking-api'
  | 'schema-migration'
  | 'refactor'
  | 'security'
  | 'performance'
  | 'auth'
  | 'payment';

// LLM response structure
export interface LLMResponse {
  summary_md: string;
  breaking_changes: string[];
  migration_notes: string[];
  refactor_clusters: string[];
  tests_needed: string[];
  questions_for_author: string[];
}

// Complete commit analysis result
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

// Database commit summary
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
  risks: string[]; // JSON string array
}

// Tree node types for discriminated union
export type NodeType = 'commit' | 'file' | 'category' | 'symbol' | 'risk';

// Tree view item for VS Code UI
export interface TreeItem extends TreeNodeBase {
  label: string;
  description?: string;
  tooltip?: string;
  children?: TreeItem[];
  command?: any; // VS Code Command
  icon?: string;
  contextValue?: string;
}

// Base interface for tree nodes with discriminated union
export interface TreeNodeBase {
  id: string;
  type: NodeType;
}

// Configuration interface
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

// Analysis Pipeline Types
export interface CommitMetadata {
  sha: string;
  author: string;
  date: string;
  message: string;
  parent?: string;
  filesChanged: FileChange[]; // Basic file list from git
  loadedAt?: string; // ISO timestamp when loaded
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
  analyzedAt: string; // ISO timestamp
  pipelineVersion?: string;
  promptVersion?: string;
  model?: string;
}

export interface AnalysisOptions {
  skipDifftastic?: boolean;
  skipLLM?: boolean;
  skipQdrant?: boolean;
  forceReanalyze?: boolean; // Re-analyze even if already analyzed
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

// Difftastic result type (placeholder for now)
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

  // Qdrant configUrl?: string;
  qdrantUrl?: string;
  qdrantApiKey?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  allowedExtensions?: string[];
  maxFileSize?: number;
  perProjectQdrantCollections?: boolean;

  // CST tracking config
  enableCstTracking?: boolean;
  enableCstAugmentation?: boolean;
  cstLanguages?: string[];

  // Snapshot cache config
  snapshotCacheEnabled?: boolean;
  snapshotCacheSize?: number;
  snapshotCacheTTL?: number;

  // Path filtering config
  excludedPrefixes?: string[]; // Hardcoded path prefixes to exclude (defaults: out/, dist/, node_modules/, .git/, build/, coverage/)

  // Detector thresholds config
  detectorThresholds?: {
    similarityMin?: number; // Minimum similarity score (0.0-1.0)
    confidenceMin?: number; // Minimum confidence score (0.0-1.0)
    changeThreshold?: number; // Minimum change count for significance
    maxGroupSize?: number; // Maximum size of groups to process
    scoreWeight?: number; // Weight multiplier for scoring
  };
}

// Context values for tree items (used in package.json menus and tree item identification)
export const ContextValues = {
  // Workspace and bundle related
  WORKSPACE_GROUP: 'workspace-group',
  WORKSPACE_FULL: 'workspace-full',
  WORKSPACE_STAGED: 'workspace-staged',
  WORKSPACE_UNSTAGED: 'workspace-unstaged',
  WORKSPACE_FILE: 'workspace-file',

  // Bundle and refactor related
  REFACTOR_BUNDLE_PROGRESS: 'refactor-bundle-progress',
  REFACTOR_BUNDLE_GROUPING: 'refactor-bundle-grouping',
  REFACTOR_BUNDLE_GROUPING_ITEM: 'refactor-bundle-grouping-item',
  REFACTOR_BUNDLE_ITEM: 'refactor-bundle-item',
  REFACTOR_FINDING: 'refactor-finding',
  BUNDLE_FILE: 'bundle-file',
  BUNDLE_SYMBOL: 'bundle-symbol',
  BUNDLE_HOTSPOT_FILE: 'bundle-hotspot-file',

  // Commit related
  COMMIT: 'commit',
  COMMIT_HEAD: 'commit head',
  COMMIT_IN_BUNDLE: 'commit inRefactorBundle',
  COMMIT_IN_BUNDLE_HEAD: 'commit inRefactorBundle head',

  // Timeline and navigation
  TIMELINE_ITEM: 'timeline-item',
  LOAD_MORE: 'load-more',

  // Selection section
  SELECTION_HEADER: 'selection-header',
  SELECTION_ITEM: 'selection-item',
  SELECTION_FILE: 'selection-file',
  SELECTION_COMMIT: 'selection-commit',
  ACTION_ADD_COMMIT: 'action-add-commit',

  // Report section
  SAVED_REPORT: 'saved-report',
  REPORT_WORKSPACE_SUMMARY: 'report-workspace-summary',
  REPORT_COMMIT_SUMMARY: 'report-commit-summary',
  REPORT_FILE: 'report-file',
  REPORT_FINDING: 'report-finding',

  // State indicators
  EMPTY_STATE: 'empty-state',
  NO_DATA_PLACEHOLDER: 'no-data-placeholder',
  SEPARATOR: 'separator',
  INITIALIZE_PLACEHOLDER: 'initialize-placeholder',
  ACTIVE_BUNDLE: 'activeBundle',
  SELECTED_COMMITS_GROUP: 'selected-commits-group',
  RECENT_COMMITS_GROUP: 'recent-commits-group',
} as const;

export type ContextValue = (typeof ContextValues)[keyof typeof ContextValues];

// Re-export CST fact types
export { isCstFact, isSymbolInfo } from './cstFacts';
export type { CstFact, CstFactKind, DeltaChange, HybridFact } from './cstFacts';
