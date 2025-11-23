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
    id: string;
    semanticId?: string;
    name: string;
    kind: 'function' | 'class' | 'method' | 'const' | 'interface' | 'type' | 'variable';
    signature: string;
    location: {
        start: {
            line: number;
            column: number;
        };
        end: {
            line: number;
            column: number;
        };
    };
    docstring?: string;
}
export type SymbolChangeType = 'added' | 'removed' | 'modified' | 'signature_changed' | 'body_changed';
export interface SymbolDelta {
    symbol: SymbolInfo;
    changeType: SymbolChangeType;
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
export type RiskFlag = 'breaking-api' | 'schema-migration' | 'refactor' | 'security' | 'performance' | 'auth' | 'payment';
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
export type NodeType = "commit" | "file" | "category" | "symbol" | "risk";
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
export type ChangeType = "added" | "modified" | "signature_changed" | "removed" | "renamed" | "moved";
export type ModReason = "body_changed" | "signature_changed" | "doc_changed" | "visibility_changed" | "annotation_changed";
export interface ExtensionConfig {
    openRouterApiKey?: string;
    openRouterModel: string;
    apiEndpoint: string;
    difftasticPath?: string;
    defaultCommitCount: number;
}
//# sourceMappingURL=index.d.ts.map