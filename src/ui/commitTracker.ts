import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TreeNode, isCommitNode, isFileNode, isCategoryNode, isSymbolNode, getCollapsibleState, toVSCodeTreeItem } from '../contracts/treeNodes';
import { RefactorBundleFacts } from '../facts/types';
import { FileChange } from '../types';

export class CommitTrackerProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> =
    new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> =
    this._onDidChangeTreeData.event;

  // Track selected commits for multi-report generation
  public selectedCommits = new Set<string>();

  // Track selected files for analysis
  public selectedFiles: Set<string> = new Set();

  // Workspace scope for analysis
  private workspaceScope: 'full' | 'staged' | 'unstaged' | 'partial' = 'full';

  // Store last bundle facts for bundle node display
  public lastBundleFacts: RefactorBundleFacts | null = null;

  // Track running analysis task
  public runningTask: { cancel: () => void; token: vscode.CancellationToken } | null = null;

  // Track database initialization state
  private isInitialized: boolean = false;

  /**
   * Workspace scoping state
   * 
   * Controls which parts of the working directory are included in bundle analysis.
   * Workspace is the ROOT/BASE for comparisons - it represents the current state
   * of files (staged and/or unstaged), not HEAD (which is just another commit).
   * 
   * Default: Full workspace (both staged and unstaged)
   */
  public workspaceParts: Set<'staged' | 'unstaged'> = new Set(['staged', 'unstaged']); // default full

  // Performance: Cache commit summaries to avoid repeated DB queries
  private commitSummaryCache = new Map<string, string>();
  
  // Performance: Cache commit info (author, date, message) for batch loading
  private commitInfoCache = new Map<string, { author: string; date: string; message: string }>();
  
  // Performance: Track expanded state for bundle node (sticky expansion)
  private bundleExpandedState = vscode.TreeItemCollapsibleState.Expanded;

  // Pagination state for commit selection
  public loadMoreOffset = 0;
  public readonly PAGE_SIZE = 3;

  // Track manually added commits (preserve during Pull Latest)
  public manualCommits = new Set<string>();

  toggleCommitSelection(sha: string): void {
    if (this.selectedCommits.has(sha)) {
      this.selectedCommits.delete(sha);
    } else {
      this.selectedCommits.add(sha);
    }
    this.persistState();
    this.updateSelectionContext();
    this.refresh();
  }

  toggleFileSelection(filePath: string): void {
    if (this.selectedFiles.has(filePath)) {
      this.selectedFiles.delete(filePath);
    } else {
      this.selectedFiles.add(filePath);
    }
    this.persistState();
    this.updateSelectionContext();
    this.refresh();
  }

  selectAllStaged(): void {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const staged = git.getStagedFiles();
      staged.forEach((f: FileChange) => this.selectedFiles.add(f.path));
      this.persistState();
      this.updateSelectionContext();
      this.refresh();
    } catch (error) {
      console.error('Failed to select all staged files:', error);
    }
  }

  selectAllUnstaged(): void {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const unstaged = git.getUnstagedFiles();
      unstaged.forEach((f: FileChange) => this.selectedFiles.add(f.path));
      this.persistState();
      this.updateSelectionContext();
      this.refresh();
    } catch (error) {
      console.error('Failed to select all unstaged files:', error);
    }
  }

  clearFileSelection(): void {
    this.selectedFiles.clear();
    this.persistState();
    this.updateSelectionContext();
    this.refresh();
  }

  clearSelection(): void {
    this.selectedCommits.clear();
    this.selectedFiles.clear();
    this.persistState();
    this.updateSelectionContext();
    this.refresh();
  }

  /**
   * Mark a commit as manually added (preserve during Pull Latest)
   */
  markCommitAsManual(sha: string): void {
    this.manualCommits.add(sha);
    this.persistState();
  }

  /**
   * Get selected files
   */
  getSelectedFiles(): string[] {
    return Array.from(this.selectedFiles);
  }

  /**
   * Get workspace scope
   */
  getWorkspaceScope(): 'full' | 'staged' | 'unstaged' | 'partial' {
    return this.workspaceScope;
  }

  /**
   * Set workspace scope
   */
  setWorkspaceScope(scope: 'full' | 'staged' | 'unstaged' | 'partial'): void {
    this.workspaceScope = scope;
    this.persistState();
    this.refresh();
  }

  /**
   * Update VS Code context key for selection state
   */
  private updateSelectionContext(): void {
    const hasSelection = this.selectedCommits.size > 0 || this.selectedFiles.size > 0;
    vscode.commands.executeCommand('setContext', 'git-context.hasSelection', hasSelection);
  }

  /**
   * Map tree node ID to markdown section anchor ID
   * 
   * This helper maps bundle category node IDs from the tree view
   * to their corresponding anchor IDs in the markdown report.
   * Used for navigation from tree nodes to markdown sections.
   */
  getMDSectionId(treeNodeId: string): string {
    const mapping: Record<string, string> = {
      'incompleteness-missing': 'incompleteness-missing',
      'incompleteness-zombies': 'incompleteness-zombies',
      'drift-hotspots': 'drift-hotspots',
      'legacy-dead': 'legacy-dead',
      'refactor-bundle-incompleteness': 'incompleteness',
      'refactor-bundle-drift': 'drift',
      'refactor-bundle-legacy': 'legacy',
      'refactor-bundle-timeline': 'timeline'
    };
    
    return mapping[treeNodeId] || treeNodeId;
  }

  /**
   * Check if comparison options should be shown
   * 
   * Workspace is the ROOT/BASE and is always available for comparison.
   * HEAD is just another commit - it has no special status here.
   * We show comparison options whenever 1+ commits are selected,
   * because workspace can always be compared against any commit.
   */
  private hasMultipleCommitsSelected(): boolean {
    return this.selectedCommits.size >= 1; // Workspace is always available as root/base
  }

  /**
   * Get human-readable label for workspace state
   * 
   * Workspace represents the current working directory state (staged/unstaged files),
   * which serves as the ROOT/BASE for all comparisons. This is distinct from HEAD,
   * which is just another commit in the history.
   * 
   * @returns Label like "Full Workspace", "Staged Only", "Unstaged Only"
   */
  private getWorkspaceStateLabel(): string {
    const includeStaged = this.workspaceParts.has('staged');
    const includeUnstaged = this.workspaceParts.has('unstaged');
    
    if (includeStaged && includeUnstaged) {
      return 'Full Workspace';
    } else if (includeStaged) {
      return 'Staged Only';
    } else if (includeUnstaged) {
      return 'Unstaged Only';
    } else {
      return 'No Workspace';
    }
  }

  /**
   * Get workspace state selector nodes
   * 
   * IMPORTANT: Workspace is the ROOT/BASE for comparisons, not HEAD.
   * - Workspace = current working directory state (staged/unstaged files)
   * - This is the baseline against which all commits are compared
   * - HEAD is just another commit - it appears in the commit list, not here
   * - Workspace state controls what gets included in bundle analysis scope
   */
  private getWorkspaceStateNodes(): TreeNode[] {
    try {
      // Use synchronous require since this is called from synchronous context
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      
      const staged = git.getStagedFiles();
      const unstaged = git.getUnstagedFiles();
    
    const includeStaged = this.workspaceParts.has('staged');
    const includeUnstaged = this.workspaceParts.has('unstaged');
    const isFull = includeStaged && includeUnstaged;
    
    const nodes: TreeNode[] = [
      {
        id: 'workspace-group',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: 1,
        label: '🔄 Workspace State',
        description: 'Scope control for analysis',
        tooltip: 'Control which parts of workspace to include in bundle analysis',
        contextValue: 'workspace-group',
      },
      {
        id: 'workspace-full',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'workspace-group',
        count: 1,
        label: `${isFull ? '☑' : '☐'} Full Workspace ${isFull ? '(active)' : ''}`,
        description: `${staged.length + unstaged.length} files`,
        tooltip: 'Include staged + unstaged (default)',
        contextValue: 'workspace-full',
        command: {
          command: 'git-context.toggleWorkspaceFull',
          title: 'Toggle Full Workspace'
        }
      }
    ];
    
    // Add staged sub-node
    if (staged.length > 0) {
      nodes.push({
        id: 'workspace-staged',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'workspace-group',
        count: staged.length,
        label: `Staged Changes (${staged.length}) ${includeStaged ? '☑' : '☐'}`,
        description: staged.slice(0, 3).map((f: { path: string }) => f.path.split('/').pop()).join(', '),
        contextValue: 'workspace-staged',
        command: {
          command: 'git-context.toggleWorkspacePart',
          title: 'Toggle Staged',
          arguments: ['staged']
        },
      });
    }
    
    // Add unstaged sub-node
    if (unstaged.length > 0) {
      nodes.push({
        id: 'workspace-unstaged',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'workspace-group',
        count: unstaged.length,
        label: `Unstaged Changes (${unstaged.length}) ${includeUnstaged ? '☑' : '☐'}`,
        description: unstaged.slice(0, 3).map((f: { path: string }) => f.path.split('/').pop()).join(', '),
        contextValue: 'workspace-unstaged',
        command: {
          command: 'git-context.toggleWorkspacePart',
          title: 'Toggle Unstaged',
          arguments: ['unstaged']
        },
      });
    }
    
    return nodes;
    } catch (error) {
      console.error('Failed to get workspace state nodes:', error);
      // Return minimal workspace group on error
      return [{
        id: 'workspace-group',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: 1,
        label: '🔄 Workspace State',
        description: 'Error loading workspace state',
        tooltip: 'Failed to load workspace state',
        contextValue: 'workspace-group',
      }];
    }
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

    /**
     * Show comparison options when commits are selected
     * 
     * IMPORTANT: Workspace is the ROOT/BASE for comparisons, not HEAD.
     * - Workspace = current working directory state (staged/unstaged files)
     * - HEAD = just another commit in the history
     * - Workspace is always available for comparison (it's the baseline)
     * - Any commit can be compared against workspace or other commits
     */
    if (this.hasMultipleCommitsSelected()) {
      const workspaceLabel = this.getWorkspaceStateLabel();
      const commitCount = this.selectedCommits.size;
      const workspaceComparisons = commitCount; // Workspace vs each commit
      const commitComparisons = commitCount >= 2 ? (commitCount * (commitCount - 1) / 2) : 0; // Pairwise commit comparisons
      const totalOptions = workspaceComparisons + commitComparisons;
      
      // Build description emphasizing commit-to-commit comparisons when available
      let description = '';
      if (commitCount >= 2) {
        description = `${commitComparisons} commit-to-commit + ${workspaceComparisons} workspace comparisons`;
      } else {
        description = `${workspaceLabel} + ${commitCount} commit(s)`;
      }
      
      children.push({
        id: 'refactor-bundle-grouping',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'refactor-bundle',
        count: totalOptions,
        label: '📊 Comparison Options',
        description: description,
        tooltip: commitCount >= 2 
          ? `Compare ${commitCount} commits with each other (${commitComparisons} pairs) or with workspace (${workspaceComparisons} options)`
          : `Compare workspace state (root/base) with ${commitCount} selected commit(s)`,
        contextValue: 'refactor-bundle-grouping',
        command: {
          command: 'git-context.showGroupingOptions',
          title: 'Show Comparison Options'
        }
      });
    }

    // Determine if we have data to show
    const hasData = !!this.lastBundleFacts;
    const noDataContextValue = hasData ? 'refactor-bundle-item' : 'no-data-placeholder';

    // Net Effect vs Working Tree
    children.push({
      id: 'refactor-bundle-net-effect',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'refactor-bundle',
      count: hasData ? selectedCount : 0,
      label: 'Net Effect vs Working Tree',
      description: hasData ? 'Combined changes from bundle' : 'Generate report first',
      tooltip: 'Shows the net result of all commits in the bundle compared to working tree',
      contextValue: noDataContextValue
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
      contextValue: hasData ? 'refactor-bundle-item' : 'no-data-placeholder'
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
      contextValue: hasData ? 'refactor-bundle-item' : 'no-data-placeholder'
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
      contextValue: hasData ? 'refactor-bundle-item' : 'no-data-placeholder'
    });

    // Timeline Rewind
    children.push({
      id: 'refactor-bundle-timeline',
      type: 'category' as const,
      categoryType: 'added' as const,
      parentId: 'refactor-bundle',
      count: hasData ? selectedCount : 0,
      label: 'Timeline Rewind',
      description: hasData ? 'Evolution of changes over time' : 'Generate report first',
      tooltip: 'See how the refactor evolved across commits',
      contextValue: hasData ? 'refactor-bundle-item' : 'no-data-placeholder'
    });

    return children;
  }

  private async getBundleChildDetails(element: TreeNode): Promise<TreeNode[]> {
    const children: TreeNode[] = [];

    // Prevent recursive expansion of "no-data" placeholders
    if (element.id?.endsWith('-no-data') || element.contextValue === 'no-data-placeholder') {
      return [];
    }

    if (!this.lastBundleFacts) {
      children.push({
        id: `${element.id}-no-data`,
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: element.id,
        count: 0,  // Set to 0 so it won't be expandable
        label: 'No data available',
        description: 'Generate report first',
        tooltip: 'Run analysis to see detailed findings',
        contextValue: 'no-data-placeholder'  // Different contextValue to prevent expansion
      });
      return children;
    }

    /**
     * Handle comparison options expansion
     * 
     * Workspace is the ROOT/BASE for comparisons:
     * - Workspace vs Commit A (workspace is the baseline)
     * - Workspace vs Commit B (workspace is the baseline)
     * - Commit A vs Commit B (both are just commits, no special status)
     * 
     * Note: HEAD is treated the same as any other commit - it has no special role here.
     */
    if (element.id === 'refactor-bundle-grouping') {
      try {
        const selectedShas = Array.from(this.selectedCommits);
        const comparisons: TreeNode[] = [];
        
        // Workspace is the root/base - always available for comparison
        const workspaceLabel = this.getWorkspaceStateLabel();
        const workspaceId = 'workspace';
        
        // Generate comparisons: workspace (root) vs each selected commit
        for (const sha of selectedShas) {
          const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
          await ensureDatabaseInitialized();
          const db = getDatabaseManager().getDatabase();
          
          const stmt = db.prepare(`SELECT message FROM commits WHERE sha = ?`);
          const commit = stmt.get(sha) as any;
          const commitLabel = commit?.message ? commit.message.split('\n')[0].substring(0, 30) : sha.substring(0, 8);
          
          comparisons.push({
            id: `group-${workspaceId}-vs-${sha}`,
            type: 'category' as const,
            categoryType: 'modified' as const,
            parentId: element.id,
            count: 1,
            label: `Workspace vs ${sha.substring(0, 8)}`,
            description: `${workspaceLabel} ↔ ${commitLabel}`,
            tooltip: `Compare workspace state with ${sha.substring(0, 8)}`,
            contextValue: 'refactor-bundle-grouping-item',
            command: {
              command: 'git-context.compareWorkspaceVsCommit',
              title: 'Compare Workspace vs Commit',
              arguments: [sha]
            }
          });
        }
        
        // Generate all pairwise comparisons between selected commits
        for (let i = 0; i < selectedShas.length; i++) {
          for (let j = i + 1; j < selectedShas.length; j++) {
            const sha1 = selectedShas[i];
            const sha2 = selectedShas[j];
            
            // Use cached commit info for labels (already loaded above)
            const commit1 = this.getCachedCommitInfo(sha1);
            const commit2 = this.getCachedCommitInfo(sha2);
            
            const label1 = commit1?.message 
              ? commit1.message.split('\n')[0].substring(0, 30) 
              : sha1.substring(0, 8);
            
            const label2 = commit2?.message 
              ? commit2.message.split('\n')[0].substring(0, 30) 
              : sha2.substring(0, 8);
            
            comparisons.push({
              id: `group-${sha1}-vs-${sha2}`,
              type: 'category' as const,
              categoryType: 'modified' as const,
              parentId: element.id,
              count: 1,
              label: `${sha1.substring(0, 8)} vs ${sha2.substring(0, 8)}`,
              description: `${label1} ↔ ${label2}`,
              tooltip: `Compare ${sha1.substring(0, 8)} with ${sha2.substring(0, 8)}`,
              contextValue: 'refactor-bundle-grouping-item',
              command: {
                command: 'git-context.compareCommits',
                title: 'Compare Commits',
                arguments: [sha1, sha2]
              }
            });
          }
        }
        
        return comparisons;
      } catch (error) {
        console.error('Failed to load comparison options:', error);
        return [];
      }
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
        
        // Batch load commit info for performance
        await this.batchLoadCommitInfo(selectedShas);
        
        try {
          for (let i = selectedShas.length - 1; i >= 0; i--) {
            const sha = selectedShas[i];
            const cachedInfo = this.getCachedCommitInfo(sha);
            
            if (cachedInfo) {
              const commitMessage = cachedInfo.message.split('\n')[0];
              children.push({
                id: `timeline-commit-${sha}`,
                type: 'category' as const,
                categoryType: 'added' as const,
                parentId: element.id,
                count: 1,
                label: `${sha.substring(0, 8)} → ${commitMessage}`,
                description: `${cachedInfo.author} · ${new Date(cachedInfo.date).toLocaleDateString()}`,
                tooltip: `${cachedInfo.message}\n\nCommit ${sha} in the refactor timeline`,
                contextValue: 'timeline-item'
              });
            } else {
              // Fallback: query database if not cached
              const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
              await ensureDatabaseInitialized();
              const db = getDatabaseManager().getDatabase();
              const stmt = db.prepare(`SELECT message, author, date FROM commits WHERE sha = ?`);
              const commit = stmt.get(sha) as any;
              
              if (commit) {
                // Cache it
                this.commitInfoCache.set(sha, {
                  author: commit.author,
                  date: commit.date,
                  message: commit.message
                });
                
                const commitMessage = commit.message.split('\n')[0];
                children.push({
                  id: `timeline-commit-${sha}`,
                  type: 'category' as const,
                  categoryType: 'added' as const,
                  parentId: element.id,
                  count: 1,
                  label: `${sha.substring(0, 8)} → ${commitMessage}`,
                  description: `${commit.author} · ${new Date(commit.date).toLocaleDateString()}`,
                  tooltip: `${commit.message}\n\nCommit ${sha} in the refactor timeline`,
                  contextValue: 'timeline-item'
                });
              } else {
                // Ultimate fallback: show just SHA
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

      case 'incompleteness-missing': {
        if (!this.lastBundleFacts) return [];
        const missing = this.lastBundleFacts.evidence?.['findings.incompleteness.missing'] || [];
        const LIMIT = 10;
        const top = missing.slice(0, LIMIT); // Limit to top 10 for performance
        
        // Group by file path (extract from symbol_id format: "path/to/file.ts:SymbolName")
        const byFile = new Map<string, typeof top>();
        for (const item of top) {
          const filePath = item.symbol_id.split(':')[0];
          if (!byFile.has(filePath)) {
            byFile.set(filePath, []);
          }
          byFile.get(filePath)!.push(item);
        }
        
        const fileNodes: TreeNode[] = [];
        for (const [filePath, items] of byFile) {
          const fileName = path.basename(filePath);
          fileNodes.push({
            id: `missing-file-${filePath}`,
            type: 'file' as const,
            path: filePath,
            sha: this.lastBundleFacts.bundle.newestSha || this.lastBundleFacts.bundle.oldestSha,
            stats: {
              added: 0,
              modified: 0,
              removed: items.length
            },
            label: `${fileName} (${items.length})`,
            description: filePath,
            tooltip: `${items.length} missing symbols in ${filePath}`,
            contextValue: 'bundle-file',
          });
        }
        
        // Add "Load more..." if there are more items
        if (missing.length > LIMIT) {
          fileNodes.push({
            id: 'load-more-missing',
            type: 'category' as const,
            categoryType: 'added' as const,
            parentId: element.id,
            count: missing.length - LIMIT,
            label: `📄 Load more... (${missing.length - LIMIT} remaining)`,
            description: 'Click to load more missing symbols',
            tooltip: `Load ${missing.length - LIMIT} more missing symbols`,
            contextValue: 'load-more',
            command: {
              command: 'git-context.loadMoreMissing',
              title: 'Load More Missing Symbols',
              arguments: [LIMIT]
            }
          });
        }
        
        return fileNodes;
      }

      case 'incompleteness-zombies': {
        if (!this.lastBundleFacts) return [];
        const zombies = this.lastBundleFacts.evidence?.['findings.incompleteness.zombies'] || [];
        const LIMIT = 10;
        const top = zombies.slice(0, LIMIT);
        
        // Group by file (extract from symbol_id or use found.path if available)
        const byFile = new Map<string, typeof top>();
        for (const item of top) {
          const filePath = item.found?.path || item.symbol_id.split(':')[0];
          if (!byFile.has(filePath)) {
            byFile.set(filePath, []);
          }
          byFile.get(filePath)!.push(item);
        }
        
        const fileNodes: TreeNode[] = [];
        for (const [filePath, items] of byFile) {
          const fileName = path.basename(filePath);
          fileNodes.push({
            id: `zombie-file-${filePath}`,
            type: 'file' as const,
            path: filePath,
            sha: this.lastBundleFacts.bundle.newestSha || this.lastBundleFacts.bundle.oldestSha,
            stats: {
              added: 0,
              modified: 0,
              removed: items.length
            },
            label: `${fileName} (${items.length} zombies)`,
            description: filePath,
            tooltip: `${items.length} zombie symbols in ${filePath}`,
            contextValue: 'bundle-file',
          });
        }
        
        // Add "Load more..." if there are more items
        if (zombies.length > LIMIT) {
          fileNodes.push({
            id: 'load-more-zombies',
            type: 'category' as const,
            categoryType: 'added' as const,
            parentId: element.id,
            count: zombies.length - LIMIT,
            label: `📄 Load more... (${zombies.length - LIMIT} remaining)`,
            description: 'Click to load more zombie symbols',
            tooltip: `Load ${zombies.length - LIMIT} more zombie symbols`,
            contextValue: 'load-more',
            command: {
              command: 'git-context.loadMoreZombies',
              title: 'Load More Zombie Symbols',
              arguments: [LIMIT]
            }
          });
        }
        
        return fileNodes;
      }

      // Add similar handling for drift and legacy categories
      case 'refactor-bundle-drift':
        // Add hotspots if available
        const hotspots = this.lastBundleFacts.evidence?.['findings.drift.hotspots'] || [];
        if (hotspots.length > 0) {
          children.push({
            id: 'drift-hotspots',
            type: 'category' as const,
            categoryType: 'modified' as const,
            parentId: element.id,
            count: hotspots.length,
            label: `Hotspots (${hotspots.length})`,
            description: 'Files with multiple drift issues',
            tooltip: 'Files with concentrated drift problems',
            contextValue: 'refactor-finding'
          });
        }
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

      case 'drift-hotspots': {
        if (!this.lastBundleFacts) return [];
        const hotspots = this.lastBundleFacts.evidence?.['findings.drift.hotspots'] || [];
        const LIMIT = 10;
        const top = hotspots.slice(0, LIMIT);
        const bundleSha = this.lastBundleFacts.bundle.newestSha || this.lastBundleFacts.bundle.oldestSha;
        
        const fileNodes = top.map((h: { path: string; drift_count: number }) => ({
          id: `hotspot-${h.path}`,
          type: 'file' as const,
          path: h.path,
          sha: bundleSha,
          stats: {
            added: 0,
            modified: h.drift_count,
            removed: 0
          },
          label: `${path.basename(h.path)} (${h.drift_count} drift issues)`,
          description: `${h.drift_count} drift issues`,
          tooltip: `Drift hotspot: ${h.path}\n${h.drift_count} drift issues detected`,
          contextValue: 'bundle-hotspot-file',
        }));
        
        // Add "Load more..." if there are more items
        if (hotspots.length > LIMIT) {
          fileNodes.push({
            id: 'load-more-hotspots',
            type: 'category' as const,
            categoryType: 'added' as const,
            parentId: element.id,
            count: hotspots.length - LIMIT,
            label: `📄 Load more... (${hotspots.length - LIMIT} remaining)`,
            description: 'Click to load more hotspot files',
            tooltip: `Load ${hotspots.length - LIMIT} more hotspot files`,
            contextValue: 'load-more',
            command: {
              command: 'git-context.loadMoreHotspots',
              title: 'Load More Hotspots',
              arguments: [LIMIT]
            }
          });
        }
        
        return fileNodes;
      }

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

      case 'legacy-dead': {
        if (!this.lastBundleFacts) return [];
        const dead = this.lastBundleFacts.evidence?.['findings.legacyAudit.dead'] || [];
        const LIMIT = 20;
        const top = dead.slice(0, LIMIT);
        
        // Group by file
        const byFile = new Map<string, typeof top>();
        for (const item of top) {
          const filePath = item.path || item.symbol_id.split(':')[0];
          if (!byFile.has(filePath)) {
            byFile.set(filePath, []);
          }
          byFile.get(filePath)!.push(item);
        }
        
        const fileNodes: TreeNode[] = [];
        for (const [filePath, items] of byFile) {
          const fileName = path.basename(filePath);
          fileNodes.push({
            id: `dead-file-${filePath}`,
            type: 'file' as const,
            path: filePath,
            sha: this.lastBundleFacts.bundle.newestSha || this.lastBundleFacts.bundle.oldestSha,
            stats: {
              added: 0,
              modified: 0,
              removed: items.length
            },
            label: `${fileName} (${items.length} dead)`,
            description: filePath,
            tooltip: `${items.length} dead symbols in ${filePath}`,
            contextValue: 'bundle-file',
          });
        }
        
        // Add "Load more..." if there are more items
        if (dead.length > LIMIT) {
          fileNodes.push({
            id: 'load-more-dead',
            type: 'category' as const,
            categoryType: 'added' as const,
            parentId: element.id,
            count: dead.length - LIMIT,
            label: `📄 Load more... (${dead.length - LIMIT} remaining)`,
            description: 'Click to load more dead symbols',
            tooltip: `Load ${dead.length - LIMIT} more dead symbols`,
            contextValue: 'load-more',
            command: {
              command: 'git-context.loadMoreDead',
              title: 'Load More Dead Symbols',
              arguments: [LIMIT]
            }
          });
        }
        
        return fileNodes;
      }
    }

    return children;
  }

  /**
   * Get commit summary with caching
   */
  private async getCommitSummary(sha: string): Promise<string> {
    // Check cache first
    if (this.commitSummaryCache.has(sha)) {
      return this.commitSummaryCache.get(sha)!;
    }

    try {
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      const stmt = db.prepare(`SELECT message FROM commits WHERE sha = ?`);
      const result = stmt.get(sha) as any;
      if (result && result.message) {
        const summary = result.message.split('\n')[0]; // First line of commit message
        this.commitSummaryCache.set(sha, summary);
        return summary;
      }
    } catch (error) {
      console.error('Failed to get commit summary:', error);
    }
    
    const fallback = sha.substring(0, 8);
    this.commitSummaryCache.set(sha, fallback);
    return fallback;
  }

  /**
   * Batch load commit info for multiple SHAs (for performance)
   */
  private async batchLoadCommitInfo(shas: string[]): Promise<void> {
    if (shas.length === 0) return;

    // Filter out already cached
    const uncachedShas = shas.filter(sha => !this.commitInfoCache.has(sha));
    if (uncachedShas.length === 0) return;

    try {
      const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();

      const placeholders = uncachedShas.map(() => '?').join(',');
      const stmt = db.prepare(`
        SELECT sha, author, date, message
        FROM commits
        WHERE sha IN (${placeholders})
      `);
      
      const results = stmt.all(...uncachedShas) as any[];
      
      // Cache all results
      for (const result of results) {
        this.commitInfoCache.set(result.sha, {
          author: result.author,
          date: result.date,
          message: result.message
        });
        // Also cache summary
        const summary = result.message.split('\n')[0];
        this.commitSummaryCache.set(result.sha, summary);
      }
    } catch (error) {
      console.error('Failed to batch load commit info:', error);
    }
  }

  /**
   * Get cached commit info or return undefined
   */
  private getCachedCommitInfo(sha: string): { author: string; date: string; message: string } | undefined {
    return this.commitInfoCache.get(sha);
  }

  /**
   * Clear all caches (used when facts update)
   */
  public clearCaches(): void {
    this.commitSummaryCache.clear();
    this.commitInfoCache.clear();
  }

  constructor(private context: vscode.ExtensionContext) {
    this.restoreState();
    this.updateSelectionContext();
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
    this.context.workspaceState.update('commit-tracker.selectedFiles', Array.from(this.selectedFiles));
    this.context.workspaceState.update('commit-tracker.workspaceScope', this.workspaceScope);
    this.context.workspaceState.update('commit-tracker.workspaceParts', Array.from(this.workspaceParts));
    this.context.workspaceState.update('commit-tracker.loadMoreOffset', this.loadMoreOffset);
    this.context.workspaceState.update('commit-tracker.manualCommits', Array.from(this.manualCommits));
    this.updateSelectionContext();

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

    const selectedFiles = this.context.workspaceState.get<string[]>('commit-tracker.selectedFiles', []);
    this.selectedFiles = new Set(selectedFiles);

    const workspaceScope = this.context.workspaceState.get<'full' | 'staged' | 'unstaged' | 'partial'>('commit-tracker.workspaceScope', 'full');
    this.workspaceScope = workspaceScope;

    // Auto-select HEAD if no selection exists
    if (this.selectedCommits.size === 0) {
      try {
        const { GitOperations } = require('../analysis/git');
        const git = new GitOperations();
        const headSha = git.getHeadSha();
        if (headSha) {
          this.selectedCommits.add(headSha);
        }
      } catch {
        // Ignore - will select on first load when database is initialized
      }
    }

    const workspaceParts = this.context.workspaceState.get<string[]>('commit-tracker.workspaceParts', ['staged', 'unstaged']);
    this.workspaceParts = new Set(workspaceParts as ('staged' | 'unstaged')[]);

    const loadMoreOffset = this.context.workspaceState.get<number>('commit-tracker.loadMoreOffset', 0);
    this.loadMoreOffset = loadMoreOffset;

    const manualCommits = this.context.workspaceState.get<string[]>('commit-tracker.manualCommits', []);
    this.manualCommits = new Set(manualCommits);
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    // Determine if this element should be expandable
    let collapsibleState = getCollapsibleState(element);

    // Override collapsibleState based on contextValue for special cases
    if (element.id === 'refactor-bundle') {
      // Bundle node uses sticky expanded state (persist user's expansion preference)
      collapsibleState = this.bundleExpandedState;
    } else if (element.contextValue === 'workspace-group') {
      // Workspace group is expanded by default
      collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else if (element.contextValue === 'recent-commits-group') {
      // Recent commits group is expanded by default
      collapsibleState = vscode.TreeItemCollapsibleState.Expanded;
    } else if (element.contextValue === 'selected-commits-group') {
      // Selected commits group is collapsed by default
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.contextValue === 'workspace-staged' || element.contextValue === 'workspace-unstaged') {
      // Workspace staged/unstaged are collapsed by default
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.contextValue === 'workspace-full') {
      // Workspace-full is not expandable (has command)
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (element.contextValue === 'no-data-placeholder') {
      // "No data available" placeholders should never be expandable
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (element.contextValue === 'refactor-bundle-grouping-item' || element.contextValue === 'timeline-item' || element.contextValue === 'load-more') {
      // Action items with commands but no children should not be expandable
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (element.type === 'category' && element.count === 0 && !element.children?.length) {
      // Don't make category items expandable if they have no children
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (element.id?.startsWith('hotspot-')) {
      // Hotspot files with no drift symbols shouldn't be expandable (no nested children implemented)
      collapsibleState = vscode.TreeItemCollapsibleState.None;
    } else if (element.children && element.children.length > 0) {
      // Items with pre-populated children (like risks, file groups)
      collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    }

    const treeItem = new vscode.TreeItem(element.label || '', collapsibleState);
    treeItem.id = element.id;
    treeItem.description = element.description;
    
    // Create rich tooltips with MarkdownString
    if (element.type === 'commit') {
      const mdTooltip = new vscode.MarkdownString();
      mdTooltip.appendMarkdown(`**${element.message.split('\n')[0]}**\n\n`);
      mdTooltip.appendMarkdown(`- SHA: \`${element.sha.substring(0, 8)}\`\n`);
      mdTooltip.appendMarkdown(`- Author: ${element.author}\n`);
      mdTooltip.appendMarkdown(`- Date: ${new Date(element.date).toLocaleDateString()}\n\n`);
      if (element.message.includes('\n')) {
        mdTooltip.appendMarkdown(`\n\`\`\`\n${element.message}\n\`\`\`\n\n`);
      }
      mdTooltip.appendMarkdown(`*Click to expand files • Right-click for actions*`);
      treeItem.tooltip = mdTooltip;
    } else if (element.type === 'file' && element.stats) {
      const fileTooltip = new vscode.MarkdownString();
      fileTooltip.appendMarkdown(`**${element.path}**\n\n`);
      fileTooltip.appendMarkdown(`| Added | Modified | Removed |\n|-------|----------|----------|\n`);
      fileTooltip.appendMarkdown(`| ${element.stats.added} | ${element.stats.modified} | ${element.stats.removed} |\n\n`);
      if (element.sha) {
        fileTooltip.appendMarkdown(`- Commit: \`${element.sha.substring(0, 8)}\`\n`);
      }
      fileTooltip.appendMarkdown(`*Click to open file*`);
      treeItem.tooltip = fileTooltip;
    } else if (element.tooltip) {
      // Use existing tooltip if it's already a MarkdownString, otherwise convert
      if (element.tooltip instanceof vscode.MarkdownString) {
        treeItem.tooltip = element.tooltip;
      } else {
        // Convert string tooltip to MarkdownString for better formatting
        const mdTooltip = new vscode.MarkdownString(element.tooltip);
        treeItem.tooltip = mdTooltip;
      }
    }
    
    treeItem.iconPath = element.icon ? new vscode.ThemeIcon(element.icon) : undefined;
    treeItem.command = element.command;
    treeItem.contextValue = element.contextValue;

    // Handle selection items: No commands, simple tooltips
    if (element.contextValue?.startsWith('selection-')) {
      // No command - clicking toggles selection
      treeItem.command = undefined;
      
      // Simple tooltip
      treeItem.tooltip = element.description || element.tooltip || '';
      
      // Collapsible state
      if (element.type === 'file') {
        collapsibleState = vscode.TreeItemCollapsibleState.None;
      } else {
        collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      }
      treeItem.collapsibleState = collapsibleState;
    }

    // Handle report items: Rich interaction with inline buttons
    if (element.contextValue === 'saved-report') {
      const reportId = element.id.replace('report-', '');
      try {
        const { getReportManager } = require('../storage/reportManager');
        const reportManager = getReportManager();
        const report = reportManager.load(reportId);
        
        if (report) {
          // Inline buttons
          (treeItem as any).buttons = [
            { 
              iconPath: new vscode.ThemeIcon('go-to-file'), 
              tooltip: 'View Report', 
              command: 'git-context.openReport',
              arguments: [reportId]
            },
            { 
              iconPath: new vscode.ThemeIcon('refresh'), 
              tooltip: 'Regenerate', 
              command: 'git-context.regenerateReport',
              arguments: [reportId]
            },
            { 
              iconPath: new vscode.ThemeIcon('trash'), 
              tooltip: 'Delete', 
              command: 'git-context.deleteReport',
              arguments: [reportId]
            },
            { 
              iconPath: new vscode.ThemeIcon(report.isPinned ? 'pinned' : 'pin'), 
              tooltip: report.isPinned ? 'Unpin' : 'Pin', 
              command: 'git-context.togglePinReport',
              arguments: [reportId]
            }
          ];
          
          // Rich MarkdownString tooltip
          const tooltip = new vscode.MarkdownString();
          tooltip.appendMarkdown(`**${report.title}**\n\n`);
          tooltip.appendMarkdown(`📅 Created: ${report.createdAt.toLocaleString()}\n\n`);
          tooltip.appendMarkdown(`| Metric | Count |\n|--------|-------|\n`);
          tooltip.appendMarkdown(`| Critical | ${report.criticalCount} |\n`);
          tooltip.appendMarkdown(`| Warnings | ${report.warningCount} |\n`);
          tooltip.appendMarkdown(`| Files analyzed | ${report.selectedFiles.length} |\n`);
          tooltip.appendMarkdown(`| Commits | ${report.commitShas.length} |\n\n`);
          const changedSince = reportManager.getChangedFileCount(report);
          if (changedSince > 0) {
            tooltip.appendMarkdown(`⚠️ **${changedSince} files changed since report**\n\n`);
          }
          tooltip.appendMarkdown(`*Click to open report*\n\n*Note: File links work best in editor mode, not preview*`);
          treeItem.tooltip = tooltip;
        }
      } catch (error) {
        console.error('Failed to load report for tooltip:', error);
      }
    }

    // Handle report commit summary child
    if (element.contextValue === 'report-commit-summary') {
      const tooltip = new vscode.MarkdownString();
      if (element.type === 'category' && element.label) {
        tooltip.appendMarkdown(`**${element.label}**\n\n`);
      }
      if (element.description) {
        tooltip.appendMarkdown(`${element.description}\n\n`);
      }
      tooltip.appendMarkdown(`*Click to jump to this section in report*`);
      treeItem.tooltip = tooltip;
    }

    // Handle report file node
    if (element.contextValue === 'report-file' && element.type === 'file') {
      const tooltip = new vscode.MarkdownString();
      tooltip.appendMarkdown(`**${element.path}**\n\n`);
      if (element.stats) {
        tooltip.appendMarkdown(`| Added | Modified | Removed |\n|-------|----------|----------|\n`);
        tooltip.appendMarkdown(`| ${element.stats.added} | ${element.stats.modified} | ${element.stats.removed} |\n\n`);
      }
      tooltip.appendMarkdown(`*Click to open file*`);
      treeItem.tooltip = tooltip;
    }

    // Add buttons for different node types
    if (element.id === 'refactor-bundle') {
      // Bundle root buttons
      (treeItem as any).buttons = [
        { iconPath: new vscode.ThemeIcon('refresh'), tooltip: 'Regenerate', command: 'commit-tracker.regenerateBundle' },
        { iconPath: new vscode.ThemeIcon('clear-all'), tooltip: 'Clear Bundle', command: 'commit-tracker.clearBundle' },
        { iconPath: new vscode.ThemeIcon('book'), tooltip: 'Open Stories MD', command: 'git-context.showRefactorReport' },
        { iconPath: new vscode.ThemeIcon('copy'), tooltip: 'Copy Drift Table', command: 'git-context.copyDriftTable' }
      ];
    } else if (element.type === 'commit') {
      // Commit node buttons
      const isSelected = this.selectedCommits.has(element.sha);
      
      // UI Polish: Bold selected commits (markdown bold syntax)
      // Note: VS Code tree items don't support markdown formatting directly,
      // but we can use checkmark icon to indicate selection
      // The label will show checkmark already, so we just ensure it's clear
      
      (treeItem as any).buttons = [
        { 
          iconPath: new vscode.ThemeIcon(isSelected ? 'check' : 'circle-outline'), 
          tooltip: isSelected ? 'Remove from bundle' : 'Add to bundle', 
          command: 'git-context.toggleCommitSelection',
          arguments: [element.sha]
        },
        { iconPath: new vscode.ThemeIcon('copy'), tooltip: 'Copy SHA', command: 'git-context.copySha', arguments: [element.sha] },
        { iconPath: new vscode.ThemeIcon('diff'), tooltip: 'View diff vs workspace', command: 'git-context.viewDiffVsWorkspace', arguments: [element.sha] }
      ];
    } else if (element.contextValue === 'refactor-finding') {
      // Bundle category buttons (incompleteness-missing, drift-hotspots, etc.)
      (treeItem as any).buttons = [
        { iconPath: new vscode.ThemeIcon('link-external'), tooltip: 'Scroll to MD section', command: 'git-context.scrollToMDSection', arguments: [element.id] },
        { iconPath: new vscode.ThemeIcon('copy'), tooltip: 'Copy section JSON', command: 'git-context.copySectionJson', arguments: [element.id] },
        { iconPath: new vscode.ThemeIcon('sparkle'), tooltip: 'Generate LLM context', command: 'git-context.generateLlmContext', arguments: [element.id] }
      ];
    } else if (element.type === 'file' && (element.contextValue === 'bundle-file' || element.contextValue === 'bundle-hotspot-file')) {
      // Bundle file buttons (including hotspot files)
      (treeItem as any).buttons = [
        { iconPath: new vscode.ThemeIcon('go-to-file'), tooltip: 'Open in editor', command: 'git-context.openFile', arguments: [element.path, element.sha] },
        { iconPath: new vscode.ThemeIcon('sparkle'), tooltip: 'Copy LLM context', command: 'git-context.generateLlmContext', arguments: [`file:${element.path}`] },
        { iconPath: new vscode.ThemeIcon('diff'), tooltip: 'View diff', command: 'git-context.viewDiffVsWorkspace', arguments: [element.sha, element.path] }
      ];
    } else if (element.type === 'symbol' && element.contextValue === 'bundle-symbol') {
      // Bundle symbol buttons
      (treeItem as any).buttons = [
        { iconPath: new vscode.ThemeIcon('go-to-file'), tooltip: 'Open symbol', command: 'git-context.openSymbol', arguments: [element.sha, element.path, element.name] },
        { iconPath: new vscode.ThemeIcon('sparkle'), tooltip: 'Copy LLM context', command: 'git-context.generateLlmContext', arguments: [`symbol:${element.semanticId}`] }
      ];
    }

    // Ensure all symbol nodes get proper commands if they don't have one
    if (element.type === 'symbol' && !treeItem.command && element.path) {
      let range: vscode.Range | undefined;
      if (element.loc) {
        try {
          range = new vscode.Range(
            new vscode.Position(element.loc.line - 1, element.loc.column || 0),
            new vscode.Position(element.loc.end_line ? element.loc.end_line - 1 : element.loc.line - 1, element.loc.end_column || 0)
          );
        } catch {
          // Invalid location, use undefined
        }
      }
      treeItem.command = {
        command: 'git-context.openSymbol',
        title: 'Open Symbol',
        arguments: [element.sha || '', element.path, range]
      };
    }

    return treeItem;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // Root level - show root nodes
      return this.getRootNodes();
    }

    // Handle selection section children
    if (element.id === 'selection-header') {
      return this.getSelectionNodes();
    }

    // Handle reports-section children
    if (element.id === 'reports-section') {
      return this.getSavedReportNodes();
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

    if (element.id === 'selection-more' || element.contextValue === 'action-add-commit') {
      return []; // Leaf node, clicking shows input
    }

    // Handle reports section children
    if (element.id?.startsWith('report-') && 
        !element.id.includes('-workspace') && 
        !element.id.includes('-commit-')) {
      const reportId = element.id.replace('report-', '');
      return this.getReportChildren(reportId);
    }

    if (element.id?.match(/^report-.*-workspace$/)) {
      const reportId = element.id.replace('report-', '').replace('-workspace', '');
      return this.getReportWorkspaceFiles(reportId);
    }

    if (element.id?.match(/^report-.*-commit-/)) {
      const match = element.id.match(/^report-(.*)-commit-(.*)$/);
      if (match) {
        const [, reportId, commitSha] = match;
        return this.getReportCommitFindings(reportId, commitSha);
      }
    }

    // Handle workspace staged/unstaged file children
    if (element.id === 'workspace-staged') {
      const { GitOperations } = await import('../analysis/git');
      const { getGitRoot } = await import('../utils/config');
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
            // File doesn't exist or can't be accessed - no command
            command = undefined;
          }
        }
        
        return {
          id: `workspace-staged-${f.path}`,
          type: 'file' as const,
          path: f.path,
          sha: '', // Workspace files don't have a commit SHA
          stats: {
            added: 0,
            modified: 0,
            removed: 0
          },
          label: f.path.split('/').pop() || f.path,
          description: f.path,
          tooltip: `Staged file: ${f.path}`,
          contextValue: 'workspace-file',
          command
        };
      });
    }

    if (element.id === 'workspace-unstaged') {
      const { GitOperations } = await import('../analysis/git');
      const { getGitRoot } = await import('../utils/config');
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
            // File doesn't exist or can't be accessed - no command
            command = undefined;
          }
        }
        
        return {
          id: `workspace-unstaged-${f.path}`,
          type: 'file' as const,
          path: f.path,
          sha: '', // Workspace files don't have a commit SHA
          stats: {
            added: 0,
            modified: 0,
            removed: 0
          },
          label: f.path.split('/').pop() || f.path,
          description: f.path,
          tooltip: `Unstaged file: ${f.path}`,
          contextValue: 'workspace-file',
          command
        };
      });
    }

    // Handle selected-commits-group children
    if (element.id === 'selected-commits-group') {
      return await this.getSelectedCommits();
    }

    // Handle recent-commits-group children
    if (element.id === 'recent-commits-group') {
      return await this.getRecentCommitsList();
    }

    // Handle refactor bundle node
    if (element.id === 'refactor-bundle') {
      return this.getRefactorBundleDetails();
    }

    // Handle bundle child nodes
    if (element.id?.startsWith('refactor-bundle-')) {
      return await this.getBundleChildDetails(element);
    }

    // Handle missing-file-* (incompleteness-missing file children)
    if (element.id?.startsWith('missing-file-')) {
      const filePath = element.id.replace('missing-file-', '');
      const missing = this.lastBundleFacts?.evidence?.['findings.incompleteness.missing'] || [];
      const fileItems = missing.filter((m: { symbol_id: string }) => m.symbol_id.startsWith(filePath + ':'));
      
      return fileItems.map((item: { symbol_id: string; expected: any }) => {
        const symbolName = item.symbol_id.split(':')[1];
        return {
          id: `missing-${item.symbol_id}`,
          type: 'symbol' as const,
          symbolId: 0, // Not in database
          semanticId: item.symbol_id,
          name: symbolName,
          kind: 'unknown',
          path: filePath,
          sha: item.expected.lastSha,
          label: symbolName,
          description: `Expected: ${item.expected.expect}`,
          tooltip: `Missing symbol: ${symbolName}\nExpected: ${item.expected.expect}\nLast seen in: ${item.expected.lastSha}`,
          contextValue: 'bundle-symbol',
          command: {
            command: 'git-context.openSymbol',
            title: 'Open Symbol',
            arguments: [item.expected.lastSha, filePath, undefined]
          }
        };
      });
    }

    // Handle zombie-file-* (incompleteness-zombies file children)
    if (element.id?.startsWith('zombie-file-')) {
      const filePath = element.id.replace('zombie-file-', '');
      const zombies = this.lastBundleFacts?.evidence?.['findings.incompleteness.zombies'] || [];
      const fileItems = zombies.filter((z: { symbol_id: string; found?: { path?: string } }) => {
        const itemPath = z.found?.path || z.symbol_id.split(':')[0];
        return itemPath === filePath;
      });
      
      return fileItems.map((item: { symbol_id: string; found: { name: string; kind: string } }) => {
        const symbolName = item.found?.name || item.symbol_id.split(':')[1];
        return {
          id: `zombie-${item.symbol_id}`,
          type: 'symbol' as const,
          symbolId: 0,
          semanticId: item.symbol_id,
          name: symbolName,
          kind: item.found?.kind || 'unknown',
          path: filePath,
          sha: this.lastBundleFacts?.bundle.newestSha || this.lastBundleFacts?.bundle.oldestSha || '',
          label: symbolName,
          description: `Zombie: should be removed`,
          tooltip: `Zombie symbol: ${symbolName}\nShould have been removed but still exists`,
          contextValue: 'bundle-symbol',
          command: {
            command: 'git-context.openSymbol',
            title: 'Open Symbol',
            arguments: [this.lastBundleFacts?.bundle.newestSha || this.lastBundleFacts?.bundle.oldestSha || '', filePath, undefined]
          }
        };
      });
    }

    // Handle hotspot-* (drift-hotspots file children)
    if (element.id?.startsWith('hotspot-')) {
      const filePath = element.id.replace('hotspot-', '');
      // For now, return empty - could expand to show drift symbols if available
      return [];
    }

    // Handle dead-file-* (legacy-dead file children)
    if (element.id?.startsWith('dead-file-')) {
      const filePath = element.id.replace('dead-file-', '');
      const dead = this.lastBundleFacts?.evidence?.['findings.legacyAudit.dead'] || [];
      const fileItems = dead.filter((d: { symbol_id: string; path?: string }) => {
        const itemPath = d.path || d.symbol_id.split(':')[0];
        return itemPath === filePath;
      });
      
      return fileItems.map((item: { symbol_id: string; name: string; kind: string }) => {
        const symbolName = item.name || item.symbol_id.split(':')[1];
        return {
          id: `dead-${item.symbol_id}`,
          type: 'symbol' as const,
          symbolId: 0,
          semanticId: item.symbol_id,
          name: symbolName,
          kind: item.kind || 'unknown',
          path: filePath,
          sha: this.lastBundleFacts?.bundle.newestSha || this.lastBundleFacts?.bundle.oldestSha || '',
          label: symbolName,
          description: `Dead code`,
          tooltip: `Dead symbol: ${symbolName}\nNo longer used`,
          contextValue: 'bundle-symbol',
          command: {
            command: 'git-context.openSymbol',
            title: 'Open Symbol',
            arguments: [this.lastBundleFacts?.bundle.newestSha || this.lastBundleFacts?.bundle.oldestSha || '', filePath, undefined]
          }
        };
      });
    }

    // Handle file nodes with pre-populated children (from getCommitDetails)
    if (element.type === 'file' && element.children?.length) {
      return element.children;
    }

    // Handle category nodes with pre-populated children (Added/Modified/Removed under files)
    if (element.type === 'category' && element.children?.length) {
      return element.children;
    }

    // Child level - show commit details
    return this.getCommitDetails(element);
  }

  /**
   * Helper function to generate checkbox label
   */
  private getCheckboxLabel(isSelected: boolean, label: string): string {
    return `${isSelected ? '☑' : '☐'} ${label}`;
  }

  /**
   * Helper function to generate partial checkbox label
   */
  private getPartialCheckboxLabel(selected: number, total: number, label: string): string {
    if (selected === 0) return `☐ ${label}`;
    if (selected === total) return `☑ ${label}`;
    return `▣ ${label} (${selected}/${total})`;
  }

  /**
   * Generate report title from workspace scope and commit SHAs
   */
  private generateReportTitle(
    workspaceScope: string,
    commitShas: string[],
    git: any
  ): string {
    const parts: string[] = [];
    
    // Workspace part
    if (workspaceScope !== 'none') {
      parts.push(`Workspace (${workspaceScope})`);
    }
    
    // Commits part
    if (commitShas.length === 1) {
      const isHead = commitShas[0] === git.getHeadSha();
      parts.push(isHead ? 'HEAD' : commitShas[0].substring(0, 8));
    } else if (commitShas.length > 1) {
      parts.push(`HEAD+${commitShas.length - 1}`);
    }
    
    return parts.join(' vs ');
  }

  /**
   * Get saved report nodes for the reports section
   */
  private getSavedReportNodes(): TreeNode[] {
    try {
      const { getReportManager } = require('../storage/reportManager');
      const reportManager = getReportManager();
      const reports = reportManager.list();

      if (reports.length === 0) {
      return [{
        id: 'empty-reports',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: 0,
        label: 'No saved reports. Select items above and click Analyze.',
        description: '',
        tooltip: 'Select files and commits above, then click Analyze to create a report',
        contextValue: 'empty-state'
      }];
      }

      return reports.map((report: any) => ({
        id: `report-${report.id}`,
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: report.criticalCount + report.warningCount,
        label: `${report.isPinned ? '📌' : '📊'} ${report.title}`,
        description: `📅 ${this.formatDate(report.createdAt)}`,
        tooltip: report.summary,
        contextValue: 'saved-report',
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
      }));
    } catch (error) {
      console.error('Failed to load saved reports:', error);
      return [];
    }
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  /**
   * Get root nodes - selection section + reports section
   */
  private async getRootNodes(): Promise<TreeNode[]> {
    const startTime = Date.now();
    console.log('[COMMIT-TRACKER] getRootNodes() called');

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
      const result: TreeNode[] = [];

      // Selection Section
      result.push({
        id: 'selection-header',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: 0,
        label: '🔄 New Analysis',
        description: '',
        tooltip: 'Select workspace files and commits to analyze',
        contextValue: 'selection-header'
      });

      // Reports Section (collapsible)
      result.push({
        id: 'reports-section',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: 0,
        label: '📊 Saved Reports',
        description: '',
        tooltip: 'Previously generated analysis reports',
        contextValue: 'reports-section'
      });

      console.log(`[COMMIT-TRACKER] getRootNodes() completed in ${Date.now() - startTime}ms`);
      return result;
    } catch (error) {
      console.error('Failed to load root nodes:', error);
      // @ts-ignore
      const errorMessage = error instanceof Error ? error.message : String(error);
      return [{
        id: 'error',
        type: 'risk' as const,
        label: 'Error loading tree',
        description: errorMessage,
        icon: 'error'
      }];
    }
  }

  /**
   * Get selection section nodes (workspace + commits)
   */
  private getSelectionNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];

    // Workspace node
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const changes = git.getWorkingDirectoryChanges();
      const fileCount = changes.length;

      // Check if workspace has selected files (for checkbox state)
      const hasSelectedFiles = this.selectedFiles.size > 0;

      nodes.push({
        id: 'workspace-select',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'selection-header',
        count: fileCount,
        label: this.getCheckboxLabel(hasSelectedFiles, `Workspace - ${fileCount} files (${this.workspaceScope})`),
        description: '',
        tooltip: `Select workspace files for analysis. Scope: ${this.workspaceScope}`,
        contextValue: 'selection-item'
      });

      // Commits node
      nodes.push({
        id: 'selection-commits',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'selection-header',
        count: this.selectedCommits.size,
        label: `Commits (${this.selectedCommits.size} selected)`,
        description: '',
        tooltip: 'Select commits to analyze',
        contextValue: 'selection-item'
      });

      // Pull Latest action button
      nodes.push({
        id: 'pull-latest-action',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'selection-header',
        count: 0,
        label: '🔄 Pull Latest',
        description: 'Re-analyze latest commits',
        tooltip: 'Re-analyze latest commits from git, preserving manual selections',
        contextValue: 'pull-latest',
        command: { command: 'git-context.pullLatest', title: 'Pull Latest' }
      });

      // Reset Analysis action button
      nodes.push({
        id: 'reset-analysis-action',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'selection-header',
        count: 0,
        label: '🔄 Reset',
        description: 'Clear selection and reload',
        tooltip: 'Clear all selections and reload latest commits',
        contextValue: 'reset-analysis',
        command: { command: 'git-context.resetAnalysis', title: 'Reset Analysis' }
      });
    } catch (error) {
      console.error('Failed to get selection nodes:', error);
    }

    return nodes;
  }

  /**
   * Get workspace selection children (staged/unstaged groups)
   */
  private getWorkspaceSelectionChildren(): TreeNode[] {
    const nodes: TreeNode[] = [];

    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const staged = git.getStagedFiles();
      const unstaged = git.getUnstagedFiles();

      if (staged.length > 0) {
        nodes.push({
          id: 'selection-staged',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'workspace-select',
          count: staged.length,
          label: this.getPartialCheckboxLabel(
            staged.filter((f: FileChange) => this.selectedFiles.has(f.path)).length,
            staged.length,
            `Staged (${staged.length})`
          ),
          description: '',
          tooltip: 'Staged files',
          contextValue: 'selection-item'
        });
      }

      if (unstaged.length > 0) {
        nodes.push({
          id: 'selection-unstaged',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'workspace-select',
          count: unstaged.length,
          label: this.getPartialCheckboxLabel(
            unstaged.filter((f: FileChange) => this.selectedFiles.has(f.path)).length,
            unstaged.length,
            `Unstaged (${unstaged.length})`
          ),
          description: '',
          tooltip: 'Unstaged files',
          contextValue: 'selection-item'
        });
      }

      if (staged.length === 0 && unstaged.length === 0) {
        nodes.push({
          id: 'empty-workspace',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'workspace-select',
          count: 0,
          label: '✓ Workspace is clean',
          description: '',
          tooltip: 'No changes in working directory',
          contextValue: 'empty-state'
        });
      }
    } catch (error) {
      console.error('Failed to get workspace selection children:', error);
    }

    return nodes;
  }

  /**
   * Get staged file nodes
   */
  private getStagedFileNodes(): TreeNode[] {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const staged = git.getStagedFiles();

      return staged.map((f: FileChange) => {
        const isSelected = this.selectedFiles.has(f.path);
        const stats = git.getFileDiffStats(f.path, true);
        return {
          id: `select-file-${f.path}`,
          type: 'file' as const,
          path: f.path,
          sha: '',
          stats: { added: stats.added, modified: 0, removed: stats.removed },
          label: this.getCheckboxLabel(isSelected, path.basename(f.path)),
          description: `${f.status} • +${stats.added} -${stats.removed}`,
          tooltip: `Staged file: ${f.path}`,
          contextValue: 'selection-file'
        };
      });
    } catch (error) {
      console.error('Failed to get staged file nodes:', error);
      return [];
    }
  }

  /**
   * Get unstaged file nodes
   */
  private getUnstagedFileNodes(): TreeNode[] {
    try {
      const { GitOperations } = require('../analysis/git');
      const git = new GitOperations();
      const unstaged = git.getUnstagedFiles();

      return unstaged.map((f: FileChange) => {
        const isSelected = this.selectedFiles.has(f.path);
        const stats = git.getFileDiffStats(f.path, false);
        return {
          id: `select-file-${f.path}`,
          type: 'file' as const,
          path: f.path,
          sha: '',
          stats: { added: stats.added, modified: 0, removed: stats.removed },
          label: this.getCheckboxLabel(isSelected, path.basename(f.path)),
          description: `${f.status} • +${stats.added} -${stats.removed}`,
          tooltip: `Unstaged file: ${f.path}`,
          contextValue: 'selection-file'
        };
      });
    } catch (error) {
      console.error('Failed to get unstaged file nodes:', error);
      return [];
    }
  }

  /**
   * Get commit selection nodes (HEAD + recent commits + manual commits + actions)
   * Uses cumulative loading: "Add More" loads 3 more commits, skipping manual ones
   */
  private async getCommitSelectionNodes(): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      const { GitOperations } = await import('../analysis/git');
      const { getDatabaseManager } = await import('../storage/database');
      const git = new GitOperations();
      const db = getDatabaseManager().getDatabase();

      if (!db) {
        console.warn('Database not initialized, cannot load commits');
        return nodes;
      }

      const headSha = git.getHeadSha();

      // 1. Show HEAD commit
      if (headSha) {
        const headCommit = git.getCommitInfo(headSha);
        const isSelected = this.selectedCommits.has(headSha);
        nodes.push({
          id: `select-commit-${headSha}`,
          type: 'commit' as const,
          sha: headSha,
          message: headCommit.message,
          author: headCommit.author,
          date: headCommit.date,
          label: this.getCheckboxLabel(isSelected, `HEAD - ${headCommit.message.split('\n')[0]}`),
          description: `${headCommit.author} · ${new Date(headCommit.date).toLocaleDateString()}`,
          tooltip: `HEAD commit`,
          contextValue: 'selection-commit'
        });
      }

      // 2. Load initial 3 commits + any additional from "Add More" clicks
      const INITIAL_LOAD = 3;
      const totalToLoad = INITIAL_LOAD + this.loadMoreOffset;

      // 3. Query: Get commits excluding HEAD and manual ones, ordered by date DESC
      const manualShas = Array.from(this.manualCommits);
      const excludeShas = [headSha, ...manualShas].filter(sha => sha); // Filter out any undefined

      // Build dynamic WHERE clause to exclude commits
      const placeholders = excludeShas.map(() => '?').join(',');
      const whereClause = excludeShas.length > 0
        ? `WHERE sha NOT IN (${placeholders})`
        : '';

      const stmt = db.prepare(`
        SELECT sha, author, date, message
        FROM commits
        ${whereClause}
        ORDER BY date DESC
        LIMIT ?
      `);

      const autoCommits = excludeShas.length > 0
        ? stmt.all(...excludeShas, totalToLoad)
        : stmt.all(totalToLoad);

      // 4. Add auto-loaded commits to tree
      for (const commit of autoCommits) {
        const isSelected = this.selectedCommits.has(commit.sha);
        nodes.push({
          id: `select-commit-${commit.sha}`,
          type: 'commit' as const,
          sha: commit.sha,
          message: commit.message,
          author: commit.author,
          date: commit.date,
          label: this.getCheckboxLabel(isSelected, `${commit.sha.substring(0, 8)} - ${commit.message.split('\n')[0]}`),
          description: `${commit.author} · ${new Date(commit.date).toLocaleDateString()}`,
          tooltip: `Commit ${commit.sha.substring(0, 8)}`,
          contextValue: 'selection-commit'
        });
      }

      // 5. Add manually selected commits (always visible at bottom with [Manual] label)
      const manualCommitsToShow = manualShas.filter(sha => sha !== headSha);
      for (const sha of manualCommitsToShow) {
        try {
          const commitInfo = git.getCommitInfo(sha);
          const isSelected = this.selectedCommits.has(sha);
          nodes.push({
            id: `select-commit-${sha}`,
            type: 'commit' as const,
            sha: sha,
            message: commitInfo.message,
            author: commitInfo.author,
            date: commitInfo.date,
            label: this.getCheckboxLabel(isSelected, `[Manual] ${sha.substring(0, 8)} - ${commitInfo.message.split('\n')[0]}`),
            description: `${commitInfo.author} · ${new Date(commitInfo.date).toLocaleDateString()}`,
            tooltip: `Manually added commit`,
            contextValue: 'selection-commit'
          });
        } catch (error) {
          console.warn(`Manual commit ${sha} not found in git history`);
        }
      }

      // 6. "Add More..." button - check if more commits exist
      const countStmt = db.prepare(`
        SELECT COUNT(*) as count FROM commits ${whereClause}
      `);

      const countResult = excludeShas.length > 0
        ? countStmt.get(...excludeShas)
        : countStmt.get();
      const totalAvailable = countResult ? countResult.count : 0;

      if (autoCommits.length < totalAvailable) {
        nodes.push({
          id: 'selection-more',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'selection-commits',
          count: 0,
          label: 'Add More...',
          description: 'Load next 3 commits',
          tooltip: 'Click to load 3 more commits from history',
          contextValue: 'action-add-more',
          command: {
            command: 'git-context.addMoreCommits',
            title: 'Add More Commits'
          }
        });
      }

      // 7. "Add by Commit" button (always visible)
      nodes.push({
        id: 'selection-add-by-sha',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'selection-commits',
        count: 0,
        label: '🔍 Add by Commit',
        description: 'Add commit by SHA or branch',
        tooltip: 'Click to add a commit by SHA or branch name',
        contextValue: 'action-add-commit',
        command: {
          command: 'git-context.addCommitBySha',
          title: 'Add Commit by SHA'
        }
      });
    } catch (error) {
      console.error('Failed to get commit selection nodes:', error);
    }

    return nodes;
  }

  /**
   * Get report children (workspace summary + commit summaries)
   */
  private getReportChildren(reportId: string): TreeNode[] {
    try {
      const { getReportManager } = require('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (!report) {
        return [];
      }

      const nodes: TreeNode[] = [];

      // Workspace summary
      if (report.selectedFiles.length > 0) {
        nodes.push({
          id: `report-${reportId}-workspace`,
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: `report-${reportId}`,
          count: report.criticalCount + report.warningCount,
          label: `Workspace (${report.workspaceScope}) - ${report.criticalCount > 0 ? '❗' : ''}${report.criticalCount} Critical Issues`,
          description: '',
          tooltip: `Workspace analysis: ${report.selectedFiles.length} files`,
          contextValue: 'report-workspace-summary'
        });
      }

      // Commit summaries
      for (const sha of report.commitShas) {
        // Extract issue count from facts if available
        const issueCount = report.facts?.findings?.incompleteness?.missing || 0;
        const driftStatus = report.facts?.findings?.patternDrift ? 'Drift Detected' : 'Clean ✓';

        nodes.push({
          id: `report-${reportId}-commit-${sha}`,
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: `report-${reportId}`,
          count: issueCount,
          label: `${sha.substring(0, 8)} - ${issueCount > 0 ? 'Major Drift Detected' : 'Clean ✓'}`,
          description: '',
          tooltip: `Commit ${sha.substring(0, 8)}\nIssues: ${issueCount}\nDrift: ${driftStatus}`,
          contextValue: 'report-commit-summary',
          command: {
            command: 'git-context.openReportSection',
            title: 'Open Report Section',
            arguments: [reportId, sha]
          }
        });
      }

      return nodes;
    } catch (error) {
      console.error('Failed to get report children:', error);
      return [];
    }
  }

  /**
   * Get report workspace files
   */
  private getReportWorkspaceFiles(reportId: string): TreeNode[] {
    try {
      const { getReportManager } = require('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (!report || !report.facts) {
        return [];
      }

      // Extract files with issues from facts
      const filesWithIssues = new Map<string, number>();

      // Count issues per file from evidence
      const evidence = report.facts.evidence || {};
      const missing = evidence['findings.incompleteness.missing'] || [];
      const zombies = evidence['findings.incompleteness.zombies'] || [];

      for (const item of missing) {
        const filePath = item.symbol_id?.split(':')[0] || '';
        if (filePath) {
          filesWithIssues.set(filePath, (filesWithIssues.get(filePath) || 0) + 1);
        }
      }

      for (const item of zombies) {
        const filePath = item.found?.path || item.symbol_id?.split(':')[0] || '';
        if (filePath) {
          filesWithIssues.set(filePath, (filesWithIssues.get(filePath) || 0) + 1);
        }
      }

      return Array.from(filesWithIssues.entries()).map(([filePath, issueCount]) => ({
        id: `report-${reportId}-file-${filePath}`,
        type: 'file' as const,
        path: filePath,
        sha: '',
        stats: { added: 0, modified: 0, removed: 0 },
        label: `${path.basename(filePath)} - ${issueCount} issues`,
        description: '',
        tooltip: `${filePath}\n${issueCount} issues`,
        contextValue: 'report-file',
        command: {
          command: 'vscode.open',
          title: 'Open File',
          arguments: [vscode.Uri.file(path.join(require('../utils/config').getGitRoot() || '', filePath))]
        }
      }));
    } catch (error) {
      console.error('Failed to get report workspace files:', error);
      return [];
    }
  }

  /**
   * Get report commit findings
   */
  private getReportCommitFindings(reportId: string, commitSha: string): TreeNode[] {
    try {
      const { getReportManager } = require('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (!report || !report.facts) {
        return [];
      }

      const nodes: TreeNode[] = [];

      // Extract commit-specific findings from facts
      // Look for commit-related drift, missing symbols, etc.

      // Check for commit-specific issues in the evidence
      const evidence = report.facts.evidence || {};
      const commitKey = `commit-${commitSha.substring(0, 8)}`;

      // Look for missing symbols introduced by this commit
      const missingSymbols = evidence['findings.incompleteness.missing']?.filter(
        (item: any) => item.commit_sha === commitSha || item.expected?.lastSha === commitSha
      ) || [];

      if (missingSymbols.length > 0) {
        nodes.push({
          id: `report-${reportId}-commit-${commitSha}-missing`,
          type: 'category' as const,
          categoryType: 'removed' as const,
          parentId: `report-${reportId}-commit-${commitSha}`,
          count: missingSymbols.length,
          label: `Missing Symbols (${missingSymbols.length})`,
          description: 'Symbols that should exist but are missing',
          tooltip: `This commit should have introduced ${missingSymbols.length} symbols that are not found`,
          contextValue: 'report-finding'
        });
      }

      // Look for zombie symbols removed by this commit
      const zombieSymbols = evidence['findings.incompleteness.zombies']?.filter(
        (item: any) => item.commit_sha === commitSha
      ) || [];

      if (zombieSymbols.length > 0) {
        nodes.push({
          id: `report-${reportId}-commit-${commitSha}-zombies`,
          type: 'category' as const,
          categoryType: 'removed' as const,
          parentId: `report-${reportId}-commit-${commitSha}`,
          count: zombieSymbols.length,
          label: `Unexpected Removals (${zombieSymbols.length})`,
          description: 'Symbols removed that should still exist',
          tooltip: `This commit removed ${zombieSymbols.length} symbols that are still referenced elsewhere`,
          contextValue: 'report-finding'
        });
      }

      // Look for drift patterns introduced by this commit
      const driftChanges = evidence['findings.patternDrift.mixedTargets']?.filter(
        (item: any) => item.commit_sha === commitSha
      ) || [];

      if (driftChanges.length > 0) {
        nodes.push({
          id: `report-${reportId}-commit-${commitSha}-drift`,
          type: 'category' as const,
          categoryType: 'modified' as const,
          parentId: `report-${reportId}-commit-${commitSha}`,
          count: driftChanges.length,
          label: `Pattern Drift (${driftChanges.length})`,
          description: 'Inconsistent patterns introduced',
          tooltip: `This commit introduced ${driftChanges.length} instances of pattern inconsistency`,
          contextValue: 'report-finding'
        });
      }

      // If no specific findings, show a summary
      if (nodes.length === 0) {
        nodes.push({
          id: `report-${reportId}-commit-${commitSha}-clean`,
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: `report-${reportId}-commit-${commitSha}`,
          count: 0,
          label: '✓ Clean Commit',
          description: 'No issues detected for this commit',
          tooltip: 'This commit appears to be clean with no detected issues',
          contextValue: 'report-finding'
        });
      }

      return nodes;
    } catch (error) {
      console.error('Failed to get report commit findings:', error);
      return [];
    }
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
      // 0. Workspace scope always first
      const result: TreeNode[] = [];
      result.push(...this.getWorkspaceStateNodes());

      // 1. Bundle pinned if >=2 selected (immediately after workspace)
      if (this.selectedCommits.size >= 2) {
        const selectedCount = this.selectedCommits.size;
        result.push({
          id: 'refactor-bundle',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'root',
          count: selectedCount,
          label: `🔥 Refactor Bundle (${selectedCount})`,
          description: 'vs working tree',
          tooltip: `Generate comprehensive refactor analysis for ${selectedCount} selected commits\n\nIncludes intent analysis, drift detection, and cleanup recommendations`,
          contextValue: 'activeBundle',
          command: {
            command: 'git-context.generateReport',
            title: 'Generate Refactor Bundle Report'
          }
        });
      }

      // 2. Selected commits group
      if (this.selectedCommits.size > 0) {
        result.push({
          id: 'selected-commits-group',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'root',
          count: this.selectedCommits.size,
          label: '✅ Selected for Bundle',
          description: `${this.selectedCommits.size} commits selected`,
          tooltip: 'Commits currently selected for bundle analysis',
          contextValue: 'selected-commits-group',
        });
      }

      // 3. Recent commits group
      result.push({
        id: 'recent-commits-group',
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: 'root',
        count: 0,
        label: '📜 Recent Commits',
        description: 'Recent commit history',
        tooltip: 'Browse recent commits',
        contextValue: 'recent-commits-group',
      });

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

  private async getSelectedCommits(): Promise<TreeNode[]> {
    const selectedShas = Array.from(this.selectedCommits);
    if (selectedShas.length === 0) {
      return [];
    }

    try {
      const { GitOperations } = await import('../analysis/git');
      const { getDatabaseManager } = await import('../storage/database');
      const git = new GitOperations();
      const db = getDatabaseManager().getDatabase();
      const headSha = git.getHeadSha();

      // Batch load commit info for performance
      await this.batchLoadCommitInfo(selectedShas);

      const nodes: TreeNode[] = [];

      // Add HEAD first if selected
      if (this.selectedCommits.has(headSha)) {
        const headCommit = git.getCommitInfo(headSha);
        const cachedInfo = this.getCachedCommitInfo(headSha);
        const commitInfo = cachedInfo || headCommit;
        
        nodes.push({
          id: headSha,
          type: 'commit' as const,
          sha: headSha,
          message: commitInfo.message,
          author: commitInfo.author,
          date: commitInfo.date,
          isSelected: true,
          label: `☑ HEAD - ${commitInfo.message.split('\n')[0]}`,
          description: `${commitInfo.author} · ${new Date(commitInfo.date).toLocaleDateString()}`,
          tooltip: `HEAD (${headSha.substring(0, 8)})\n\n${commitInfo.message}\n\nClick to expand\nRight-click to toggle selection`,
          contextValue: 'commit inRefactorBundle head'
        });
      }

      // Load other selected commits (use cached if available)
      const otherShas = selectedShas.filter(sha => sha !== headSha);
      for (const sha of otherShas) {
        const cachedInfo = this.getCachedCommitInfo(sha);
        if (cachedInfo) {
          nodes.push({
            id: sha,
            type: 'commit' as const,
            sha: sha,
            message: cachedInfo.message,
            author: cachedInfo.author,
            date: cachedInfo.date,
            isSelected: true,
            label: `☑ ${sha.substring(0, 8)} - ${cachedInfo.message.split('\n')[0]}`,
            description: `${cachedInfo.author} · ${new Date(cachedInfo.date).toLocaleDateString()}`,
            tooltip: `${cachedInfo.message}\n\nClick to expand\nRight-click to toggle selection`,
            contextValue: 'commit inRefactorBundle'
          });
        } else {
          // Fallback: query database if not cached
          const stmt = db.prepare(`SELECT sha, author, date, message FROM commits WHERE sha = ?`);
          const commit = stmt.get(sha) as any;
          if (commit) {
            this.commitInfoCache.set(sha, {
              author: commit.author,
              date: commit.date,
              message: commit.message
            });
            nodes.push({
              id: sha,
              type: 'commit' as const,
              sha: sha,
              message: commit.message,
              author: commit.author,
              date: commit.date,
              isSelected: true,
              label: `☑ ${sha.substring(0, 8)} - ${commit.message.split('\n')[0]}`,
              description: `${commit.author} · ${new Date(commit.date).toLocaleDateString()}`,
              tooltip: `${commit.message}\n\nClick to expand\nRight-click to toggle selection`,
              contextValue: 'commit inRefactorBundle'
            });
          }
        }
      }

      // Sort by date descending (only commits have dates)
      nodes.sort((a, b) => {
        if (a.type === 'commit' && b.type === 'commit') {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        }
        return 0; // Keep order for non-commit nodes
      });

      return nodes;
    } catch (error) {
      console.error('Failed to load selected commits:', error);
      return [];
    }
  }

  private async getRecentCommitsList(): Promise<TreeNode[]> {
    try {
      const { GitOperations } = await import('../analysis/git');
      const { getDatabaseManager } = await import('../storage/database');
      const git = new GitOperations();
      const db = getDatabaseManager().getDatabase();
      const headSha = git.getHeadSha();

      const nodes: TreeNode[] = [];

      // Add HEAD as first selectable commit
      const headCommit = git.getCommitInfo(headSha);
      const cachedHeadInfo = this.getCachedCommitInfo(headSha);
      const headInfo = cachedHeadInfo || headCommit;
      const isHeadSelected = this.selectedCommits.has(headSha);
      
      nodes.push({
        id: headSha,
        type: 'commit' as const,
        sha: headSha,
        message: headInfo.message,
        author: headInfo.author,
        date: headInfo.date,
        isSelected: isHeadSelected,
        label: `${isHeadSelected ? '☑ ' : '☐ '}HEAD - ${headInfo.message.split('\n')[0]}`,
        description: `${headInfo.author} · ${new Date(headInfo.date).toLocaleDateString()}`,
        tooltip: `HEAD (${headSha.substring(0, 8)})\n\n${headInfo.message}\n\nClick to expand\nRight-click to toggle selection`,
        contextValue: isHeadSelected ? 'commit inRefactorBundle head' : 'commit head'
      });

      // Load unselected commits from database (limit for performance)
      const LIMIT = 20;
      const stmt = db.prepare(`
        SELECT sha, author, date, message, files_changed, symbols_added, symbols_modified, symbols_removed, risks
        FROM commits
        WHERE sha != ?
        ORDER BY date DESC
        LIMIT ?
      `);

      const commits = stmt.all(headSha, LIMIT) as any[];
      
      // Batch cache commit info
      const commitShas = commits.map(c => c.sha);
      await this.batchLoadCommitInfo(commitShas);
      
      commits.forEach(commit => {
        const isSelected = this.selectedCommits.has(commit.sha);
        if (!isSelected) {
          const cachedInfo = this.getCachedCommitInfo(commit.sha);
          const commitInfo = cachedInfo || commit;
          
          nodes.push({
            id: commit.sha,
            type: 'commit' as const,
            sha: commit.sha,
            message: commitInfo.message,
            author: commitInfo.author,
            date: commitInfo.date,
            isSelected: false,
            label: `☐ ${commit.sha.substring(0, 8)} - ${commitInfo.message.split('\n')[0]}`,
            description: `${commitInfo.author} · ${new Date(commitInfo.date).toLocaleDateString()}`,
            tooltip: `${commitInfo.message}\n\nClick to expand\nRight-click to toggle selection for report`,
            contextValue: 'commit'
          });
        }
      });

      // Add "Load more..." node if there might be more commits
      if (commits.length === LIMIT) {
        nodes.push({
          id: 'load-more-commits',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'recent-commits-group',
          count: 0,
          label: '📄 Load more commits...',
          description: 'Click to load additional commits',
          tooltip: 'Load more commits from history',
          contextValue: 'load-more',
          command: {
            command: 'git-context.loadMoreCommits',
            title: 'Load More Commits'
          }
        });
      }

      return nodes;
    } catch (error) {
      console.error('Failed to load recent commits:', error);
      return [];
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
