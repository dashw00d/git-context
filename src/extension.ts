import * as vscode from 'vscode';
import { logInfo, logDebug, logError } from './utils/logger';
import type { ActiveBundleProvider } from './providers/activeBundleProvider';
import type { CommitsProvider } from './providers/commitsProvider';
import type { SymbolHistoryProvider } from './providers/symbolHistoryProvider';
import type { ReportsProvider } from './providers/reportsProvider';
import type { CockpitProvider } from './webview/cockpit/CockpitProvider';
import { getCockpitOrchestrator } from './state/cockpitOrchestrator';
import { LiveDiffTracker } from './liveTracker';
import type {
  BundleSummaryDTO,
  CockpitState,
  CommitDTO,
  FileStatus,
  ReportDTO,
  StagedFileDTO,
  SymbolDTO,
  UnstagedFileDTO
} from './types/cockpit';

let activeBundleProvider: ActiveBundleProvider;
let commitsProvider: CommitsProvider;
let symbolHistoryProvider: SymbolHistoryProvider;
let reportsProvider: ReportsProvider;
let outputChannel: vscode.OutputChannel;
let debugChannel: vscode.OutputChannel;
let cockpitProvider: CockpitProvider | undefined;

const orchestrator = getCockpitOrchestrator();
let workspaceRefreshTimeout: NodeJS.Timeout | null = null;

async function getRepoContext(): Promise<Pick<CockpitState, 'repoName' | 'branchName'>> {
  let repoName: string | null = null;
  let branchName: string | null = null;
  try {
    const { getGitRoot } = await import('./utils/config');
    const gitRoot = getGitRoot();
    if (gitRoot) {
      const path = await import('path');
      repoName = path.basename(gitRoot);
      const { promisify } = await import('util');
      const { exec } = await import('child_process');
      const execAsync = promisify(exec);
      try {
        const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
          cwd: gitRoot,
          encoding: 'utf8',
          timeout: 2000
        });
        branchName = stdout.trim();
      } catch {
        // best-effort branch lookup
      }
    }
  } catch {
    // ignore
  }
  return { repoName, branchName };
}

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

