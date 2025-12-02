import * as vscode from 'vscode';
import { CockpitClientMessageSchema } from '../../../state/schemas';
import { getStore } from '../../../state/store';
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
    // console.log('[Cockpit] Message details:', msg); // Reduce noise
    switch (msg.type) {
      case 'dispatch':
        getStore().dispatch(msg.action);
        break;
      case 'setActiveSection':
        getStore().dispatch({ type: 'SECTION_CHANGED', payload: { section: msg.section } });
        break;
      case 'generateLiveReport':
        getStore().dispatch({ type: 'LIVE_STATE_UPDATED', payload: { status: 'analyzing' } });
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
          // Update depth if passed explicitly (Stage posts LAST_N separately but keep this for safety)
          if (typeof msg.lastN === 'number') {
            getStore().dispatch({ type: 'LAST_N_COMMITS_CHANGED', payload: { n: msg.lastN } });
          }

          // For lastN mode, prompt the user then dispatch analysis
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
              getStore().dispatch({ type: 'LAST_N_COMMITS_CHANGED', payload: { n: lastN } });
            }
          }

          // Trigger the new store-based analysis flow (auto-selects depth in effects)
          getStore().dispatch({
            type: 'ANALYSIS_REQUESTED',
            payload: { selection: state.selectedCommitShas, force },
          });

          // Kick off a skeleton so the UI can show progressive context while pipeline runs
          this.analysisController
            .sendSkeletonProgress()
            .catch(err => logDebug(`[Cockpit] Skeleton resolution failed: ${err}`));
          // Kick off a hybrid fast update (virtual commits, quick churn) before full pipeline completes
          this.analysisController
            .sendHybridProgress()
            .catch(err => logDebug(`[Cockpit] Hybrid update failed: ${err}`));

          getStore().dispatch({
            type: 'ANALYSIS_PROGRESS_UPDATED',
            payload: { isAnalyzing: true },
          });
          getStore().dispatch({ type: 'ERROR_CLEARED' });
          logInfo(
            `[Cockpit] Triggered analysis via store (${mode || 'selection'}), selection=${state.selectedCommitShas.length}`
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          getStore().dispatch({
            type: 'ANALYSIS_PROGRESS_UPDATED',
            payload: { isAnalyzing: false },
          });
          getStore().dispatch({ type: 'ERROR_SET', payload: { error: errorMessage } });
          logError('[Cockpit] Failed to trigger analysis', error);
        }
        break;
      }
      case 'cancelAnalysis':
        await vscode.commands.executeCommand('git-context.bundle.cancel');
        getStore().dispatch({
          type: 'ANALYSIS_PROGRESS_UPDATED',
          payload: { isAnalyzing: false },
        });
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
        getStore().dispatch({
          type: 'COMMITS_FILTER_TEXT_CHANGED',
          payload: { text: msg.text ?? '' },
        });
        break;
      case 'setCommitsFilterScopes': {
        const state = getStore().getState();
        getStore().dispatch({
          type: 'COMMITS_FILTER_SCOPES_CHANGED',
          payload: { scopes: { ...state.commitsFilterScopes, ...msg.scopes } },
        });
        break;
      }
      case 'clearSelection':
        await vscode.commands.executeCommand('git-context.clearSelection');
        break;
      case 'resetAll':
        getStore().dispatch({ type: 'RESET_ALL_STATE' });
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
        // Build a scoped context payload and call the configured LLM client
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

          this.sendMessage('assistantResponse', { text: reply });
        } catch (err) {
          logError('[Cockpit] Assistant handling failed', err);
          this.sendMessage('assistantResponse', {
            text: `Assistant error: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        break;
      case 'setSymbolFilterText':
        getStore().dispatch({
          type: 'SYMBOL_FILTER_TEXT_CHANGED',
          payload: { text: msg.text ?? '' },
        });
        break;
      case 'setSymbolKindFilter':
        getStore().dispatch({
          type: 'SYMBOL_KIND_FILTER_CHANGED',
          payload: { kind: msg.kind ?? 'all' },
        });
        break;
      case 'setSymbolChangeFilter':
        getStore().dispatch({
          type: 'SYMBOL_CHANGE_FILTER_CHANGED',
          payload: { change: msg.change ?? 'all' },
        });
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
        getStore().dispatch({
          type: 'REPORTS_FILTER_TEXT_CHANGED',
          payload: { text: msg.text ?? '' },
        });
        break;
      case 'setReportsBranchFilter':
        getStore().dispatch({
          type: 'REPORTS_BRANCH_FILTER_CHANGED',
          payload: { branch: msg.branch ?? 'all' },
        });
        break;
      case 'setReportsShowPinnedOnly':
        getStore().dispatch({
          type: 'REPORTS_PINNED_FILTER_CHANGED',
          payload: { showPinnedOnly: msg.value ?? false },
        });
        break;
      case 'scrollReportToSection':
        if (msg.sectionId) {
          const state = getStore().getState();
          // First ensure report is open
          if (state.bundleReportId) {
            await vscode.commands.executeCommand('git-context.openReport', state.bundleReportId);
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
        // Send state is handled by CockpitProvider or we can do it here if we had access to sendState
        // But sendState is just postMessage.
        // Let's do it here.
        this.sendState();
        await this.analysisController.updateBundleData();
        await this.explorerController.updateExplorerTree();
        break;
      case 'clearError':
        getStore().dispatch({ type: 'ERROR_CLEARED' });
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
        if (msg.id) {
          // 1. Clear UI state immediately to show clean slate
          getStore().dispatch({ type: 'BUNDLE_SWITCH_START' });

          // 2. Switch active bundle in database
          await this.bundleManager.setActiveBundle(msg.id);

          // 3. Load bundle details (config + facts)
          const bundle = await this.bundleManager.getBundle(msg.id);

          if (bundle) {
            // 4. Update config
            getStore().dispatch({
              type: 'BUNDLE_CONFIG_UPDATED',
              payload: { config: bundle.config },
            });

            // 5. Clear facts (will reload from analysis)
            getStore().dispatch({
              type: 'BUNDLE_FACTS_UPDATED',
              payload: {
                facts: null,
                summary: { id: msg.id, commitCount: 0, fileCount: 0, symbolCount: 0 },
              },
            });

            // 6. Populate skeleton, bundle data, and explorer
            await this.analysisController.updateSkeleton(bundle.config);
            await this.analysisController.updateBundleData();
            await this.explorerController.updateExplorerTree();

            // 7. Navigate to bundle root with proper frame
            getStore().dispatch({
              type: 'NAVIGATE_TO',
              payload: {
                frame: {
                  level: 'bundle',
                  id: 'root',
                  name: bundle.name,
                  status: 'ready',
                },
              },
            });

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
          getStore().dispatch({
            type: 'BUNDLE_CONFIG_UPDATED',
            payload: { config: newConfig },
          });

          // Trigger immediate skeleton update for visual feedback
          await this.analysisController.updateSkeleton(newConfig);

          // Save to workspace settings
          await vscode.workspace
            .getConfiguration('git-context')
            .update('bundleConfig', newConfig, vscode.ConfigurationTarget.Workspace);

          // Trigger data update with new config
          await this.analysisController.updateBundleData();
        }
        break;
      default:
        break;
    }
  }

  private sendState() {
    const message = { type: 'updateState', payload: getStore().getState() };
    this.sendMessage(message.type, message.payload);
    logInfo('[Cockpit] Sent state update to webview');
  }

  sendMessage(type: string, payload: any) {
    this.tracer.logOutgoing(type, payload, 'extension');
    try {
      // eslint-disable-next-line no-restricted-syntax
      this.view.webview.postMessage({ type, payload });
    } catch (error) {
      logError('[Cockpit] Failed to send message', error);
    }
  }
}
