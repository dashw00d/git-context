import * as vscode from 'vscode';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { getReportService } from '../services/reportService';
import { prepare } from '../storage/statement-wrapper';
import { logError, logInfo } from '../utils/logger';
import { Action } from './actions';
import { CockpitStore } from './store';

export class CockpitEffects {
  constructor(
    private store: CockpitStore,
    private providers: {
      commitsProvider: CommitsProvider;
      activeBundleProvider: ActiveBundleProvider;
      symbolHistoryProvider: SymbolHistoryProvider;
    }
  ) {
    store.subscribe(this.onAction.bind(this));
  }

  private async onAction(state: any, action: Action) {
    switch (action.type) {
      case 'ANALYSIS_REQUESTED':
        await this.handleAnalysis(action.payload);
        break;
      case 'SELECTION_TOGGLED':
      case 'SELECTION_CLEARED':
      case 'SELECTION_SET':
      case 'STAGED_SELECTION_UPDATED':
      case 'UNSTAGED_SELECTION_UPDATED':
      case 'COMMITS_FILTER_TEXT_CHANGED':
      case 'COMMITS_FILTER_SCOPES_CHANGED':
      case 'LAST_N_COMMITS_CHANGED':
        await this.refreshCommits();
        break;
      case 'REFRESH_REQUESTED':
        await this.handleRefresh(action.payload.scope);
        break;
      case 'ANALYSIS_COMPLETED':
      case 'BUNDLE_CLEARED':
        await this.updateContexts();
        break;
        break;
      // Add other side effects here
    }
  }

  private async updateContexts() {
    const state = this.store.getState();
    await vscode.commands.executeCommand(
      'setContext',
      'gitContext.hasActiveBundle',
      !!state.bundleFacts
    );
    const hasSelection = state.selectedCommitShas.length > 0;
    await vscode.commands.executeCommand('setContext', 'gitContext.hasSelection', hasSelection);
  }

  private async handleRefresh(scope: 'all' | 'commits' | 'bundle' | 'symbols' | 'reports') {
    const promises: Promise<void>[] = [];
    if (scope === 'all' || scope === 'commits') promises.push(this.refreshCommits());
    if (scope === 'all' || scope === 'bundle') promises.push(this.refreshBundle());
    if (scope === 'all' || scope === 'symbols') promises.push(this.refreshSymbols());
    if (scope === 'all' || scope === 'reports') promises.push(this.refreshReports());
    // Workspace is usually part of commits refresh in the old logic, but let's be explicit
    if (scope === 'all' || scope === 'commits') promises.push(this.refreshWorkspace());

    await Promise.all(promises);
  }

  private async refreshCommits() {
    if (!this.providers.commitsProvider) return;
    await this.providers.commitsProvider.initializeDatabase();

    const state = this.store.getState();
    const { getExtensionConfig } = await import('../utils/config');
    const config = getExtensionConfig();
    const baseLimit = config.defaultCommitCount;
    const requestedLimit = state.lastNCommits || baseLimit;
    const effectiveLimit = Math.max(baseLimit, requestedLimit);

    const commits = await this.providers.commitsProvider.exportCommitsDto(
      effectiveLimit + this.providers.commitsProvider.loadMoreOffset
    );
    const hasMore = commits.length >= baseLimit; // Simplified check

    // We need to map commits to DTOs (including 'analyzed' status)
    // This requires DB access similar to updateCommitsState
    const { ANALYSIS_VERSION } = await import('../storage/schema');

    // Check analysis status
    const analyzedStatuses = await Promise.all(
      commits.map(async (commit: any) => {
        const result = prepare(
          'SELECT COUNT(*) as count FROM commits_analysis WHERE sha = ? AND analysis_version = ? AND status = ?'
        ).get(commit.sha, ANALYSIS_VERSION, 'complete');
        return { sha: commit.sha, analyzed: (result as any)?.count > 0 };
      })
    );
    const analyzedMap = new Map(analyzedStatuses.map(s => [s.sha, s.analyzed]));
    const bundleShaSet = new Set(state.bundleFacts?.bundle?.shas ?? []);

    const commitDtos = commits.map((commit: any) => {
      const files = Array.isArray(commit.files)
        ? commit.files.map((file: any) => ({
            path: file.path,
            status: this.mapStatus(file.status),
          }))
        : undefined;
      const scope = this.mapScope(commit.sha);
      return {
        sha: commit.sha,
        shortSha: (commit.sha || '').slice(0, 8),
        message: commit.message,
        author: commit.author || 'Unknown',
        authoredAt: commit.date || '',
        changes: typeof commit.changes === 'number' ? commit.changes : (files?.length ?? 0),
        inBundle: bundleShaSet.has(commit.sha),
        scope,
        files,
        analyzed: scope === 'history' ? analyzedMap.get(commit.sha) || false : false,
      };
    });

    this.store.dispatch({
      type: 'COMMITS_UPDATED',
      payload: { commits: commitDtos, hasMore },
    });
  }

