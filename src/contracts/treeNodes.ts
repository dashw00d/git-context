/**
 * Tree Node Type System
 *
 * Discriminated unions for tree view nodes to eliminate regex-based
 * collapsibility logic and make node handling type-safe.
 *
 * INVARIANT: Every node type explicitly declares its collapsibility behavior.
 */

import * as vscode from 'vscode';

export type NodeType = 'commit' | 'file' | 'category' | 'symbol' | 'risk';

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
  /**
   * Context value for VS Code tree item context menus and commands.
   * Common values include:
   * - 'workspace-group' | 'workspace-staged' | 'workspace-unstaged' | 'workspace-full'
   * - 'bundle-file' | 'bundle-hotspot-file' | 'bundle-symbol'
   * - 'commit' | 'commit head' | 'commit inRefactorBundle'
   * - 'refactor-finding' | 'refactor-bundle-item' | 'refactor-bundle-grouping-item'
   * - 'load-more' | 'timeline-item'
   */
  contextValue?: string;
  // Optional properties for tree hierarchy
  children?: TreeNode[];
  command?: vscode.Command;
}

/**
 * Commit node - always expandable, shows files and risks
 */
export interface CommitNode extends TreeNodeBase {
  type: 'commit';
  sha: string;
  message: string;
  author: string;
  date: string;
  isSelected?: boolean; // For multi-select
}

/**
 * File node - expandable, shows symbol categories
 */
export interface FileNode extends TreeNodeBase {
  type: 'file';
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
  type: 'category';
  categoryType: 'added' | 'modified' | 'removed' | 'risks';
  parentId: string; // SHA or file ID
  count: number;
}

/**
 * Symbol node - NOT expandable, clickable to navigate
 */
export interface SymbolNode extends TreeNodeBase {
  type: 'symbol';
  symbolId: number; // Database row ID
  semanticId: string; // symbol_id for edges
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
  type: 'risk';
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
export function isCommitNode(node: TreeNode): node is CommitNode {
  return node.type === 'commit';
}

export function isFileNode(node: TreeNode): node is FileNode {
  return node.type === 'file';
}

export function isCategoryNode(node: TreeNode): node is CategoryNode {
  return node.type === 'category';
}

export function isSymbolNode(node: TreeNode): node is SymbolNode {
  return node.type === 'symbol';
}

export function isRiskNode(node: TreeNode): node is RiskNode {
  return node.type === 'risk';
}

/**
 * Get collapsibility for a node type
 *
 * INVARIANT: Collapsibility is determined by node type, not ID patterns
 */
export function getCollapsibleState(node: TreeNode): vscode.TreeItemCollapsibleState {
  switch (node.type) {
    case 'commit':
    case 'file':
    case 'category':
      return vscode.TreeItemCollapsibleState.Collapsed;
    case 'symbol':
    case 'risk':
      return vscode.TreeItemCollapsibleState.None;
  }
}

/**
 * Convert TreeNode to VS Code TreeItem
 */
export function toVSCodeTreeItem(node: TreeNode, command?: vscode.Command): vscode.TreeItem {
  return {
    id: node.id,
    label: node.label,
    description: node.description,
    tooltip: node.tooltip,
    collapsibleState: getCollapsibleState(node),
    iconPath: node.icon ? new vscode.ThemeIcon(node.icon) : undefined,
    command: command,
    contextValue: node.contextValue || node.type,
  };
}
