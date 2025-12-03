import * as vscode from 'vscode';
import {
  analysisActions,
  bundleActions,
  commitActions,
  liveActions,
  metricsActions,
  navigationActions,
  reportActions,
  symbolActions,
  uiActions,
} from '../../../state/actionCreators';
import { CockpitClientMessageSchema, CockpitHostMessageSchema } from '../../../state/schemas';
import { selectSelection } from '../../../state/selectors';
import { getStore } from '../../../state/store';
import { CockpitHostMessage } from '../../../types/cockpit';
import { logDebug, logError, logInfo } from '../../../utils/logger';
import { MessageTracer } from '../../../utils/messageTracer';
import { AnalysisController } from './AnalysisController';
import { BundleManager } from './BundleManager';
import { ExplorerController } from './ExplorerController';

export class MessageController {
  private tracer = new MessageTracer();

  constructor(
    private readonly view: vscode.WebviewView,
    private readonly analysisController: AnalysisController,
    private readonly explorerController: ExplorerController,
    private readonly bundleManager: BundleManager
  ) {}

  public async handleMessage(rawMsg: any) {
    this.tracer.logIncoming(rawMsg.type, rawMsg, 'webview');

    let msg;
    try {
      msg = CockpitClientMessageSchema.parse(rawMsg);
    } catch (error) {
      logError(`[Cockpit] Invalid message received: ${JSON.stringify(rawMsg)}`, error);
      return;
    }

    logInfo(`[Cockpit] Received message: ${msg.type}`);

    switch (msg.type) {
      case 'navigateToFrame':
        getStore().dispatch(navigationActions.navigateTo(msg.frame));
        break;
      case 'navigateBack':
        getStore().dispatch(navigationActions.navigateBack());
        break;
      case 'setActiveSection':
        getStore().dispatch(uiActions.setActiveSection(msg.section));
        break;
      case 'generateLiveReport':
        getStore().dispatch(liveActions.updateLegacy({ status: 'analyzing' }));
        await vscode.commands.executeCommand('git-context.generateLiveReport');
        break;
      case 'startLiveAnalysis':
        await vscode.commands.executeCommand('git-context.startLiveAnalysis');
        break;
      case 'generateReport': {
        const mode = msg.mode as 'selection' | 'lastN' | undefined;
        const force = msg.force as boolean | undefined;
        try {
          const state = getStore().getState();
          logInfo(
            `[Cockpit] generateReport message received (mode=${mode || 'selection'}, force=${!!force}, lastN=${msg.lastN ?? state.lastNCommits})`
          );

          if (typeof msg.lastN === 'number') {
            getStore().dispatch(commitActions.setLastN(msg.lastN));
          }

          if (mode === 'lastN') {
            const { getExtensionConfig } = await import('../../../utils/config');
            const config = getExtensionConfig();
            const defaultValue = String(state.lastNCommits || config.defaultCommitCount || 20);

            const count = await vscode.window.showInputBox({
              prompt: 'Number of commits to analyze',
              value: defaultValue,
              validateInput: value => {
                const num = parseInt(value);
                if (isNaN(num) || num <= 0) {
                  return 'Please enter a positive number';
                }
                return undefined;
              },
            });

            if (count) {
              const lastN = parseInt(count);
              getStore().dispatch(commitActions.setLastN(lastN));
            }
          }

          const selection = selectSelection(state).commits;
          getStore().dispatch(analysisActions.request(selection, force));

          this.analysisController
            .sendSkeletonProgress()
            .catch(err => logDebug(`[Cockpit] Skeleton resolution failed: ${err}`));

          this.analysisController
            .sendHybridProgress()
            .catch(err => logDebug(`[Cockpit] Hybrid update failed: ${err}`));

          getStore().dispatch(analysisActions.progress(true));
          getStore().dispatch(analysisActions.clearError());
          logInfo(
            `[Cockpit] Triggered analysis via store (${mode || 'selection'}), selection=${state.selectedCommitShas.length}`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          getStore().dispatch(analysisActions.progress(false));
          getStore().dispatch(analysisActions.setError(errorMessage));
          logError('[Cockpit] Failed to trigger analysis', error);
        }
        break;
      }
      case 'cancelAnalysis':
        await vscode.commands.executeCommand('git-context.bundle.cancel');
        getStore().dispatch(analysisActions.progress(false));
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
        getStore().dispatch(commitActions.setFilterText(msg.text ?? ''));
        break;
      case 'setCommitsFilterScopes': {
        const state = getStore().getState();
        getStore().dispatch(
          commitActions.setFilterScopes({ ...state.commitsFilterScopes, ...msg.scopes })
        );
        break;
      }
      case 'clearSelection':
        await vscode.commands.executeCommand('git-context.clearSelection');
        break;
      case 'resetAll':
        getStore().dispatch(uiActions.resetAll());
        await vscode.commands.executeCommand('git-context.resetAll');
        break;
      case 'openActiveReport': {
        const state = getStore().getState();
        if (state.bundleReportId) {
          await vscode.commands.executeCommand('git-context.openReport', state.bundleReportId);
        } else {
          vscode.window.showInformationMessage('No active report available');
        }
        break;
      }
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
            filePath: msg.payload.filePath,
          });
        }
        break;
      case 'askAssistant':
        try {
          const frame = msg.payload?.frame;
          const text = msg.payload?.text || 'Provide a concise summary and next steps.';
          const symbolName = frame?.data?.symbolId
            ? frame.data.symbolId.split(':').pop() || ''
            : '';
          const snippet = this.analysisController.extractSnippet(frame?.data?.content, symbolName);
          const context = {
            level: frame?.level,
            name: frame?.name,
            breadcrumbs: frame?.breadcrumbs,
            hotspot: frame?.data?.hotspotScore,
            drift: frame?.data?.drift,
            timeline: frame?.data?.timeline?.slice(0, 5),
            blastRadius: frame?.data?.blastRadius,
            snippet,
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

          const { getLLMClient } = await import('../../../llm/openrouter');
          const client = getLLMClient();
          const reply = await client.complete(messages as any, {
            maxTokens: 600,
            temperature: 0.2,
          });

          this.sendMessage({ type: 'assistantResponse', payload: { text: reply } });
        } catch (err) {
          logError('[Cockpit] Assistant handling failed', err);
          this.sendMessage({
            type: 'assistantResponse',
            payload: {
              text: `Assistant error: ${err instanceof Error ? err.message : String(err)}`,
            },
          });
        }
        break;
      case 'setSymbolFilterText':
        getStore().dispatch(symbolActions.setFilterText(msg.text ?? ''));
        break;
      case 'setSymbolKindFilter':
        getStore().dispatch(symbolActions.setKindFilter(msg.kind ?? 'all'));
        break;
      case 'setSymbolChangeFilter':
        getStore().dispatch(symbolActions.setChangeFilter(msg.change ?? 'all'));
        break;
      case 'setLastNCommits':
        if (typeof msg.value === 'number') {
          getStore().dispatch(commitActions.setLastN(msg.value));
        }
        break;
      case 'compareFilesToCommit':
        if (msg.sha) {
          await vscode.commands.executeCommand('git-context.compareFilesToCommit', msg.sha);
        }
        break;
      case 'setReportsFilterText':
        getStore().dispatch(reportActions.setFilterText(msg.text ?? ''));
        break;
      case 'setReportsBranchFilter':
        getStore().dispatch(reportActions.setBranchFilter(msg.branch ?? 'all'));
        break;
      case 'setReportsShowPinnedOnly':
        getStore().dispatch(reportActions.setPinnedOnly(msg.value ?? false));
        break;
      case 'scrollReportToSection':
        if (msg.sectionId) {
          const state = getStore().getState();

          if (state.bundleReportId) {
            await vscode.commands.executeCommand('git-context.openReport', state.bundleReportId);
          }

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
        await this.analysisController.updateBundleData();
        await this.explorerController.updateExplorerTree();
        break;
      case 'clearError':
        getStore().dispatch(analysisActions.clearError());
        break;
      case 'getExplorerTree':
        await this.explorerController.updateExplorerTree();
        break;
      case 'analyzeFrame':
        if (msg.frameId) {
          await this.analysisController.analyzeFrame(msg.frameId);
        }
        break;
      case 'getBundleData':
        await this.analysisController.updateBundleData();
        break;
      case 'createBundle':
        if (msg.name && msg.config) {
          logInfo(`[Cockpit] Creating bundle: ${msg.name}, config: ${JSON.stringify(msg.config)}`);
          try {
            const bundleId = await this.bundleManager.createBundle(msg.name, msg.config);
            logInfo(`[Cockpit] Bundle created with ID: ${bundleId}`);
            await this.handleMessage({ type: 'switchBundle', id: bundleId });
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
          await this.explorerController.updateExplorerTree();
        }
        break;
      case 'switchBundle':
        if (msg.id && msg.id !== 'root') {
          getStore().dispatch(bundleActions.switchStart());

          await this.bundleManager.setActiveBundle(msg.id);

          const bundle = await this.bundleManager.getBundle(msg.id);

          if (bundle) {
            getStore().dispatch(bundleActions.configUpdated(bundle.config));

            getStore().dispatch(
              bundleActions.factsUpdated(null, {
                id: msg.id,
                commitCount: 0,
                fileCount: 0,
                symbolCount: 0,
              })
            );

            await this.analysisController.updateSkeleton(bundle.config);
            await this.analysisController.updateBundleData();
            await this.explorerController.updateExplorerTree();

            getStore().dispatch(
              navigationActions.navigateTo({
                level: 'bundle',
                id: 'root',
                name: bundle.name,
                status: 'ready',
              })
            );

            logInfo(`[Cockpit] Switched to bundle ${msg.id}`);
          }
        }
        break;
      case 'updateBundleConfig':
        if (msg.config) {
          const state = getStore().getState();
          const currentConfig = state.bundleConfig || {
            mode: 'repo',
            roots: [],
            includeConnected: false,
            exclusions: [],
          };
          const newConfig = { ...currentConfig, ...msg.config };
          getStore().dispatch(bundleActions.configUpdated(newConfig));

          await this.analysisController.updateSkeleton(newConfig);

          await vscode.workspace
            .getConfiguration('git-context')
            .update('bundleConfig', newConfig, vscode.ConfigurationTarget.Workspace);

          await this.analysisController.updateBundleData();
        }
        break;
      case 'updateTimeFilter':
        getStore().dispatch(metricsActions.setTimeFilter(msg.value));
        break;
      default:
        break;
    }
  }

  private sendState() {
    const state = getStore().getState();
    const sanitizedState = {
      ...state,
      commits: state.commits.map(c => ({
        ...c,
        scope: c.scope || ('history' as const),
      })),
    };
    const message: CockpitHostMessage = { type: 'updateState', payload: sanitizedState };
    this.sendMessage(message);
    logInfo('[Cockpit] Sent state update to webview');
  }

  sendMessage(message: CockpitHostMessage) {
    const parsed = CockpitHostMessageSchema.parse(message);
    this.tracer.logOutgoing(parsed.type, parsed.payload, 'extension');
    try {
      this.view.webview.postMessage(parsed);
    } catch (error) {
      logError('[Cockpit] Failed to send message', error);
    }
  }
}
