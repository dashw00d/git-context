import * as vscode from 'vscode';
import type { CommitTrackerProvider } from './ui/commitTracker';
import type { SymbolHistoryProvider } from './ui/symbolHistory';

let commitTrackerProvider: CommitTrackerProvider;
let symbolHistoryProvider: SymbolHistoryProvider;
let outputChannel: vscode.OutputChannel;
let debugChannel: vscode.OutputChannel;

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

export async function activate(context: vscode.ExtensionContext) {
  try {
    outputChannel = vscode.window.createOutputChannel('Git Context');
    debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
    outputChannel.appendLine('[ACTIVATION] Git Context extension is activating...');
    console.log('Git Context extension is activating...');

    // Dynamically import providers and commands to prevent load-time errors
    // from native dependencies or ESM issues
    const { CommitTrackerProvider } = await import('./ui/commitTracker');
    const { SymbolHistoryProvider } = await import('./ui/symbolHistory');
    const { registerCommands } = await import('./ui/commands');
    const { RefactorReportProvider } = await import('./webview/refactorReportProvider');
    const { getDebtMeter, disposeDebtMeter } = await import('./ui/refactorDebtMeter');

    console.log('Modules loaded successfully');

    // Initialize providers
    commitTrackerProvider = new CommitTrackerProvider(context);
    symbolHistoryProvider = new SymbolHistoryProvider(context);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('commitTracker', commitTrackerProvider);
    vscode.window.registerTreeDataProvider('symbolHistory', symbolHistoryProvider);

    // Register webview provider for refactor reports
    const refactorReportProvider = new RefactorReportProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        RefactorReportProvider.viewType,
        refactorReportProvider
      )
    );

    // Register evidence provider for markdown links
    const { EvidenceProvider } = await import('./ui/evidenceProvider');
    const evidenceProvider = new EvidenceProvider();
    context.subscriptions.push(
      vscode.workspace.registerTextDocumentContentProvider('evidence', evidenceProvider)
    );

    // Initialize debt meter
    const debtMeter = getDebtMeter();
    context.subscriptions.push({
      dispose: () => disposeDebtMeter()
    });

    // Set up file watcher for database auto-refresh
    const { getGitRoot } = await import('./utils/config');
    const gitRoot = getGitRoot();
    if (gitRoot) {
      const dbPath = vscode.Uri.file(`${gitRoot}/.git/commit-tracker/commit_tracker.db`);
      const dbWatcher = vscode.workspace.createFileSystemWatcher(dbPath.fsPath);

      // Debounce rapid file changes to avoid excessive refreshes
      // This prevents SQLITE_IOERR from concurrent access
      let refreshTimeout: NodeJS.Timeout | null = null;

      // Refresh UI when database changes (with defensive checks)
      const refreshUI = () => {
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
            if (commitTrackerProvider) {
              commitTrackerProvider.refresh();
            }
            if (symbolHistoryProvider) {
              symbolHistoryProvider.refresh();
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
                  console.debug('Debt meter update skipped (no facts file):', err);
                });
              }
            }
          } catch (error) {
            // Gracefully handle any errors during refresh
            console.warn('Error refreshing UI after database change:', error);
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
    }

    // Register commands
    registerCommands(context, commitTrackerProvider, symbolHistoryProvider, refactorReportProvider);

    // Refresh providers when workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (commitTrackerProvider) {
          commitTrackerProvider.refresh();
        }
        if (symbolHistoryProvider) {
          symbolHistoryProvider.refresh();
        }
      })
    );

    console.log('Git Context extension activated successfully');
  } catch (error) {
    console.error('Failed to activate Git Context extension:', error);
    // This is the critical part: show the error to the user!
    vscode.window.showErrorMessage(
      `Git Context extension failed to activate. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deactivate() {
  console.log('Git Context extension is now deactivated!');

  // Cleanup: Close database connection
  try {
    const { closeDatabase } = require('./storage/database');
    closeDatabase();
  } catch (error) {
    console.error('Error closing database:', error);
  }
}
