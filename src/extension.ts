import * as vscode from 'vscode';
import { logInfo, logDebug, logError } from './utils/logger';
import type { ActiveBundleProvider } from './ui/activeBundleProvider';
import type { CommitsProvider } from './ui/commitsProvider';
import type { SymbolHistoryProvider } from './ui/symbolHistory';
import type { ReportsProvider } from './ui/reportsProvider';
import type { CockpitProvider } from './webview/CockpitProvider';
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

async function syncCockpitState() {
  if (!cockpitProvider || !commitsProvider) {
    return;
  }
  try {
    // Ensure database is initialized before trying to export data
    await commitsProvider.initializeDatabase();

    const currentState = cockpitProvider.getState();
    const [commits, selection, bundleFacts, symbols, reports, workspaceFiles] = await Promise.all([
      commitsProvider.exportCommitsDto(
        20 + commitsProvider.loadMoreOffset
      ),
      Promise.resolve(commitsProvider.exportSelectionDto()),
      Promise.resolve(activeBundleProvider?.exportBundleFacts?.() ?? null),
      symbolHistoryProvider?.exportRecentSymbols
        ? symbolHistoryProvider.exportRecentSymbols(
            50,
            currentState.symbolFilterText || undefined,
            currentState.symbolKindFilter !== 'all' ? currentState.symbolKindFilter : undefined,
            currentState.symbolChangeFilter !== 'all' ? currentState.symbolChangeFilter : undefined
          )
        : Promise.resolve([]),
      reportsProvider?.exportReportsDto
        ? reportsProvider.exportReportsDto(
            currentState.reportsFilterText || undefined,
            currentState.reportsBranchFilter !== 'all' ? currentState.reportsBranchFilter : undefined,
            currentState.reportsShowPinnedOnly
          )
        : Promise.resolve([]),
      Promise.resolve(commitsProvider.exportWorkspaceFilesDto())
    ]);

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
          // Silently fail if git command times out or fails
        }
      }
    } catch {
      // best-effort repo/branch detection
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

    const bundleShaSet = new Set(bundleFacts?.bundle?.shas ?? []);

    // Check analyzed status for commits
    const { getAnalysisPipeline } = await import('./analysis/pipeline');
    const pipeline = await getAnalysisPipeline();
    const analyzedStatuses = await Promise.all(
      commits.map(async (commit: any) => ({
        sha: commit.sha,
        analyzed: await pipeline.isCommitAnalyzed(commit.sha)
      }))
    );
    const analyzedMap = new Map(analyzedStatuses.map(s => [s.sha, s.analyzed]));

    // Map commits to DTOs with scope information
    // Note: All commits from the database are 'history' commits.
    // Staged/unstaged are working directory files, not commits.
    // If we need to show virtual commits for staged/unstaged in the future,
    // we would create them here with appropriate scope.
    const commitDtos: CommitDTO[] = commits.map((commit: any) => {
      // Determine scope: all commits from DB are history
      // Future: could check if commit affects staged/unstaged files to tag scope
      const scope: 'staged' | 'unstaged' | 'history' = 'history';
      
      return {
        sha: commit.sha,
        shortSha: (commit.sha || '').slice(0, 8),
        message: commit.message,
        author: commit.author || 'Unknown',
        authoredAt: commit.date || '',
        changes: typeof commit.changes === 'number' ? commit.changes : 0,
        inBundle: bundleShaSet.has(commit.sha),
        scope,
        analyzed: analyzedMap.get(commit.sha) || false
      };
    });

    const bundleSummary: BundleSummaryDTO | null = bundleFacts
      ? {
          id: bundleFacts.bundle?.newestSha || bundleFacts.bundle?.oldestSha || 'bundle',
          commitCount: bundleFacts.bundle?.shas?.length ?? 0,
          fileCount: bundleFacts.scope?.files ?? (bundleFacts.evidence?.['bundle.files']?.length ?? 0),
          symbolCount: bundleFacts.working?.symbols ?? 0,
          createdAt: bundleFacts.generated_at
        }
      : null;

    const symbolDtos: SymbolDTO[] = symbols.map((symbol: any) => {
      // Map change_type from DB to SymbolChangeType
      const changeType: 'added' | 'modified' | 'removed' | undefined = 
        symbol.change_type || symbol.changeType || undefined;
      
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

    const reportDtos: ReportDTO[] = reports.map((report: any) => ({
      id: report.id,
      title: report.title,
      summary: report.summary,
      createdAt: report.createdAt,
      branch: report.branch,
      pinned: report.pinned,
      bundleSummary: report.bundleSummary
    }));

    // Get the latest report ID (reports are sorted by date DESC, so first is latest)
    // Only set if we have bundle facts (active bundle) and reports exist
    const latestReportId = bundleFacts && reportDtos.length > 0 
      ? reportDtos[0].id 
      : (currentState.bundleReportId ?? null);

    const cockpitState: Partial<CockpitState> = {
      repoName,
      branchName,
      commits: commitDtos,
      selectedCommitShas: selection.selectedCommitShas,
      selectedStagedPaths: selectedFiles.filter((path: string) => stagedPaths.has(path)),
      selectedUnstagedPaths: selectedFiles.filter((path: string) => unstagedPaths.has(path)),
      selectedFiles: selection.selectedFiles,
      hasMoreCommits: commitDtos.length >= 20,
      commitsFilterText: currentState.commitsFilterText ?? '',
      commitsFilterScopes: currentState.commitsFilterScopes ?? { staged: true, unstaged: true, history: true },
      lastNCommits: currentState.lastNCommits ?? 20,
      workspaceScope: selection.workspaceScope,
      bundleFacts,
      bundleSummary,
      bundleReportId: latestReportId,
      symbols: symbolDtos,
      symbolFilterText: currentState.symbolFilterText ?? '',
      symbolKindFilter: currentState.symbolKindFilter ?? 'all',
      symbolChangeFilter: currentState.symbolChangeFilter ?? 'all',
      activeSymbolId: currentState.activeSymbolId ?? null,
      activeSymbolHistory: currentState.activeSymbolHistory ?? [],
      reports: reportDtos,
      reportsFilterText: currentState.reportsFilterText ?? '',
      reportsBranchFilter: currentState.reportsBranchFilter ?? 'all',
      reportsShowPinnedOnly: currentState.reportsShowPinnedOnly ?? false,
      stagedFiles,
      unstagedFiles,
      activeSection: currentState.activeSection ?? 'commits',
      isAnalyzing: currentState.isAnalyzing && !bundleFacts ? true : false,
      analysisStep: currentState.isAnalyzing && !bundleFacts ? currentState.analysisStep : undefined,
      analysisProgress: currentState.isAnalyzing && !bundleFacts ? currentState.analysisProgress : undefined
    };

    cockpitProvider.updateState(cockpitState);
    logInfo('[Cockpit] Synced state to webview');
  } catch (error) {
    logError('Failed to sync cockpit state', error);
  }
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

export { syncCockpitState };

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
    const { ActiveBundleProvider } = await import('./ui/activeBundleProvider');
    const { CommitsProvider } = await import('./ui/commitsProvider');
    const { SymbolHistoryProvider } = await import('./ui/symbolHistory');
    const { ReportsProvider } = await import('./ui/reportsProvider');
    const { registerCommands } = await import('./ui/commands');
    const { RefactorReportProvider } = await import('./webview/refactorReportProvider');
    const { getDebtMeter, disposeDebtMeter } = await import('./ui/refactorDebtMeter');
    const { CockpitProvider } = await import('./webview/CockpitProvider');

    logDebug('Modules loaded successfully');

    // Initialize providers
    activeBundleProvider = new ActiveBundleProvider(context);
    commitsProvider = new CommitsProvider(context, activeBundleProvider);
    symbolHistoryProvider = new SymbolHistoryProvider(context);
    reportsProvider = new ReportsProvider(context);
    cockpitProvider = new CockpitProvider(context.extensionUri);

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
      await syncCockpitState();
    });
    activeBundleProvider.onDidChangeTreeData(async () => {
      await syncCockpitState();
    });
    symbolHistoryProvider.onDidChangeTreeData(async () => {
      await syncCockpitState();
    });
    reportsProvider.onDidChangeTreeData(async () => {
      await syncCockpitState();
    });

    // Register evidence provider for markdown links
    const { EvidenceProvider } = await import('./ui/evidenceProvider');
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

    syncCockpitState().catch(() => {
      // Best-effort initial sync; errors are logged in syncCockpitState
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
