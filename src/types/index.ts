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
  id: string;
  name: string;
  kind: 'function' | 'class' | 'method' | 'const' | 'interface' | 'type' | 'variable';
  signature: string;
  location: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  docstring?: string;
}

// Symbol change types
export type SymbolChangeType = 'added' | 'removed' | 'modified' | 'signature_changed' | 'body_changed';

// Symbol delta between commits
export interface SymbolDelta {
  symbol: SymbolInfo;
  changeType: SymbolChangeType;
  previousSymbol?: SymbolInfo;
}

// Dependency edge types
export interface EdgeInfo {
  from: string; // symbol ID
  to: string;   // symbol ID
  type: 'imports' | 'calls' | 'extends' | 'implements';
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

// Tree view item for VS Code UI
export interface TreeItem {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  children?: TreeItem[];
  command?: any; // VS Code Command
  icon?: string;
  contextValue?: string;
}

// Configuration interface
export interface ExtensionConfig {
  openRouterApiKey?: string;
  openRouterModel: string;
  apiEndpoint: string;
  difftasticPath?: string;
  defaultCommitCount: number;
}