async function updateWorkspaceFilesState(reason = 'workspace:update') {
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

async function updateCommitsState(reason = 'commits:update') {
  if (!commitsProvider) return;
  await commitsProvider.initializeDatabase();

  const currentState = orchestrator.getState();
  const { getExtensionConfig } = await import('./utils/config');
  const config = getExtensionConfig();
  const baseLimit = config.defaultCommitCount || 20;

  const [commits, selection, workspaceFiles] = await Promise.all([
    commitsProvider.exportCommitsDto(baseLimit + commitsProvider.loadMoreOffset),
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

  const { getAnalysisPipeline } = await import('./analysis/pipeline');
  const pipeline = await getAnalysisPipeline();
  const analyzedStatuses = await Promise.all(
    commits.map(async (commit: any) => ({
      sha: commit.sha,
      analyzed: await pipeline.isCommitAnalyzed(commit.sha)
    }))
  );
  const analyzedMap = new Map(analyzedStatuses.map((s) => [s.sha, s.analyzed]));

  const commitDtos: CommitDTO[] = commits.map((commit: any) => ({
    sha: commit.sha,
    shortSha: (commit.sha || '').slice(0, 8),
    message: commit.message,
    author: commit.author || 'Unknown',
    authoredAt: commit.date || '',
    changes: typeof commit.changes === 'number' ? commit.changes : 0,
    inBundle: bundleShaSet.has(commit.sha),
    scope: 'history',
    analyzed: analyzedMap.get(commit.sha) || false
  }));

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

async function updateBundleState(reason = 'bundle:update') {
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

async function updateSymbolsState(reason = 'symbols:update') {
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

async function updateReportsState(reason = 'reports:update') {
  if (!reportsProvider?.exportReportsDto) return;
  const currentState = orchestrator.getState();
  const reports = await reportsProvider.exportReportsDto(
    currentState.reportsFilterText || undefined,
    currentState.reportsBranchFilter !== 'all' ? currentState.reportsBranchFilter : undefined,
    currentState.reportsShowPinnedOnly
  );
  const reportDtos: ReportDTO[] = reports.map((report: any) => ({
    id: report.id,
    title: report.title,
    summary: report.summary,
    createdAt: report.createdAt,
    branch: report.branch,
    pinned: report.pinned,
    bundleSummary: report.bundleSummary
  }));
  orchestrator.updateState(
    {
      reports: reportDtos,
      bundleReportId: reportDtos.length > 0 ? reportDtos[0].id : currentState.bundleReportId ?? null
    },
    reason
  );
}

async function refreshCockpitState(reason = 'refresh:all') {
  await Promise.all([
    updateCommitsState(`${reason}:commits`),
    updateBundleState(`${reason}:bundle`),
    updateSymbolsState(`${reason}:symbols`),
    updateReportsState(`${reason}:reports`),
    updateWorkspaceFilesState(`${reason}:workspace`)
  ]);
}

export async function updateContexts() {
  try {
    await vscode.commands.executeCommand('setContext', 'gitContext.hasActiveBundle', !!activeBundleProvider?.lastBundleFacts);
    await vscode.commands.executeCommand('setContext', 'gitContext.hasSelection', commitsProvider?.selectedCommits.size > 0 || false);
  } catch (error) {
    logError('Failed to update context keys', error);
  }
}

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Git Context');
  }
  return outputChannel;
}

export function getDebugChannel(): vscode.OutputChannel {
  if (!debugChannel) {
    debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
  }
  return debugChannel;
}

export { refreshCockpitState };

export function getCockpitProvider(): CockpitProvider | undefined {
  return cockpitProvider;
}

async function updateContextKeys() {
  await updateContexts();
}


export async function activate(context: vscode.ExtensionContext) {
  try {
    outputChannel = vscode.window.createOutputChannel('Git Context');
    debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
    outputChannel.appendLine('[ACTIVATION] Git Context extension is activating...');
    logInfo('Git Context extension is activating...');

    // Dynamically import providers and commands to prevent load-time errors
    // from native dependencies or ESM issues
    const { ActiveBundleProvider } = await import('./providers/activeBundleProvider');
    const { CommitsProvider } = await import('./providers/commitsProvider');
    const { SymbolHistoryProvider } = await import('./providers/symbolHistoryProvider');
    const { ReportsProvider } = await import('./providers/reportsProvider');
    const { registerCommands } = await import('./commands/commands');
    const { RefactorReportProvider } = await import('./webview/reports/refactorReportProvider');
    const { getDebtMeter, disposeDebtMeter } = await import('./providers/legacy/refactorDebtMeter');
    const { CockpitProvider } = await import('./webview/cockpit/CockpitProvider');

    logDebug('Modules loaded successfully');

    // Initialize providers
    activeBundleProvider = new ActiveBundleProvider(context);
    commitsProvider = new CommitsProvider(context, activeBundleProvider);
    symbolHistoryProvider = new SymbolHistoryProvider(context);
    reportsProvider = new ReportsProvider(context);
    cockpitProvider = new CockpitProvider(context.extensionUri);

    // Initialize LiveDiffTracker
    const liveTracker = new LiveDiffTracker();
    context.subscriptions.push(liveTracker);

    // Initialize LiveAnalysisEngine
    const { LiveAnalysisEngine } = await import('./analysis/liveAnalysis');
    const liveAnalysisEngine = new LiveAnalysisEngine(liveTracker, orchestrator);

    // Register live analysis command
    context.subscriptions.push(
      vscode.commands.registerCommand('git-context.live.thresholdReached', async (data: { uri: string; linesChanged: number; editCount: number }) => {
        logDebug(`[Extension] Live threshold reached for ${data.uri}`);

        // Update state to show tracking
        orchestrator.updateLiveState({
          isTracking: true,
          pendingChanges: liveTracker.hasPendingChanges().files,
          totalEdits: data.editCount,
          status: 'analyzing'
        });

        // Trigger analysis
        await liveAnalysisEngine.analyze();
      })
    );

    // Register tree data providers
    vscode.window.registerTreeDataProvider('bundle', activeBundleProvider);
    vscode.window.registerTreeDataProvider('commits', commitsProvider);
    vscode.window.registerTreeDataProvider('symbols', symbolHistoryProvider);
    vscode.window.registerTreeDataProvider('reports', reportsProvider);

    // Initialize context keys
    await updateContextKeys();

    // Register webview provider for refactor reports
    const refactorReportProvider = new RefactorReportProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        RefactorReportProvider.viewType,
        refactorReportProvider
      )
    );
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('cockpit', cockpitProvider)
    );

    commitsProvider.onDidChangeTreeData(async () => {
      await updateCommitsState('commits:treeChange');
    });
    activeBundleProvider.onDidChangeTreeData(async () => {
      await updateBundleState('bundle:treeChange');
    });
    symbolHistoryProvider.onDidChangeTreeData(async () => {
      await updateSymbolsState('symbols:treeChange');
    });
    reportsProvider.onDidChangeTreeData(async () => {
      await updateReportsState('reports:treeChange');
    });
    // Lightweight working directory watcher (debounced)
    const scheduleWorkspaceRefresh = (reason: string) => {
      if (workspaceRefreshTimeout) {
        clearTimeout(workspaceRefreshTimeout);
      }
      workspaceRefreshTimeout = setTimeout(() => {
        updateWorkspaceFilesState(reason).catch((error) => logError('[Cockpit] Workspace refresh failed', error));
        workspaceRefreshTimeout = null;
      }, 300);
    };
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(() => scheduleWorkspaceRefresh('workspace:textChange')),
      vscode.workspace.onDidSaveTextDocument(() => scheduleWorkspaceRefresh('workspace:save'))
    );

    // Auto-load initial commits on activation
    try {
      logInfo('[Cockpit] Checking if initial commits need to be loaded...');
      const { getAnalysisPipeline } = await import('./analysis/pipeline');
      const pipeline = await getAnalysisPipeline();
      const { getExtensionConfig } = await import('./utils/config');
      const config = getExtensionConfig();

      // Check if database has any commits
      const { getDatabaseManager } = await import('./storage/database');
      const db = getDatabaseManager().getDatabase();
      const result = db.prepare('SELECT COUNT(*) as count FROM commits_metadata').get() as { count: number };

      if (result.count === 0) {
        logInfo(`[Cockpit] Database is empty, loading initial ${config.defaultCommitCount} commits...`);
        await pipeline.loadRecentCommits(config.defaultCommitCount);
        commitsProvider.refresh(); // This will trigger orchestrator updates
        logInfo('[Cockpit] Initial commits loaded successfully');
      } else {
        logInfo(`[Cockpit] Database already has ${result.count} commits, skipping initial load`);
      }
    } catch (error) {
      logError('[Cockpit] Failed to auto-load initial commits', error);
      // Continue activation even if initial load fails
    }

    // Register evidence provider for markdown links
    const { EvidenceProvider } = await import('./providers/legacy/evidenceProvider');
    const evidenceProvider = new EvidenceProvider();
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('evidence', evidenceProvider)
    );

    // Initialize debt meter and wire it to commits provider
    const debtMeter = getDebtMeter();
    debtMeter.setCommitTracker(commitsProvider);
    context.subscriptions.push({
      dispose: () => disposeDebtMeter()
    });

    // Set up file watcher for database auto-refresh
    const { getGitRoot } = await import('./utils/config');
    const initialGitRoot = getGitRoot();
    if (initialGitRoot) {
      // Use dynamic gitRoot path pattern to handle workspace changes
      const dbPathPattern = new vscode.RelativePattern(
        vscode.Uri.file(initialGitRoot),
        '.git/commit-tracker/commit_tracker.db'
      );
      const dbWatcher = vscode.workspace.createFileSystemWatcher(dbPathPattern);

      // Debounce rapid file changes to avoid excessive refreshes
      // This prevents SQLITE_IOERR from concurrent access
      let refreshTimeout: NodeJS.Timeout | null = null;

      // Refresh UI when database changes (with defensive checks)
      const refreshUI = () => {
        // Get gitRoot dynamically in case workspace changed
        const gitRoot = getGitRoot();
        if (!gitRoot) {
          return; // No git root available
        }

        const dbPath = vscode.Uri.file(`${gitRoot}/.git/commit-tracker/commit_tracker.db`);

        // Check if database file actually exists before refreshing
        const fs = require('fs');
        if (!fs.existsSync(dbPath.fsPath)) {
          return; // Don't refresh if database doesn't exist yet
        }

        // Clear existing timeout to debounce rapid changes
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }

        refreshTimeout = setTimeout(() => {
          try {
            // Only refresh if providers are initialized
            if (activeBundleProvider) {
              activeBundleProvider.refresh();
            }
            if (commitsProvider) {
              commitsProvider.refresh();
            }
            if (symbolHistoryProvider) {
              symbolHistoryProvider.refresh();
            }
            if (reportsProvider) {
              reportsProvider.refresh();
            }

            // Only refresh debt meter if facts file exists (defensive check)
            if (debtMeter) {
              const factsPath = debtMeter.getFactsPath();
              if (factsPath && fs.existsSync(factsPath)) {
                debtMeter.refresh();
              } else {
                // Try to update once to see if facts file now exists
                debtMeter.update().catch(err => {
                  // Silently fail if facts don't exist yet
                  logDebug(`Debt meter update skipped (no facts file): ${err}`);
                });
              }
            }
          } catch (error) {
            // Gracefully handle any errors during refresh
            logError('Error refreshing UI after database change', error);
          }
          refreshTimeout = null;
        }, 100); // 100ms debounce
      };

      dbWatcher.onDidChange(refreshUI);
      dbWatcher.onDidCreate(refreshUI);
      dbWatcher.onDidDelete(refreshUI);

      context.subscriptions.push(dbWatcher);

      // Clean up timeout on deactivation
      context.subscriptions.push({
        dispose: () => {
          if (refreshTimeout) {
            clearTimeout(refreshTimeout);
            refreshTimeout = null;
          }
        }
      });

      // Set up file watcher for facts file to auto-refresh tree
      const factsPathPattern = new vscode.RelativePattern(
        vscode.Uri.file(initialGitRoot),
        '.git/commit-tracker/last-bundle-facts.json'
      );
      const factsWatcher = vscode.workspace.createFileSystemWatcher(factsPathPattern);

      let factsRefreshTimeout: NodeJS.Timeout | null = null;

      const refreshTreeOnFactsUpdate = () => {
        // Debounce rapid changes
        if (factsRefreshTimeout) {
          clearTimeout(factsRefreshTimeout);
        }

        factsRefreshTimeout = setTimeout(() => {
          try {
            // Get gitRoot dynamically in case workspace changed
            const gitRoot = getGitRoot();
            if (!gitRoot) {
              return; // No git root available
            }

            const factsPath = vscode.Uri.file(`${gitRoot}/.git/commit-tracker/last-bundle-facts.json`);

            // Refresh bundle provider to pick up latest facts
            if (activeBundleProvider) {
              activeBundleProvider.refresh();
            }
            if (commitsProvider) {
              commitsProvider.refresh();
            }
            if (reportsProvider) {
              reportsProvider.refresh();
            }
          } catch (error) {
            logError('Error refreshing tree after facts update', error);
          }
          factsRefreshTimeout = null;
        }, 200); // 200ms debounce for facts updates
      };

      factsWatcher.onDidChange(refreshTreeOnFactsUpdate);
      factsWatcher.onDidCreate(refreshTreeOnFactsUpdate);

      context.subscriptions.push(factsWatcher);
      context.subscriptions.push({
        dispose: () => {
          if (factsRefreshTimeout) {
            clearTimeout(factsRefreshTimeout);
            factsRefreshTimeout = null;
          }
        }
      });
    }

    // Register commands
    await registerCommands(context, commitsProvider, activeBundleProvider, symbolHistoryProvider, refactorReportProvider, reportsProvider);

    // Refresh providers when workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (activeBundleProvider) {
          activeBundleProvider.refresh();
        }
        if (commitsProvider) {
          commitsProvider.refresh();
        }
        if (symbolHistoryProvider) {
          symbolHistoryProvider.refresh();
        }
        if (reportsProvider) {
          reportsProvider.refresh();
        }
      })
    );

    // Initial sync after auto-load (or immediate if commits already exist)
    refreshCockpitState().catch((error) => {
      logError('[Cockpit] Failed during initial refresh', error);
      // Show user-friendly message if initial sync fails
      vscode.window.showWarningMessage(
        'Git Context: Failed to load commit data. Try refreshing the view or reloading the window.',
        'Refresh'
      ).then((choice) => {
        if (choice === 'Refresh') {
          commitsProvider.refresh();
        }
      });
    });

    logInfo('Git Context extension activated successfully');
  } catch (error) {
    logError('Failed to activate Git Context extension', error);
    // This is the critical part: show the error to the user!
    vscode.window.showErrorMessage(
      `Git Context extension failed to activate. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deactivate() {
  logInfo('Git Context extension is now deactivated!');

  // Cleanup: Close database connection
  try {
    const { closeDatabase } = require('./storage/database');
    closeDatabase();
  } catch (error) {
    logError('Error closing database', error);
  }
}
