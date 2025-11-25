import * as vscode from 'vscode';
import type { ActiveBundleProvider } from './ui/activeBundleProvider';
import type { CommitsProvider } from './ui/commitsProvider';
import type { SymbolHistoryProvider } from './ui/symbolHistory';
import type { ReportsProvider } from './ui/reportsProvider';

let activeBundleProvider: ActiveBundleProvider;
let commitsProvider: CommitsProvider;
let symbolHistoryProvider: SymbolHistoryProvider;
let reportsProvider: ReportsProvider;
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

async function updateContextKeys() {
  try {
    // Check if there's an active bundle
    const hasActiveBundle = activeBundleProvider?.lastBundleFacts !== null;
    await vscode.commands.executeCommand('setContext', 'gitContext.hasActiveBundle', hasActiveBundle);

    // Check if current selection is in bundle (simplified - could be enhanced)
    const inBundle = false; // TODO: Implement bundle membership checking
    await vscode.commands.executeCommand('setContext', 'gitContext.inBundle', inBundle);

    console.log('Context keys updated:', { hasActiveBundle, inBundle });
  } catch (error) {
    console.error('Failed to update context keys:', error);
  }
}


export async function activate(context: vscode.ExtensionContext) {
  try {
    outputChannel = vscode.window.createOutputChannel('Git Context');
    debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
    outputChannel.appendLine('[ACTIVATION] Git Context extension is activating...');
    console.log('Git Context extension is activating...');

    // Dynamically import providers and commands to prevent load-time errors
    // from native dependencies or ESM issues
    const { ActiveBundleProvider } = await import('./ui/activeBundleProvider');
    const { CommitsProvider } = await import('./ui/commitsProvider');
    const { SymbolHistoryProvider } = await import('./ui/symbolHistory');
    const { ReportsProvider } = await import('./ui/reportsProvider');
    const { registerCommands } = await import('./ui/commands');
    const { RefactorReportProvider } = await import('./webview/refactorReportProvider');
    const { getDebtMeter, disposeDebtMeter } = await import('./ui/refactorDebtMeter');

    console.log('Modules loaded successfully');

    // Initialize providers
    activeBundleProvider = new ActiveBundleProvider(context);
    commitsProvider = new CommitsProvider(context);
    symbolHistoryProvider = new SymbolHistoryProvider(context);
    reportsProvider = new ReportsProvider(context);

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
            console.warn('Error refreshing tree after facts update:', error);
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
    registerCommands(context, commitsProvider, activeBundleProvider, symbolHistoryProvider, refactorReportProvider, reportsProvider);

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
