import * as vscode from 'vscode';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { CockpitOrchestrator } from '../state/cockpitOrchestrator';
import { logError } from '../utils/logger';

export function setupFileWatchers(
  context: vscode.ExtensionContext,
  providers: {
    activeBundleProvider: ActiveBundleProvider;
    commitsProvider: CommitsProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
  },
  orchestrator: CockpitOrchestrator
): vscode.Disposable {
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

    const { getGitRoot } = await import('../utils/config');
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

      refreshTimeout = setTimeout(async () => {
        try {
          // Only refresh if providers are initialized
          if (providers.activeBundleProvider) {
            providers.activeBundleProvider.refresh();
          }
          if (providers.commitsProvider) {
            await providers.commitsProvider.refresh();
          }
          if (providers.symbolHistoryProvider) {
            await providers.symbolHistoryProvider.refresh();
          }
          // Refresh reports via orchestrator
          const { updateReportsState } = await import('./stateUpdaters');
          updateReportsState(orchestrator, 'db:facts').catch((err: any) => {
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

      factsRefreshTimeout = setTimeout(async () => {
        try {
          // Get gitRoot dynamically in case workspace changed
          const currentGitRoot = getGitRoot();
          if (!currentGitRoot) {
            return; // No git root available
          }

          // Refresh bundle provider to pick up latest facts
          if (providers.activeBundleProvider) {
            providers.activeBundleProvider.refresh();
          }
          if (providers.commitsProvider) {
            await providers.commitsProvider.refresh();
          }
          // Refresh reports
          const { updateReportsState } = await import('./stateUpdaters');
          updateReportsState(orchestrator, 'facts:update').catch((err: any) => {
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
  setupWatchers();

  // Clean up timeout on deactivation
  return {
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
  };
}