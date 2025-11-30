import * as vscode from 'vscode';
import { CockpitOrchestrator } from '../state/cockpitOrchestrator';
import { CommitsProvider } from '../providers/commitsProvider';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { parseWorkspaceSha } from '../utils/workspace';
import { logError } from '../utils/logger';
import { getReportService } from '../services/reportService';
import type { CockpitState, CommitDTO, FileStatus, StagedFileDTO, UnstagedFileDTO, SymbolDTO, BundleSummaryDTO } from '../types/cockpit';

const mapStatus = (status: string): FileStatus => {
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
};

const mapScope = (sha: string): CommitDTO['scope'] => {
  const parsed = parseWorkspaceSha(sha);
  if (parsed) return parsed.mode;
  return 'history';
};

async function getRepoContext(): Promise<Pick<CockpitState, 'repoName' | 'branchName'>> {
  let repoName: string | null = null;
  let branchName: string | null = null;
  try {
    const { getGitRoot } = await import('../utils/config');
    const gitRoot = getGitRoot();
    if (gitRoot) {
      const path = await import('path');
      repoName = path.basename(gitRoot);
      const { GitOperations } = await import('../analysis/git');
      try {
        const git = new GitOperations();
        branchName = await git.getCurrentBranch();
      } catch {
        // best-effort branch lookup
      }
    }
  } catch {
    // ignore
  }
  return { repoName, branchName };
}

export async function updateWorkspaceFilesState(
  orchestrator: CockpitOrchestrator,
  commitsProvider: CommitsProvider,
  reason = 'workspace:update'
): Promise<void> {
  if (!commitsProvider) return;
  const workspaceFiles = await Promise.resolve(commitsProvider.exportWorkspaceFilesDto());
  const selection = commitsProvider.exportSelectionDto();

  const stagedFiles: StagedFileDTO[] = workspaceFiles.staged.map((file: { path: string; status: string }) => ({
    path: file.path,
    status: mapStatus(file.status)
  }));
  const unstagedFiles: UnstagedFileDTO[] = workspaceFiles.unstaged.map((file: { path: string; status: string }) => ({
    path: file.path,
    status: mapStatus(file.status)
  }));

  const stagedPaths = new Set(stagedFiles.map((file) => file.path));
  const unstagedPaths = new Set(unstagedFiles.map((file) => file.path));
  const selectedFiles = selection.selectedFiles || [];

  orchestrator.updateState(
    {
      stagedFiles,
      unstagedFiles,
      selectedStagedPaths: selectedFiles.filter((path: string) => stagedPaths.has(path)),
      selectedUnstagedPaths: selectedFiles.filter((path: string) => unstagedPaths.has(path)),
      selectedFiles: selection.selectedFiles,
      workspaceScope: selection.workspaceScope
    },
    reason
  );
}

export async function updateCommitsState(
  orchestrator: CockpitOrchestrator,
  commitsProvider: CommitsProvider,
  activeBundleProvider: ActiveBundleProvider,
  reason = 'commits:update'
): Promise<void> {
  if (!commitsProvider) return;
  await commitsProvider.initializeDatabase();

  const currentState = orchestrator.getState();
  const { getExtensionConfig } = await import('../utils/config');
  const config = getExtensionConfig();
  const baseLimit = config.defaultCommitCount;
  const requestedLimit = currentState.lastNCommits || baseLimit;
  const effectiveLimit = Math.max(baseLimit, requestedLimit);

  const [commits, selection, workspaceFiles] = await Promise.all([
    commitsProvider.exportCommitsDto(effectiveLimit + commitsProvider.loadMoreOffset),
    Promise.resolve(commitsProvider.exportSelectionDto()),
    Promise.resolve(commitsProvider.exportWorkspaceFilesDto())
  ]);

  const stagedFiles: StagedFileDTO[] = workspaceFiles.staged.map((file: { path: string; status: string }) => ({
    path: file.path,
    status: mapStatus(file.status)
  }));
  const unstagedFiles: UnstagedFileDTO[] = workspaceFiles.unstaged.map((file: { path: string; status: string }) => ({
    path: file.path,
    status: mapStatus(file.status)
  }));

  const stagedPaths = new Set(stagedFiles.map((file) => file.path));
  const unstagedPaths = new Set(unstagedFiles.map((file) => file.path));
  const selectedFiles = selection.selectedFiles || [];

  const bundleShaSet = new Set(activeBundleProvider?.exportBundleFacts?.()?.bundle?.shas ?? []);

  const { getDatabaseManager } = await import('../storage/database');
  const { ANALYSIS_VERSION } = await import('../storage/schema');
  const db = getDatabaseManager().getDatabase();
  const analyzedStatuses = await Promise.all(
    commits.map(async (commit: any) => {
      // Check if commit is analyzed by querying commits_analysis table
      const result = db.prepare('SELECT COUNT(*) as count FROM commits_analysis WHERE sha = ? AND analysis_version = ? AND status = ?').get(commit.sha, ANALYSIS_VERSION, 'complete');
      return {
        sha: commit.sha,
        analyzed: (result as any)?.count > 0
      };
    })
  );
  const analyzedMap = new Map(analyzedStatuses.map((s) => [s.sha, s.analyzed]));

  const commitDtos: CommitDTO[] = commits.map((commit: any) => {
    const files = Array.isArray(commit.files)
      ? commit.files.map((file: any) => ({ path: file.path, status: mapStatus(file.status) }))
      : undefined;

    const scope = mapScope(commit.sha);

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
      analyzed: scope === 'history' ? (analyzedMap.get(commit.sha) || false) : false
    };
  });

  orchestrator.updateState(
    {
      ...(await getRepoContext()),
      commits: commitDtos,
      selectedCommitShas: selection.selectedCommitShas,
      selectedStagedPaths: selectedFiles.filter((path: string) => stagedPaths.has(path)),
      selectedUnstagedPaths: selectedFiles.filter((path: string) => unstagedPaths.has(path)),
      selectedFiles: selection.selectedFiles,
      hasMoreCommits: commitDtos.length >= baseLimit,
      commitsFilterText: currentState.commitsFilterText ?? '',
      commitsFilterScopes: currentState.commitsFilterScopes ?? { staged: true, unstaged: true, history: true },
      lastNCommits: currentState.lastNCommits ?? 20,
      workspaceScope: selection.workspaceScope,
      stagedFiles,
      unstagedFiles
    },
    reason
  );
}

