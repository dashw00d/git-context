import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getGitRoot } from '../utils/config';
import { ActiveBundleProvider } from './activeBundleProvider';

export type TreeNode = {
  id: string;
  type: 'category' | 'commit' | 'file' | 'risk' | 'timeline' | 'load-more' | 'action' | 'bundle-root';
  categoryType?: 'added' | 'modified' | 'removed';
  parentId?: string;
  count?: number;
  label: string;
  description?: string;
  tooltip?: string | vscode.MarkdownString;
  icon?: string;
  contextValue?: string;
  command?: vscode.Command;
  sha?: string;
  path?: string;
  message?: string;
  author?: string;
  date?: string;
  stats?: {
    added: number;
    modified: number;
    removed: number;
  };
  children?: TreeNode[];
};

export class CommitsProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public selectedCommits = new Set<string>();
  public selectedFiles = new Set<string>();
  public workspaceScope: 'workspace' | 'staged' | 'unstaged' = 'workspace';
  public loadMoreOffset = 0;
  public manualCommits: Set<string>;
  public runningTask: { cancel: () => void; token: vscode.CancellationToken } | null = null;
  public PAGE_SIZE = 50;

  constructor(private context: vscode.ExtensionContext, private activeBundleProvider: ActiveBundleProvider) {
    this.manualCommits = new Set(context.workspaceState.get<string[]>('commit-tracker.manualCommits', []));

    // Load initial state
    const selectedCommits = context.workspaceState.get<string[]>('selectedCommits', []);
    this.selectedCommits = new Set(selectedCommits);

    const selectedFiles = context.workspaceState.get<string[]>('selectedFiles', []);
    this.selectedFiles = new Set(selectedFiles);

    this.workspaceScope = context.workspaceState.get('workspaceScope', 'workspace');
    this.loadMoreOffset = context.workspaceState.get('loadMoreOffset', 0);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    let collapsibleState = this.getCollapsibleState(element);

    const treeItem = new vscode.TreeItem(element.label || '', collapsibleState);
    treeItem.id = element.id;
    treeItem.description = element.description;

    // Create rich tooltips with MarkdownString
    if (element.type === 'commit') {
      const mdTooltip = new vscode.MarkdownString();
      mdTooltip.appendMarkdown(`**${element.message!.split('\n')[0]}**\n\n`);
      mdTooltip.appendMarkdown(`- SHA: \`${element.sha!.substring(0, 8)}\`\n`);
      mdTooltip.appendMarkdown(`- Author: ${element.author}\n`);
      mdTooltip.appendMarkdown(`- Date: ${new Date(element.date!).toLocaleDateString()}\n\n`);
      if (element.message!.includes('\n')) {
        mdTooltip.appendMarkdown(`\n\`\`\`\n${element.message}\n\`\`\`\n\n`);
      }
      mdTooltip.appendMarkdown(`*Click to expand files • Right-click for actions*`);
      treeItem.tooltip = mdTooltip;
    } else if (element.tooltip) {
      if (element.tooltip instanceof vscode.MarkdownString) {
        treeItem.tooltip = element.tooltip;
      } else {
        const mdTooltip = new vscode.MarkdownString(element.tooltip);
        treeItem.tooltip = mdTooltip;
      }
    }

    treeItem.iconPath = element.icon ? new vscode.ThemeIcon(element.icon) : undefined;
    treeItem.command = element.command;
    treeItem.contextValue = element.contextValue;

    // Handle selection items: No commands, simple tooltips
    if (element.contextValue?.startsWith('gitContextSelection')) {
      treeItem.command = undefined;
      treeItem.tooltip = element.description || element.tooltip || '';
    }

    return treeItem;
  }

  private getCollapsibleState(element: TreeNode): vscode.TreeItemCollapsibleState {
    if (element.contextValue === 'no-data-placeholder') {
      return vscode.TreeItemCollapsibleState.None;
    } else if (element.contextValue === 'workspace-group') {
      return vscode.TreeItemCollapsibleState.Expanded;
    } else if (element.contextValue === 'recent-commits-group') {
      return vscode.TreeItemCollapsibleState.Expanded;
    } else if (element.contextValue === 'selected-commits-group') {
      return vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.contextValue === 'gitContextSelectionStaged' || element.contextValue === 'gitContextSelectionUnstaged') {
      return vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.contextValue === 'workspace-full') {
      return vscode.TreeItemCollapsibleState.None;
    } else if (element.type === 'category' && element.count === 0 && !element.children?.length) {
      return vscode.TreeItemCollapsibleState.None;
    } else if (element.children && element.children.length > 0) {
      return vscode.TreeItemCollapsibleState.Collapsed;
    }
    return vscode.TreeItemCollapsibleState.None;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // Root level - show selection header
      return this.getRootNodes();
    }

    // Handle selection section children
    if (element.id === 'selection-header') {
      return this.getSelectionNodes();
    }

    if (element.id === 'workspace-select') {
      return this.getWorkspaceSelectionChildren();
    }

    if (element.id === 'selection-staged') {
      return this.getStagedFileNodes();
    }

    if (element.id === 'selection-unstaged') {
      return this.getUnstagedFileNodes();
    }

    if (element.id === 'selection-commits') {
      return this.getCommitSelectionNodes();
    }

    if (element.id === 'selection-more' || element.contextValue === 'gitContextActionAddBySha') {
      return []; // Leaf node, clicking shows input
    }

    // Handle workspace staged/unstaged file children
    if (element.id === 'workspace-staged') {
      return this.getWorkspaceStagedFiles();
    }

    if (element.id === 'workspace-unstaged') {
      return this.getWorkspaceUnstagedFiles();
    }

    // Handle selected-commits-group children
    if (element.id === 'selected-commits-group') {
      return [];
    }

    // Handle recent-commits-group children
    if (element.id === 'recent-commits-group') {
      return this.getRecentCommitsList();
    }

    return [];
  }

  private async getRootNodes(): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [{
      id: 'selection-header',
      type: 'category',
      label: '🔄 New Analysis',
      description: '',
      tooltip: 'Select workspace files and commits to analyze',
      contextValue: 'gitContextSelectionHeader',
      command: {
        command: 'git-context.analyzeLastCommits',
        title: 'Analyze Last N Commits'
      }
    }];

    // Add recent commits section
    nodes.push({
      id: 'recent-commits-group',
      type: 'category',
      label: '📋 Recent Commits',
      description: '',
      tooltip: 'Recently analyzed commits',
      contextValue: 'gitContextRecentCommitsGroup'
    });

    return nodes;
  }

  private getSelectionNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];

    // Workspace node
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const changes = git.getWorkingDirectoryChanges();
      const fileCount = changes.length;

      nodes.push({
        id: 'workspace-select',
        type: 'category',
        count: fileCount,
        label: this.getCheckboxLabel(this.selectedFiles.size > 0, `Workspace - ${fileCount} files (${this.workspaceScope})`),
        description: '',
        tooltip: `Select workspace files for analysis. Scope: ${this.workspaceScope}`,
        contextValue: 'gitContextSelectionItem'
      });
    } catch (error) {
      console.debug('Failed to get workspace changes:', error);
    }

    // Commits node
    nodes.push({
      id: 'selection-commits',
      type: 'category',
      count: this.selectedCommits.size,
      label: `Commits (${this.selectedCommits.size} selected)`,
      description: '',
      tooltip: 'Select commits to analyze',
      contextValue: 'gitContextSelectionItem'
    });

    // Pull Latest action button
    nodes.push({
      id: 'pull-latest-action',
      type: 'action',
      label: 'Pull Latest Commits',
      description: '',
      tooltip: 'Fetch and display the latest commits',
      contextValue: 'gitContextActionPullLatest',
      icon: 'repo-pull'
    });

    return nodes;
  }

  private getWorkspaceSelectionChildren(): TreeNode[] {
    const nodes: TreeNode[] = [];

    // Staged files
    nodes.push({
      id: 'selection-staged',
      type: 'category',
      label: this.getCheckboxLabel(false, 'Staged Files'),
      description: '',
      tooltip: 'Files staged for commit',
      contextValue: 'gitContextSelectionStaged'
    });

    // Unstaged files
    nodes.push({
      id: 'selection-unstaged',
      type: 'category',
      label: this.getCheckboxLabel(false, 'Unstaged Files'),
      description: '',
      tooltip: 'Files with uncommitted changes',
      contextValue: 'gitContextSelectionUnstaged'
    });

    return nodes;
  }

  private async getStagedFileNodes(): Promise<TreeNode[]> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const staged = git.getStagedFiles();

      return staged.map((f: { path: string }) => ({
        id: `staged-${f.path}`,
        type: 'file',
        path: f.path,
        label: path.basename(f.path),
        description: f.path,
        tooltip: `Staged file: ${f.path}`,
        contextValue: 'gitContextFile',
        icon: 'file'
      }));
    } catch (error) {
      console.debug('Failed to get staged files:', error);
      return [];
    }
  }

  private async getUnstagedFileNodes(): Promise<TreeNode[]> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const unstaged = git.getUnstagedFiles();

      return unstaged.map((f: { path: string }) => ({
        id: `unstaged-${f.path}`,
        type: 'file',
        path: f.path,
        label: path.basename(f.path),
        description: f.path,
        tooltip: `Unstaged file: ${f.path}`,
        contextValue: 'gitContextFile',
        icon: 'file'
      }));
    } catch (error) {
      console.debug('Failed to get unstaged files:', error);
      return [];
    }
  }

  private async getCommitSelectionNodes(): Promise<TreeNode[]> {
    // This would show selected commits - for now return empty
    // In the future, this would show the actual selected commits
    return [];
  }

  private async getWorkspaceStagedFiles(): Promise<TreeNode[]> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const gitRoot = getGitRoot();
      const staged = git.getStagedFiles();

      return staged.map((f: { path: string }) => {
        const fullPath = gitRoot ? path.join(gitRoot, f.path) : f.path;
        let command: vscode.Command | undefined;

        if (gitRoot) {
          try {
            const stats = fs.statSync(fullPath);
            const isFile = stats.isFile();
            if (isFile) {
              command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(fullPath)]
              };
            } else {
              command = {
                command: 'revealInExplorer',
                title: 'Reveal in Explorer',
                arguments: [vscode.Uri.file(fullPath)]
              };
            }
          } catch {
            command = undefined;
          }
        }

        return {
          id: `workspace-staged-${f.path}`,
          type: 'file',
          path: f.path,
          label: path.basename(f.path),
          description: f.path,
          tooltip: `Staged file: ${f.path}`,
          contextValue: 'gitContextFile',
          command,
          icon: 'file'
        };
      });
    } catch (error) {
      console.debug('Failed to get workspace staged files:', error);
      return [];
    }
  }

  private async getWorkspaceUnstagedFiles(): Promise<TreeNode[]> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const gitRoot = getGitRoot();
      const unstaged = git.getUnstagedFiles();

      return unstaged.map((f: { path: string }) => {
        const fullPath = gitRoot ? path.join(gitRoot, f.path) : f.path;
        let command: vscode.Command | undefined;

        if (gitRoot) {
          try {
            const stats = fs.statSync(fullPath);
            const isFile = stats.isFile();
            if (isFile) {
              command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(fullPath)]
              };
            } else {
              command = {
                command: 'revealInExplorer',
                title: 'Reveal in Explorer',
                arguments: [vscode.Uri.file(fullPath)]
              };
            }
          } catch {
            command = undefined;
          }
        }

        return {
          id: `workspace-unstaged-${f.path}`,
          type: 'file',
          path: f.path,
          label: path.basename(f.path),
          description: f.path,
          tooltip: `Unstaged file: ${f.path}`,
          contextValue: 'gitContextFile',
          command,
          icon: 'file'
        };
      });
    } catch (error) {
      console.debug('Failed to get workspace unstaged files:', error);
      return [];
    }
  }

  // Methods for compatibility with commands.ts
  async initializeDatabase(): Promise<void> {
    // TODO: Implement database initialization if needed
  }

  getWorkspaceScope(): 'workspace' | 'staged' | 'unstaged' {
    return this.workspaceScope;
  }

  toggleCommitSelection(commit: any): void {
    const sha = commit.sha || commit.id;
    if (this.selectedCommits.has(sha)) {
      this.selectedCommits.delete(sha);
    } else {
      this.selectedCommits.add(sha);
    }
    this.refresh();
  }

  clearSelection(): void {
    this.selectedCommits.clear();
    this.selectedFiles.clear();
    this.refresh();
  }

  toggleFileSelection(file: any): void {
    const path = file.path || file.id;
    if (this.selectedFiles.has(path)) {
      this.selectedFiles.delete(path);
    } else {
      this.selectedFiles.add(path);
    }
    this.refresh();
  }

  selectAllStaged(): void {
    // TODO: Implement select all staged files
  }

  selectAllUnstaged(): void {
    // TODO: Implement select all unstaged files
  }

  markCommitAsManual(sha: string): void {
    this.manualCommits.add(sha);
  }

  persistState(): void {
    // TODO: Implement state persistence
  }

  get workspaceParts(): Set<string> {
    return this.selectedFiles;
  }

  set workspaceParts(parts: Set<string>) {
    this.selectedFiles = parts;
  }

  // State management methods
  setSelectedCommits(commits: Set<string>) {
    this.selectedCommits = commits;
    this.context.workspaceState.update('selectedCommits', Array.from(commits));
    this.refresh();
  }

  setSelectedFiles(files: Set<string>) {
    this.selectedFiles = files;
    this.context.workspaceState.update('selectedFiles', Array.from(files));
    this.refresh();
  }

  getSelectedCommits(): Set<string> {
    return this.selectedCommits;
  }

  getSelectedFiles(): Set<string> {
    return this.selectedFiles;
  }

  private async getRecentCommitsList(): Promise<TreeNode[]> {
    try {
      const { getDatabaseManager } = await import('../storage/database');
      const db = getDatabaseManager().getDatabase();

      // Get recent commits (limit to 20 for performance)
      const commitsStmt = db.prepare(`
        SELECT m.sha, m.author, m.date, m.message,
               COALESCE(a.symbols_added, 0) + COALESCE(a.symbols_modified, 0) + COALESCE(a.symbols_removed, 0) as changes
        FROM commits_metadata m
        LEFT JOIN commits_analysis a ON m.sha = a.sha
        ORDER BY m.date DESC
        LIMIT 20
      `);

      const commits = commitsStmt.all() as any[];
      const nodes: TreeNode[] = [];

      for (const commit of commits) {
        const isSelected = this.selectedCommits.has(commit.sha);
        const inBundle = this.activeBundleProvider.lastBundleFacts?.bundle?.shas?.includes(commit.sha) || false;
        const shortSha = commit.sha.substring(0, 8);
        const changesText = commit.changes > 0 ? ` (${commit.changes} changes)` : '';

        nodes.push({
          id: `commit-${commit.sha}`,
          type: 'commit',
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          date: commit.date,
          label: this.getCheckboxLabel(isSelected, `${shortSha} - ${commit.message.split('\n')[0]}`),
          description: `${commit.author} • ${new Date(commit.date).toLocaleDateString()}${changesText}`,
          tooltip: `Commit: ${commit.sha}\nAuthor: ${commit.author}\nDate: ${commit.date}\nMessage: ${commit.message}`,
          contextValue: inBundle ? 'gitContextCommitInBundle' : 'gitContextCommit',
          command: {
            command: 'git-context.toggleCommitSelection',
            title: 'Toggle Selection',
            arguments: [commit.sha]
          }
        });
      }

      return nodes;
    } catch (error) {
      console.error('Failed to load recent commits:', error);
      return [{
        id: 'error-loading-commits',
        type: 'risk',
        label: 'Error loading commits',
        description: 'Check console for details',
        icon: 'error'
      }];
    }
  }

  private getCheckboxLabel(isChecked: boolean, label: string): string {
    return isChecked ? `☑ ${label}` : `☐ ${label}`;
  }

  async exportCommitsDto(limit = 20): Promise<Array<{ sha: string; message: string; author?: string; date?: string }>> {
    try {
      const { getDatabaseManager } = await import('../storage/database');
      const db = getDatabaseManager().getDatabase();
      const limitValue = Math.max(1, Number(limit) || 20);
      const commitsStmt = db.prepare(`
        SELECT m.sha, m.author, m.date, m.message
        FROM commits_metadata m
        ORDER BY m.date DESC
        LIMIT ${limitValue}
      `);
      const commits = commitsStmt.all() as any[];
      commitsStmt.free?.();

      return commits.map((commit) => ({
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        date: commit.date
      }));
    } catch (error) {
      console.error('Failed to export commits for cockpit:', error);
      return [];
    }
  }

  exportSelectionDto(): { selectedCommitShas: string[]; selectedFiles: string[]; workspaceScope: 'workspace' | 'staged' | 'unstaged' } {
    return {
      selectedCommitShas: Array.from(this.selectedCommits),
      selectedFiles: Array.from(this.selectedFiles),
      workspaceScope: this.workspaceScope
    };
  }
}