  private async refreshWorkspace() {
    if (!this.providers.commitsProvider) return;
    const workspaceFiles = await this.providers.commitsProvider.exportWorkspaceFilesDto();

    const staged = workspaceFiles.staged.map((file: any) => ({
      path: file.path,
      status: this.mapStatus(file.status),
    }));
    const unstaged = workspaceFiles.unstaged.map((file: any) => ({
      path: file.path,
      status: this.mapStatus(file.status),
    }));

    this.store.dispatch({
      type: 'WORKSPACE_FILES_UPDATED',
      payload: { staged, unstaged },
    });
  }

  private async refreshBundle() {
    if (!this.providers.activeBundleProvider) return;
    // activeBundleProvider updates are usually reactive to report generation
    // But if we need to pull:
    const bundleFacts = this.providers.activeBundleProvider.exportBundleFacts();
    // We don't have a BUNDLE_UPDATED action that takes facts directly?
    // ANALYSIS_COMPLETED does.
    // But if we just want to refresh the UI from existing provider state:
    // We might need a generic BUNDLE_REFRESHED action or reuse LEGACY
    // For now, let's assume bundle is pushed via ANALYSIS_COMPLETED.
    // But if we reload window, we need to pull.
    // Let's use LEGACY for now to update bundleFacts/Summary

    if (bundleFacts) {
      const summary = {
        id: bundleFacts.bundle?.newestSha || 'bundle',
        commitCount: bundleFacts.bundle?.shas?.length ?? 0,
        fileCount: bundleFacts.scope?.files ?? 0,
        symbolCount: bundleFacts.working?.symbols ?? 0,
        createdAt: bundleFacts.generated_at,
      };
      this.store.dispatch({
        type: 'LEGACY_STATE_UPDATED',
        payload: { partial: { bundleFacts, bundleSummary: summary } },
      });
    }
  }

  private async refreshSymbols() {
    if (!this.providers.symbolHistoryProvider) return;
    const state = this.store.getState();
    const symbols = await this.providers.symbolHistoryProvider.exportRecentSymbols(
      50,
      state.symbolFilterText || undefined,
      state.symbolKindFilter !== 'all' ? state.symbolKindFilter : undefined,
      state.symbolChangeFilter !== 'all' ? state.symbolChangeFilter : undefined
    );

    const symbolDtos = symbols.map((symbol: any) => ({
      id: `${symbol.path}:${symbol.name}`,
      name: symbol.name,
      path: symbol.path,
      kind: symbol.kind,
      language: symbol.language || '',
      changeType: symbol.change_type || symbol.changeType,
      commitCount: symbol.commitCount ?? 1,
      lastChangedAt: symbol.date || '',
    }));

    this.store.dispatch({
      type: 'SYMBOLS_UPDATED',
      payload: { symbols: symbolDtos },
    });
  }

