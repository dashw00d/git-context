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

  // DEPRECATED: State moved to CockpitOrchestrator
  // public selectedCommits = new Set<string>();
  // public selectedFiles = new Set<string>();

  public workspaceScope: 'workspace' | 'staged' | 'unstaged' = 'workspace';
  public loadMoreOffset = 0;
  public manualCommits: Set<string>;
  public runningTask: { cancel: () => void; token: vscode.CancellationToken } | null = null;
  public PAGE_SIZE = 50;

  constructor(private context: vscode.ExtensionContext, private activeBundleProvider: ActiveBundleProvider) {
    this.manualCommits = new Set(context.workspaceState.get<string[]>('commit-tracker.manualCommits', []));

    // DEPRECATED: State moved to CockpitOrchestrator
    // Load initial state (no longer used - CockpitOrchestrator is single source of truth)
    // const selectedCommits = context.workspaceState.get<string[]>('selectedCommits', []);
    // this.selectedCommits = new Set(selectedCommits);
    // const selectedFiles = context.workspaceState.get<string[]>('selectedFiles', []);
    // this.selectedFiles = new Set(selectedFiles);

    this.workspaceScope = context.workspaceState.get('workspaceScope', 'workspace');
    this.loadMoreOffset = context.workspaceState.get('loadMoreOffset', 0);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    const collapsibleState = this.getCollapsibleState(element);

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

  private async getSelectionNodes(): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    // Workspace node
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const changes = await git.getWorkingDirectoryChanges();
      const fileCount = changes.length;

      // Check selected files count
      const { getCockpitOrchestrator: getOrch } = require('../state/cockpitOrchestrator');
      const orch = getOrch();
      const selectedFilesCount = orch.getState().selectedStagedPaths.length + orch.getState().selectedUnstagedPaths.length;

      nodes.push({
        id: 'workspace-select',
        type: 'category',
        count: fileCount,
        label: this.getCheckboxLabel(selectedFilesCount > 0, `Workspace - ${fileCount} files (${this.workspaceScope})`),
        description: '',
        tooltip: `Select workspace files for analysis. Scope: ${this.workspaceScope}`,
        contextValue: 'gitContextSelectionItem'
      });
    } catch (error) {
      console.debug('Failed to get workspace changes:', error);
    }

    // Selection group
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const selectedCount = orchestrator.getState().selectedCommitShas.length;

    nodes.push({
      id: 'selection-commits',
      type: 'category',
      count: selectedCount,
      label: `Commits (${selectedCount} selected)`,
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
      const staged = await git.getStagedFiles();

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
      const unstaged = await git.getUnstagedFiles();

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
      const staged = await git.getStagedFiles();

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
      const unstaged = await git.getUnstagedFiles();

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
    const { ensureDatabaseInitialized } = await import('../storage/database');
    await ensureDatabaseInitialized();
  }

  getWorkspaceScope(): 'workspace' | 'staged' | 'unstaged' {
    return this.workspaceScope;
  }

  async toggleCommitSelection(sha: string): Promise<void> {
    // DEPRECATED: Use CockpitOrchestrator.updateState() instead
    // This method kept for backwards compatibility with tree views
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();
    const selected = new Set(state.selectedCommitShas);

    if (selected.has(sha)) {
      selected.delete(sha);
    } else {
      selected.add(sha);
    }

    orchestrator.updateState({ selectedCommitShas: Array.from(selected) }, 'provider:toggleCommit');
    this.refresh();
  }

  async clearSelection(): Promise<void> {
    // DEPRECATED: Use CockpitOrchestrator.updateState() instead
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    orchestrator.updateState({
      selectedCommitShas: [],
      selectedStagedPaths: [],
      selectedUnstagedPaths: []
    }, 'provider:clearSelection');
    this.refresh();
  }

  async toggleFileSelection(file: any): Promise<void> {
    const filePath = typeof file === 'string' ? file : (file.path || file.id);
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();
    const selectedStaged = new Set(state.selectedStagedPaths);
    const selectedUnstaged = new Set(state.selectedUnstagedPaths);

    let updatedStaged: string[] | undefined;
    let updatedUnstaged: string[] | undefined;

    // Check if it's a staged file
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const stagedFilesList = await git.getStagedFiles();
      const stagedFiles = stagedFilesList.map((f: { path: string }) => f.path);
      if (stagedFiles.includes(filePath)) {
        if (selectedStaged.has(filePath)) {
          selectedStaged.delete(filePath);
        } else {
          selectedStaged.add(filePath);
        }
        updatedStaged = Array.from(selectedStaged);
      } else {
        // Assume it's an unstaged file if not staged
        if (selectedUnstaged.has(filePath)) {
          selectedUnstaged.delete(filePath);
        } else {
          selectedUnstaged.add(filePath);
        }
        updatedUnstaged = Array.from(selectedUnstaged);
      }
    } catch (error) {
      console.error('Failed to determine file status for toggle:', error);
      // Fallback: if we can't determine, just toggle in both sets (less efficient but safe)
      if (selectedStaged.has(filePath)) {
        selectedStaged.delete(filePath);
      } else {
        selectedStaged.add(filePath);
      }
      if (selectedUnstaged.has(filePath)) {
        selectedUnstaged.delete(filePath);
      } else {
        selectedUnstaged.add(filePath);
      }
      updatedStaged = Array.from(selectedStaged);
      updatedUnstaged = Array.from(selectedUnstaged);
    }

    orchestrator.updateState({
      selectedStagedPaths: updatedStaged,
      selectedUnstagedPaths: updatedUnstaged
    }, 'provider:toggleFile');
    this.refresh();
  }

  async selectAllStaged(): Promise<void> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const staged = await git.getStagedFiles();
      const stagedPaths = staged.map((file: { path: string; status: any }) => file.path);

      const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
      const orchestrator = getCockpitOrchestrator();
      orchestrator.updateState({ selectedStagedPaths: stagedPaths }, 'provider:selectAllStaged');
      this.refresh();
    } catch (error) {
      console.error('Failed to select all staged files:', error);
    }
  }

  async selectAllUnstaged(): Promise<void> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const unstaged = await git.getUnstagedFiles();
      const unstagedPaths = unstaged.map((file: { path: string; status: any }) => file.path);

      const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
      const orchestrator = getCockpitOrchestrator();
      orchestrator.updateState({ selectedUnstagedPaths: unstagedPaths }, 'provider:selectAllUnstaged');
      this.refresh();
    } catch (error) {
      console.error('Failed to select all unstaged files:', error);
    }
  }

  markCommitAsManual(sha: string): void {
    this.manualCommits.add(sha);
  }

  get workspaceParts(): Set<string> {
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();
    return new Set([...state.selectedStagedPaths, ...state.selectedUnstagedPaths]);
  }

  set workspaceParts(parts: Set<string>) {
    // This setter is deprecated as files are now split into staged/unstaged
    // For compatibility, we'll just set staged paths.
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    orchestrator.updateState({ selectedStagedPaths: Array.from(parts) }, 'provider:setWorkspaceParts');
  }

  // State management methods
  async setSelectedCommits(commits: Set<string>): Promise<void> {
    // DEPRECATED: Use CockpitOrchestrator.updateState() instead
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    orchestrator.updateState({ selectedCommitShas: Array.from(commits) }, 'provider:setSelectedCommits');
    this.refresh();
  }

  async setSelectedFiles(files: Set<string>): Promise<void> {
    // DEPRECATED: Use CockpitOrchestrator.updateState() instead
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    // Note: Files are now in selectedStagedPaths or selectedUnstagedPaths
    // For compatibility, we'll just set staged paths.
    orchestrator.updateState({ selectedStagedPaths: Array.from(files) }, 'provider:setSelectedFiles');
    this.refresh();
  }

  getSelectedCommits(): Set<string> {
    // DEPRECATED: Read from CockpitOrchestrator instead
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    return new Set(orchestrator.getState().selectedCommitShas);
  }

  getSelectedFiles(): Set<string> {
    // DEPRECATED: Read from CockpitOrchestrator instead
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();
    // Combine staged and unstaged
    return new Set([...state.selectedStagedPaths, ...state.selectedUnstagedPaths]);
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

      const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
      const orchestrator = getCockpitOrchestrator();
      const selectedShas = new Set(orchestrator.getState().selectedCommitShas);

      for (const commit of commits) {
        const isSelected = selectedShas.has(commit.sha);
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

  async exportCommitsDto(
    limit = 20,
    filterText?: string,
    filterScopes?: { staged?: boolean; unstaged?: boolean; history?: boolean }
  ): Promise<Array<{ sha: string; message: string; author?: string; date?: string; changes?: number }>> {
    try {
      // Ensure database is initialized before accessing it
      await this.initializeDatabase();
      const { getDatabaseManager } = await import('../storage/database');
      const db = getDatabaseManager().getDatabase();
      const limitValue = Math.max(1, Number(limit) || 20);

      let query = `
        SELECT m.sha, m.author, m.date, m.message, m.files_changed
        FROM commits_metadata m
      `;
      const conditions: string[] = [];
      const params: any[] = [];

      // Apply text filter if provided
      if (filterText && filterText.trim()) {
        conditions.push(`(m.message LIKE ? OR m.sha LIKE ?)`);
        const searchTerm = `%${filterText.trim()}%`;
        params.push(searchTerm, searchTerm);
      }

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ` ORDER BY m.date DESC LIMIT ${this.loadMoreOffset + limitValue}`;

      const commitsStmt = db.prepare(query);
      const commits = commitsStmt.all(...params) as any[];
      commitsStmt.free?.();

      // Note: Scope filtering (staged/unstaged/history) is handled client-side
      // since all commits from DB are 'history' scope. If we add virtual commits
      // for staged/unstaged in the future, we'd filter here.

      // Fetch files for each commit
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();

      return commits.map((commit) => {
        let files: Array<{ path: string; status: any }> = [];
        try {
          // Only fetch files if we have a valid SHA
          if (commit.sha) {
            files = git.getFileChanges(commit.sha).map((f: any) => ({
              path: f.path,
              status: f.status
            }));
          }
        } catch (e) {
          console.warn(`Failed to fetch files for commit ${commit.sha}:`, e);
        }

        return {
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          date: commit.date,
          changes: commit.files_changed ?? 0,
          files: files
        };
      });
    } catch (error) {
      console.error('Failed to export commits for cockpit:', error);
      return [];
    }
  }

  exportSelectionDto(): { selectedCommitShas: string[]; selectedFiles: string[]; workspaceScope: 'workspace' | 'staged' | 'unstaged' } {
    const { getCockpitOrchestrator } = require('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();

    return {
      selectedCommitShas: state.selectedCommitShas,
      selectedFiles: [...state.selectedStagedPaths, ...state.selectedUnstagedPaths],
      workspaceScope: this.workspaceScope
    };
  }

  async exportWorkspaceFilesDto(): Promise<{
    staged: Array<{ path: string; status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' }>;
    unstaged: Array<{ path: string; status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' }>;
  }> {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const stagedList = await git.getStagedFiles();
      const unstagedList = await git.getUnstagedFiles();
      const staged = stagedList.map((f: { path: string; status: any }) => ({ path: f.path, status: f.status }));
      const unstaged = unstagedList.map((f: { path: string; status: any }) => ({ path: f.path, status: f.status }));
      return { staged, unstaged };
    } catch (error) {
      console.error('Failed to export workspace files for cockpit:', error);
      return { staged: [], unstaged: [] };
    }
  }
}
