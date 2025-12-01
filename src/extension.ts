import * as vscode from 'vscode';
import { AppShell } from './core/appShell';
import { setupFileWatchers } from './core/fileWatchers';
import { registerCockpitFeatures } from './features/cockpitFeatures';
import { registerCoreFeatures } from './features/coreFeatures';
import { registerGitWatcherFeature, setGlobalProviders } from './features/gitWatcherFeature';
import { LiveDiffTracker } from './liveTracker';
import { logDebug, logError, logInfo } from './utils/logger';
import type { ActiveBundleProvider } from './providers/activeBundleProvider';
import type { CommitsProvider } from './providers/commitsProvider';
import type { SymbolHistoryProvider } from './providers/symbolHistoryProvider';
import type { CockpitProvider } from './webview/cockpit/CockpitProvider';

let activeBundleProvider: ActiveBundleProvider;
let commitsProvider: CommitsProvider;
let symbolHistoryProvider: SymbolHistoryProvider;
let outputChannel: vscode.OutputChannel;
let debugChannel: vscode.OutputChannel;
let cockpitProvider: CockpitProvider | undefined;

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

export function getCockpitProvider(): CockpitProvider | undefined {
  return cockpitProvider;
}

export async function activate(context: vscode.ExtensionContext) {
  try {
    outputChannel = vscode.window.createOutputChannel('Git Context');
    debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
    outputChannel.appendLine('[ACTIVATION] Git Context extension is activating...');
    logInfo('Git Context extension is activating...');

    // Initialize AppShell
    const shell = new AppShell(context);

    // Dynamically import providers to prevent load-time errors
    const { ActiveBundleProvider } = await import('./providers/activeBundleProvider');
    const { CommitsProvider } = await import('./providers/commitsProvider');
    const { SymbolHistoryProvider } = await import('./providers/symbolHistoryProvider');
    const { RefactorReportProvider } = await import('./webview/reports/refactorReportProvider');
    const { CockpitProvider } = await import('./webview/cockpit/CockpitProvider');

    logDebug('Modules loaded successfully');

    // Initialize providers
    activeBundleProvider = new ActiveBundleProvider(context);
    commitsProvider = new CommitsProvider(context, activeBundleProvider);
    symbolHistoryProvider = new SymbolHistoryProvider(context);
    cockpitProvider = new CockpitProvider(context.extensionUri);

    // Set global providers for git watcher callback
    setGlobalProviders({
      commitsProvider,
      activeBundleProvider,
      symbolHistoryProvider,
    });

    // Initialize LiveDiffTracker
    const liveTracker = new LiveDiffTracker();

    // Initialize LiveAnalysisEngine
    const { LiveAnalysisEngine } = await import('./analysis/liveAnalysis');
    const liveEngine = new LiveAnalysisEngine(liveTracker, shell.getOrchestrator());

    // Store liveEngine reference for command access
    (shell.getOrchestrator() as any).liveEngine = liveEngine;

    // Subscribe to live tracker events for state synchronization
    liveTracker.on(
      'changesUpdated',
      (data: {
        uri: string;
        pendingChanges: { files: number; totalEdits: number };
        linesChanged?: number;
        symbolCount?: number;
        editCount?: number;
        thresholdReached?: boolean;
      }) => {
        shell.getOrchestrator().updateLiveState(
          {
            pendingChanges: data.pendingChanges.files,
            totalEdits: data.pendingChanges.totalEdits,
            isTracking: true,
          },
          'liveTracker:changesUpdated'
        );
      }
    );

    // Cleanup event listeners on deactivation
    context.subscriptions.push({
      dispose: () => {
        liveTracker.removeAllListeners('changesUpdated');
      },
    });

    context.subscriptions.push(liveTracker);

    // Register webview providers
    const refactorReportProvider = new RefactorReportProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        RefactorReportProvider.viewType,
        refactorReportProvider
      )
    );

    // Register command to show report
    const showReportCommand = vscode.commands.registerCommand(
      'gitContext.showRefactorReport',
      async () => {
        const { getCockpitOrchestrator } = await import('./state/cockpitOrchestrator');
        const orchestrator = getCockpitOrchestrator();
        const { llmOutputs } = orchestrator.getState();

        // Analysis might be nested in llmOutputs (legacy) or directly available
        const analysis = llmOutputs?.llmAnalysis || llmOutputs;

        if (analysis && analysis.markdown) {
          const doc = await vscode.workspace.openTextDocument({
            content: analysis.markdown,
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc, { preview: true });
        } else {
          vscode.window.showInformationMessage('Run an analysis first to view the report.');
        }
      }
    );
    context.subscriptions.push(showReportCommand);

    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider('cockpit', cockpitProvider)
    );

    // Lightweight working directory watcher (debounced)
    let workspaceRefreshTimeout: NodeJS.Timeout | null = null;
    const { updateWorkspaceFilesState } = await import('./core/stateUpdaters');
    const scheduleWorkspaceRefresh = (reason: string) => {
      if (workspaceRefreshTimeout) {
        clearTimeout(workspaceRefreshTimeout);
      }
      workspaceRefreshTimeout = setTimeout(async () => {
        await updateWorkspaceFilesState(shell.getOrchestrator(), commitsProvider, reason);
        workspaceRefreshTimeout = null;
      }, 300);
    };
    context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        // Ignore output channel updates to prevent infinite loops
        if (e.document.uri.scheme === 'output') return;
        scheduleWorkspaceRefresh('workspace:textChange');
      }),
      vscode.workspace.onDidSaveTextDocument(() => scheduleWorkspaceRefresh('workspace:save'))
    );

    // Auto-load initial commits on activation
    try {
      logInfo('[Cockpit] Checking if initial commits need to be loaded...');

      // Ensure database is initialized first
      const { ensureDatabaseInitialized, getDatabaseManager } = await import('./storage/database');
      await ensureDatabaseInitialized();

      // Check for legacy DB issues
      const { auditAllModules } = await import('./storage/schema');
      const db = getDatabaseManager().getDatabase();
      const gaps = auditAllModules(db);
      const hasLegacy = gaps.some(g => g.includes('Legacy edges') || g.includes('legacy'));
      if (hasLegacy) {
        const action = await vscode.window.showWarningMessage(
          'Legacy database detected—run `ct index --reindex` to fix edge_type column',
          'Open Terminal'
        );
        if (action === 'Open Terminal') {
          vscode.commands.executeCommand('workbench.action.terminal.new');
        }
      }

      const { BranchManager } = await import('./storage/branchManager');
      const { getExtensionConfig } = await import('./utils/config');
      const { getDatabaseService } = await import('./services/databaseService');
      const config = getExtensionConfig();

      // Check if database has any commits
      const commitService = getDatabaseService();
      const commitCount = await commitService.countCommits();

      if (commitCount === 0) {
        logInfo(
          `[Cockpit] Database is empty, loading initial ${config.defaultCommitCount} commits...`
        );

        // Load recent commits directly
        const { GitOperations } = await import('./analysis/git');
        const git = new GitOperations();
        const branchManager = new BranchManager(db);
        const recentCommits = await git.getRecentCommits(config.defaultCommitCount);
        const shas = recentCommits.map(c => c.sha);

        // Record commits in branch manager
        const branch = await git.getCurrentBranch();
        if (branch && recentCommits.length > 0) {
          for (const commit of recentCommits) {
            branchManager.recordCommit(commit.sha, branch);
          }
          branchManager.updateBranchHead(branch, recentCommits[0].sha);
        }

        // Index the commits to ensure they're in the database
        const { getRefactorPipeline } = await import('./services/pipelineFactory');
        const refactorPipeline = await getRefactorPipeline();
        await refactorPipeline.indexCommits(shas);

        await commitsProvider.refresh();
        logInfo('[Cockpit] Initial commits loaded successfully');
      } else {
        logInfo(`[Cockpit] Database already has ${commitCount} commits, skipping initial load`);
      }
    } catch (error) {
      logError('[Cockpit] Failed to auto-load initial commits', error);
      // Continue activation even if initial load fails
    }

    // Set up file watchers
    const fileWatchers = setupFileWatchers(
      context,
      {
        activeBundleProvider,
        commitsProvider,
        symbolHistoryProvider,
      },
      shell.getOrchestrator()
    );
    context.subscriptions.push(fileWatchers);

    // Register core features
    await registerCoreFeatures(shell, {
      activeBundleProvider,
      commitsProvider,
      symbolHistoryProvider,
      cockpitProvider,
      refactorReportProvider,
    });

    // Register cockpit-specific features
    await registerCockpitFeatures(shell, {
      activeBundleProvider,
      commitsProvider,
      symbolHistoryProvider,
      refactorReportProvider,
    });

    // Register git watcher feature
    await registerGitWatcherFeature(shell, context);

    // Register debug commands
    context.subscriptions.push(
      vscode.commands.registerCommand('git-context.debug.dumpState', async () => {
        if (!cockpitProvider) {
          vscode.window.showErrorMessage('Cockpit provider not initialized');
          return;
        }
        const state = cockpitProvider.getState();
        const doc = await vscode.workspace.openTextDocument({
          content: JSON.stringify(state, null, 2),
          language: 'json',
        });
        await vscode.window.showTextDocument(doc);
      }),
      vscode.commands.registerCommand('git-context.debug.loadState', async () => {
        if (!cockpitProvider) {
          vscode.window.showErrorMessage('Cockpit provider not initialized');
          return;
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No active editor with state JSON');
          return;
        }
        try {
          const text = editor.document.getText();
          const state = JSON.parse(text);
          cockpitProvider.injectState(state);
          vscode.window.showInformationMessage('Debug state injected successfully');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to parse state JSON: ${error}`);
        }
      }),
      vscode.commands.registerCommand('git-context.debug.openStateLog', async () => {
        const { getStateLogger } = await import('./services/stateLogger');
        const logPath = getStateLogger().getLogPath();
        if (logPath && require('fs').existsSync(logPath)) {
          const doc = await vscode.workspace.openTextDocument(logPath);
          await vscode.window.showTextDocument(doc);
        } else {
          vscode.window.showInformationMessage(
            'State log file not found (it may be empty or not initialized yet).'
          );
        }
      })
    );

    // Refresh providers when workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(async () => {
        // Re-setup watchers for new workspace structure
        const _newWatchers = setupFileWatchers(
          context,
          {
            activeBundleProvider,
            commitsProvider,
            symbolHistoryProvider,
          },
          shell.getOrchestrator()
        );

        if (activeBundleProvider) {
          activeBundleProvider.refresh();
        }
        if (commitsProvider) {
          await commitsProvider.refresh();
        }
        if (symbolHistoryProvider) {
          symbolHistoryProvider.refresh();
        }

        const { updateReportsState } = await import('./core/stateUpdaters');
        updateReportsState(shell.getOrchestrator(), 'workspace:change').catch(err => {
          logError('Failed to update reports state', err);
        });
      })
    );

    // Initial state sync
    const { refreshCockpitState } = await import('./core/stateUpdaters');
    await refreshCockpitState(shell.getOrchestrator(), {
      commitsProvider,
      activeBundleProvider,
      symbolHistoryProvider,
    }).catch(error => {
      logError('[Cockpit] Failed during initial refresh', error);
      vscode.window
        .showWarningMessage(
          'Git Context: Failed to load commit data. Try refreshing the view or reloading the window.',
          'Refresh'
        )
        .then(async choice => {
          if (choice === 'Refresh') {
            await commitsProvider.refresh();
          }
        });
    });

    logInfo('Git Context extension activated successfully');
  } catch (error) {
    logError('Failed to activate Git Context extension', error);
    vscode.window.showErrorMessage(
      `Git Context extension failed to activate. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Pipeline factory moved to src/services/pipelineFactory.ts
// State updaters moved to src/core/stateUpdaters.ts
// File watchers moved to src/core/fileWatchers.ts

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
