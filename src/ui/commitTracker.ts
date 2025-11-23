import * as vscode from 'vscode';
import { TreeItem } from '../types';

export class CommitTrackerProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> =
    new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    const hasChildren = element.children && element.children.length > 0;

    return {
      id: element.id,
      label: element.label,
      description: element.description,
      tooltip: element.tooltip,
      collapsibleState: hasChildren
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
      iconPath: element.icon ? new vscode.ThemeIcon(element.icon) : undefined,
      command: element.command,
      contextValue: element.contextValue
    };
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - show recent commits
      return this.getRecentCommits();
    }

    // Child level - show commit details
    return this.getCommitDetails(element);
  }

  private async getRecentCommits(): Promise<TreeItem[]> {
    try {
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      const stmt = db.prepare(`
        SELECT sha, author, date, message, files_changed, symbols_added, symbols_modified, symbols_removed, risks
        FROM commits
        ORDER BY date DESC
        LIMIT 20
      `);

      const commits = stmt.all() as any[];

      return commits.map(commit => {
        const risks = JSON.parse(commit.risks || '[]');
        const riskIndicator = risks.length > 0 ? ' ⚠️' : '';

        return {
          id: commit.sha,
          label: commit.sha.substring(0, 8),
          description: commit.message.split('\n')[0] + riskIndicator,
          tooltip: `Author: ${commit.author}\nDate: ${commit.date}\nFiles: ${commit.files_changed}, Symbols: +${commit.symbols_added} -${commit.symbols_removed} ~${commit.symbols_modified}`,
          children: this.getCommitChildren(commit),
          icon: 'git-commit',
          contextValue: 'commit'
        };
      });
    } catch (error) {
      console.error('Failed to load commits:', error);
      // @ts-ignore
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [{
        id: 'error',
        label: 'Error loading commits',
        description: errorMessage,
        icon: 'error'
      }];
    }
  }

  private getCommitChildren(commit: any): TreeItem[] {
    const children: TreeItem[] = [];

    if (commit.symbols_added > 0) {
      children.push({
        id: `${commit.sha}-added`,
        label: `Symbols Added (${commit.symbols_added})`,
        icon: 'add',
        children: [] // Will be populated when expanded
      });
    }

    if (commit.symbols_modified > 0) {
      children.push({
        id: `${commit.sha}-modified`,
        label: `Symbols Modified (${commit.symbols_modified})`,
        icon: 'edit',
        children: []
      });
    }

    if (commit.symbols_removed > 0) {
      children.push({
        id: `${commit.sha}-removed`,
        label: `Symbols Removed (${commit.symbols_removed})`,
        icon: 'remove',
        children: []
      });
    }

    const risks = JSON.parse(commit.risks || '[]');
    if (risks.length > 0) {
      children.push({
        id: `${commit.sha}-risks`,
        label: `Risks (${risks.length})`,
        icon: 'warning',
        children: risks.map((risk: string) => ({
          id: `${commit.sha}-risk-${risk}`,
          label: risk,
          icon: 'issue-opened'
        }))
      });
    }

    return children;
  }

  private async getCommitDetails(element: TreeItem): Promise<TreeItem[]> {
    const [sha, type] = element.id.split('-');

    try {
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      if (type === 'added' || type === 'modified' || type === 'removed') {
        const stmt = db.prepare(`
          SELECT name, kind FROM symbols
          WHERE sha = ? AND change_type = ?
          ORDER BY kind, name
        `);

        const symbols = stmt.all(sha, type) as any[];
        return symbols.map(symbol => ({
          id: `${element.id}-${symbol.name}`,
          label: `${symbol.kind} ${symbol.name}`,
          icon: `symbol-${symbol.kind}`,
          command: {
            command: 'vscode.open',
            title: 'Open file',
            arguments: [] // TODO: Add file opening logic
          }
        }));
      }
    } catch (error) {
      console.error('Failed to load commit details:', error);
    }

    return [];
  }
}
