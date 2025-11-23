/**
 * Tree Node Type System
 *
 * Discriminated unions for tree view nodes to eliminate regex-based
 * collapsibility logic and make node handling type-safe.
 *
 * INVARIANT: Every node type explicitly declares its collapsibility behavior.
 */
import * as vscode from 'vscode';
export type NodeType = "commit" | "file" | "category" | "symbol" | "risk";
/**
 * Base interface for all tree nodes
 */
export interface TreeNodeBase {
    id: string;
    type: NodeType;
    label: string;
    description?: string;
    tooltip?: string | vscode.MarkdownString;
    icon?: string;
    contextValue?: string;
    children?: TreeNode[];
    command?: vscode.Command;
}
/**
 * Commit node - always expandable, shows files and risks
 */
export interface CommitNode extends TreeNodeBase {
    type: "commit";
    sha: string;
    message: string;
    author: string;
    date: string;
    isSelected?: boolean;
}
/**
 * File node - expandable, shows symbol categories
 */
export interface FileNode extends TreeNodeBase {
    type: "file";
    path: string;
    sha: string;
    stats: {
        added: number;
        modified: number;
        removed: number;
    };
}
/**
 * Category node - expandable, shows symbols within a change type
 */
export interface CategoryNode extends TreeNodeBase {
    type: "category";
    categoryType: "added" | "modified" | "removed" | "risks";
    parentId: string;
    count: number;
}
/**
 * Symbol node - NOT expandable, clickable to navigate
 */
export interface SymbolNode extends TreeNodeBase {
    type: "symbol";
    symbolId: number;
    semanticId: string;
    name: string;
    kind: string;
    path: string;
    sha: string;
    loc?: {
        line: number;
        column: number;
        end_line?: number;
        end_column?: number;
    };
}
/**
 * Risk node - NOT expandable, informational
 */
export interface RiskNode extends TreeNodeBase {
    type: "risk";
    severity?: string;
    category?: string;
}
/**
 * Union of all node types
 */
export type TreeNode = CommitNode | FileNode | CategoryNode | SymbolNode | RiskNode;
/**
 * Type guards
 */
export declare function isCommitNode(node: TreeNode): node is CommitNode;
export declare function isFileNode(node: TreeNode): node is FileNode;
export declare function isCategoryNode(node: TreeNode): node is CategoryNode;
export declare function isSymbolNode(node: TreeNode): node is SymbolNode;
export declare function isRiskNode(node: TreeNode): node is RiskNode;
/**
 * Get collapsibility for a node type
 *
 * INVARIANT: Collapsibility is determined by node type, not ID patterns
 */
export declare function getCollapsibleState(node: TreeNode): vscode.TreeItemCollapsibleState;
/**
 * Convert TreeNode to VS Code TreeItem
 */
export declare function toVSCodeTreeItem(node: TreeNode, command?: vscode.Command): vscode.TreeItem;
//# sourceMappingURL=treeNodes.d.ts.map