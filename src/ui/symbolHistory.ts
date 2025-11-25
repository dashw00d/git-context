import * as vscode from 'vscode';
import { TreeNode, toVSCodeTreeItem } from '../contracts/treeNodes';

export class SymbolHistoryProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> =
    new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private searchQuery: string = '';

  constructor(private context: vscode.ExtensionContext) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return toVSCodeTreeItem(element);
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // Root level - show search input and recent symbols
      return this.getSymbolSearchResults();
    }

    // Child level - show symbol history timeline
    return this.getSymbolTimeline(element);
  }

  private async getSymbolSearchResults(): Promise<TreeNode[]> {
    try {
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      if (this.searchQuery) {
        // Search mode - show matching symbols
        const { getSearchIndex } = await import('../storage/index');
        const searchIndex = getSearchIndex();
        const results = await searchIndex.searchSymbols(this.searchQuery, 20);

        if (results.length === 0) {
          return [{
            id: 'no-symbols',
            type: 'risk' as const,
            label: 'No symbols found',
            description: `No matches for "${this.searchQuery}"`,
            icon: 'search'
          }];
        }

        // Group by file for search results
        const fileGroups = new Map<string, any[]>();
        for (const result of results) {
          const key = result.path || 'unknown';
          if (!fileGroups.has(key)) {
            fileGroups.set(key, []);
          }
          fileGroups.get(key)!.push(result);
        }

        const items: TreeNode[] = [];
        for (const [filePath, symbols] of fileGroups) {
          items.push({
            id: `file-${filePath}`,
            type: 'file' as const,
            path: filePath,
            sha: symbols[0]?.sha || '',
            stats: {
              added: symbols.filter(s => s.change_type === 'added').length,
              modified: symbols.filter(s => s.change_type === 'modified').length,
              removed: symbols.filter(s => s.change_type === 'removed').length
            },
            label: filePath.split('/').pop() || filePath,
            description: filePath,
            tooltip: `${symbols.length} matching symbols`,
            children: symbols.map(s => ({
              id: `${filePath}-${s.name}`,
              type: 'symbol' as const,
              symbolId: s.id || 0,
              semanticId: s.symbol_id || '',
              name: s.name,
              kind: s.kind,
              path: filePath,
              sha: s.sha,
              label: `${s.name} (${s.kind})`,
              description: s.change_type,
              icon: `symbol-${s.kind}`
            })),
            icon: 'file'
          });
        }
        return items;
      } else {
        // Default mode - show recent files with their symbols
        const stmt = db.prepare(`
          SELECT s.path, s.name, s.kind, s.change_type, c.date, s.sha
          FROM symbols s
          JOIN commits_metadata c ON s.sha = c.sha
          ORDER BY c.date DESC, s.path, s.name
          LIMIT 100
        `);
        const results = stmt.all() as any[];

        if (results.length === 0) {
          return [{
            id: 'no-symbols',
            type: 'risk' as const,
            label: 'No symbols analyzed yet',
            description: 'Run "Analyze Last N Commits" to populate',
            icon: 'search'
          }];
        }

        // Group by file path
        const fileGroups = new Map<string, any[]>();
        for (const result of results) {
          const key = result.path;
          if (!fileGroups.has(key)) {
            fileGroups.set(key, []);
          }
          fileGroups.get(key)!.push(result);
        }

        const items: TreeNode[] = [];
        for (const [filePath, symbols] of fileGroups) {
          const added = symbols.filter(s => s.change_type === 'added').length;
          const modified = symbols.filter(s => s.change_type === 'modified' || s.change_type === 'signature_changed').length;
          const removed = symbols.filter(s => s.change_type === 'removed').length;

          const changeSummary = [];
          if (added > 0) changeSummary.push(`+${added}`);
          if (modified > 0) changeSummary.push(`~${modified}`);
          if (removed > 0) changeSummary.push(`-${removed}`);

          items.push({
            id: `file-${filePath}`,
            type: 'file' as const,
            path: filePath,
            sha: symbols[0]?.sha || '',
            stats: { added, modified, removed },
            label: filePath.split('/').pop() || filePath,
            description: `${changeSummary.join(' ')} · ${filePath}`,
            tooltip: `${symbols.length} total symbols\nAdded: ${added}, Modified: ${modified}, Removed: ${removed}`,
            contextValue: 'gitContextSymbolFile',
            children: symbols.map(s => ({
              id: `${filePath}-${s.sha}-${s.name}`,
              type: 'symbol' as const,
              symbolId: s.id || 0,
              semanticId: s.symbol_id || '',
              name: s.name,
              kind: s.kind,
              path: filePath,
              sha: s.sha,
              label: `${s.change_type === 'added' ? '➕' : s.change_type === 'removed' ? '➖' : '✏️'} ${s.name}`,
              description: `${s.kind}`,
              tooltip: `${s.change_type} in ${s.sha.substring(0, 8)}`,
              icon: `symbol-${s.kind}`,
              contextValue: 'gitContextSymbol'
            })),
            icon: 'file'
          });
        }
        return items;
      }
    } catch (error) {
      console.error('Failed to load symbols:', error);
      return [{
        id: 'search-error',
        type: 'risk' as const,
        label: 'Failed to load symbols',
        description: 'Error loading symbol data',
        icon: 'error'
      }];
    }
  }

  private async getSymbolTimeline(symbol: TreeNode): Promise<TreeNode[]> {
    // Children are already set in getSymbolSearchResults
    return symbol.children || [];
  }

  setSearchQuery(query: string): void {
    this.searchQuery = query;
    this.refresh();
  }
}
