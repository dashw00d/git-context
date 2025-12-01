import * as vscode from 'vscode';
import { AppShell } from '../core/appShell';
import { refreshCockpitState } from '../core/stateUpdaters';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { GitCommitWatcher } from '../watchers/gitCommitWatcher';

// Store providers globally for the git watcher callback
let globalProviders: {
  commitsProvider: CommitsProvider;
  activeBundleProvider: ActiveBundleProvider;
  symbolHistoryProvider: SymbolHistoryProvider;
} | null = null;

export function setGlobalProviders(providers: {
  commitsProvider: CommitsProvider;
  activeBundleProvider: ActiveBundleProvider;
  symbolHistoryProvider: SymbolHistoryProvider;
}) {
  globalProviders = providers;
}

export async function registerGitWatcherFeature(
  shell: AppShell,
  context: vscode.ExtensionContext
): Promise<void> {
  const orchestrator = shell.getOrchestrator();
  const pipeline = await shell.getPipeline();

  const watcher = new GitCommitWatcher(pipeline, orchestrator, async sha => {
    if (globalProviders) {
      await refreshCockpitState(orchestrator, globalProviders, 'git:commit');
    }
  });
  await watcher.start();

  // Register the watcher directly as a disposable
  context.subscriptions.push(watcher);
}
