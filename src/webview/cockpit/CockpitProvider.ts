import * as vscode from 'vscode';
import type { ZodError } from 'zod';
import {
  analysisActions,
  bundleActions,
  commitActions,
  reportActions,
  selectionActions,
  symbolActions,
  uiActions,
} from '../../state/actionCreators';
import { normalizeBundleConfig } from '../../state/bundleConfig';
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

function formatZodIssues(error: ZodError): string {
  return error.issues
    .map(issue => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

let stateValidationNotified = false;
const notifyValidationError = (message: string) => {
  logError(message);
  if (!stateValidationNotified) {
    stateValidationNotified = true;
    void vscode.window.showErrorMessage(`Git Context Cockpit failed to render: ${message}`);
  }
};

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
    this.unsubscribe = getStore().subscribe((_state, action) => {
      if (action.type === 'WEBVIEW_MESSAGE' && this.view) {
        logInfo(`[CockpitProvider] Posting WEBVIEW_MESSAGE: ${action.payload.message.type}`);
        try {
          // eslint-disable-next-line no-restricted-syntax
          this.view.webview.postMessage(action.payload.message);
          logInfo(`[CockpitProvider] Successfully posted message to webview`);
        } catch (error) {
          logError('[CockpitProvider] Failed to post message to webview', error);
        }
        return;
      }

      const currentCockpitState = getStore().getState();

      if (currentCockpitState !== previousCockpitState) {
        const oldState = previousCockpitState;

        previousCockpitState = currentCockpitState;

        const change: any = {
          full: currentCockpitState,
          partial: {},
          reason: 'store_update',
        };

        let hasRelevantChanges = false;
        for (const key in currentCockpitState) {
          if (
            Object.prototype.hasOwnProperty.call(currentCockpitState, key) &&
            Object.prototype.hasOwnProperty.call(oldState, key) &&
            (currentCockpitState as any)[key] !== (oldState as any)[key]
          ) {
            (change.partial as any)[key] = (currentCockpitState as any)[key];
            if (key !== 'actionHistory') {
              hasRelevantChanges = true;
            }
          }
        }

        if (hasRelevantChanges) {
          logInfo(
            `[CockpitProvider] State changed, keys: ${Object.keys(change.partial).join(', ')}`
          );
          try {
            this.handleStateChange(change);
          } catch (error) {
            logError('[CockpitProvider] Error in handleStateChange', error);
          }
        } else {
          logDebug('[CockpitProvider] State changed but no relevant changes detected');
        }
      } else {
        logDebug(`[CockpitProvider] State reference unchanged (action: ${action.type})`);
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
      const normalizedConfig = normalizeBundleConfig(savedConfig);
      if (JSON.stringify(normalizedConfig) !== JSON.stringify(savedConfig)) {
        logInfo('[Cockpit] Normalized bundle config loaded from workspace settings');
      }
      getStore().dispatch({
        type: 'BUNDLE_CONFIG_UPDATED',
        payload: { config: normalizedConfig },
      });
    }

    if (!this.state.bundleFacts) {
      this.updateExplorerTree();
    }

    this.sendState();
  }

  private handleStateChange(change: any) {
    logInfo(
      `[CockpitProvider] handleStateChange: Applying state change (${change.reason ?? 'unspecified'})`
    );
    this.state = change.full;

    const partialKeys = Object.keys(change.partial);
    const factsChanged = partialKeys.includes('bundleFacts');
    const configChanged = partialKeys.includes('bundleConfig');

    logInfo(
      `[CockpitProvider] handleStateChange: keys=${partialKeys.join(', ')}, factsChanged=${factsChanged}, hasBundleFacts=${!!this.state.bundleFacts}`
    );

    this.sendState();
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
          this.analysisController
            .updateBundleData()
            .catch(err => logError('[Cockpit] Failed to push bundle data to webview', err));
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
        const metrics = await MetricsService.getInstance().getNodeMetrics(paths);
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
      logDebug('[CockpitProvider] sendState: No view available');
      return;
    }

    try {
      logInfo(
        `[CockpitProvider] sendState: Preparing state update (bundleFacts: ${this.state.bundleFacts ? 'EXISTS' : 'NULL'})`
      );

      const sanitizedState = {
        ...this.state,
        bundleConfig: normalizeBundleConfig(this.state.bundleConfig),
        commits: this.state.commits.map(c => ({
          ...c,
          scope: c.scope || ('history' as const),
        })),
      };

      logInfo(
        `[CockpitProvider] sendState: Sanitized state keys: ${Object.keys(sanitizedState).join(', ')}`
      );

      const stateResult = CockpitStateSchema.safeParse(sanitizedState);
      if (!stateResult.success) {
        const detail = formatZodIssues(stateResult.error);
        const message = `[Cockpit] State validation failed: ${detail}`;
        logError(message);
        notifyValidationError(message);
        // Don't throw - log and return to allow other updates to continue
        return;
      }

      const hostMessage: CockpitHostMessage = { type: 'updateState', payload: sanitizedState };
      const hostResult = CockpitHostMessageSchema.safeParse(hostMessage);
      if (!hostResult.success) {
        const detail = formatZodIssues(hostResult.error);
        const message = `[Cockpit] Host message validation failed: ${detail}`;
        logError(message);
        notifyValidationError(message);
        // Don't throw - log and return to allow other updates to continue
        return;
      }

      logInfo(
        `[CockpitProvider] sendState: Dispatching WEBVIEW_MESSAGE with ${Object.keys(sanitizedState).length} state keys`
      );
      getStore().dispatch({
        type: 'WEBVIEW_MESSAGE',
        payload: { message: hostMessage, target: 'cockpit' },
      });
      logInfo('[CockpitProvider] sendState: Successfully dispatched state update');
    } catch (error) {
      logError('[CockpitProvider] sendState: Unexpected error', error);
      // Don't throw - allow other updates to continue
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
