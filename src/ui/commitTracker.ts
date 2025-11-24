import * as vscode from 'vscode';
import { TreeNode, isCommitNode, isFileNode, isCategoryNode, isSymbolNode, getCollapsibleState, toVSCodeTreeItem } from '../contracts/treeNodes';
import { RefactorBundleFacts } from '../facts/types';

export class CommitTrackerProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> =
    new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> =
    this._onDidChangeTreeData.event;

  // Track selected commits for multi-report generation
  public selectedCommits = new Set<string>();

  // Store last bundle facts for bundle node display
  public lastBundleFacts: RefactorBundleFacts | null = null;

  // Track running analysis task
  public runningTask: { cancel: () => void; token: vscode.CancellationToken } | null = null;

  // Track database initialization state
  private isInitialized: boolean = false;

  toggleCommitSelection(sha: string): void {
    if (this.selectedCommits.has(sha)) {
      this.selectedCommits.delete(sha);
    } else {
      this.selectedCommits.add(sha);
    }
    this.persistState();
    this.refresh();
  }

  clearSelection(): void {
    this.selectedCommits.clear();
    this.persistState();
    this.refresh();
  }

  private getRefactorBundleDetails(): TreeNode[] {
    const selectedCount = this.selectedCommits.size;
    const children: TreeNode[] = [];

    // Show progress indicator if analysis is running
    if (this.runningTask) {
      children.push({
        id: 'refactor-bundle-progress',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'refactor-bundle',
        count: 1,
        label: '🔄 Analyzing...',
        description: 'Analysis in progress',
        tooltip: 'Cancel analysis if needed',
        contextValue: 'refactor-bundle-progress'
      });
      return children; // Don't show other children while analyzing
    }

    // Net Effect vs Working Tree
    children.push({
      id: 'refactor-bundle-net-effect',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'refactor-bundle',
      count: selectedCount,
      label: 'Net Effect vs Working Tree',
      description: 'Combined changes from bundle',
      tooltip: 'Shows the net result of all commits in the bundle compared to working tree',
      contextValue: 'refactor-bundle-item'
    });

    // Incompleteness Analysis
    const incompletenessCount = this.lastBundleFacts
      ? this.lastBundleFacts.findings.incompleteness.missing + this.lastBundleFacts.findings.incompleteness.zombies
      : 0;
    children.push({
      id: 'refactor-bundle-incompleteness',
      type: 'category' as const,
      categoryType: 'modified' as const,
      parentId: 'refactor-bundle',
      count: incompletenessCount,
      label: `Incompleteness${incompletenessCount > 0 ? ` ${incompletenessCount} issues` : ''}`,
      description: this.lastBundleFacts
        ? `${this.lastBundleFacts.findings.incompleteness.missing} missing · ${this.lastBundleFacts.findings.incompleteness.zombies} zombies`
        : 'Missing additions and zombie removals',
      tooltip: 'Analyze what parts of the refactor are incomplete',
      contextValue: 'refactor-bundle-item'
    });

    // Pattern Drift
    const driftCount = this.lastBundleFacts
      ? this.lastBundleFacts.findings.patternDrift.mixedTargets + this.lastBundleFacts.findings.patternDrift.oldNamespaces
      : 0;
    children.push({
      id: 'refactor-bundle-drift',
      type: 'category' as const,
      categoryType: 'modified' as const,
      parentId: 'refactor-bundle',
      count: driftCount,
      label: `Pattern Drift${driftCount > 0 ? ` ${driftCount} issues` : ''}`,
      description: driftCount > 0 ? `${driftCount} mixed/old patterns` : 'Pattern consistency analysis',
      tooltip: 'Identify where patterns have drifted during the refactor',
      contextValue: 'refactor-bundle-item'
    });

    // Legacy / Dead
    const legacyCount = this.lastBundleFacts
      ? this.lastBundleFacts.findings.legacyAudit.dead + this.lastBundleFacts.findings.legacyAudit.replacedLeftovers.length
      : 0;
    children.push({
      id: 'refactor-bundle-legacy',
      type: 'category' as const,
      categoryType: 'removed' as const,
      parentId: 'refactor-bundle',
      count: legacyCount,
      label: `Legacy / Dead${legacyCount > 0 ? ` ${legacyCount} issues` : ''}`,
      description: this.lastBundleFacts
        ? `${this.lastBundleFacts.findings.legacyAudit.dead} dead · ${this.lastBundleFacts.findings.legacyAudit.replacedLeftovers.length} replaced`
        : 'Dead code and technical debt',
      tooltip: 'Identify dead code, legacy usage, and cleanup opportunities',
      contextValue: 'refactor-bundle-item'
    });

    // Timeline Rewind
    children.push({
      id: 'refactor-bundle-timeline',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'refactor-bundle',
      count: selectedCount,
      label: 'Timeline Rewind',
      description: 'Evolution of changes over time',
      tooltip: 'See how the refactor evolved across commits',
      contextValue: 'refactor-bundle-item'
    });

    return children;
  }

  private async getBundleChildDetails(element: TreeNode): Promise<TreeNode[]> {
    const children: TreeNode[] = [];

    if (!this.lastBundleFacts) {
      children.push({
        id: `${element.id}-no-data`,
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: element.id,
        count: 1,
        label: 'No data available',
        description: 'Generate report first',
        tooltip: 'Run analysis to see detailed findings',
        contextValue: 'refactor-bundle-item'
      });
      return children;
    }

    switch (element.id) {
      case 'refactor-bundle-timeline':
        // Show working state first, then commits in reverse chronological order
        children.push({
          id: 'timeline-working-state',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: element.id,
          count: 1,
          label: 'Working State',
          description: 'Current state of the code',
          tooltip: 'The current working directory state',
          contextValue: 'timeline-item'
        });

        // Add commits in reverse order (newest first) with actual commit messages
        const selectedShas = Array.from(this.selectedCommits);
        try {
          const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
          await ensureDatabaseInitialized();
          const db = getDatabaseManager().getDatabase();

          for (let i = selectedShas.length - 1; i >= 0; i--) {
            const sha = selectedShas[i];
            const stmt = db.prepare(`SELECT message, author, date FROM commits WHERE sha = ?`);
            const commit = stmt.get(sha) as any;
            const commitMessage = commit?.message ? commit.message.split('\n')[0] : sha.substring(0, 8);

            children.push({
              id: `timeline-commit-${sha}`,
              type: 'category' as const,
              categoryType: 'added' as const,
              parentId: element.id,
              count: 1,
              label: `${sha.substring(0, 8)} → ${commitMessage}`,
              description: commit?.author ? `${commit.author} · ${new Date(commit.date).toLocaleDateString()}` : 'Commit in refactor sequence',
              tooltip: commit?.message ? `${commit.message}\n\nCommit ${sha} in the refactor timeline` : `Commit ${sha} in the refactor timeline`,
              contextValue: 'timeline-item'
            });
          }
        } catch (error) {
          console.error('Failed to load timeline commits:', error);
          // Fallback: show just SHAs
          for (let i = selectedShas.length - 1; i >= 0; i--) {
            const sha = selectedShas[i];
            children.push({
              id: `timeline-commit-${sha}`,
              type: 'category' as const,
              categoryType: 'added' as const,
              parentId: element.id,
              count: 1,
              label: `${sha.substring(0, 8)} → Commit`,
              description: 'Commit in refactor sequence',
              tooltip: `Commit ${sha} in the refactor timeline`,
              contextValue: 'timeline-item'
            });
          }
        }
        break;

      case 'refactor-bundle-incompleteness':
        if (this.lastBundleFacts.findings.incompleteness.missing > 0) {
          children.push({
            id: 'incompleteness-missing',
            type: 'category' as const,
            categoryType: 'modified' as const,
            parentId: element.id,
            count: this.lastBundleFacts.findings.incompleteness.missing,
            label: `Missing Additions (${this.lastBundleFacts.findings.incompleteness.missing})`,
            description: 'Symbols added but not found in working tree',
            tooltip: 'These additions may have been lost or reverted',
            contextValue: 'refactor-finding'
          });
        }
        if (this.lastBundleFacts.findings.incompleteness.zombies > 0) {
          children.push({
            id: 'incompleteness-zombies',
            type: 'category' as const,
            categoryType: 'removed' as const,
            parentId: element.id,
            count: this.lastBundleFacts.findings.incompleteness.zombies,
            label: `Zombie Removals (${this.lastBundleFacts.findings.incompleteness.zombies})`,
            description: 'Symbols removed but still exist in working tree',
            tooltip: 'These removals may not have been completed',
            contextValue: 'refactor-finding'
          });
        }
        break;

      // Add similar handling for drift and legacy categories
      case 'refactor-bundle-drift':
        children.push({
          id: 'drift-mixed-targets',
          type: 'category' as const,
          categoryType: 'modified' as const,
          parentId: element.id,
          count: this.lastBundleFacts.findings.patternDrift.mixedTargets,
          label: `Mixed Targets (${this.lastBundleFacts.findings.patternDrift.mixedTargets})`,
          description: 'Inconsistent target usage',
          tooltip: 'Symbols using different patterns than expected',
          contextValue: 'refactor-finding'
        });
        children.push({
          id: 'drift-old-namespaces',
          type: 'category' as const,
          categoryType: 'modified' as const,
          parentId: element.id,
          count: this.lastBundleFacts.findings.patternDrift.oldNamespaces,
          label: `Old Namespaces (${this.lastBundleFacts.findings.patternDrift.oldNamespaces})`,
          description: 'Using outdated namespace patterns',
          tooltip: 'Symbols still using old namespace conventions',
          contextValue: 'refactor-finding'
        });
        break;

      case 'refactor-bundle-legacy':
        if (this.lastBundleFacts.findings.legacyAudit.dead > 0) {
          children.push({
            id: 'legacy-dead',
            type: 'category' as const,
            categoryType: 'removed' as const,
            parentId: element.id,
            count: this.lastBundleFacts.findings.legacyAudit.dead,
            label: `Dead Code (${this.lastBundleFacts.findings.legacyAudit.dead})`,
            description: 'Symbols no longer used',
            tooltip: 'These symbols appear to be dead code',
            contextValue: 'refactor-finding'
          });
        }
        if (this.lastBundleFacts.findings.legacyAudit.replacedLeftovers.length > 0) {
          children.push({
            id: 'legacy-replaced',
            type: 'category' as const,
            categoryType: 'removed' as const,
            parentId: element.id,
            count: this.lastBundleFacts.findings.legacyAudit.replacedLeftovers.length,
            label: `Replaced Leftovers (${this.lastBundleFacts.findings.legacyAudit.replacedLeftovers.length})`,
            description: 'Old symbols that should have been removed',
            tooltip: 'These symbols were replaced but not cleaned up',
            contextValue: 'refactor-finding'
          });
        }
        break;
    }

    return children;
  }

  private async getCommitSummary(sha: string): Promise<string> {
    try {
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      const stmt = db.prepare(`SELECT message FROM commits WHERE sha = ?`);
      const result = stmt.get(sha) as any;
      if (result && result.message) {
        return result.message.split('\n')[0]; // First line of commit message
      }
    } catch (error) {
      console.error('Failed to get commit summary:', error);
    }
    return sha.substring(0, 8); // Fallback to short SHA
  }

  constructor(private context: vscode.ExtensionContext) {
    this.restoreState();
  }

  /**
   * Initialize the database (lazy initialization)
   */
  async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const startTime = Date.now();
    console.log('[COMMIT-TRACKER] Starting database initialization...');

    try {
      const { ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      this.isInitialized = true;
      console.log(`[COMMIT-TRACKER] Database initialized in ${Date.now() - startTime}ms`);
      console.log('[COMMIT-TRACKER] Refreshing tree view...');
      const refreshStartTime = Date.now();
      this.refresh();
      console.log(`[COMMIT-TRACKER] Tree view refresh triggered in ${Date.now() - refreshStartTime}ms`);
    } catch (error) {
      console.error('Failed to initialize database:', error);
      vscode.window.showErrorMessage(
        `Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Persist current selection state to workspace storage
   */
  public persistState(): void {
    const selectedShas = Array.from(this.selectedCommits);
    this.context.workspaceState.update('commit-tracker.selectedShas', selectedShas);

    // Also persist last bundle SHAs for regenerate fallback
    if (selectedShas.length >= 2) {
      this.context.workspaceState.update('commit-tracker.lastBundleShas', selectedShas);
    }
  }

  /**
   * Restore selection state from workspace storage
   */
  private restoreState(): void {
    const selectedShas = this.context.workspaceState.get<string[]>('commit-tracker.selectedShas', []);
    this.selectedCommits = new Set(selectedShas);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    // Determine if this element should be expandable
    let collapsibleState = vscode.TreeItemCollapsibleState.None;

    if (element.contextValue === 'commit') {
      // Commits are always expandable
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.id === 'refactor-bundle') {
      // Bundle node is always expandable
      collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else if (element.contextValue === 'refactor-bundle-item' || element.contextValue === 'timeline-item' || element.contextValue === 'refactor-finding') {
      // Bundle child items are expandable
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.children && element.children.length > 0) {
      // Items with pre-populated children (like risks, file groups)
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.id && !element.command) {
      // Categories without commands (like "Added Symbols") are expandable
      // Individual symbols have commands so they won't be expandable
      if (element.id.match(/-(added|modified|removed|files)$/)) {
        collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      }
    }

    const treeItem = new vscode.TreeItem(element.label || '', collapsibleState);
    treeItem.id = element.id;
    treeItem.description = element.description;
    treeItem.tooltip = element.tooltip;
    treeItem.iconPath = element.icon ? new vscode.ThemeIcon(element.icon) : undefined;
    treeItem.command = element.command;
    treeItem.contextValue = element.contextValue;

    // Add buttons for bundle node
    if (element.id === 'refactor-bundle') {
      (treeItem as any).buttons = [
        { iconPath: new vscode.ThemeIcon('refresh'), tooltip: 'Regenerate', command: 'commit-tracker.regenerateBundle' },
        { iconPath: new vscode.ThemeIcon('clear-all'), tooltip: 'Clear Bundle', command: 'commit-tracker.clearBundle' }
      ];
    }

    return treeItem;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // Root level - show recent commits
      return this.getRecentCommits();
    }

    // Handle refactor bundle node
    if (element.id === 'refactor-bundle') {
      return this.getRefactorBundleDetails();
    }

    // Handle bundle child nodes
    if (element.id?.startsWith('refactor-bundle-')) {
      return await this.getBundleChildDetails(element);
    }

    // Child level - show commit details
    return this.getCommitDetails(element);
  }

  private async getRecentCommits(): Promise<TreeNode[]> {
    const startTime = Date.now();
    console.log('[COMMIT-TRACKER] getRecentCommits() called');

    // If database is not initialized, show placeholder
    if (!this.isInitialized) {
      console.log('[COMMIT-TRACKER] Database not initialized, showing placeholder');
      return [{
        id: 'initialize-placeholder',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: 0,
        label: '📦 Click to Load Commits',
        description: 'Database not initialized',
        tooltip: 'Click to initialize the database and load commit history',
        contextValue: 'initialize-placeholder',
        command: {
          command: 'git-context.initializeDatabase',
          title: 'Initialize Database'
        }
      }];
    }

    try {
      console.log('[COMMIT-TRACKER] Querying database for recent commits...');
      const queryStartTime = Date.now();
      const { getDatabaseManager } = await import('../storage/database');
      const db = getDatabaseManager().getDatabase();

      const stmt = db.prepare(`
        SELECT sha, author, date, message, files_changed, symbols_added, symbols_modified, symbols_removed, risks
        FROM commits
        ORDER BY date DESC
        LIMIT 20
      `);

      const commits = stmt.all() as any[];
      console.log(`[COMMIT-TRACKER] Query returned ${commits.length} commits in ${Date.now() - queryStartTime}ms`);
      const commitNodes = commits.map(commit => {
        const shortSha = commit.sha.substring(0, 8);
        const isSelected = this.selectedCommits.has(commit.sha);
        const checkbox = isSelected ? '☑ ' : '☐ ';

        return {
          id: commit.sha,
          type: 'commit' as const,
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          date: commit.date,
          isSelected,
          label: `${checkbox}${shortSha} - ${commit.message.split('\n')[0]}`,
          description: `${commit.author} · ${new Date(commit.date).toLocaleDateString()}`,
          tooltip: `${commit.message}\n\nClick to expand\nRight-click to toggle selection for report`,
          contextValue: isSelected ? 'commit inRefactorBundle' : 'commit'
        };
      });

      // Add refactor bundle node if 2+ commits selected
      const result: TreeNode[] = [];
      if (this.selectedCommits.size >= 2) {
        const selectedCount = this.selectedCommits.size;
        result.push({
          id: 'refactor-bundle',
          type: 'category' as const,
          categoryType: 'added' as const, // Using a valid categoryType
          parentId: 'root',
          count: selectedCount,
          label: `Refactor Bundle (${selectedCount} commits)`,
          description: 'vs working tree',
          tooltip: `Generate comprehensive refactor analysis for ${selectedCount} selected commits\n\nIncludes intent analysis, drift detection, and cleanup recommendations`,
          contextValue: 'activeBundle',
          command: {
            command: 'git-context.generateReport',
            title: 'Generate Refactor Bundle Report'
          }
        });
      }

      result.push(...commitNodes);
      console.log(`[COMMIT-TRACKER] getRecentCommits() completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      console.error('Failed to load commits:', error);
      // @ts-ignore
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [{
        id: 'error',
        type: 'risk' as const,
        label: 'Error loading commits',
        description: errorMessage,
        icon: 'error'
      }];
    }
  }

  private async getCommitChildren(commit: any): Promise<TreeNode[]> {
    const children: TreeNode[] = [];

    // Add summary if available
    if (commit.summary_md) {
      children.push({
        id: `${commit.sha}-summary`,
        type: 'risk' as const,
        label: '📝 Summary',
        description: commit.summary_md.split('\n')[0].substring(0, 50) + '...',
        tooltip: commit.summary_md,
        icon: 'note'
      });
    }

    // Add files changed
    if (commit.files_changed > 0) {
      children.push({
        id: `${commit.sha}-files`,
        type: 'category' as const,
        categoryType: 'added' as const, // Using 'added' as a placeholder since files can be added/modified/removed
        parentId: commit.sha,
        count: commit.files_changed,
        label: `📁 Files Changed (${commit.files_changed})`,
        icon: 'files'
      });
    }

    // Add symbol changes
    if (commit.symbols_added > 0) {
      children.push({
        id: `${commit.sha}-added`,
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: commit.sha,
        count: commit.symbols_added,
        label: `➕ Added Symbols (${commit.symbols_added})`,
        children: [], // Will be populated in getCommitDetails
        icon: 'add'
      });
    }

    if (commit.symbols_modified > 0) {
      children.push({
        id: `${commit.sha}-modified`,
        type: 'category' as const,
        categoryType: 'modified' as const,
        parentId: commit.sha,
        count: commit.symbols_modified,
        label: `✏️ Modified Symbols (${commit.symbols_modified})`,
        children: [], // Will be populated in getCommitDetails
        icon: 'edit'
      });
    }

    if (commit.symbols_removed > 0) {
      children.push({
        id: `${commit.sha}-removed`,
        type: 'category' as const,
        categoryType: 'removed' as const,
        parentId: commit.sha,
        count: commit.symbols_removed,
        label: `➖ Removed Symbols (${commit.symbols_removed})`,
        children: [], // Will be populated in getCommitDetails
        icon: 'remove'
      });
    }

    // Note: Semantic categories (renames, moves) will be loaded dynamically in getChildren
    // when the commit node is expanded to avoid async issues here

    // Add risks if any
    const risks = JSON.parse(commit.risks || '[]');
    if (risks.length > 0) {
      children.push({
        id: `${commit.sha}-risks`,
        type: 'category' as const,
        categoryType: 'risks' as const,
        parentId: commit.sha,
        count: risks.length,
        label: `⚠️ Risks (${risks.length})`,
        children: risks.map((risk: string, idx: number) => ({
          id: `${commit.sha}-risk-${idx}`,
          type: 'risk' as const,
          label: risk,
          icon: 'warning'
        })),
        icon: 'warning'
      });
    }

    return children;
  }

  private async getCommitDetails(element: TreeNode): Promise<TreeNode[]> {
    try {
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      // Check if this is a commit (SHA only) or a category
      const parts = element.id.split('-');

      if (parts.length === 1) {
        // This is a commit - fetch and return its children grouped by file
        const sha = element.id;

        // Get all symbols for this commit
        const symbolsStmt = db.prepare(`
          SELECT name, kind, path, change_type, loc_post, id
          FROM symbols
          WHERE sha = ?
          ORDER BY path, change_type, name
        `);
        const allSymbols = symbolsStmt.all(sha) as any[];

        if (allSymbols.length === 0) {
          return [{
            id: `${sha}-no-symbols`,
            type: 'risk' as const,
            label: 'No symbols found',
            icon: 'info'
          }];
        }

        // Group by file path
        const fileGroups = new Map<string, any[]>();
        for (const symbol of allSymbols) {
          if (!fileGroups.has(symbol.path)) {
            fileGroups.set(symbol.path, []);
          }
          fileGroups.get(symbol.path)!.push(symbol);
        }

        const children: TreeNode[] = [];

        for (const [filePath, symbols] of fileGroups) {
          const added = symbols.filter(s => s.change_type === 'added');
          const modified = symbols.filter(s => s.change_type === 'modified' || s.change_type === 'signature_changed');
          const removed = symbols.filter(s => s.change_type === 'removed');

          const fileName = filePath.split('/').pop() || filePath;
          const changeDesc = [];
          if (added.length > 0) changeDesc.push(`+${added.length}`);
          if (modified.length > 0) changeDesc.push(`~${modified.length}`);
          if (removed.length > 0) changeDesc.push(`-${removed.length}`);

          const fileChildren: TreeNode[] = [];

          // Add "Added" category if any
          if (added.length > 0) {
            fileChildren.push({
              id: `${sha}-${filePath}-added`,
              type: 'category' as const,
              categoryType: 'added' as const,
              parentId: `${sha}-${filePath}`,
              count: added.length,
              label: `➕ Added (${added.length})`,
              children: added.map(s => this.createSymbolItem(sha, s)),
              icon: 'add'
            });
          }

          // Add "Modified" category if any
          if (modified.length > 0) {
            fileChildren.push({
              id: `${sha}-${filePath}-modified`,
              type: 'category' as const,
              categoryType: 'modified' as const,
              parentId: `${sha}-${filePath}`,
              count: modified.length,
              label: `✏️ Modified (${modified.length})`,
              children: modified.map(s => this.createSymbolItem(sha, s)),
              icon: 'edit'
            });
          }

          // Add "Removed" category if any
          if (removed.length > 0) {
            fileChildren.push({
              id: `${sha}-${filePath}-removed`,
              type: 'category' as const,
              categoryType: 'removed' as const,
              parentId: `${sha}-${filePath}`,
              count: removed.length,
              label: `➖ Removed (${removed.length})`,
              children: removed.map(s => this.createSymbolItem(sha, s)),
              icon: 'remove'
            });
          }

          children.push({
            id: `${sha}-file-${filePath}`,
            type: 'file' as const,
            path: filePath,
            sha: sha,
            stats: {
              added: added.length,
              modified: modified.length,
              removed: removed.length
            },
            label: fileName,
            description: `${changeDesc.join(' ')} · ${filePath}`,
            tooltip: filePath,
            children: fileChildren,
            icon: 'file'
          });
        }

        // Add risks at the end
        const commitStmt = db.prepare(`SELECT risks FROM commits WHERE sha = ?`);
        const commit = commitStmt.get(sha) as any;
        const risks = JSON.parse(commit?.risks || '[]');

        if (risks.length > 0) {
          children.push({
            id: `${sha}-risks`,
            type: 'category' as const,
            categoryType: 'risks' as const,
            parentId: sha,
            count: risks.length,
            label: `⚠️ Risks (${risks.length})`,
            children: risks.map((risk: string, idx: number) => ({
              id: `${sha}-risk-${idx}`,
              type: 'risk' as const,
              label: risk,
              icon: 'warning'
            })),
            icon: 'warning'
          });
        }

        return children;
      } else if (parts.length >= 2 && (parts[1] === 'added' || parts[1] === 'modified' || parts[1] === 'removed')) {
        // Handle symbol categories (added, modified, removed)
        const sha = parts[0];
        const categoryType = parts[1];

        const symbolsStmt = db.prepare(`
          SELECT id, name, kind, path, change_type, mod_reason, confidence
          FROM symbols
          WHERE sha = ? AND change_type = ?
          ORDER BY path, name
        `);
        const symbols = symbolsStmt.all(sha, categoryType) as any[];

        return symbols.map(symbol => this.createSymbolItem(sha, symbol));
      } else if (parts.length >= 2 && (parts[1] === 'renames' || parts[1] === 'moves')) {
        // Handle renames or moves category
        const sha = parts[0];
        const changeType = parts[1] === 'renames' ? 'renamed' : 'moved';

        const symbolsStmt = db.prepare(`
          SELECT id, name, kind, path, confidence
          FROM symbols
          WHERE sha = ? AND change_type = ?
          ORDER BY confidence DESC, name
        `);
        const symbols = symbolsStmt.all(sha, changeType) as any[];

        return symbols.map(symbol => ({
          id: `${sha}-${changeType}-symbol-${symbol.id}`,
          type: 'symbol' as const,
          symbolId: symbol.id,
          semanticId: symbol.id, // For renames/moves, this is the semantic ID
          name: symbol.name,
          kind: symbol.kind,
          path: symbol.path,
          sha: sha,
          label: `${symbol.name} (${symbol.kind}) - ${Math.round(symbol.confidence * 100)}%`,
          icon: changeType === 'renamed' ? 'arrow-right' : 'arrow-right',
          tooltip: `${changeType === 'renamed' ? 'Renamed' : 'Moved'} symbol with ${Math.round(symbol.confidence * 100)}% confidence`
        }));
      }
    } catch (error) {
      console.error('Failed to load commit details:', error);
      return [{
        id: `${element.id}-error`,
        type: 'risk' as const,
        label: 'Error loading details',
        description: String(error),
        icon: 'error'
      }];
    }

    return [];
  }

  private createSymbolItem(sha: string, symbol: any): TreeNode {
    // Parse location if available
    let range: vscode.Range | undefined;
    try {
      const loc = symbol.loc_post ? JSON.parse(symbol.loc_post) : null;
      if (loc && loc.start) {
        range = new vscode.Range(
          new vscode.Position(loc.start.line - 1, loc.start.column || 0),
          new vscode.Position(loc.end?.line - 1 || loc.start.line - 1, loc.end?.column || 0)
        );
      }
    } catch (e) {
      // Ignore parse errors
    }

    return {
      id: `${sha}-symbol-${symbol.id}`,
      type: 'symbol' as const,
      symbolId: symbol.id,
      semanticId: symbol.symbol_id,
      name: symbol.name,
      kind: symbol.kind,
      path: symbol.path,
      sha: sha,
      loc: symbol.loc_post ? JSON.parse(symbol.loc_post) : undefined,
      label: `${symbol.kind} ${symbol.name}`,
      icon: `symbol-${symbol.kind}`,
      command: symbol.path ? {
        command: 'git-context.openSymbol',
        title: 'Open Symbol',
        arguments: [sha, symbol.path, range]
      } : undefined
    };
  }
}
