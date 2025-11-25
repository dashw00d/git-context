import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RefactorBundleFacts } from '../facts/types';
import { getGitRoot } from '../utils/config';

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

export class ActiveBundleProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  public lastBundleFacts: RefactorBundleFacts | null = null;
  private bundleExpandedState = vscode.TreeItemCollapsibleState.Expanded;

  constructor(private context: vscode.ExtensionContext) {
    // Load bundle facts from file if available
    this.loadBundleFacts();
  }

  private async loadBundleFacts() {
    try {
      const gitRoot = getGitRoot();
      if (!gitRoot) return;

      const factsPath = path.join(gitRoot, '.git/commit-tracker/last-bundle-facts.json');
      if (fs.existsSync(factsPath)) {
        const factsContent = fs.readFileSync(factsPath, 'utf8');
        this.lastBundleFacts = JSON.parse(factsContent);
      }
    } catch (error) {
      console.debug('Failed to load bundle facts:', error);
    }
  }

  refresh(): void {
    this.loadBundleFacts();
    this._onDidChangeTreeData.fire();
  }

  exportBundleFacts(): RefactorBundleFacts | null {
    return this.lastBundleFacts;
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    let collapsibleState = this.getCollapsibleState(element);

    // Override collapsibleState for bundle root
    if (element.id === 'refactor-bundle') {
      collapsibleState = this.bundleExpandedState;
    }

    const treeItem = new vscode.TreeItem(element.label || '', collapsibleState);
    treeItem.id = element.id;
    treeItem.description = element.description;

    if (element.tooltip) {
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

    return treeItem;
  }

  private getCollapsibleState(element: TreeNode): vscode.TreeItemCollapsibleState {
    if (element.id === 'refactor-bundle') {
      return this.bundleExpandedState;
    } else if (element.contextValue === 'no-data-placeholder') {
      return vscode.TreeItemCollapsibleState.None;
    } else if (element.children && element.children.length > 0) {
      return vscode.TreeItemCollapsibleState.Collapsed;
    } else if (element.type === 'category' && element.count === 0 && !element.children?.length) {
      return vscode.TreeItemCollapsibleState.None;
    }
    return vscode.TreeItemCollapsibleState.None;
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // Root level - show bundle root if available
      return this.getBundleRootNodes();
    }

    // Handle bundle children
    if (element.id === 'refactor-bundle') {
      return this.getBundleChildNodes();
    }

    // Handle bundle category children
    return this.getBundleChildDetails(element);
  }

  private getBundleRootNodes(): TreeNode[] {
    const nodes: TreeNode[] = [];

    // Always show the bundle root at the top
    if (this.lastBundleFacts) {
      nodes.push(this.createBundleRootNode());
    } else {
      nodes.push({
        id: 'no-active-bundle',
        type: 'bundle-root',
        label: 'No Active Bundle',
        description: 'Generate a report to create a bundle',
        tooltip: 'Run analysis to create an active bundle',
        contextValue: 'gitContextActiveBundleEmpty',
        icon: 'package'
      });
    }

    return nodes;
  }

  private createBundleRootNode(): TreeNode {
    const facts = this.lastBundleFacts!;
    const hasData = !!facts;

    const commitCount = facts.bundle.shas?.length || 0;
    const fileCount = facts.scope?.files || 0;

    return {
      id: 'refactor-bundle',
      type: 'bundle-root',
      label: 'Active Bundle',
      description: hasData ? `${commitCount} commits, ${fileCount} files` : 'Generate report first',
      tooltip: hasData ? `Bundle created from ${commitCount} commits affecting ${fileCount} files` : 'No active bundle - run analysis first',
      contextValue: 'gitContextActiveBundle',
      command: { command: "git-context.viewBundle", title: "View Bundle" },
      icon: 'package'
    };
  }

  private getBundleChildNodes(): TreeNode[] {
    if (!this.lastBundleFacts) {
      return [{
        id: 'no-bundle-data',
        type: 'category',
        label: 'No bundle data available',
        description: 'Run analysis to generate bundle',
        contextValue: 'no-data-placeholder',
        icon: 'info'
      }];
    }

    const nodes: TreeNode[] = [];
    const facts = this.lastBundleFacts;

    // Progress indicator
    nodes.push({
      id: 'refactor-bundle-progress',
      type: 'category',
      label: 'Analysis Progress',
      description: 'Analysis Complete',
      tooltip: 'Current analysis progress',
      contextValue: 'gitContextBundleProgress',
      icon: 'sync'
    });

    // Net effect summary
    const hasData = !!facts;
    nodes.push({
      id: 'refactor-bundle-net-effect',
      type: 'category',
      label: 'Net Effect',
      description: hasData ? 'Combined changes from bundle' : 'Generate report first',
      tooltip: 'Shows the net result of all commits in the bundle compared to working tree',
      contextValue: hasData ? 'gitContextBundleNetEffect' : 'no-data-placeholder',
      icon: 'git-compare'
    });

    // Findings sections
    const incompletenessCount = facts.findings.incompleteness.missing + facts.findings.incompleteness.zombies;
    if (incompletenessCount > 0) {
      nodes.push({
        id: 'refactor-bundle-incompleteness',
        type: 'category',
        categoryType: 'removed',
        count: incompletenessCount,
        label: `Incomplete Changes (${incompletenessCount})`,
        description: `${facts.findings.incompleteness.missing} missing · ${facts.findings.incompleteness.zombies} zombies`,
        tooltip: 'Parts of changes that may be incomplete or inconsistent',
        contextValue: 'gitContextBundleIncompleteness',
        icon: 'warning'
      });
    }

    const driftCount = facts.findings.patternDrift.mixedTargets + facts.findings.patternDrift.oldNamespaces;
    if (driftCount > 0) {
      nodes.push({
        id: 'refactor-bundle-drift',
        type: 'category',
        categoryType: 'modified',
        count: driftCount,
        label: `Pattern Drift (${driftCount})`,
        description: `${facts.findings.patternDrift.mixedTargets} mixed · ${facts.findings.patternDrift.oldNamespaces} old`,
        tooltip: 'Code patterns that have changed or evolved',
        contextValue: 'gitContextBundleDrift',
        icon: 'arrow-both'
      });
    }

    const legacyCount = facts.findings.legacyAudit.dead + facts.findings.legacyAudit.replacedLeftovers.length;
    if (legacyCount > 0) {
      nodes.push({
        id: 'refactor-bundle-legacy',
        type: 'category',
        categoryType: 'removed',
        count: legacyCount,
        label: `Legacy Code (${legacyCount})`,
        description: `${facts.findings.legacyAudit.dead} dead · ${facts.findings.legacyAudit.replacedLeftovers.length} replaced`,
        tooltip: 'Legacy or obsolete code that should be cleaned up',
        contextValue: 'gitContextBundleLegacy',
        icon: 'trash'
      });
    }

    // Timeline section
    nodes.push({
      id: 'refactor-bundle-timeline',
      type: 'category',
      label: 'Timeline',
      description: 'Changes over time',
      tooltip: 'View how the bundle evolved chronologically',
      contextValue: 'gitContextBundleTimeline',
      icon: 'history'
    });

    return nodes;
  }

  private async getBundleChildDetails(element: TreeNode): Promise<TreeNode[]> {
    if (!this.lastBundleFacts) return [];

    const facts = this.lastBundleFacts;

    switch (element.id) {
      case 'refactor-bundle-net-effect':
        return this.getNetEffectDetails();

      case 'refactor-bundle-incompleteness':
        return this.getIncompletenessDetails();

      case 'refactor-bundle-drift':
        return this.getDriftDetails();

      case 'refactor-bundle-legacy':
        return this.getLegacyDetails();

      case 'refactor-bundle-timeline':
        return this.getTimelineDetails();

      default:
        return [];
    }
  }

  private getNetEffectDetails(): TreeNode[] {
    if (!this.lastBundleFacts) return [];

    const nodes: TreeNode[] = [];
    const bundleSha = this.lastBundleFacts.bundle.newestSha || this.lastBundleFacts.bundle.oldestSha;

    // Show files from evidence or create placeholder
    const bundleFiles = this.lastBundleFacts.evidence?.['bundle.files'] || [];
    if (bundleFiles.length > 0) {
      for (const filePath of bundleFiles) {
        nodes.push({
          id: `bundle-file-${filePath}`,
          type: 'file',
          path: filePath,
          sha: this.lastBundleFacts.bundle.newestSha || this.lastBundleFacts.bundle.oldestSha,
          label: path.basename(filePath),
          description: filePath,
          tooltip: `File changed in bundle: ${filePath}`,
          contextValue: 'gitContextBundleFile',
          command: {
            command: 'vscode.open',
            title: 'Open File',
            arguments: [vscode.Uri.file(path.join(getGitRoot() || '', filePath))]
          },
          icon: 'file'
        });
      }
    }

    return nodes;
  }

  private getIncompletenessDetails(): TreeNode[] {
    const nodes: TreeNode[] = [];

    if (this.lastBundleFacts!.findings.incompleteness.missing > 0) {
      nodes.push({
        id: 'incompleteness-missing',
        type: 'category',
        count: this.lastBundleFacts!.findings.incompleteness.missing,
        label: `Missing Additions (${this.lastBundleFacts!.findings.incompleteness.missing})`,
        description: 'Additions that appear incomplete',
        contextValue: 'gitContextBundleIncompletenessMissing',
        icon: 'add'
      });
    }

    if (this.lastBundleFacts!.findings.incompleteness.zombies > 0) {
      nodes.push({
        id: 'incompleteness-zombies',
        type: 'category',
        count: this.lastBundleFacts!.findings.incompleteness.zombies,
        label: `Zombie Removals (${this.lastBundleFacts!.findings.incompleteness.zombies})`,
        description: 'Removals that may leave dangling references',
        contextValue: 'gitContextBundleIncompletenessZombies',
        icon: 'remove'
      });
    }

    return nodes;
  }

  private getDriftDetails(): TreeNode[] {
    const nodes: TreeNode[] = [];

    if (this.lastBundleFacts!.findings.patternDrift.mixedTargets > 0) {
      nodes.push({
        id: 'drift-mixed-targets',
        type: 'category',
        count: this.lastBundleFacts!.findings.patternDrift.mixedTargets,
        label: `Mixed Targets (${this.lastBundleFacts!.findings.patternDrift.mixedTargets})`,
        description: 'Functions called with different parameter patterns',
        contextValue: 'gitContextBundleDriftMixed',
        icon: 'arrow-both'
      });
    }

    if (this.lastBundleFacts!.findings.patternDrift.oldNamespaces > 0) {
      nodes.push({
        id: 'drift-old-namespaces',
        type: 'category',
        count: this.lastBundleFacts!.findings.patternDrift.oldNamespaces,
        label: `Old Namespaces (${this.lastBundleFacts!.findings.patternDrift.oldNamespaces})`,
        description: 'References to old or renamed namespaces',
        contextValue: 'gitContextBundleDriftOld',
        icon: 'symbol-namespace'
      });
    }

    return nodes;
  }

  private getLegacyDetails(): TreeNode[] {
    const nodes: TreeNode[] = [];

    if (this.lastBundleFacts!.findings.legacyAudit.dead > 0) {
      nodes.push({
        id: 'legacy-dead',
        type: 'category',
        count: this.lastBundleFacts!.findings.legacyAudit.dead,
        label: `Dead Code (${this.lastBundleFacts!.findings.legacyAudit.dead})`,
        description: 'Code that is no longer referenced',
        contextValue: 'gitContextBundleLegacyDead',
        icon: 'trash'
      });
    }

    if (this.lastBundleFacts!.findings.legacyAudit.replacedLeftovers.length > 0) {
      nodes.push({
        id: 'legacy-replaced',
        type: 'category',
        count: this.lastBundleFacts!.findings.legacyAudit.replacedLeftovers.length,
        label: `Replaced Leftovers (${this.lastBundleFacts!.findings.legacyAudit.replacedLeftovers.length})`,
        description: 'Old implementations that should be removed',
        contextValue: 'gitContextBundleLegacyReplaced',
        icon: 'replace'
      });
    }

    return nodes;
  }

  private getTimelineDetails(): TreeNode[] {
    // For now, show a simple timeline entry
    return [{
      id: 'timeline-placeholder',
      type: 'timeline',
      label: 'Bundle Timeline',
      description: 'Chronological view of changes',
      tooltip: 'Shows how the bundle evolved over time',
      contextValue: 'gitContextBundleTimelineView',
      icon: 'history'
    }];
  }
}
