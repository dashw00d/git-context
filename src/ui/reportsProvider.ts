import * as vscode from 'vscode';
import { logError, logDebug } from '../utils/logger';
import { TreeNode, toVSCodeTreeItem } from '../contracts/treeNodes';

export class ReportsProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | null | void> =
    new vscode.EventEmitter<TreeNode | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | null | void> =
    this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) { }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return toVSCodeTreeItem(element);
  }

  async getChildren(element?: TreeNode): Promise<TreeNode[]> {
    if (!element) {
      // Root level - show saved reports
      return this.getSavedReports();
    }

    // Handle report children
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

    return [];
  }

  private async getSavedReports(): Promise<TreeNode[]> {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const reports = reportManager.list();

      if (reports.length === 0) {
        return [{
          id: 'empty-reports',
          type: 'category' as const,
          categoryType: 'added' as const,
          parentId: 'root',
          count: 0,
          label: 'No saved reports. Generate analysis reports to see them here.',
          description: '',
          tooltip: 'Create reports using the Commits & Files section',
          contextValue: 'gitContextEmptyState'
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
        contextValue: 'gitContextReport',
        command: {
          command: "git-context.openReport",
          title: "Open Report",
          arguments: [report.id]
        },
        collapsibleState: vscode.TreeItemCollapsibleState.Collapsed
      }));
    } catch (error) {
      logError('Failed to load saved reports', error);
      return [];
    }
  }

  private async getReportChildren(reportId: string): Promise<TreeNode[]> {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (!report) {
        return [];
      }

      const result: TreeNode[] = [];

      // Workspace summary
      result.push({
        id: `report-${reportId}-workspace`,
        type: 'category' as const,
        categoryType: 'added' as const,
        parentId: `report-${reportId}`,
        count: 0,
        label: '📁 Workspace Summary',
        description: `${report.selectedFiles?.length || 0} files analyzed`,
        tooltip: 'Files included in this analysis',
        contextValue: 'gitContextReportWorkspace'
      });

      // Commit summaries
      const commitShas = report.commitShas || [];
      for (const sha of commitShas) {
        try {
          // Get commit info from database
          const { getDatabaseManager } = await import('../storage/database');
          const db = getDatabaseManager().getDatabase();

          const commitInfo = db.prepare('SELECT * FROM commits_metadata WHERE sha = ?').get(sha) as any;
          if (commitInfo) {
            const issueCount = this.countIssuesInReport(report, sha);
            result.push({
              id: `report-${reportId}-commit-${sha}`,
              type: 'category' as const,
              categoryType: 'added' as const,
              parentId: `report-${reportId}`,
              count: issueCount,
              label: `${sha.substring(0, 8)} - ${issueCount > 0 ? 'Major Drift Detected' : 'Clean ✓'}`,
              description: '',
              tooltip: `Commit ${sha.substring(0, 8)}\nIssues: ${issueCount}\nDrift: ${this.getDriftStatus(report, sha)}`,
              contextValue: 'gitContextReportCommit',
              command: {
                command: 'git-context.openReportSection',
                title: 'Open Report Section',
                arguments: [reportId, sha]
              }
            });
          }
        } catch (error) {
          logDebug(`Failed to get commit info for ${sha}: ${error}`);
        }
      }

      return result;
    } catch (error) {
      logError('Failed to get report children', error);
      return [];
    }
  }

  private async getReportWorkspaceFiles(reportId: string): Promise<TreeNode[]> {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (!report || !report.selectedFiles) {
        return [];
      }

      return report.selectedFiles.map((filePath: string) => ({
        id: `report-${reportId}-file-${filePath}`,
        type: 'file' as const,
        path: filePath,
        sha: '', // Reports don't have specific SHAs
        stats: { added: 0, modified: 0, removed: 0 }, // No stats for report files
        label: vscode.workspace.asRelativePath(filePath),
        description: '',
        tooltip: `File analyzed in report: ${filePath}`,
        contextValue: 'gitContextReportFile'
      } as TreeNode));
    } catch (error) {
      logError('Failed to get report workspace files', error);
      return [];
    }
  }

  private async getReportCommitFindings(reportId: string, commitSha: string): Promise<TreeNode[]> {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (!report) {
        return [];
      }

      // This would need to be implemented based on the report structure
      // For now, return empty array
      return [];
    } catch (error) {
      logError('Failed to get report commit findings', error);
      return [];
    }
  }

  private countIssuesInReport(report: any, commitSha: string): number {
    // Placeholder - implement based on report structure
    return 0;
  }

  async exportReportsDto(
    filterText?: string,
    filterBranch?: string | 'all',
    showPinnedOnly?: boolean
  ): Promise<Array<{ id: string; title: string; summary: string; createdAt: string; pinned?: boolean; branch?: string }>> {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      let reports = reportManager.list();

      // Apply filters
      if (filterText && filterText.trim()) {
        const searchTerm = filterText.trim().toLowerCase();
        reports = reports.filter((report: any) =>
          (report.title || '').toLowerCase().includes(searchTerm) ||
          (report.summary || '').toLowerCase().includes(searchTerm)
        );
      }

      if (filterBranch && filterBranch !== 'all') {
        reports = reports.filter((report: any) => report.branch === filterBranch);
      }

      if (showPinnedOnly) {
        reports = reports.filter((report: any) => !!report.isPinned);
      }

      return reports.map((report: any) => ({
        id: report.id,
        title: report.title,
        summary: report.summary || '',
        createdAt: (report.createdAt instanceof Date ? report.createdAt : new Date(report.createdAt)).toISOString(),
        pinned: !!report.isPinned,
        branch: report.branch
      }));
    } catch (error) {
      logError('Failed to export reports for cockpit', error);
      return [];
    }
  }

  private getDriftStatus(report: any, commitSha: string): string {
    // Placeholder - implement based on report structure
    return 'Unknown';
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }
}
