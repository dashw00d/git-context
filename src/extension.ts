import * as vscode from 'vscode';
import { logInfo, logDebug, logError } from './utils/logger';
import type { ActiveBundleProvider } from './providers/activeBundleProvider';
import type { CommitsProvider } from './providers/commitsProvider';
import type { SymbolHistoryProvider } from './providers/symbolHistoryProvider';
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
  try {
    const { getReportService } = await import('./services/reportService');
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
    // Use orchestrator state (single source of truth)
    const hasSelection = orchestrator.getState().selectedCommitShas.length > 0;
    await vscode.commands.executeCommand('setContext', 'gitContext.hasSelection', hasSelection);
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
    const { registerCommands } = await import('./commands/commands');
    const { RefactorReportProvider } = await import('./webview/reports/refactorReportProvider');
    const { CockpitProvider } = await import('./webview/cockpit/CockpitProvider');

    logDebug('Modules loaded successfully');

    // Initialize providers
    activeBundleProvider = new ActiveBundleProvider(context);
    commitsProvider = new CommitsProvider(context, activeBundleProvider);
    symbolHistoryProvider = new SymbolHistoryProvider(context);
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

    // LEGACY: Tree data providers (deprecated in favor of Cockpit UI)
    // Keeping providers for data export but not registering tree views
    // vscode.window.registerTreeDataProvider('bundle', activeBundleProvider);
    // vscode.window.registerTreeDataProvider('commits', commitsProvider);
    // vscode.window.registerTreeDataProvider('symbols', symbolHistoryProvider);

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

    // LEGACY: Tree provider change listeners (deprecated)
    // commitsProvider.onDidChangeTreeData(async () => {
    //   await updateCommitsState('commits:treeChange');
    // });
    // activeBundleProvider.onDidChangeTreeData(async () => {
    //   await updateBundleState('bundle:treeChange');
    // });
    // symbolHistoryProvider.onDidChangeTreeData(async () => {
    //   await updateSymbolsState('symbols:treeChange');
    // });
    // reportsProvider.onDidChangeTreeData(async () => {
    //   await updateReportsState('reports:treeChange');
    // });
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

      // Ensure database is initialized first
      const { ensureDatabaseInitialized, getDatabaseManager } = await import('./storage/database');
      await ensureDatabaseInitialized();

      const { getAnalysisPipeline } = await import('./analysis/pipeline');
      const pipeline = await getAnalysisPipeline();
      const { getExtensionConfig } = await import('./utils/config');
      const config = getExtensionConfig();

      // Check if database has any commits
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


    // Watcher management
    let dbWatcher: vscode.FileSystemWatcher | undefined;
    let factsWatcher: vscode.FileSystemWatcher | undefined;
    let refreshTimeout: NodeJS.Timeout | null = null;
    let factsRefreshTimeout: NodeJS.Timeout | null = null;

    const setupWatchers = async () => {
      // Dispose existing watchers
      if (dbWatcher) {
        dbWatcher.dispose();
        dbWatcher = undefined;
      }
      if (factsWatcher) {
        factsWatcher.dispose();
        factsWatcher = undefined;
      }

      const { getGitRoot } = await import('./utils/config');
      const gitRoot = getGitRoot();

      if (!gitRoot) {
        return;
      }

      // Set up file watcher for database auto-refresh
      const dbPathPattern = new vscode.RelativePattern(
        vscode.Uri.file(gitRoot),
        '.git/commit-tracker/commit_tracker.db'
      );
      dbWatcher = vscode.workspace.createFileSystemWatcher(dbPathPattern);

      // Refresh UI when database changes (with defensive checks)
      const refreshUI = () => {
        // Get gitRoot dynamically in case workspace changed
        const currentGitRoot = getGitRoot();
        if (!currentGitRoot) {
          return; // No git root available
        }

        const dbPath = vscode.Uri.file(`${currentGitRoot}/.git/commit-tracker/commit_tracker.db`);

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
            // Refresh reports via orchestrator
            updateReportsState('db:facts').catch(err => {
              logError('Failed to update reports state', err);
            });
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

      // Set up file watcher for facts file to auto-refresh tree
      const factsPathPattern = new vscode.RelativePattern(
        vscode.Uri.file(gitRoot),
        '.git/commit-tracker/last-bundle-facts.json'
      );
      factsWatcher = vscode.workspace.createFileSystemWatcher(factsPathPattern);

      const refreshTreeOnFactsUpdate = () => {
        // Debounce rapid changes
        if (factsRefreshTimeout) {
          clearTimeout(factsRefreshTimeout);
        }

        factsRefreshTimeout = setTimeout(() => {
          try {
            // Get gitRoot dynamically in case workspace changed
            const currentGitRoot = getGitRoot();
            if (!currentGitRoot) {
              return; // No git root available
            }

            // Refresh bundle provider to pick up latest facts
            if (activeBundleProvider) {
              activeBundleProvider.refresh();
            }
            if (commitsProvider) {
              commitsProvider.refresh();
            }
            // Refresh reports
            updateReportsState('facts:update').catch(err => {
              logError('Failed to update reports state', err);
            });
          } catch (error) {
            logError('Error refreshing tree after facts update', error);
          }
          factsRefreshTimeout = null;
        }, 200); // 200ms debounce for facts updates
      };

      factsWatcher.onDidChange(refreshTreeOnFactsUpdate);
      factsWatcher.onDidCreate(refreshTreeOnFactsUpdate);
    };

    // Initial setup
    await setupWatchers();

    // Clean up timeout on deactivation
    context.subscriptions.push({
      dispose: () => {
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
          refreshTimeout = null;
        }
        if (factsRefreshTimeout) {
          clearTimeout(factsRefreshTimeout);
          factsRefreshTimeout = null;
        }
        if (dbWatcher) {
          dbWatcher.dispose();
        }
        if (factsWatcher) {
          factsWatcher.dispose();
        }
      }
    });

    // Register commands
    await registerCommands(context, commitsProvider, activeBundleProvider, symbolHistoryProvider, refactorReportProvider);

    // Refresh providers when workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        // Re-setup watchers for new workspace structure
        await setupWatchers();

        if (activeBundleProvider) {
          activeBundleProvider.refresh();
        }
        if (commitsProvider) {
          commitsProvider.refresh();
        }
        if (symbolHistoryProvider) {
          symbolHistoryProvider.refresh();
        }
        updateReportsState('workspace:change').catch(err => {
          logError('Failed to update reports state', err);
        });
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
