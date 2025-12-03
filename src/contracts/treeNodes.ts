import * as vscode from 'vscode';

export type NodeType = 'commit' | 'file' | 'category' | 'symbol' | 'risk';

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

export interface CommitNode extends TreeNodeBase {
  type: 'commit';
  sha: string;
  message: string;
  author: string;
  date: string;
  isSelected?: boolean;
}

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

export interface CategoryNode extends TreeNodeBase {
  type: 'category';
  categoryType: 'added' | 'modified' | 'removed' | 'risks';
  parentId: string;
  count: number;
}

export interface SymbolNode extends TreeNodeBase {
  type: 'symbol';
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

export interface RiskNode extends TreeNodeBase {
  type: 'risk';
  severity?: string;
  category?: string;
}

export type TreeNode = CommitNode | FileNode | CategoryNode | SymbolNode | RiskNode;

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
