import * as vscode from 'vscode';
import { RefactorBundleFacts } from '../../facts/types';
import { MetricsService } from '../../services/metricsService';
import { normalizeBundleConfig } from '../../state/bundleConfig';
import { CockpitClientMessageSchema, CockpitHostMessageSchema } from '../../state/schemas';
import {
  BundleSummaryDTO,
  BundleView,
  CockpitHostMessage,
  CockpitPayload,
  ContextFrame,
  ExplorerNode,
} from '../../types/cockpit';
import { withTimeout } from '../../utils/async';
import { logDebug, logError, logInfo, logWarn } from '../../utils/logger';
import { BundleManager } from './services/BundleManager';
import { buildBundleView, extractSnippet } from './utils/bundleViewHelpers';

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
  private _explorerData: ExplorerNode[] = [];
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
  private hotspotCache: Map<string, any[]> = new Map();
  private skeletonCache: { files: string[]; roots: string[]; mode: string } | null = null;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.bundleManager = new BundleManager();
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

    // Update explorer tree first (this will transition nodes from 'scanning' to 'ready')
    this._updateExplorerTree().catch(err =>
      logError('[CockpitProvider] Failed to update explorer tree', err)
    );

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
    const updateNode = (nodes: ExplorerNode[]): ExplorerNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, status };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    this._explorerData = updateNode(this._explorerData);
    this._update();
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

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async msg => {
      await this._handleMessage(msg);
    });

    webviewView.onDidDispose(() => {
      this.view = undefined;
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = undefined;
      }
    });

    // Subscribe to store updates
    import('../../state/store').then(({ getStore }) => {
      const store = getStore();
      this.unsubscribe = store.subscribe((state, _action) => {
        // Sync active frame if changed (by analysis or other effects)
        // Fix: Use deep equality check to catch data updates even if reference is same
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
      });
    });

    // Load saved config (for future use)
    const savedConfig = vscode.workspace.getConfiguration('git-context').get('bundleConfig');
    if (savedConfig) {
      normalizeBundleConfig(savedConfig);
      logInfo('[Cockpit] Loaded bundle config from workspace settings');
    }

    // Initial update if we have data
    const initSequence = async () => {
      if (!this._bundleFacts) {
        await this._hydrateFromPersistedFacts();
      } else {
        this._update();
      }

      // Always refresh skeleton and start background analysis to ensure fresh state / DB sync
      // This fixes the issue where DB has facts but UI doesn't see them until a scan
      const config = this._getBundleConfig();
      await this._updateSkeleton(config);
    };

    initSequence().catch(err => logError(`[CockpitProvider] Init sequence failed: ${err}`));
  }

  private async _handleMessage(rawMsg: any): Promise<void> {
    const parsed = CockpitClientMessageSchema.safeParse(rawMsg);
    if (!parsed.success) {
      logError('[CockpitProvider] Invalid client message received', {
        message: rawMsg,
        errors: parsed.error.issues,
      });
      return;
    }

    const msg = parsed.data;
    logInfo(`[CockpitProvider] Received message: ${msg.type}`);

    try {
      switch (msg.type) {
        case 'ready':
          if (this._bundleFacts) {
            this._update();
          }
          await this._buildAndUpdateBundleView();
          await this._updateExplorerTree();
          break;

        case 'runAnalysis': {
          const mode = msg.mode || 'selection';
          const force = msg.force || false;

          try {
            const { getStore } = await import('../../state/store');
            const store = getStore();

            if (mode === 'lastN') {
              const lastN = msg.lastN || this._lastNCommits || 20;
              const { GitOperations } = await import('../../analysis/git');
              const git = new GitOperations();
              const commits = await git.getRecentCommits(lastN);
              const shas = commits.map(c => c.sha);

              // Update selection and trigger analysis
              store.dispatch({ type: 'SELECTION_SET', payload: { shas } });
              store.dispatch({
                type: 'ANALYSIS_REQUESTED',
                payload: { selection: shas, force },
              });
              logInfo(
                `[CockpitProvider] Triggered analysis for ${shas.length} commits (lastN=${lastN})`
              );
            } else if (mode === 'staged' || mode === 'unstaged') {
              // For staged/unstaged, use workspace SHA format
              const { makeWorkspaceSha } = await import('../../utils/workspace');
              const { GitOperations } = await import('../../analysis/git');
              const git = new GitOperations();
              const branch = await git.getCurrentBranch().catch(() => null);
              const workspaceSha = makeWorkspaceSha(mode, branch);
              store.dispatch({ type: 'SELECTION_SET', payload: { shas: [workspaceSha] } });
              store.dispatch({
                type: 'ANALYSIS_REQUESTED',
                payload: { selection: [workspaceSha], force },
              });
              logInfo(`[CockpitProvider] Triggered analysis for ${mode} changes`);
            } else {
              // For 'selection' or 'changes', use existing analyze command
              await vscode.commands.executeCommand('git-context.analyze', undefined, force);
              logInfo(
                `[CockpitProvider] Triggered analysis via git-context.analyze (mode=${mode})`
              );
            }
          } catch (error) {
            logError('[CockpitProvider] Error handling runAnalysis', error);
            this.setError(
              `Failed to start analysis: ${error instanceof Error ? error.message : String(error)}`
            );
          }
          break;
        }

        case 'openReport':
          if (msg.reportId) {
            await vscode.commands.executeCommand('git-context.openReport', msg.reportId);
          }
          break;

        case 'regenerateReport':
          if (msg.reportId) {
            await vscode.commands.executeCommand('git-context.regenerateReport', msg.reportId);
          }
          break;

        case 'togglePinReport':
          if (msg.reportId) {
            await vscode.commands.executeCommand('git-context.togglePinReport', msg.reportId);
          }
          break;

        case 'deleteReport':
          if (msg.reportId) {
            await vscode.commands.executeCommand('git-context.deleteReport', msg.reportId);
          }
          break;

        case 'openSymbolInEditor':
          if (msg.symbolId) {
            await vscode.commands.executeCommand('git-context.openSymbol', msg.symbolId);
          }
          break;

        case 'applyRefactorSuggestion':
          if (msg.payload?.symbolId && msg.payload?.suggestedName) {
            await vscode.commands.executeCommand('git-context.applyRefactor', {
              action: 'rename',
              symbolId: msg.payload.symbolId,
              suggestedName: msg.payload.suggestedName,
              filePath: msg.payload.filePath,
            });
          }
          break;

        case 'navigateToFrame': {
          let frame = msg.frame;

          // Populate folder data if needed
          if (frame.level === 'folder' && (!frame.data || frame.data === 'none')) {
            frame = this._populateFolderFrame(frame);
          }

          this._history.push(this._activeFrame);
          this._activeFrame = frame;
          this._update();

          // Sync with Redux store so analysis reducers know the active frame
          const { getStore } = await import('../../state/store');
          getStore().dispatch({ type: 'NAVIGATE_TO', payload: { frame: frame as any } });

          // On-demand analysis: Always trigger analysis when navigating to a file/symbol
          // The service will check cache/state and only fetch what's needed (Tier 1 content is always needed initially)
          if (frame.level === 'file' || frame.level === 'symbol') {
            const { getAnalysisService } = await import('../../services/analysisService');
            const { getStore } = await import('../../state/store');
            // Run analysis in background (don't await here to keep UI responsive)
            getAnalysisService()
              .analyzeFrame(frame.id, this.view, (tier: number, frameId: string) => {
                // Pull updated frame from Redux store after tier completes
                const store = getStore();
                const state = store.getState();
                // Fix: Always update if this frame is active OR if we have cached data
                // This handles race conditions where user navigates away and back
                if (
                  state.activeFrame.id === frameId ||
                  (state as any).cachedTierResults?.[frameId]
                ) {
                  // Only update UI if it's the active frame
                  if (state.activeFrame.id === frameId) {
                    this._activeFrame = state.activeFrame;
                    this._update();
                  }
                  logInfo(`[CockpitProvider] Updated webview after tier ${tier} for ${frameId}`);
                }
              })
              .catch(err =>
                logError(`[CockpitProvider] Auto-analysis failed for ${frame.id}`, err)
              );
          }
          break;
        }

        case 'navigateBack':
          if (this._history.length > 0) {
            this._activeFrame = this._history.pop()!;
            this._update();
          }
          break;

        case 'switchBundle':
          if (msg.id && msg.id !== 'root') {
            await this.bundleManager.setActiveBundle(msg.id);
            const bundle = await this.bundleManager.getBundle(msg.id);
            if (bundle) {
              this._bundleFacts = null;
              this._bundleSummary = {
                id: msg.id,
                commitCount: 0,
                fileCount: 0,
                symbolCount: 0,
              };
              await this._updateSkeleton(bundle.config);
              await this._buildAndUpdateBundleView();
              await this._updateExplorerTree();
              this._activeFrame = {
                level: 'bundle',
                id: 'root',
                name: bundle.name,
                status: 'ready',
              };
              this._update();
              logInfo(`[Cockpit] Switched to bundle ${msg.id}`);
            }
          }
          break;

        case 'askAssistant': {
          try {
            const frame = msg.payload?.frame || this._activeFrame;
            const text = msg.payload?.text || 'Provide a concise summary and next steps.';
            // symbolId is now DNA hash, use name from payload or frame data
            const symbolName = msg.payload?.symbolId
              ? frame?.data?.name || ''
              : frame?.data?.name || '';
            const snippet = extractSnippet(frame?.data?.content, symbolName);
            const context = {
              level: frame?.level,
              name: frame?.name,
              breadcrumbs: frame?.breadcrumbs,
              hotspot: frame?.data?.hotspotScore,
              drift: msg.payload?.drift || frame?.data?.drift,
              timeline: frame?.data?.timeline?.slice(0, 5),
              blastRadius: frame?.data?.blastRadius,
              snippet,
              symbolId: msg.payload?.symbolId,
              filePath: msg.payload?.filePath,
            };

            const messages = [
              {
                role: 'system',
                content:
                  'You are a refactor assistant. Use only provided context. Respond concisely with actions and risks. Do not fabricate code.',
              },
              {
                role: 'user',
                content: `Context: ${JSON.stringify(context, null, 2)}\n\nQuestion: ${text}`,
              },
            ];

            const { getLLMClient } = await import('../../llm/openrouter');
            const client = getLLMClient();
            const reply = await withTimeout(
              client.complete(messages as any, {
                maxTokens: 600,
                temperature: 0.2,
              }),
              60000,
              'Assistant response'
            );

            this._postMessage({ type: 'assistantResponse', payload: { text: reply } });
          } catch (err) {
            logError('[CockpitProvider] Assistant handling failed', err);
            this._postMessage({
              type: 'assistantResponse',
              payload: {
                text: `Assistant error: ${err instanceof Error ? err.message : String(err)}`,
              },
            });
          }
          break;
        }

        case 'analyzeFrame':
          if (msg.frameId) {
            const { getAnalysisService } = await import('../../services/analysisService');
            const { getStore } = await import('../../state/store');
            await getAnalysisService().analyzeFrame(
              msg.frameId,
              this.view,
              (tier: number, frameId: string) => {
                // Pull updated frame from Redux store after tier completes
                const store = getStore();
                const state = store.getState();
                if (
                  state.activeFrame.id === frameId ||
                  (state as any).cachedTierResults?.[frameId]
                ) {
                  if (state.activeFrame.id === frameId) {
                    this._activeFrame = state.activeFrame;
                    this._update();
                  }
                  logInfo(`[CockpitProvider] Updated webview after tier ${tier} for ${frameId}`);
                }
              }
            );
          }
          break;

        case 'getExplorerTree':
          await this._updateExplorerTree();
          break;

        case 'getBundleData':
          await this._buildAndUpdateBundleView();
          break;

        case 'updateBundleConfig':
          if (msg.config) {
            const currentConfig = this._getBundleConfig();
            const mergedConfig = { ...currentConfig, ...msg.config };
            const normalizedConfig = normalizeBundleConfig(mergedConfig);

            await vscode.workspace
              .getConfiguration('git-context')
              .update('bundleConfig', normalizedConfig, vscode.ConfigurationTarget.Workspace);

            await this._updateSkeleton(normalizedConfig);
            await this._buildAndUpdateBundleView();
          }
          break;

        case 'setLastNCommits':
          // Update configuration directly
          this._lastNCommits = msg.value;
          await vscode.workspace
            .getConfiguration('git-context')
            .update('defaultCommitCount', msg.value, vscode.ConfigurationTarget.Workspace);
          this._update(); // Update UI with new value
          break;

        case 'updateCommitIndex': {
          const { getStore } = await import('../../state/store');
          const store = getStore();
          const commitIndex = msg.payload?.commitIndex;

          if (typeof commitIndex === 'number') {
            store.dispatch({
              type: 'COMMIT_INDEX_UPDATED',
              payload: { index: commitIndex },
            });
            logInfo(`[CockpitProvider] Dispatched COMMIT_INDEX_UPDATED for index: ${commitIndex}`);
            await this._update(); // This will trigger the updated state to be sent to webview
          } else {
            logWarn(
              `[CockpitProvider] Received updateCommitIndex message without a valid commitIndex in payload: ${JSON.stringify(
                msg
              )}`
            );
          }
          break;
        }

        case 'clearError':
          this._error = null;
          this._update();
          break;

        case 'getHeadInfo': {
          try {
            const { GitOperations } = await import('../../analysis/git');
            const gitOps = new GitOperations();
            const headSha = await gitOps.getHeadSha();
            const headCommit = await gitOps.getCommitInfo(headSha);
            const headInfo = {
              sha: headSha,
              date: headCommit.date,
              message: headCommit.message,
              author: headCommit.author,
            };
            this._postMessage({
              type: 'setData',
              payload: { headInfo },
            });
          } catch (err) {
            logError('[CockpitProvider] Failed to get HEAD info', err);
          }
          break;
        }
      }
    } catch (error) {
      logError(`[CockpitProvider] Error handling message ${msg.type}`, error);
    }
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

  private async _updateSkeleton(config: any): Promise<void> {
    try {
      const { getRefactorPipeline } = await import('../../services/pipelineFactory');
      const pipeline = await getRefactorPipeline();

      // Increase timeout for large repos and handle gracefully
      const skeleton = await withTimeout(
        pipeline.workspaceIndexer.getSkeleton(config),
        120000, // 2 minutes for large repos
        'Skeleton resolution'
      ).catch(error => {
        logWarn(
          `[CockpitProvider] Skeleton resolution failed or timed out, using empty skeleton: ${error}`
        );
        return { files: [], roots: [], mode: config.mode || 'repo' };
      });
      this.skeletonCache = skeleton;

      if (skeleton) {
        const { ExplorerService } = await import('../../services/explorerService');

        // Perform Quick Scan for symbols
        let quickSymbols: any[] = [];
        try {
          logInfo(`[CockpitProvider] Starting Quick Scan for ${skeleton.files.length} files...`);
          quickSymbols = await pipeline.workspaceIndexer.quickScanSymbols(skeleton.files);
          logInfo(`[CockpitProvider] Quick Scan complete. Found ${quickSymbols.length} symbols.`);
        } catch (e) {
          logWarn(`[CockpitProvider] Quick Scan failed: ${e}`);
        }

        // Count total commits for optimistic time travel
        let totalCommits = 0;
        try {
          const { GitOperations } = await import('../../analysis/git');
          const gitOps = new GitOperations();
          // Use git rev-list to count all commits
          const { stdout } = await gitOps.spawnGit(['rev-list', '--all', '--count']);
          totalCommits = parseInt(stdout.trim(), 10) || 0;
          logInfo(`[CockpitProvider] Total commits: ${totalCommits}`);
        } catch (e) {
          logWarn(`[CockpitProvider] Failed to count commits: ${e}`);
        }

        // Create temporary facts for symbol hydration and partial view
        // Must match BundleFactsSchema in src/state/schemas.ts
        const partialFacts: any = {
          version: '1.0.0',
          generated_at: new Date().toISOString(),
          confidence: 1.0,
          bundle: {
            oldestSha: 'HEAD',
            newestSha: 'HEAD',
            shas: ['HEAD'],
            totalCommits, // Add commit count for optimistic time travel
          },
          intended: {
            present: skeleton.files.length,
            absent: 0,
            renamed: 0,
          },
          scope: {
            files: skeleton.files.length,
            blastRadius: 0,
          },
          working: {
            symbols: quickSymbols.length,
            edges: 0,
          },
          evidence: {
            'scope.files': skeleton.files,
            'working.symbols': quickSymbols, // Now full symbol objects
          },
        };

        // Update main state so all views can benefit
        this._bundleFacts = partialFacts;

        // Update Bundle View (Stats, Treemap, etc.)
        await this._buildAndUpdateBundleView();

        // Update Explorer (now uses _bundleFacts internally via ExplorerService)
        const nodes = ExplorerService.getInstance().getExplorerTree(
          partialFacts,
          skeleton,
          [],
          null
        );
        this._explorerData = nodes;

        this._update();

        // Trigger background full analysis (Issue: "entire scope to run in the background")
        this._startBackgroundAnalysis(config, skeleton.files).catch(err =>
          logError('[CockpitProvider] Background analysis failed', err)
        );
      }
    } catch (error) {
      logError('[CockpitProvider] Failed to update skeleton', error);
    }
  }

  private async _startBackgroundAnalysis(config: any, files: string[]): Promise<void> {
    logInfo(`[CockpitProvider] Starting background analysis for ${files.length} files...`);
    const { getRefactorPipeline } = await import('../../services/pipelineFactory');
    const pipeline = await getRefactorPipeline();
    const { GitOperations } = await import('../../analysis/git');
    const git = new GitOperations();

    // Fetch recent commits for the scope to seed the bundle
    // We use a small depth (e.g. 5) for the initial background scan to be fast
    const history = await git.getRecentCommits(5);
    const shas = history.map(c => c.sha);

    if (shas.length > 0) {
      // Run pipeline in background
      // We don't await this in the UI thread (caller catches errors but doesn't block)
      const result = await pipeline.analyzeBundle(shas, true, undefined, event => {
        if (event.type === 'progress' && event.data?.type === 'file_complete') {
          // Update explorer node status when a file is done
          this.updateExplorerNodeStatus(event.data.file, 'ready');
        }
      });

      if (result.bundleFacts) {
        // Dispatch update to Redux (which will merge with partial/on-demand facts)
        const { getStore } = await import('../../state/store');
        getStore().dispatch({
          type: 'BUNDLE_FACTS_UPDATED',
          payload: { facts: result.bundleFacts },
        });
        logInfo('[CockpitProvider] Background analysis complete and merged.');
      }
    }
  }

  private async _buildAndUpdateBundleView(): Promise<void> {
    try {
      const bundleView = await buildBundleView(this._bundleFacts || null, this.hotspotCache);
      this._bundleView = bundleView;
      this._update();
      logInfo(`[CockpitProvider] Built bundle view (${bundleView.hotspots?.length || 0} hotspots)`);
    } catch (error) {
      logError('[CockpitProvider] Failed to build bundle view', error);
      this._bundleView = { hotspots: [], error: String(error) };
      this._update();
    }
  }

  private async _updateExplorerTree(): Promise<void> {
    try {
      const bundles = await this.bundleManager.getBundles();
      const activeBundleId = this.bundleManager.getActiveBundleId();

      const { ExplorerService } = await import('../../services/explorerService');
      const nodes = ExplorerService.getInstance().getExplorerTree(
        this._bundleFacts || null,
        this.skeletonCache,
        bundles,
        activeBundleId
      );

      this._explorerData = nodes;
      this._update();
      logInfo(`[CockpitProvider] Updated explorer tree (${nodes.length} root nodes)`);
    } catch (error) {
      logError('[CockpitProvider] Failed to update explorer tree', error);
      this._explorerData = [];
      this._update();
    }
  }

  private async _hydrateFromPersistedFacts(): Promise<boolean> {
    try {
      if (this._bundleFacts) return true;

      const { getGitRoot } = await import('../../utils/config');
      const gitRoot = getGitRoot();
      if (!gitRoot) return false;

      const path = await import('path');
      const fs = await import('fs');
      const factsPath = path.join(gitRoot, '.git/commit-tracker/last-bundle-facts.json');
      if (!fs.existsSync(factsPath)) return false;

      const raw = fs.readFileSync(factsPath, 'utf8');
      const facts = JSON.parse(raw);
      const summary = {
        id: facts.bundle?.newestSha || 'bundle',
        commitCount: facts.bundle?.shas?.length || 0,
        fileCount: facts.scope?.files || 0,
        symbolCount: facts.working?.symbols || 0,
        createdAt: facts.generated_at,
      };

      this._bundleFacts = facts;
      this._bundleSummary = summary;
      await this._buildAndUpdateBundleView();
      await this._updateExplorerTree();
      this._update();
      logInfo('[CockpitProvider] Hydrated bundle facts from persisted cache');
      return true;
    } catch (error) {
      logDebug(`[CockpitProvider] hydrateFromPersistedFacts error: ${error}`);
      return false;
    }
  }

  private _populateFolderFrame(frame: ContextFrame): ContextFrame {
    // Helper to find node in tree
    const findNode = (nodes: ExplorerNode[], id: string): ExplorerNode | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return undefined;
    };

    const node = findNode(this._explorerData, frame.id);
    if (!node) return frame;

    // Collect all descendant files
    const files: ExplorerNode[] = [];
    const collectFiles = (n: ExplorerNode) => {
      if (n.type === 'file') {
        files.push(n);
      } else if (n.children) {
        n.children.forEach(collectFiles);
      }
    };
    collectFiles(node);

    // Aggregate metrics
    let symbolCount = 0;
    let totalScore = 0;
    const hotspots: any[] = [];

    files.forEach(file => {
      // Count symbols (children of file node)
      if (file.children) {
        symbolCount += file.children.length;
      }

      // Check for hotspots/metrics
      // We might check _bundleView.hotspots or _nodeMetrics
      if (this._bundleView?.hotspots) {
        const hotspot = this._bundleView.hotspots.find(h => h.path === file.id);
        if (hotspot) {
          hotspots.push(hotspot);
          totalScore += hotspot.score;
        }
      }
    });

    // Sort hotspots by score
    hotspots.sort((a, b) => b.score - a.score);

    return {
      ...frame,
      data: {
        fileCount: files.length,
        symbolCount,
        avgScore: files.length > 0 ? totalScore / files.length : 0,
        hotspots: hotspots.slice(0, 10), // Top 10
        files: files.map(f => ({ id: f.id, name: f.name, status: f.status })),
      },
    };
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
      explorerData: this._explorerData,
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
      currentCommitIndex: state.currentCommitIndex, // Get from Redux state
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
