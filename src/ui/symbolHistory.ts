import * as vscode from 'vscode';
import { TreeItem } from '../types';

export class SymbolHistoryProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> =
    new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private searchQuery: string = '';

  constructor(private context: vscode.ExtensionContext) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return {
      id: element.id,
      label: element.label,
      description: element.description,
      tooltip: element.tooltip,
      collapsibleState: element.children
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None,
      command: element.command,
      iconPath: element.icon ? new vscode.ThemeIcon(element.icon) : undefined,
      contextValue: element.contextValue
    };
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level - show search input and recent symbols
      return this.getSymbolSearchResults();
    }

    // Child level - show symbol history timeline
    return this.getSymbolTimeline(element);
  }

  private async getSymbolSearchResults(): Promise<TreeItem[]> {
    if (!this.searchQuery) {
      return [{
        id: 'search-placeholder',
        label: 'Search symbols...',
        description: 'Type to search symbol history',
        icon: 'search'
      }];
    }

    try {
      const { getSearchIndex } = await import('../storage/index');
      const { ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const searchIndex = getSearchIndex();

      const results = searchIndex.searchSymbols(this.searchQuery, 10);

      if (results.length === 0) {
        return [{
          id: 'no-results',
          label: 'No symbols found',
          description: `No matches for "${this.searchQuery}"`,
          icon: 'search'
        }];
      }

      // Group results by symbol name
      const symbolGroups = new Map<string, any[]>();

      for (const result of results) {
        if (!symbolGroups.has(result.name)) {
          symbolGroups.set(result.name, []);
        }
        symbolGroups.get(result.name)!.push(result);
      }

      const items: TreeItem[] = [];

      for (const [symbolName, occurrences] of symbolGroups) {
        const latest = occurrences[0]; // Results are ordered by relevance
        items.push({
          id: `symbol-${symbolName}`,
          label: symbolName,
          description: `${occurrences.length} commits`,
          tooltip: `Found in ${occurrences.length} commits\nLatest: ${latest.sha.substring(0, 8)}`,
          children: occurrences.map(occ => ({
            id: `symbol-${symbolName}-${occ.sha}`,
            label: occ.sha.substring(0, 8),
            description: occ.path,
            tooltip: occ.summary_snippet || 'Symbol occurrence',
            icon: 'git-commit'
          })),
          icon: 'symbol-variable' // Default icon, could be more specific
        });
      }

      return items;
    } catch (error) {
      console.error('Failed to search symbols:', error);
      return [{
        id: 'search-error',
        label: 'Search failed',
        description: 'Error searching symbols',
        icon: 'error'
      }];
    }
  }

  private async getSymbolTimeline(symbol: TreeItem): Promise<TreeItem[]> {
    // The children are already populated in getSymbolSearchResults
    return symbol.children || [];
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.refresh();
  }
}
