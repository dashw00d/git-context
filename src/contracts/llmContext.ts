export type LlmContextVersion = '1.0.0';

export type ChangeType =
  | 'added'
  | 'modified'
  | 'signature_changed'
  | 'removed'
  | 'renamed'
  | 'moved';
export type EdgeType = 'calls' | 'imports' | 'uses' | 'extends' | 'implements';
export type ModReason =
  | 'body_changed'
  | 'signature_changed'
  | 'doc_changed'
  | 'visibility_changed'
  | 'annotation_changed';

export interface Loc {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export interface LlmContextReport {
  version: LlmContextVersion;
  generated_at: string;
  repo: { root: string; head_sha: string; branch: string };

  commits: CommitContext[];
  global_risks: RiskItem[];

  rollups?: {
    hotspots: Hotspot[];
    top_changed_files: FileRollup[];
    dependency_deltas: DependencyDelta[];
    expected_absent_but_present_count?: number;
    expected_present_but_missing_count?: number;
  };

  graphs?: {
    dependency_graph?: string;
    blast_radius_graph?: string;
  };

  legacy_audit?: LegacyAuditReport;
}

export interface LegacyAuditReport {
  missing_symbols: string[];
  zombie_symbols: string[];
  replaced_leftover: string[];
  dead_candidates: string[];
  drift_edges: EdgeContext[];
  hotspots: string[];
}

export interface CommitContext {
  sha: string;
  parent_sha?: string;
  message: string;
  author: string;
  date: string;

  stats: { files: number; added: number; modified: number; removed: number };

  files: FileContext[];
  risks: RiskItem[];
  edges: EdgeContext[];
  llm_summary?: string;
}

export interface FileContext {
  path: string;
  language: string;
  stats: { added: number; modified: number; removed: number; renamed?: boolean };

  hunks?: DiffHunk[];
  symbols: {
    added: SymbolContext[];
    modified: SymbolContext[];
    removed: SymbolContext[];
    renamed?: RenameContext[];
  };
}

export interface SymbolContext {
  id: number;
  symbol_id: string; // DNA hash (stable identifier)
  name: string;
  kind: string;
  signature?: string;
  dnaId?: string; // Legacy field, same as symbol_id
  filePath?: string; // File path where symbol is located
  loc_pre?: Loc;
  loc_post?: Loc;
  mod_reason?: ModReason;
  diff_snippet_pre?: string;
  diff_snippet_post?: string;
}

export interface EdgeContext {
  from_symbol_id: string;
  to_symbol_id: string;
  edge_type: EdgeType;
  change_type: ChangeType;
  confidence: number;
  is_resolved: boolean;
}

export interface RenameContext {
  old_symbol_id: string;
  new_symbol_id: string;
  old_name: string;
  new_name: string;
  confidence: number;
}

export interface RiskItem {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  symbols?: string[];
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  content: string;
}

export interface Hotspot {
  symbol_id: string;
  change_count: number;
  last_changed: string;
  risk_score: number;
}

export interface FileRollup {
  path: string;
  total_changes: number;
  last_commit: string;
  languages: string[];
}

export interface DependencyDelta {
  from_symbol_id: string;
  to_symbol_id: string;
  change_type: ChangeType;
  confidence: number;
}
