import * as vscode from 'vscode';
import { RefactorBundleFacts } from '../../facts/types';
import { MetricsService } from '../../services/metricsService';
import { normalizeBundleConfig } from '../../state/bundleConfig';
import { CockpitHostMessageSchema } from '../../state/schemas';
import {
  BundleSummaryDTO,
  BundleView,
  CockpitHostMessage,
  CockpitPayload,
  ContextFrame,
} from '../../types/cockpit';
import { logDebug, logError, logInfo, logWarn } from '../../utils/logger';
import { AnalysisController } from './services/AnalysisController';
import { BundleManager } from './services/BundleManager';
import { ExplorerController } from './services/ExplorerController';
import { MessageController } from './services/MessageController';
import { buildBundleView } from './utils/bundleViewHelpers';

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private unsubscribe?: () => void;

  // Local state fields
  private _bundleFacts?: RefactorBundleFacts | null;
  private _bundleSummary?: BundleSummaryDTO | null;
  private _bundleView?: BundleView | null;
  private _activeFrame: ContextFrame = {
    level: 'bundle',
    id: 'root',
    name: 'Bundle Overview',
    status: 'ready',
  };
  private _history: ContextFrame[] = [];
  private _nodeMetrics: Record<string, any> = {};
  private _isAnalyzing: boolean = false;
  private _analysisStep?: string;
  private _analysisProgress?: number;
  private _error: string | null = null;
  private _liveAnalysis: {
    isTracking: boolean;
    pendingChanges: number;
    totalEdits: number;
    status: 'idle' | 'analyzing' | 'ready' | 'error';
    summary: any;
    facts: any;
  } = {
    isTracking: false,
    pendingChanges: 0,
    totalEdits: 0,
    status: 'idle',
    summary: null,
    facts: null,
  };
  private _repoName: string | null = null;
  private _branchName: string | null = null;
  private _llmOutputs?: any;
  private _retrievedHistory?: any;
  private _lastNCommits?: number;
  private _debugMode = false;
  private _currentCommitIndex?: number;

  private bundleManager: BundleManager;
  private analysisController: AnalysisController;
  private explorerController?: ExplorerController;
  private messageController?: MessageController;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.bundleManager = new BundleManager();
    this.analysisController = new AnalysisController(); // View set later? No, constructor takes view.
    // We'll instantiate controllers in resolveWebviewView where we have the view.
    // But AnalysisController might need to be instantiated earlier if used?
    // In master it was in resolveWebviewView.

    this._debugMode = vscode.workspace
      .getConfiguration('git-context')
      .get<boolean>('debugMode', false);
  }

  /**
   * Main entry point - called by pipeline to update cockpit with new data
   */
  public showCockpit(
    facts: RefactorBundleFacts,
    summary: BundleSummaryDTO,
    extras?: {
      llmOutputs?: any;
      retrievedHistory?: any;
      repoName?: string | null;
      branchName?: string | null;
    }
  ): void {
    logInfo(
      `[CockpitProvider] showCockpit called: ${facts.scope.files} files, ${facts.working.symbols} symbols`
    );

    this._bundleFacts = facts;
    this._bundleSummary = summary;
    if (extras?.llmOutputs) this._llmOutputs = extras.llmOutputs;
    if (extras?.retrievedHistory) this._retrievedHistory = extras.retrievedHistory;
    if (extras?.repoName !== undefined) this._repoName = extras.repoName;
    if (extras?.branchName !== undefined) this._branchName = extras.branchName;

    // Update explorer tree first
    if (this.explorerController) {
      this.explorerController
        .updateExplorerTree(this._bundleFacts, this.analysisController.skeletonCache)
        .then(() => this._update())
        .catch(err => logError('[CockpitProvider] Failed to update explorer tree', err));
    }

    // Build bundle view asynchronously
    this._buildAndUpdateBundleView().catch(err =>
      logError('[CockpitProvider] Failed to build bundle view', err)
    );

    // Populate node metrics
    if (facts.evidence?.['scope.files']) {
      const files = facts.evidence['scope.files'] as string[];
      MetricsService.getInstance()
        .getNodeMetrics(files)
        .then(metrics => {
          this._nodeMetrics = metrics;
          this._update();
        })
        .catch(err => logError('[CockpitProvider] Failed to load node metrics', err));
    }

    // Send full state update
    this._update();
  }

  /**
   * Update analysis progress
   */
  public setProgress(isAnalyzing: boolean, step?: string, progress?: number): void {
    this._isAnalyzing = isAnalyzing;
    this._analysisStep = step;
    this._analysisProgress = progress;

    const message: CockpitHostMessage = {
      type: 'setProgress',
      payload: { isAnalyzing, step, progress },
    };
    this._postMessage(message);
  }

  /**
   * Set error state
   */
  public setError(error: string | null): void {
    this._error = error;
    this._update();
  }

  /**
   * Update explorer node status (for pipeline progress updates)
   */
  public updateExplorerNodeStatus(
    nodeId: string,
    status: 'scanning' | 'analyzing' | 'ready' | 'error'
  ): void {
    if (this.explorerController) {
      this.explorerController.updateNodeStatus(nodeId, status);
      this._update();
    }
  }

  /**
   * Update live analysis state
   */
  public updateLiveAnalysis(liveAnalysis: {
    isTracking: boolean;
    pendingChanges: number;
    totalEdits: number;
    status: 'idle' | 'analyzing' | 'ready' | 'error';
    summary: any;
    facts: any;
  }): void {
    this._liveAnalysis = liveAnalysis;
    this._update();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    // Instantiate controllers
    this.analysisController = new AnalysisController(webviewView);
    this.explorerController = new ExplorerController(webviewView, this.bundleManager);
    this.messageController = new MessageController(
      webviewView,
      this.analysisController,
      this.explorerController,
      this.bundleManager,
      {
        postMessage: msg => this._postMessage(msg),
        getBundleView: () => this._bundleView || null,
        update: () => this._update(),
      }
    );

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async msg => {
      if (this.messageController) {
        await this.messageController.handleMessage(msg);
      }
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = undefined;
      }
      this.explorerController = undefined;
      this.messageController = undefined;
      // analysisController is kept? No, it depends on view.
      // But we initialized it in constructor property.
      // We should probably recreate it or clear it.
      // In master it was undefined.
    });

    // Subscribe to store updates
    import('../../state/store').then(({ getStore }) => {
      const store = getStore();
      this.unsubscribe = store.subscribe((state, _action) => {
        // Sync active frame if changed
        const activeFrameChanged =
          state.activeFrame &&
          (state.activeFrame.id !== this._activeFrame.id ||
            state.activeFrame.status !== this._activeFrame.status ||
            JSON.stringify(state.activeFrame.data) !== JSON.stringify(this._activeFrame.data));

        if (activeFrameChanged) {
          this._activeFrame = state.activeFrame;
          this._update();
        }

        // Sync analysis status
        if (
          state.isAnalyzing !== this._isAnalyzing ||
          state.analysisStep !== this._analysisStep ||
          state.analysisProgress !== this._analysisProgress
        ) {
          this._isAnalyzing = state.isAnalyzing;
          this._analysisStep = state.analysisStep;
          this._analysisProgress = state.analysisProgress;
          this._update();
        }

        // Sync error if changed
        if (state.error !== this._error) {
          this._error = state.error ?? null;
          this._update();
        }

        // Sync current commit index
        if (state.currentCommitIndex !== this._currentCommitIndex) {
          this._currentCommitIndex = state.currentCommitIndex;
          this._update();
        }

        // Sync bundle facts if changed (e.g. from background analysis)
        // Note: This might be heavy, so be careful.
        // But we need to update local _bundleFacts if Redux updates it.
        if (state.bundleFacts && state.bundleFacts !== this._bundleFacts) {
          this._bundleFacts = state.bundleFacts;
          this._bundleSummary = state.bundleSummary; // Sync summary too
          this._buildAndUpdateBundleView().catch(e =>
            logError('[CockpitProvider] Failed to update bundle view from store', e)
          );
          if (this.explorerController) {
            this.explorerController
              .updateExplorerTree(this._bundleFacts, this.analysisController.skeletonCache)
              .then(() => this._update());
          }
        }
      });
    });

    // Load saved config
    const savedConfig = vscode.workspace.getConfiguration('git-context').get('bundleConfig');
    if (savedConfig) {
      normalizeBundleConfig(savedConfig);
      logInfo('[Cockpit] Loaded bundle config from workspace settings');
    }

    // Initial update if we have data
    const initSequence = async () => {
      if (!this._bundleFacts) {
        const hydrated = await this.analysisController.hydrateFromPersistedFacts();
        if (hydrated) {
          this._bundleFacts = hydrated.facts;
          this._bundleSummary = hydrated.summary;
          await this._buildAndUpdateBundleView();
          if (this.explorerController) {
            await this.explorerController.updateExplorerTree(
              this._bundleFacts,
              this.analysisController.skeletonCache
            );
          }
          this._update();
          logInfo('[CockpitProvider] Hydrated bundle facts from persisted cache');
        }
      } else {
        this._update();
      }

      // Always refresh skeleton and start background analysis
      const config = this._getBundleConfig();
      const skeleton = await this.analysisController.resolveSkeleton(config);

      if (skeleton) {
        const partialFacts = await this.analysisController.generatePartialFacts(skeleton);
        this._bundleFacts = partialFacts;

        await this._buildAndUpdateBundleView();
        if (this.explorerController) {
          await this.explorerController.updateExplorerTree(this._bundleFacts, skeleton);
        }
        this._update();

        // Trigger background analysis
        this.analysisController
          .startBackgroundAnalysis(config, skeleton.files, event => {
            if (event.type === 'progress' && event.data?.type === 'file_complete') {
              this.updateExplorerNodeStatus(event.data.file, 'ready');
            }
          })
          .catch(err => logError('[CockpitProvider] Background analysis failed', err));
      }
    };

    initSequence().catch(err => logError(`[CockpitProvider] Init sequence failed: ${err}`));
  }

  private _getBundleConfig(): any {
    const savedConfig = vscode.workspace.getConfiguration('git-context').get('bundleConfig');
    return savedConfig
      ? normalizeBundleConfig(savedConfig)
      : {
          mode: 'repo' as const,
          roots: [],
          includeConnected: false,
          exclusions: [],
        };
  }

  private async _buildAndUpdateBundleView(): Promise<void> {
    try {
      const bundleView = await buildBundleView(
        this._bundleFacts || null,
        this.analysisController.hotspotCache
      );
      this._bundleView = bundleView;
      this._update();
      logInfo(`[CockpitProvider] Built bundle view (${bundleView.hotspots?.length || 0} hotspots)`);
    } catch (error) {
      logError('[CockpitProvider] Failed to build bundle view', error);
      this._bundleView = { hotspots: [], error: String(error) };
      this._update();
    }
  }

  private async _update(): Promise<void> {
    if (!this.view) {
      logDebug('[CockpitProvider] _update: No view available');
      return;
    }

    const { getStore } = await import('../../state/store');
    const store = getStore();
    const state = store.getState();

    const bundleConfig = this._getBundleConfig();
    const lastNCommits =
      this._lastNCommits ??
      vscode.workspace.getConfiguration('git-context').get<number>('defaultCommitCount', 20);

    const payload: CockpitPayload = {
      bundleFacts: this._bundleFacts || null,
      bundleSummary: this._bundleSummary || null,
      bundleView: this._bundleView || null,
      activeFrame: this._activeFrame,
      history: this._history,
      explorerData: this.explorerController ? this.explorerController.explorerData : [],
      nodeMetrics: this._nodeMetrics,
      isAnalyzing: this._isAnalyzing,
      analysisStep: this._analysisStep,
      analysisProgress: this._analysisProgress,
      error: this._error,
      liveAnalysis: this._liveAnalysis,
      repoName: this._repoName,
      branchName: this._branchName,
      bundleConfig,
      lastNCommits,
      currentCommitIndex: state.currentCommitIndex,
      llmOutputs: this._llmOutputs,
      retrievedHistory: this._retrievedHistory,
    };

    const message: CockpitHostMessage = {
      type: 'setData',
      payload,
    };

    this._postMessage(message);
  }

  private _postMessage(message: CockpitHostMessage): void {
    if (!this.view) {
      logDebug('[CockpitProvider] _postMessage: No view available');
      return;
    }

    if (this._debugMode && message.type === 'setData') {
      this._validatePayload(message.payload);
    }

    const parsed = CockpitHostMessageSchema.safeParse(message);
    if (!parsed.success) {
      logError('[CockpitProvider] Validation failed, refusing to send message', {
        messageType: message.type,
        errors: parsed.error.issues,
        payload: message.payload,
      });
      return;
    }

    try {
      // eslint-disable-next-line no-restricted-syntax
      this.view.webview.postMessage(parsed.data);
      logDebug(`[CockpitProvider] Posted message: ${message.type}`);
    } catch (error) {
      logError('[CockpitProvider] postMessage failed', {
        error: error instanceof Error ? error.message : String(error),
        messageType: message.type,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  private _validatePayload(payload: CockpitPayload): void {
    try {
      const { CockpitPayloadSchema } = require('../../state/schemas');
      const result = CockpitPayloadSchema.safeParse(payload);
      if (!result.success) {
        logWarn(
          `[CockpitProvider] Payload schema validation issues: ${JSON.stringify(
            result.error.issues,
            null,
            2
          )}`
        );
      } else {
        logInfo('[CockpitProvider] Payload schema validation passed');
      }
    } catch (e) {
      logWarn(`[CockpitProvider] Validation check failed: ${e}`);
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