export async function updateBundleState(
  orchestrator: CockpitOrchestrator,
  activeBundleProvider: ActiveBundleProvider,
  reason = 'bundle:update'
): Promise<void> {
  if (!activeBundleProvider) return;
  const bundleFacts = activeBundleProvider.exportBundleFacts();
  const bundleSummary: BundleSummaryDTO | null = bundleFacts
    ? {
      id: bundleFacts.bundle?.newestSha || bundleFacts.bundle?.oldestSha || 'bundle',
      commitCount: bundleFacts.bundle?.shas?.length ?? 0,
      fileCount: bundleFacts.scope?.files ?? (bundleFacts.evidence?.['bundle.files']?.length ?? 0),
      symbolCount: bundleFacts.working?.symbols ?? 0,
      createdAt: bundleFacts.generated_at
    }
    : null;
  orchestrator.updateState({ bundleFacts, bundleSummary, metrics: orchestrator.metrics }, reason);
}

export async function updateSymbolsState(
  orchestrator: CockpitOrchestrator,
  symbolHistoryProvider: SymbolHistoryProvider,
  reason = 'symbols:update'
): Promise<void> {
  if (!symbolHistoryProvider?.exportRecentSymbols) return;
  const currentState = orchestrator.getState();
  const symbols = await symbolHistoryProvider.exportRecentSymbols(
    50,
    currentState.symbolFilterText || undefined,
    currentState.symbolKindFilter !== 'all' ? currentState.symbolKindFilter : undefined,
    currentState.symbolChangeFilter !== 'all' ? currentState.symbolChangeFilter : undefined
  );
  const symbolDtos: SymbolDTO[] = symbols.map((symbol: any) => {
    const changeType: 'added' | 'modified' | 'removed' | undefined = symbol.change_type || symbol.changeType || undefined;
    return {
      id: `${symbol.path}:${symbol.name}`,
      name: symbol.name,
      path: symbol.path,
      kind: symbol.kind,
      language: symbol.language || '',
      changeType: changeType as 'added' | 'modified' | 'removed' | undefined,
      commitCount: symbol.commitCount ?? 1,
      lastChangedAt: symbol.date || ''
    };
  });
  orchestrator.updatePartial('symbols', symbolDtos, reason);
}

export async function updateReportsState(
  orchestrator: CockpitOrchestrator,
  reason = 'reports:update'
): Promise<void> {
  try {
    const reportService = await getReportService();
    const state = orchestrator.getState();

    const reports = await reportService.exportReportsDto(
      state.reportsFilterText,
      state.reportsBranchFilter,
      state.reportsShowPinnedOnly
    );

    orchestrator.updateState({ reports }, reason);
  } catch (error) {
    logError('Failed to update reports state', error);
  }
}

export async function refreshCockpitState(
  orchestrator: CockpitOrchestrator,
  providers: {
    commitsProvider: CommitsProvider;
    activeBundleProvider: ActiveBundleProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
  },
  reason = 'refresh:all'
): Promise<void> {
  await Promise.all([
    updateCommitsState(orchestrator, providers.commitsProvider, providers.activeBundleProvider, `${reason}:commits`),
    updateBundleState(orchestrator, providers.activeBundleProvider, `${reason}:bundle`),
    updateSymbolsState(orchestrator, providers.symbolHistoryProvider, `${reason}:symbols`),
    updateReportsState(orchestrator, `${reason}:reports`),
    updateWorkspaceFilesState(orchestrator, providers.commitsProvider, `${reason}:workspace`)
  ]);
}

export async function updateContexts(): Promise<void> {
  try {
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();

    await vscode.commands.executeCommand('setContext', 'gitContext.hasActiveBundle', !!state.bundleFacts);
    const hasSelection = state.selectedCommitShas.length > 0;
    await vscode.commands.executeCommand('setContext', 'gitContext.hasSelection', hasSelection);
  } catch (error) {
    logError('Failed to update context keys', error);
  }
}