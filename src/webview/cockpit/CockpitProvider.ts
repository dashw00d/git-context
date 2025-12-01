import * as vscode from 'vscode';
import { logInfo, logError, logDebug } from '../../utils/logger';
import { CockpitClientMessage, CockpitSectionKey, CockpitState, ContextFrame, ExplorerNode } from '../../types/cockpit';
import { CockpitStateChange, getCockpitOrchestrator } from '../../state/cockpitOrchestrator';
import { getStore } from '../../state/store';
import { Action } from '../../state/actions';
import { ExplorerService } from '../../services/explorerService';

import { BundleManager } from './services/BundleManager';
import { ExplorerController } from './services/ExplorerController';
import { getTreeSitterParser } from '../../analysis/tree-sitter';

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState;
  private unsubscribe?: () => void;
  private readonly orchestrator = getCockpitOrchestrator();
  private hotspotCache: Map<string, any[]> = new Map();
  private skeletonCache: { files: string[]; roots: string[]; mode: string } | null = null;

  // New Services
  private bundleManager: BundleManager;
  private explorerController?: ExplorerController;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.state = this.orchestrator.getState();
    this.bundleManager = new BundleManager();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.unsubscribe?.();
    this.unsubscribe = this.orchestrator.subscribe((change) => this.handleStateChange(change));

    this.view = webviewView;
    this.state = this.orchestrator.getState();

    // Initialize ExplorerController with the view
    this.explorerController = new ExplorerController(webviewView, this.bundleManager);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    webviewView.onDidDispose(() => {
      this.unsubscribe?.();
      this.view = undefined;
      this.explorerController = undefined;
    });
    // If we have no bundle facts in state, try to hydrate from last persisted bundle facts
    this.hydrateFromPersistedFacts().catch(err => logDebug(`[Cockpit] Failed to hydrate persisted facts: ${err}`));

    // Load bundle config from workspace settings
    const savedConfig = vscode.workspace.getConfiguration('git-context').get('bundleConfig');
    if (savedConfig) {
      this.orchestrator.updatePartial('bundleConfig', savedConfig as any, 'init:config');
    }

    // Ensure explorer tree is initialized even if no facts (for static nodes)
    if (!this.state.bundleFacts) {
      this.updateExplorerTree();
    }

    this.sendState();
  }

  private handleStateChange(change: CockpitStateChange) {
    logDebug(`[Cockpit] Applying state change (${change.reason ?? 'unspecified'})`);
    this.state = change.full;
    this.sendState();

    // Only update derived data if relevant parts of state changed
    const partialKeys = Object.keys(change.partial);
    const factsChanged = partialKeys.includes('bundleFacts');
    const configChanged = partialKeys.includes('bundleConfig');

    logInfo(`[Cockpit] handleStateChange: reason=${change.reason ?? 'unspecified'}, factsChanged=${factsChanged}, hasBundleFacts=${!!this.state.bundleFacts}`);
    if (factsChanged) {
      const hotspotCount = (this.state.bundleFacts?.evidence as any)?.hotspots?.length || 0;
      const scopeFiles = (this.state.bundleFacts?.evidence as any)?.['scope.files']?.length || 0;
      const workingSymbols = (this.state.bundleFacts?.evidence as any)?.['working.symbols']?.length || 0;
      logInfo(`[Cockpit] State update: bundleFacts changed (hotspots=${hotspotCount}, scope.files=${scopeFiles}, working.symbols=${workingSymbols})`);
    }

    if (factsChanged || configChanged) {
      if (configChanged) {
        // Invalidate hotspot cache on config change to ensure fresh filtering
        this.hotspotCache.clear();
        logInfo('[Cockpit] Cleared hotspot cache due to config change');
      }

      if (factsChanged) {
        // Clear skeleton cache when we have fresh facts so we render the full tree
        this.skeletonCache = null;
        this.updateBundleData();
      }
      // Always update explorer tree if facts or config changed
      this.updateExplorerTree();
    }
  }

  getState(): CockpitState {
    return this.orchestrator.getState();
  }

  updateCommits(commits: CockpitState['commits']) {
    this.orchestrator.updatePartial('commits', commits, 'host:updateCommits');
  }

  updateSelection(
    selectedCommitShas: string[],
    selectedStagedPaths: string[],
    selectedUnstagedPaths: string[],
    workspaceScope: CockpitState['workspaceScope'],
    selectedFiles?: string[]
  ) {
    this.orchestrator.updateState({
      selectedCommitShas,
      selectedStagedPaths,
      selectedUnstagedPaths,
      selectedFiles,
      workspaceScope
    }, 'host:updateSelection');
  }

  updateWorkspaceFiles(stagedFiles: CockpitState['stagedFiles'], unstagedFiles: CockpitState['unstagedFiles']) {
    this.orchestrator.updateState({ stagedFiles, unstagedFiles }, 'host:updateWorkspaceFiles');
  }

  updateBundleFacts(bundleFacts: CockpitState['bundleFacts'], bundleSummary?: CockpitState['bundleSummary']) {
    this.orchestrator.updateState(
      { bundleFacts, bundleSummary: bundleSummary ?? this.state.bundleSummary },
      'host:updateBundleFacts'
    );
  }

  updateSymbols(symbols: CockpitState['symbols']) {
    this.orchestrator.updatePartial('symbols', symbols, 'host:updateSymbols');
  }

  updateReports(reports: CockpitState['reports']) {
    this.orchestrator.updatePartial('reports', reports, 'host:updateReports');
  }

  updateState(partial: Partial<CockpitState>) {
    this.orchestrator.updateState(partial, 'host:updateState');
  }

  updateAnalysisProgress(isAnalyzing: boolean, step?: string, progress?: number) {
    this.orchestrator.updateState(
      { isAnalyzing, analysisStep: step, analysisProgress: progress },
      'host:analysisProgress'
    );
    this.sendAnalysisProgress(isAnalyzing, step, progress);
  }

  focusSection(section: CockpitSectionKey) {
    this.orchestrator.updatePartial('activeSection', section, 'host:focusSection');
    this.sendFocusSection(section);
  }

  private sendFocusSection(section: CockpitSectionKey) {
    if (!this.view) {
      return;
    }
    try {
      this.view.webview.postMessage({
        type: 'focusSection',
        payload: { section }
      });
      logInfo(`[Cockpit] Sent focusSection message for ${section}`);
    } catch (error) {
      logError('[Cockpit] Failed to send focusSection', error);
    }
  }

  private sendAnalysisProgress(isAnalyzing: boolean, step?: string, progress?: number) {
    if (!this.view) {
      return;
    }
    try {
      this.view.webview.postMessage({
        type: 'analysisProgress',
        payload: { isAnalyzing, step, progress }
      });
      logInfo('[Cockpit] Sent analysis progress update');
    } catch (error) {
      logError('[Cockpit] Failed to send analysis progress', error);
    }
  }

  private async handleMessage(msg: CockpitClientMessage | { type: 'ready' } | { type: 'clearError' } | { type: 'dispatch'; action: Action }) {
    logInfo(`[Cockpit] Received message: ${msg.type}`);
    // console.log('[Cockpit] Message details:', msg); // Reduce noise
    switch (msg.type) {
      case 'dispatch':
        getStore().dispatch(msg.action);
        break;
      case 'setActiveSection':
        getStore().dispatch({ type: 'SECTION_CHANGED', payload: { section: msg.section } });
        break;
      case 'generateLiveReport':
        this.orchestrator.updateLiveState({ status: 'analyzing' }, 'ui:generateLiveReport');
        await vscode.commands.executeCommand('git-context.generateLiveReport');
        break;
      case 'startLiveAnalysis':
        await vscode.commands.executeCommand('git-context.startLiveAnalysis');
        break;
      case 'generateReport': {
        const mode = msg.mode as 'selection' | 'lastN' | undefined;
        const force = msg.force as boolean | undefined;
        try {
          logInfo(`[Cockpit] generateReport message received (mode=${mode || 'selection'}, force=${!!force}, lastN=${msg.lastN ?? this.state.lastNCommits})`);
          // Update depth if passed explicitly (Stage posts LAST_N separately but keep this for safety)
          if (typeof msg.lastN === 'number') {
            getStore().dispatch({ type: 'LAST_N_COMMITS_CHANGED', payload: { n: msg.lastN } });
          }

          // For lastN mode, prompt the user then dispatch analysis
          if (mode === 'lastN') {
            const { getExtensionConfig } = await import('../../utils/config');
            const config = getExtensionConfig();
            const defaultValue = String(this.state.lastNCommits || config.defaultCommitCount || 20);

            const count = await vscode.window.showInputBox({
              prompt: 'Number of commits to analyze',
              value: defaultValue,
              validateInput: (value) => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                  return 'Please enter a positive number';
                }
                return undefined;
              }
            });

            if (count) {
              const lastN = parseInt(count);
              getStore().dispatch({ type: 'LAST_N_COMMITS_CHANGED', payload: { n: lastN } });
            }
          }

          // Trigger the new store-based analysis flow (auto-selects depth in effects)
          getStore().dispatch({
            type: 'ANALYSIS_REQUESTED',
            payload: { selection: this.state.selectedCommitShas, force }
          });

          // Kick off a skeleton so the UI can show progressive context while pipeline runs
          this.sendSkeletonProgress().catch(err => logDebug(`[Cockpit] Skeleton resolution failed: ${err}`));
          // Kick off a hybrid fast update (virtual commits, quick churn) before full pipeline completes
          this.sendHybridProgress().catch(err => logDebug(`[Cockpit] Hybrid update failed: ${err}`));

          this.orchestrator.updateState({ isAnalyzing: true, error: null }, 'ui:generateReport:start');
          logInfo(`[Cockpit] Triggered analysis via store (${mode || 'selection'}), selection=${this.state.selectedCommitShas.length}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.orchestrator.updateState({ isAnalyzing: false, error: errorMessage }, 'ui:generateReport:error');
          logError('[Cockpit] Failed to trigger analysis', error);
        }
        break;
      }
      case 'cancelAnalysis':
        await vscode.commands.executeCommand('git-context.bundle.cancel');
        this.orchestrator.updatePartial('isAnalyzing', false, 'ui:cancelAnalysis');
        break;
      case 'toggleCommit':
        if (msg.sha) {
          await vscode.commands.executeCommand('git-context.toggleCommitSelection', msg.sha);
        }
        break;
      case 'addCommitBySha':
        if (msg.shaOrRef) {
          await vscode.commands.executeCommand('git-context.addCommitBySha', msg.shaOrRef);
        }
        break;
      case 'loadMoreCommits':
        await vscode.commands.executeCommand('git-context.addMoreCommits');
        break;
      case 'setCommitsFilterText':
        getStore().dispatch({ type: 'COMMITS_FILTER_TEXT_CHANGED', payload: { text: msg.text ?? '' } });
        break;
      case 'setCommitsFilterScopes':
        getStore().dispatch({ type: 'COMMITS_FILTER_SCOPES_CHANGED', payload: { scopes: { ...this.state.commitsFilterScopes, ...msg.scopes } } });
        break;
      case 'clearSelection':
        await vscode.commands.executeCommand('git-context.clearSelection');
        break;
      case 'resetAll':
        this.orchestrator.reset(undefined, 'ui:resetAll');
        await vscode.commands.executeCommand('git-context.resetAll');
        break;
      case 'openActiveReport':
        if (this.state.bundleReportId) {
          await vscode.commands.executeCommand('git-context.openReport', this.state.bundleReportId);
        } else {
          vscode.window.showInformationMessage('No active report available');
        }
        break;
      case 'openReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.openReport', msg.reportId);
        }
        break;
      case 'openSuperReport':
        await vscode.commands.executeCommand('git-context.superReport');
        break;
      case 'regenerateReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.regenerateReport', msg.reportId);
        }
        break;
      case 'deleteReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.deleteReport', msg.reportId);
        }
        break;
      case 'togglePinReport':
        if (msg.reportId) {
          await vscode.commands.executeCommand('git-context.togglePinReport', msg.reportId);
        }
        break;
      case 'bundleRegenerate':
        await vscode.commands.executeCommand('git-context.bundle.regenerate');
        break;
      case 'bundleClear':
        await vscode.commands.executeCommand('git-context.bundle.clear');
        break;
      case 'bundleExport':
        await vscode.commands.executeCommand('git-context.bundle.export');
        break;
      case 'openSymbolHistory':
        if (msg.symbolId) {
          await vscode.commands.executeCommand('git-context.openSymbolHistory', msg.symbolId);
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
            filePath: msg.payload.filePath
          });
        }
        break;
      case 'askAssistant':
        // Build a scoped context payload and call the configured LLM client
        try {
          const frame = msg.payload?.frame;
          const text = msg.payload?.text || 'Provide a concise summary and next steps.';
          const symbolName = frame?.data?.symbolId ? (frame.data.symbolId.split(':').pop() || '') : '';
          const snippet = this.extractSnippet(frame?.data?.content, symbolName);
          const context = {
            level: frame?.level,
            name: frame?.name,
            breadcrumbs: frame?.breadcrumbs,
            hotspot: frame?.data?.hotspotScore,
            drift: frame?.data?.drift,
            timeline: frame?.data?.timeline?.slice(0, 5),
            blastRadius: frame?.data?.blastRadius,
            snippet
          };

          const messages = [
            {
              role: 'system',
              content: 'You are a refactor assistant. Use only provided context. Respond concisely with actions and risks. Do not fabricate code.'
            },
            {
              role: 'user',
              content: `Context: ${JSON.stringify(context, null, 2)}\n\nQuestion: ${text}`
            }
          ];

          const { getLLMClient } = await import('../../llm/openrouter');
          const client = getLLMClient();
          const reply = await client.complete(messages as any, { maxTokens: 600, temperature: 0.2 });

          this.view?.webview.postMessage({ type: 'assistantResponse', payload: { text: reply } });
        } catch (err) {
          logError('[Cockpit] Assistant handling failed', err);
          this.view?.webview.postMessage({ type: 'assistantResponse', payload: { text: `Assistant error: ${err instanceof Error ? err.message : String(err)}` } });
        }
        break;
      case 'setSymbolFilterText':
        getStore().dispatch({ type: 'SYMBOL_FILTER_TEXT_CHANGED', payload: { text: msg.text ?? '' } });
        break;
      case 'setSymbolKindFilter':
        getStore().dispatch({ type: 'SYMBOL_KIND_FILTER_CHANGED', payload: { kind: msg.kind ?? 'all' } });
        break;
      case 'setSymbolChangeFilter':
        getStore().dispatch({ type: 'SYMBOL_CHANGE_FILTER_CHANGED', payload: { change: msg.change ?? 'all' } });
        break;
      case 'setLastNCommits':
        if (typeof msg.value === 'number') {
          getStore().dispatch({ type: 'LAST_N_COMMITS_CHANGED', payload: { n: msg.value } });
        }
        break;
      case 'compareFilesToCommit':
        if (msg.sha) {
          await vscode.commands.executeCommand('git-context.compareFilesToCommit', msg.sha);
        }
        break;
      case 'setReportsFilterText':
        getStore().dispatch({ type: 'REPORTS_FILTER_TEXT_CHANGED', payload: { text: msg.text ?? '' } });
        break;
      case 'setReportsBranchFilter':
        getStore().dispatch({ type: 'REPORTS_BRANCH_FILTER_CHANGED', payload: { branch: msg.branch ?? 'all' } });
        break;
      case 'setReportsShowPinnedOnly':
        getStore().dispatch({ type: 'REPORTS_PINNED_FILTER_CHANGED', payload: { showPinnedOnly: msg.value ?? false } });
        break;
      case 'scrollReportToSection':
        if (msg.sectionId) {
          // First ensure report is open
          if (this.state.bundleReportId) {
            await vscode.commands.executeCommand('git-context.openReport', this.state.bundleReportId);
          }
          // Then scroll to the section
          await vscode.commands.executeCommand('git-context.scrollToReportSection', msg.sectionId);
          logInfo(`[Cockpit] Scrolled to report section ${msg.sectionId}`);
        }
        break;
      case 'openEvidence':
        if (msg.evidenceId) {
          await vscode.commands.executeCommand('git-context.openEvidence', msg.evidenceId);
        }
        break;
      case 'ready':
        this.sendState();
        await this.updateBundleData();
        await this.updateExplorerTree();
        break;
      case 'clearError':
        this.orchestrator.updatePartial('error', null, 'ui:clearError');
        break;
      case 'getExplorerTree':
        await this.updateExplorerTree();
        break;
      case 'analyzeFrame':
        if (msg.frameId) {
          await this.analyzeFrame(msg.frameId);
        }
        break;
      case 'getBundleData':
        await this.updateBundleData();
        break;
      case 'createBundle':
        if (msg.name && msg.config) {
          logInfo(`[Cockpit] Creating bundle: ${msg.name}, config: ${JSON.stringify(msg.config)}`);
          try {
            const bundleId = await this.bundleManager.createBundle(msg.name, msg.config);
            logInfo(`[Cockpit] Bundle created with ID: ${bundleId}`);
            await this.updateExplorerTree();
          } catch (error) {
            logError('[Cockpit] Failed to create bundle', error);
          }
        } else {
          logError('[Cockpit] createBundle called without name or config', msg);
        }
        break;
      case 'deleteBundle':
        if (msg.id) {
          await this.bundleManager.deleteBundle(msg.id);
          await this.updateExplorerTree();
        }
        break;
      case 'switchBundle':
        if (msg.id) {
          await this.bundleManager.setActiveBundle(msg.id);
          // TODO: Load bundle config and facts into state
          const bundle = await this.bundleManager.getBundles().then(bundles => bundles.find(b => b.id === msg.id));
          if (bundle) {
            this.orchestrator.updatePartial('bundleConfig', bundle.config, 'ui:switchBundle');
            // Trigger analysis/skeleton update for the new bundle
            await this.updateSkeleton(bundle.config);
            await this.updateBundleData();
          }
          await this.updateExplorerTree();
        }
        break;
      case 'updateBundleConfig':
        if (msg.config) {
          const currentConfig = this.state.bundleConfig || { mode: 'repo', roots: [], includeConnected: false, exclusions: [] };
          const newConfig = { ...currentConfig, ...msg.config };
          this.orchestrator.updatePartial('bundleConfig', newConfig, 'ui:updateBundleConfig');

          // Trigger immediate skeleton update for visual feedback
          await this.updateSkeleton(newConfig);

          // Save to workspace settings
          await vscode.workspace.getConfiguration('git-context').update('bundleConfig', newConfig, vscode.ConfigurationTarget.Workspace);

          // Trigger data update with new config
          await this.updateBundleData();
        }
        break;
      default:
        break;
    }
  }

  async updateSkeleton(config: any) {
    try {
      const { getRefactorPipeline } = await import('../../services/pipelineFactory');
      const pipeline = await getRefactorPipeline();
      // Resolve the skeleton of files based on the configuration
      const skeleton = await pipeline.workspaceIndexer.getSkeleton(config);
      this.skeletonCache = skeleton;

      if (this.view && skeleton) {
        // Convert skeleton files to explorer nodes with 'scanning' status
        // This provides immediate visual feedback in the Explorer tree
        const nodes = skeleton.files.map((f: string) => ({
          id: f,
          name: f.split('/').slice(-1)[0] || f,
          type: 'file',
          status: 'scanning', // Visual feedback
          children: []
        }));

        this.view.webview.postMessage({
          type: 'updateExplorerTree',
          payload: nodes
        });
        logInfo(`[Cockpit] Sent skeleton update (${nodes.length} files scanning)`);

        // NEW: Update Bundle View with Skeleton immediately
        // This populates the main Bundle Stage with "Scanning..." cards
        const pendingHotspots = skeleton.files.map((f: string) => ({
          path: f,
          name: f.split('/').slice(-1)[0] || f,
          score: 0,
          status: 'scanning'
        }));

        this.view.webview.postMessage({
          type: 'updateBundle',
          payload: {
            hotspots: pendingHotspots,
            summary: {
              files: skeleton.files.length,
              commits: 0,
              symbols: 0
            },
            isPartial: true
          }
        });
      }
    } catch (error) {
      logError('[Cockpit] Failed to update skeleton', error);
    }
  }

  async updateBundleData() {
    try {
      const facts = this.state.bundleFacts;
      const cacheKey = facts?.bundle?.newestSha || 'workspace';
      let hotspots: any[] = [];
      if (facts) {
        if (this.hotspotCache.has(cacheKey)) {
          hotspots = this.hotspotCache.get(cacheKey)!;
        } else {
          hotspots = ((facts.evidence as any)?.hotspots || (facts.findings as any)?.hotspots || (facts as any)?.hotspots || []).map((h: any) => ({
            name: h.path?.split('/').slice(-1)[0] || h.path,
            path: h.path,
            score: h.drift_count || h.score || h.count || 0,
            count: h.count,
            size: h.size,
            added: h.added,
            removed: h.removed
          }));
          // If hotspots are missing in facts, fetch churn from git as a fallback
          if (!hotspots.length) {
            try {
              const { GitOperations } = await import('../../analysis/git');
              const gitOps = new GitOperations();
              const churn = await gitOps.getHotspots(100);
              hotspots = churn.map((h: any) => ({ path: h.path, name: h.path.split('/').pop(), score: h.count, count: h.count, size: h.size, added: h.added, removed: h.removed }));
            } catch (err) {
              logDebug(`[Cockpit] Fallback hotspots failed: ${err}`);
            }
          }
          // Cache Management: Limit size to prevent leaks (LRU-like)
          if (this.hotspotCache.size > 20) {
            const firstKey = this.hotspotCache.keys().next().value;
            if (firstKey) this.hotspotCache.delete(firstKey);
          }
          this.hotspotCache.set(cacheKey, hotspots);
        }
      } else {
        const iter = this.hotspotCache.values().next();
        if (!iter.done && Array.isArray(iter.value)) {
          hotspots = iter.value;
        }
        // If no cache and no facts, fetch churn to populate heatmap
        if (!hotspots.length) {
          try {
            const { GitOperations } = await import('../../analysis/git');
            const gitOps = new GitOperations();
            const churn = await gitOps.getHotspots(100);
            hotspots = churn.map((h: any) => ({ path: h.path, name: h.path.split('/').pop(), score: h.count, count: h.count, size: h.size, added: h.added, removed: h.removed }));
          } catch (err) {
            logDebug(`[Cockpit] Fallback hotspots (no facts) failed: ${err}`);
          }
        }
      }

      // Basic risk summary for bundle inspector
      const driftSymbols = ((facts?.findings as any)?.patternDrift?.conventionDrift?.driftSymbols as any[]) || [];
      const topRisks = driftSymbols.slice(0, 5).map((d: any) => ({
        path: d.path,
        name: d.name,
        issue: 'Naming drift',
        detail: d.suggestedName ? `Suggested: ${d.suggestedName}` : ''
      }));

      const summary = facts
        ? {
          commits: facts.bundle?.shas?.length || 0,
          files: facts.scope?.files || 0,
          symbols: facts.working?.symbols || 0
        }
        : { commits: 0, files: 0, symbols: 0 };

      const treemap = this.buildTreemap(hotspots);

      const payload = { hotspots, summary, risks: topRisks, treemap, tier: facts ? 'semantics' : undefined };

      if (this.view) {
        this.view.webview.postMessage({
          type: 'updateBundle',
          payload
        });
        logInfo(`[Cockpit] Sent bundle data (${hotspots.length} hotspots)`);
      }
    } catch (error) {
      logError('[Cockpit] Failed to update bundle data', error);
      // Send empty data to stop loading state
      if (this.view) {
        this.view.webview.postMessage({
          type: 'updateBundle',
          payload: { hotspots: [], error: String(error) }
        });
      }
    }
  }

  private buildTreemap(hotspots: Array<{ path: string; score: number; name?: string; size?: number; added?: number; removed?: number; count?: number }>) {
    // Aggregate churn per folder/file for a simple treemap structure, weight by churn*log(size)
    const root: any = {};
    const scores: number[] = [];

    for (const h of hotspots) {
      if (!h.path) continue;
      const parts = h.path.split('/').filter(Boolean);
      let cursor = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        if (!cursor[part]) {
          cursor[part] = { id: parts.slice(0, i + 1).join('/'), name: part, score: 0, added: 0, removed: 0, children: {} };
        }
        if (isFile) {
          const sizeWeight = h.size ? Math.log10(h.size + 1) : 1;
          const churn = (h.score || h.count || 0);
          const changeWeight = (h.added || 0) + (h.removed || 0);
          cursor[part].score += (churn + changeWeight / 50) * sizeWeight;
          cursor[part].added += h.added || 0;
          cursor[part].removed += h.removed || 0;
        }
        cursor = cursor[part].children;
      }
    }

    const flatten = (nodeMap: any): any[] =>
      Object.values(nodeMap).map((node: any) => {
        const children = flatten(node.children);
        const childrenScore = children.reduce((sum: number, c: any) => sum + c.score, 0);
        const totalScore = Math.max(node.score, childrenScore);
        const totalAdded = (node.added || 0) + children.reduce((sum: number, c: any) => sum + (c.added || 0), 0);
        const totalRemoved = (node.removed || 0) + children.reduce((sum: number, c: any) => sum + (c.removed || 0), 0);
        scores.push(totalScore);
        return {
          id: node.id,
          name: node.name,
          score: totalScore,
          added: totalAdded,
          removed: totalRemoved,
          children
        };
      });

    const tree = flatten(root);
    const max = scores.length ? Math.max(...scores) : 1;
    const normalize = (nodes: any[]): any[] =>
      nodes.map(n => ({
        ...n,
        weight: max > 0 ? Math.max(n.score / max, 0.05) : 0.05,
        children: n.children ? normalize(n.children) : []
      }));

    return normalize(tree);
  }

  private buildRisk(targetPath: string, hotspot: any, driftForFile: any[], facts: any) {
    const legacyDead = ((facts?.findings as any)?.legacyAudit?.dead || []).filter((d: any) => (d.symbol_id || '').startsWith(`${targetPath}:`));
    const legacyReplaced = ((facts?.findings as any)?.legacyAudit?.replacedLeftovers || []).filter((d: any) => (d.old || '').startsWith(`${targetPath}:`));
    return {
      hotspotScore: hotspot ? (hotspot.drift_count || hotspot.score || hotspot.count || 0) : 0,
      driftCount: driftForFile.length,
      legacyDead: legacyDead.length,
      legacyReplaced: legacyReplaced.length
    };
  }

  /**
   * Extract a focused snippet around a symbol name if possible.
   */
  private extractSnippet(content: string | undefined, symbolName: string): string | undefined {
    if (!content) return undefined;
    if (!symbolName) return content.slice(0, 1800);
    const idx = content.indexOf(symbolName);
    if (idx === -1) return content.slice(0, 1800);
    const lines = content.split('\n');
    let running = 0;
    let lineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      running += lines[i].length + 1;
      if (running >= idx) {
        lineIndex = i;
        break;
      }
    }
    const start = Math.max(0, lineIndex - 5);
    const end = Math.min(lines.length, lineIndex + 15);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Resolve a lightweight "skeleton" of files based on bundleConfig so the UI can
   * show progress before the full pipeline completes.
   */
  private async sendSkeletonProgress() {
    const config = this.state.bundleConfig || { mode: 'repo', roots: [], includeConnected: false, exclusions: [] };
    try {
      const { ContextSkeletonService } = await import('../../services/contextSkeleton');
      const skeletonService = new ContextSkeletonService();
      const skeleton = await skeletonService.resolveSkeleton(config as any);
      this.skeletonCache = skeleton;

      if (this.view) {
        this.view.webview.postMessage({
          type: 'updateBundle',
          payload: {
            tier: 'structure',
            summary: {
              commits: this.state.selectedCommitShas.length,
              files: skeleton.files.length,
              symbols: this.state.bundleSummary?.symbolCount || 0
            },
            skeleton: {
              mode: skeleton.mode,
              roots: skeleton.roots,
              files: skeleton.files.slice(0, 200) // cap to avoid huge payloads
            }
          }
        });
        // Trigger explorer tree update with skeleton data
        await this.updateExplorerTree();
        logInfo(`[Cockpit] Sent skeleton progress (${skeleton.files.length} files scanning)`);
      }
    } catch (error) {
      logDebug(`[Cockpit] Failed to send skeleton progress: ${error}`);
    }
  }

  /**
   * Send a fast "hybrid" update with virtual commit stats and quick churn while the full pipeline runs.
   */
  private async sendHybridProgress() {
    try {
      if (!this.view) return;
      const { GitOperations } = await import('../../analysis/git');
      const git = new GitOperations();
      const staged = await git.getStagedFiles().catch(() => []);
      const unstaged = await git.getUnstagedFiles().catch(() => []);
      const stagedDiff = await git.getDiffStats('staged').catch(() => ({ added: 0, removed: 0 }));
      const unstagedDiff = await git.getDiffStats('unstaged').catch(() => ({ added: 0, removed: 0 }));
      const hybridHotspots = await git.getHotspots(50).catch(() => []);

      const summary = {
        stagedCount: staged.length,
        unstagedCount: unstaged.length
      };

      // Use cached hotspots/treemap if available for quick churn signal, otherwise fallback to fresh git churn
      let hotspots = this.hotspotCache.values().next().value || [];
      if (!hotspots.length) {
        hotspots = hybridHotspots.map((h: any) => ({ path: h.path, name: h.path.split('/').pop(), score: h.count, count: h.count, size: h.size, added: h.added, removed: h.removed }));
      }
      // Filter hotspots to skeleton scope if available
      if (this.skeletonCache) {
        const skeletonSet = new Set(this.skeletonCache.files);
        hotspots = hotspots.filter((h: any) => skeletonSet.has(h.path));
      }
      const treemap = this.buildTreemap(hotspots);

      this.view.webview.postMessage({
        type: 'updateBundle',
        payload: {
          tier: 'hybrid',
          summary: {
            commits: this.state.selectedCommitShas.length,
            files: (this.state.bundleSummary?.fileCount || 0),
            symbols: this.state.bundleSummary?.symbolCount || 0,
            staged: staged.length,
            unstaged: unstaged.length
          },
          virtualCommits: {
            staged,
            unstaged,
            stats: {
              staged: stagedDiff,
              unstaged: unstagedDiff
            }
          },
          treemap,
          hotspots
        }
      });
      logInfo(`[Cockpit] Sent hybrid progress (staged=${staged.length}, unstaged=${unstaged.length})`);
    } catch (error) {
      logDebug(`[Cockpit] Failed to send hybrid progress: ${error}`);
    }
  }

  async analyzeFrame(frameId: string) {
    const gitRoot = (await import('../../utils/config')).getGitRoot();
    if (!gitRoot || !this.view) return;

    const level: 'file' | 'symbol' = frameId.includes('::') ? 'symbol' : 'file';
    let targetPath = frameId;
    let symbolName: string | undefined;

    if (level === 'symbol') {
      const [filePart, sym] = frameId.split('::');
      targetPath = filePart;
      symbolName = sym;
    }

    // 1. Dispatch navigation immediately with 'scanning' status
    const initialFrame: ContextFrame = {
      id: frameId,
      level: level as any,
      name: targetPath.split('/').slice(-1)[0] || targetPath,
      status: 'scanning',
      breadcrumbs: targetPath.split('/'),
      tier: 'structure'
    };
    getStore().dispatch({ type: 'NAVIGATE_TO', payload: { frame: initialFrame } });

    const { FrameAnalyzer } = await import('./services/FrameAnalyzer');
    const analyzer = new FrameAnalyzer(this.view);
    const facts = this.state.bundleFacts;

    // TIER 1: Structure (Always succeeds)
    try {
      const tier1Data = await analyzer.analyzeTier1(frameId, targetPath, gitRoot);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_1_COMPLETE',
        payload: { frameId, data: tier1Data }
      });

      // Also send legacy postMessage for backward compatibility
      this.view.webview.postMessage({
        type: 'updateFrame',
        payload: {
          frame: { ...initialFrame, status: 'scanning', tier: 'hybrid' },
          data: tier1Data
        }
      });
    } catch (error) {
      logError(`[Tier 1] Failed for ${frameId}`, error);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 1, error: String(error) }
      });
      // Even Tier 1 failure shouldn't completely block - show error frame
      this.view.webview.postMessage({
        type: 'updateFrame',
        payload: { frame: { id: frameId, status: 'error' }, error: String(error) }
      });
      return;
    }

    // TIER 2: Hybrid Metadata (Best effort)
    try {
      const tier2Data = await analyzer.analyzeTier2(frameId, targetPath, facts);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_2_COMPLETE',
        payload: { frameId, data: tier2Data }
      });

      // Update message with tier 2 data
      const currentState = getStore().getState();
      const currentData = currentState.activeFrame.data || {};
      this.view.webview.postMessage({
        type: 'updateFrame',
        payload: {
          frame: { ...initialFrame, status: 'scanning', tier: 'semantics' },
          data: { ...currentData }
        }
      });
    } catch (error) {
      logError(`[Tier 2] Failed for ${frameId}`, error);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 2, error: String(error) }
      });
      // Continue to Tier 3 even if Tier 2 fails
    }

    // TIER 3: Semantics (Optional)
    try {
      const currentState = getStore().getState();
      const content = currentState.activeFrame.data?.content || '';
      const tier3Data = await analyzer.analyzeTier3(frameId, targetPath, content, facts);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_3_COMPLETE',
        payload: { frameId, data: tier3Data }
      });

      // Final update with all data
      const finalState = getStore().getState();
      const finalData = finalState.activeFrame.data || {};

      // Build final frame
      const finalFrame: ContextFrame = {
        ...initialFrame,
        status: 'ready',
        tier: 'semantics'
      };

      this.view.webview.postMessage({
        type: 'updateFrame',
        payload: { frame: finalFrame, data: finalData }
      });
      logInfo(`[Cockpit] Analyzed frame ${frameId} (${level})`);
    } catch (error) {
      logError(`[Tier 3] Failed for ${frameId}`, error);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 3, error: String(error) }
      });

      // Still send final frame even if Tier 3 fails
      const finalState = getStore().getState();
      const finalData = finalState.activeFrame.data || {};
      this.view.webview.postMessage({
        type: 'updateFrame',
        payload: {
          frame: { ...initialFrame, status: 'ready', tier: 'hybrid' },
          data: finalData
        }
      });
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

  /**
   * Load persisted bundle facts from disk (last-bundle-facts.json) so the bundle
   * view can render immediately after reload without re-running analysis.
   */
  private async hydrateFromPersistedFacts() {
    if (this.state.bundleFacts) return;
    try {
      const { getGitRoot } = await import('../../utils/config');
      const gitRoot = getGitRoot();
      if (!gitRoot) return;
      const path = await import('path');
      const fs = await import('fs');
      const factsPath = path.join(gitRoot, '.git/commit-tracker/last-bundle-facts.json');
      if (!fs.existsSync(factsPath)) return;
      const raw = fs.readFileSync(factsPath, 'utf8');
      const facts = JSON.parse(raw);
      const persistedTreemap = facts.treemap || undefined;
      const persistedHotspots = facts.hotspots || undefined;
      const summary = {
        id: facts.bundle?.newestSha || 'bundle',
        commitCount: facts.bundle?.shas?.length || 0,
        fileCount: facts.scope?.files || 0,
        symbolCount: facts.working?.symbols || 0,
        createdAt: facts.generated_at
      };
      this.orchestrator.updateState({
        bundleFacts: facts,
        bundleSummary: summary,
        bundleReportId: null
      }, 'hydrate:persistedFacts');
      this.state = this.orchestrator.getState();
      if (persistedHotspots) {
        this.hotspotCache.set(summary.id || 'bundle', persistedHotspots);
      }
      if (persistedTreemap && this.view) {
        this.view.webview.postMessage({
          type: 'updateBundle',
          payload: { treemap: persistedTreemap, hotspots: persistedHotspots || [], summary, tier: 'semantics' }
        });
      }
      await this.updateBundleData();
      await this.updateExplorerTree();
      logInfo('[Cockpit] Hydrated bundle facts from persisted cache');
    } catch (error) {
      logDebug(`[Cockpit] hydrateFromPersistedFacts error: ${error}`);
    }
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
