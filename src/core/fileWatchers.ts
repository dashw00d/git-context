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

    const dbPathPattern = new vscode.RelativePattern(
      vscode.Uri.file(gitRoot),
      '.git/commit-tracker/commit_tracker.db'
    );
    dbWatcher = vscode.workspace.createFileSystemWatcher(dbPathPattern);

    const refreshUI = () => {
      const currentGitRoot = getGitRoot();
      if (!currentGitRoot) {
        return;
      }

      const dbPath = vscode.Uri.file(`${currentGitRoot}/.git/commit-tracker/commit_tracker.db`);

      const fs = require('fs');
      if (!fs.existsSync(dbPath.fsPath)) {
        return;
      }

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(async () => {
        try {
          if (providers.activeBundleProvider) {
            providers.activeBundleProvider.refresh();
          }
          if (providers.commitsProvider) {
            await providers.commitsProvider.refresh();
          }
          if (providers.symbolHistoryProvider) {
            await providers.symbolHistoryProvider.refresh();
          }

          const { updateReportsState } = await import('./stateUpdaters');
          updateReportsState(orchestrator, 'db:facts').catch((err: any) => {
            logError('Failed to update reports state', err);
          });
        } catch (error) {
          logError('Error refreshing UI after database change', error);
        }
        refreshTimeout = null;
      }, 100);
    };

    dbWatcher.onDidChange(refreshUI);
    dbWatcher.onDidCreate(refreshUI);

    const factsPathPattern = new vscode.RelativePattern(
      vscode.Uri.file(gitRoot),
      '.git/commit-tracker/last-bundle-facts.json'
    );
    factsWatcher = vscode.workspace.createFileSystemWatcher(factsPathPattern);

    const refreshTreeOnFactsUpdate = () => {
      if (factsRefreshTimeout) {
        clearTimeout(factsRefreshTimeout);
      }

      factsRefreshTimeout = setTimeout(async () => {
        try {
          const currentGitRoot = getGitRoot();
          if (!currentGitRoot) {
            return;
          }

          if (providers.activeBundleProvider) {
            providers.activeBundleProvider.refresh();
          }
          if (providers.commitsProvider) {
            await providers.commitsProvider.refresh();
          }

          const { updateReportsState } = await import('./stateUpdaters');
          updateReportsState(orchestrator, 'facts:update').catch((err: any) => {
            logError('Failed to update reports state', err);
          });
        } catch (error) {
          logError('Error refreshing tree after facts update', error);
        }
        factsRefreshTimeout = null;
      }, 200);
    };

    factsWatcher.onDidChange(refreshTreeOnFactsUpdate);
    factsWatcher.onDidCreate(refreshTreeOnFactsUpdate);
  };

  setupWatchers();

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
    },
  };
}
