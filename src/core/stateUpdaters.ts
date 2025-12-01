import * as vscode from 'vscode';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { CockpitOrchestrator } from '../state/cockpitOrchestrator';
import { getStore } from '../state/store';
import { logError } from '../utils/logger';

/**
 * @deprecated Use store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'commits' } })
 */
export async function updateWorkspaceFilesState(
  _orchestrator: CockpitOrchestrator,
  _commitsProvider: CommitsProvider,
  _reason = 'workspace:update'
): Promise<void> {
  getStore().dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'commits' } });
}

/**
 * @deprecated Use store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'commits' } })
 */
export async function updateCommitsState(
  _orchestrator: CockpitOrchestrator,
  _commitsProvider: CommitsProvider,
  _activeBundleProvider: ActiveBundleProvider,
  _reason = 'commits:update'
): Promise<void> {
  getStore().dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'commits' } });
}

/**
 * @deprecated Use store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'bundle' } })
 */
export async function updateBundleState(
  _orchestrator: CockpitOrchestrator,
  _activeBundleProvider: ActiveBundleProvider,
  _reason = 'bundle:update'
): Promise<void> {
  getStore().dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'bundle' } });
}

/**
 * @deprecated Use store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'symbols' } })
 */
export async function updateSymbolsState(
  _orchestrator: CockpitOrchestrator,
  _symbolHistoryProvider: SymbolHistoryProvider,
  _reason = 'symbols:update'
): Promise<void> {
  getStore().dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'symbols' } });
}

/**
 * @deprecated Use store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'reports' } })
 */
export async function updateReportsState(
  _orchestrator: CockpitOrchestrator,
  _reason = 'reports:update'
): Promise<void> {
  getStore().dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'reports' } });
}

/**
 * @deprecated Use store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'all' } })
 */
export async function refreshCockpitState(
  _orchestrator: CockpitOrchestrator,
  _providers: {
    commitsProvider: CommitsProvider;
    activeBundleProvider: ActiveBundleProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
  },
  _reason = 'refresh:all'
): Promise<void> {
  getStore().dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'all' } });
}

export async function updateContexts(): Promise<void> {
  try {
    const { getCockpitOrchestrator } = await import('../state/cockpitOrchestrator');
    const orchestrator = getCockpitOrchestrator();
    const state = orchestrator.getState();

    await vscode.commands.executeCommand(
      'setContext',
      'gitContext.hasActiveBundle',
      !!state.bundleFacts
    );
    const hasSelection = state.selectedCommitShas.length > 0;
    await vscode.commands.executeCommand('setContext', 'gitContext.hasSelection', hasSelection);
  } catch (error) {
    logError('Failed to update context keys', error);
  }
}
