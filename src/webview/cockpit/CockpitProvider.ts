import * as vscode from 'vscode';
import {
  analysisActions,
  bundleActions,
  commitActions,
  reportActions,
  selectionActions,
  symbolActions,
  uiActions,
} from '../../state/actionCreators';
import { CockpitHostMessageSchema, CockpitStateSchema } from '../../state/schemas';
import { getStore } from '../../state/store';
import {
  CockpitClientMessage,
  CockpitHostMessage,
  CockpitSectionKey,
  CockpitState,
} from '../../types/cockpit';
import { logDebug, logError, logInfo } from '../../utils/logger';
import { AnalysisController } from './services/AnalysisController';
import { BundleManager } from './services/BundleManager';
import { ExplorerController } from './services/ExplorerController';
import { MessageController } from './services/MessageController';

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState;
  private unsubscribe?: () => void;

  private bundleManager: BundleManager;
  private explorerController?: ExplorerController;
  private analysisController?: AnalysisController;
  private messageController?: MessageController;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.state = getStore().getState();
    this.bundleManager = new BundleManager();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.unsubscribe?.();

    let previousCockpitState = getStore().getState();
    this.unsubscribe = getStore().subscribe(() => {
      const currentCockpitState = getStore().getState();

      if (currentCockpitState !== previousCockpitState) {
        const oldState = previousCockpitState;

        previousCockpitState = currentCockpitState;

        const change: any = {
          full: currentCockpitState,
          partial: {},
          reason: 'store_update',
        };

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
    this.state = getStore().getState();

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

    this.analysisController
      .hydrateFromPersistedFacts()
      .catch(err => logDebug(`[Cockpit] Failed to hydrate persisted facts: ${err}`));

    const savedConfig = vscode.workspace.getConfiguration('git-context').get('bundleConfig');
    if (savedConfig) {
      getStore().dispatch({
        type: 'BUNDLE_CONFIG_UPDATED',
        payload: { config: savedConfig },
      });
    }

    if (!this.state.bundleFacts) {
      this.updateExplorerTree();
    }

    this.sendState();
  }

  private handleStateChange(change: any) {
    logDebug(`[Cockpit] Applying state change (${change.reason ?? 'unspecified'})`);
    this.state = change.full;
    this.sendState();

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
        if (this.analysisController) {
          this.analysisController.hotspotCache.clear();
          this.analysisController.clearSkeletonCache();
          logInfo('[Cockpit] Cleared hotspot and skeleton caches due to config change');
        }
      }

      if (factsChanged) {
        if (this.analysisController) {
          this.analysisController.skeletonCache = null;
          this.analysisController.updateBundleData();
        }
      }

      this.updateExplorerTree().then(() => {
        this.refreshNodeMetrics();
      });
    }
  }

  getState(): CockpitState {
    return getStore().getState();
  }

  async refreshNodeMetrics() {
    try {
      const { MetricsService } = await import('../../services/metricsService');
      const { metricsActions } = await import('../../state/actionCreators');

      const paths: string[] = [];
      const traverse = (nodes: any[]) => {
        for (const node of nodes) {
          if (node.type === 'file') {
            paths.push(node.id);
          }
          if (node.children) {
            traverse(node.children);
          }
        }
      };

      traverse(this.state.explorerData || []);

      if (paths.length > 0) {
        const metrics = await MetricsService.getInstance().getNodeMetrics(
          paths,
          this.state.currentTimeFilter
        );
        getStore().dispatch(metricsActions.update(metrics));
      }
    } catch (error) {
      logError('[Cockpit] Failed to refresh node metrics', error);
    }
  }

  updateCommits(commits: CockpitState['commits']) {
    getStore().dispatch(commitActions.updateData(commits));
  }

  updateSelection(
    selectedCommitShas: string[],
    selectedStagedPaths: string[],
    selectedUnstagedPaths: string[],
    workspaceScope: CockpitState['workspaceScope'],
    selectedFiles?: string[]
  ) {
    getStore().dispatch(
      selectionActions.update(
        selectedCommitShas,
        selectedStagedPaths,
        selectedUnstagedPaths,
        workspaceScope,
        selectedFiles
      )
    );
  }

  updateWorkspaceFiles(
    stagedFiles: CockpitState['stagedFiles'],
    unstagedFiles: CockpitState['unstagedFiles']
  ) {
    getStore().dispatch(commitActions.updateWorkspaceFiles(stagedFiles, unstagedFiles));
  }

  updateBundleFacts(
    bundleFacts: CockpitState['bundleFacts'],
    bundleSummary?: CockpitState['bundleSummary']
  ) {
    getStore().dispatch(
      bundleActions.factsUpdated(bundleFacts, bundleSummary ?? this.state.bundleSummary)
    );
  }

  updateSymbols(symbols: CockpitState['symbols']) {
    getStore().dispatch(symbolActions.update(symbols));
  }

  updateReports(reports: CockpitState['reports']) {
    getStore().dispatch(reportActions.update(reports));
  }

  /**
   * @deprecated Use specific action dispatchers instead (updateBundleFacts, updateSymbols, etc.)
   * Only kept for backward compatibility and debug scenarios
   */
  updateState(): void {
    logInfo('[Cockpit] updateState is removed. Ignoring call; use explicit actions.');
  }

  /**
   * DEBUG ONLY: Inject a full state object to test UI rendering
   */
  injectState(_state: CockpitState) {
    logInfo('[Cockpit] DEBUG injectState removed. Use explicit actions instead.');
  }

  updateAnalysisProgress(isAnalyzing: boolean, step?: string, progress?: number) {
    getStore().dispatch(analysisActions.progress(isAnalyzing, step, progress));
  }

  focusSection(section: CockpitSectionKey) {
    getStore().dispatch(uiActions.setActiveSection(section));
  }

  private async handleMessage(
    msg: CockpitClientMessage | { type: 'ready' } | { type: 'clearError' }
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
      const sanitizedState = {
        ...this.state,

        commits: this.state.commits.map(c => ({
          ...c,
          scope: c.scope || ('history' as const),
        })),
      };

      try {
        CockpitStateSchema.parse(sanitizedState);
      } catch (validationError) {
        logError('[Cockpit] State validation failed!', validationError);
      }

      const message: CockpitHostMessage = { type: 'updateState', payload: sanitizedState };
      try {
        CockpitHostMessageSchema.parse(message);
      } catch (validationError) {
        logError('[Cockpit] Host message validation failed!', validationError);
      }

      this.view.webview.postMessage(message);
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
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} blob: data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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