  private async refreshReports() {
    const reportService = await getReportService();
    const state = this.store.getState();
    const reports = await reportService.exportReportsDto(
      state.reportsFilterText,
      state.reportsBranchFilter,
      state.reportsShowPinnedOnly
    );
    this.store.dispatch({ type: 'REPORTS_UPDATED', payload: { reports } });
  }

  private mapStatus(status: string): any {
    switch (status) {
      case 'A':
        return 'added';
      case 'M':
        return 'modified';
      case 'D':
        return 'deleted';
      case 'R':
        return 'renamed';
      default:
        return 'unknown';
    }
  }

  private mapScope(sha: string): 'staged' | 'unstaged' | 'history' {
    if (sha.includes('staged')) return 'staged'; // Simplified check, ideally use parseWorkspaceSha
    if (sha.includes('unstaged')) return 'unstaged';
    return 'history';
  }

  private async handleAnalysis(payload: { selection: string[]; force?: boolean }) {
    const reportService = await getReportService();
    this.store.dispatch({
      type: 'ANALYSIS_STARTED',
      payload: { step: 'Initializing...' },
    });

    try {
      await this.providers.commitsProvider.initializeDatabase();

      const state = this.store.getState();
      const { GitOperations } = await import('../analysis/git');
      const { makeWorkspaceSha, isWorkspaceSha } = await import('../utils/workspace');
      const { getExtensionConfig } = await import('../utils/config');

      const git = new GitOperations();
      let branch = 'HEAD';
      try {
        const current = await git.getCurrentBranch();
        branch = current ?? 'HEAD';
      } catch {
        // fall back to HEAD marker when branch is unavailable
      }

      const stagedFiles = await git.getStagedFiles().catch(() => []);
      const unstagedFiles = await git.getUnstagedFiles().catch(() => []);
      const includeStaged = stagedFiles.length > 0 || state.selectedStagedPaths.length > 0;
      const includeUnstaged = unstagedFiles.length > 0 || state.selectedUnstagedPaths.length > 0;

      const ordered: string[] = [];
      const pushUnique = (sha?: string) => {
        if (sha && !ordered.includes(sha)) ordered.push(sha);
      };

      if (includeUnstaged) pushUnique(makeWorkspaceSha('unstaged', branch));
      if (includeStaged) pushUnique(makeWorkspaceSha('staged', branch));

      const explicitSelection =
        payload.selection && payload.selection.length > 0
          ? payload.selection
          : state.selectedCommitShas;
      explicitSelection.forEach(pushUnique);

      const config = getExtensionConfig();
      const depth = state.lastNCommits || config.defaultCommitCount || 5;

      const hasCommitCount = (): number => ordered.filter(sha => !isWorkspaceSha(sha)).length;

      if (hasCommitCount() === 0) {
        try {
          const headSha = await git.getHeadSha();
          pushUnique(headSha);
        } catch {
          // no HEAD available
        }

        const recent = await git.getRecentCommits(depth * 2);
        for (const commit of recent) {
          if (hasCommitCount() >= depth) break;
          pushUnique(commit.sha);
        }
      } else if (hasCommitCount() < depth) {
        const recent = await git.getRecentCommits(depth * 2);
        for (const commit of recent) {
          if (hasCommitCount() >= depth) break;
          pushUnique(commit.sha);
        }
      }

      logInfo(
        `[Effects] ANALYSIS_REQUESTED -> ordered selection (${ordered.length}): ` +
          `${ordered.map(s => s.slice(0, 8)).join(', ')}`
      );

      // keep store selection in sync with the computed order
      this.store.dispatch({
        type: 'SELECTION_SET',
        payload: { shas: ordered },
      });

      await reportService.generateReport(ordered, 'full', {
        force: payload.force,
      });
    } catch (error) {
      logError('[Effects] Analysis failed to start', error);
      this.store.dispatch({
        type: 'ANALYSIS_FAILED',
        payload: { error: String(error) },
      });
    }
  }
}
