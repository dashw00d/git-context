import * as vscode from 'vscode';
import { Action } from '../../state/actions';
import { CockpitStateSchema } from '../../state/schemas';
import { getStore } from '../../state/store';
import { CockpitClientMessage, CockpitSectionKey, CockpitState } from '../../types/cockpit';
import { logDebug, logError, logInfo } from '../../utils/logger';
import { AnalysisController } from './services/AnalysisController';
import { BundleManager } from './services/BundleManager';
import { ExplorerController } from './services/ExplorerController';
import { MessageController } from './services/MessageController';

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState;
  private unsubscribe?: () => void;

  // Services & Controllers
  private bundleManager: BundleManager;
  private explorerController?: ExplorerController;
  private analysisController?: AnalysisController;
  private messageController?: MessageController;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.state = getStore().getState(); // Initialize state directly from store
    this.bundleManager = new BundleManager();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.unsubscribe?.();
    // Subscribe to store changes and pass the relevant cockpit state to handleStateChange
    let previousCockpitState = getStore().getState();
    this.unsubscribe = getStore().subscribe(() => {
      const currentCockpitState = getStore().getState();
      // Only trigger handleStateChange if the cockpit state itself has changed
      if (currentCockpitState !== previousCockpitState) {
        // Capture old state for diffing
        const oldState = previousCockpitState;
        // Update reference immediately to prevent infinite recursion if handleStateChange triggers a synchronous dispatch
        previousCockpitState = currentCockpitState;

        // Construct a CockpitStateChange object for compatibility
        const change: any = {
          full: currentCockpitState,
          partial: {}, // We don't have granular partial changes from direct store subscription
          reason: 'store_update',
        };
        // Attempt to infer partial changes for logging/conditional updates
        for (const key in currentCockpitState) {
          if (
            Object.prototype.hasOwnProperty.call(currentCockpitState, key) &&
            Object.prototype.hasOwnProperty.call(oldState, key) &&
            (currentCockpitState as any)[key] !== (oldState as any)[key]
          ) {
            (change.partial as any)[key] = (currentCockpitState as any)[key];
          }
        }
        this.handleStateChange(change);
      }
    });

    this.view = webviewView;
    this.state = getStore().getState(); // Ensure state is up-to-date

    // Initialize Services & Controllers
    this.explorerController = new ExplorerController(webviewView, this.bundleManager);
    this.analysisController = new AnalysisController(webviewView);
    this.messageController = new MessageController(
      webviewView,
      this.analysisController,
      this.explorerController,
      this.bundleManager
    );

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(msg => this.messageController?.handleMessage(msg));
    webviewView.onDidDispose(() => {
      this.unsubscribe?.();
      this.view = undefined;
      this.explorerController = undefined;
      this.analysisController = undefined;
      this.messageController = undefined;
    });
    // If we have no bundle facts in state, try to hydrate from last persisted bundle facts
    this.analysisController
      .hydrateFromPersistedFacts()
      .catch(err => logDebug(`[Cockpit] Failed to hydrate persisted facts: ${err}`));

    // Load bundle config from workspace settings
    const savedConfig = vscode.workspace.getConfiguration('git-context').get('bundleConfig');
    if (savedConfig) {
      getStore().dispatch({
        type: 'BUNDLE_CONFIG_UPDATED',
        payload: { config: savedConfig },
      });
    }

    // Ensure explorer tree is initialized even if no facts (for static nodes)
    if (!this.state.bundleFacts) {
      this.updateExplorerTree();
    }

    this.sendState();
  }

  private handleStateChange(change: any) {
    // CockpitStateChange type is internal to orchestrator, using any for now
    logDebug(`[Cockpit] Applying state change (${change.reason ?? 'unspecified'})`);
    this.state = change.full;
    this.sendState();

    // Only update derived data if relevant parts of state changed
    const partialKeys = Object.keys(change.partial);
    const factsChanged = partialKeys.includes('bundleFacts');
    const configChanged = partialKeys.includes('bundleConfig');

    logInfo(
      `[Cockpit] handleStateChange: reason=${change.reason ?? 'unspecified'}, factsChanged=${factsChanged}, hasBundleFacts=${!!this.state.bundleFacts}`
    );
    if (factsChanged) {
      const hotspotCount = (this.state.bundleFacts?.evidence as any)?.hotspots?.length || 0;
      const scopeFiles = (this.state.bundleFacts?.evidence as any)?.['scope.files']?.length || 0;
      const workingSymbols =
        (this.state.bundleFacts?.evidence as any)?.['working.symbols']?.length || 0;
      logInfo(
        `[Cockpit] State update: bundleFacts changed (hotspots=${hotspotCount}, scope.files=${scopeFiles}, working.symbols=${workingSymbols})`
      );
    }

    if (factsChanged || configChanged) {
      if (configChanged) {
        // Invalidate hotspot cache on config change to ensure fresh filtering
        this.analysisController?.hotspotCache.clear();
        logInfo('[Cockpit] Cleared hotspot cache due to config change');
      }

      if (factsChanged) {
        // Clear skeleton cache when we have fresh facts so we render the full tree
        if (this.analysisController) {
          this.analysisController.skeletonCache = null;
          this.analysisController.updateBundleData();
        }
      }
      // Always update explorer tree if facts or config changed
      this.updateExplorerTree();
    }
  }

  getState(): CockpitState {
    return getStore().getState();
  }

  updateCommits(commits: CockpitState['commits']) {
    getStore().dispatch({ type: 'COMMITS_DATA_UPDATED', payload: { commits } });
  }

  updateSelection(
    selectedCommitShas: string[],
    selectedStagedPaths: string[],
    selectedUnstagedPaths: string[],
    workspaceScope: CockpitState['workspaceScope'],
    selectedFiles?: string[]
  ) {
    getStore().dispatch({
      type: 'SELECTION_UPDATED',
      payload: {
        selectedCommitShas,
        selectedStagedPaths,
        selectedUnstagedPaths,
        selectedFiles,
        workspaceScope,
      },
    });
  }

  updateWorkspaceFiles(
    stagedFiles: CockpitState['stagedFiles'],
    unstagedFiles: CockpitState['unstagedFiles']
  ) {
    getStore().dispatch({
      type: 'WORKSPACE_FILES_UPDATED',
      payload: { staged: stagedFiles, unstaged: unstagedFiles },
    });
  }

  updateBundleFacts(
    bundleFacts: CockpitState['bundleFacts'],
    bundleSummary?: CockpitState['bundleSummary']
  ) {
    getStore().dispatch({
      type: 'BUNDLE_FACTS_UPDATED',
      payload: {
        facts: bundleFacts,
        summary: bundleSummary ?? this.state.bundleSummary,
      },
    });
  }

  updateSymbols(symbols: CockpitState['symbols']) {
    getStore().dispatch({ type: 'SYMBOLS_UPDATED', payload: { symbols } });
  }

  updateReports(reports: CockpitState['reports']) {
    getStore().dispatch({ type: 'REPORTS_UPDATED', payload: { reports } });
  }

  updateState(partial: Partial<CockpitState>) {
    getStore().dispatch({ type: 'LEGACY_STATE_UPDATED', payload: { partial } });
  }

  /**
   * DEBUG ONLY: Inject a full state object to test UI rendering
   */
  injectState(state: CockpitState) {
    logInfo('[Cockpit] Injecting debug state...');
    // Dispatch a legacy update with the full state to force a refresh
    // We use LEGACY_STATE_UPDATED because it merges partial state, but if we pass the full state
    // it effectively replaces it (mostly). Ideally we'd have a RESET_STATE action.
    // For now, let's try updating the store with the injected state.
    // Actually, let's add a proper action for this if we want it to be clean,
    // but for quick testing, we can just dispatch updates for key components.

    // Better approach: Dispatch a RESET_ALL_STATE then LEGACY_STATE_UPDATED
    getStore().dispatch({ type: 'RESET_ALL_STATE' });
    getStore().dispatch({ type: 'LEGACY_STATE_UPDATED', payload: { partial: state } });

    // Force send to webview
    this.state = getStore().getState();
    this.sendState();
    logInfo('[Cockpit] Debug state injected');
  }

  updateAnalysisProgress(isAnalyzing: boolean, step?: string, progress?: number) {
    getStore().dispatch({
      type: 'ANALYSIS_PROGRESS_UPDATED',
      payload: { isAnalyzing, step, progress },
    });
  }

  focusSection(section: CockpitSectionKey) {
    getStore().dispatch({ type: 'SECTION_CHANGED', payload: { section } });
  }

  private async handleMessage(
    msg:
      | CockpitClientMessage
      | { type: 'ready' }
      | { type: 'clearError' }
      | { type: 'dispatch'; action: Action }
  ) {
    if (this.messageController) {
      await this.messageController.handleMessage(msg);
    }
  }

  async updateExplorerTree() {
    if (this.explorerController) {
      await this.explorerController.updateExplorerTree();
    }
  }

  private sendState() {
    if (!this.view) {
      return;
    }
    try {
      // Validate state before sending
      try {
        CockpitStateSchema.parse(this.state);
      } catch (validationError) {
        logError('[Cockpit] State validation failed!', validationError);
        // We still send the state so the UI doesn't freeze, but the error is logged.
        // In strict mode, we might want to block this.
      }

      // eslint-disable-next-line no-restricted-syntax
      this.view.webview.postMessage({ type: 'updateState', payload: this.state });
      logInfo('[Cockpit] Sent state update to webview');
    } catch (error) {
      logError('[Cockpit] Failed to send state', error);
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'cockpit.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'cockpit.css')
    );

    const cspSource = webview.cspSource;
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} blob: data:; style-src ${cspSource}; script-src 'nonce-${nonce}';">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="${styleUri}">
          <title>Cockpit</title>
        </head>
        <body>
          <div id="root"></div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }
}

function getNonce() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
