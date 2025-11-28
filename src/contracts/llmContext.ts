export type LlmContextVersion = "1.0.0";

export type ChangeType = "added" | "modified" | "signature_changed" | "removed" | "renamed" | "moved";
export type EdgeType = "calls" | "imports" | "uses" | "extends" | "implements";
export type ModReason = "body_changed" | "signature_changed" | "doc_changed" | "visibility_changed" | "annotation_changed";

export interface Loc {
    start: { line: number; column: number };
    end: { line: number; column: number };
}

export interface LlmContextReport {
    version: LlmContextVersion;
    generated_at: string; // ISO
    repo: { root: string; head_sha: string; branch: string };

    commits: CommitContext[];
    global_risks: RiskItem[];

    // optional: cross-commit rollups
    rollups?: {
        hotspots: Hotspot[];
        top_changed_files: FileRollup[];
        dependency_deltas: DependencyDelta[];
        expected_absent_but_present_count?: number;
        expected_present_but_missing_count?: number;
    };

    // optional: graph visualizations
    graphs?: {
        dependency_graph?: string; // Mermaid graph
        blast_radius_graph?: string; // Mermaid graph
    };

    // optional: drift audit
    legacy_audit?: LegacyAuditReport;
}

export interface LegacyAuditReport {
    missing_symbols: string[]; // Expected present but missing (incomplete migration)
    zombie_symbols: string[]; // Expected absent but present (dead code)
    replaced_leftover: string[]; // Old version of renamed symbol still exists
    dead_candidates: string[]; // Symbols with no incoming edges in working tree
    drift_edges: EdgeContext[]; // Edges that exist in working tree but not in intended state
    hotspots: string[]; // Files with high drift
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
    llm_summary?: string; // your model output
}

export interface FileContext {
    path: string;
    language: string;
    stats: { added: number; modified: number; removed: number; renamed?: boolean };

    hunks?: DiffHunk[]; // optional, truncated
    symbols: {
        added: SymbolContext[];
        modified: SymbolContext[];
        removed: SymbolContext[];
        renamed?: RenameContext[];
    };
}

export interface SymbolContext {
    id: number;          // row pk
    symbol_id: string;   // semantic id for edges
    name: string;
    kind: string;        // "class" | "method" | "function" | ...
    signature?: string;
    dnaId?: string;      // DNA hash for similarity clustering
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
    confidence: number; // 0.0 to 1.0
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
    type: string; // "breaking-api" | "schema-migration" | "refactor" | "security" | "performance" | "auth" | "payment"
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    symbols?: string[]; // affected symbol_ids
}

export interface DiffHunk {
    old_start: number;
    old_lines: number;
    new_start: number;
    new_lines: number;
    content: string; // truncated diff content
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