import * as vscode from 'vscode';
import { normalizeBundleConfig } from '../../../state/bundleConfig';
import { getStore } from '../../../state/store';
import { BundleView, CockpitClientMessage, CockpitHostMessage } from '../../../types/cockpit';
import { withTimeout } from '../../../utils/async';
import { logError, logInfo } from '../../../utils/logger';
import {
  extractFileEvidence,
  extractSnippet,
  extractSymbolEvidence,
} from '../utils/bundleViewHelpers';
import { AnalysisController } from './AnalysisController';
import { BundleManager } from './BundleManager';
import { ExplorerController } from './ExplorerController';

export interface MessageControllerCallbacks {
  postMessage: (msg: CockpitHostMessage) => void;
  getBundleView: () => BundleView | null;
  getBundleFacts: () => import('../../../facts/types').RefactorBundleFacts | null;
  update: () => void;
}

export class MessageController {
  constructor(
    private readonly view: vscode.WebviewView | undefined,
    private readonly analysisController: AnalysisController,
    private readonly explorerController: ExplorerController,
    private readonly bundleManager: BundleManager,
    private readonly callbacks: MessageControllerCallbacks
  ) {}

  public async handleMessage(msg: CockpitClientMessage): Promise<void> {
    try {
      switch (msg.type) {
        case 'ready':
          this.callbacks.update();
          break;

        case 'runAnalysis': {
          const mode = msg.mode || 'selection';
          const force = msg.force || false;

          try {
            const store = getStore();

            if (mode === 'lastN') {
              const lastN = msg.lastN || 20;
              const { GitOperations } = await import('../../../analysis/git');
              const git = new GitOperations();
              const commits = await git.getRecentCommits(lastN);
              const shas = commits.map(c => c.sha);

              store.dispatch({ type: 'SELECTION_SET', payload: { shas } });
              store.dispatch({
                type: 'ANALYSIS_REQUESTED',
                payload: { selection: shas, force },
              });
              logInfo(
                `[MessageController] Triggered analysis for ${shas.length} commits (lastN=${lastN})`
              );
            } else if (mode === 'staged' || mode === 'unstaged') {
              const { makeWorkspaceSha } = await import('../../../utils/workspace');
              const { GitOperations } = await import('../../../analysis/git');
              const git = new GitOperations();
              const branch = await git.getCurrentBranch().catch(() => null);
              const workspaceSha = makeWorkspaceSha(mode, branch);
              store.dispatch({ type: 'SELECTION_SET', payload: { shas: [workspaceSha] } });
              store.dispatch({
                type: 'ANALYSIS_REQUESTED',
                payload: { selection: [workspaceSha], force },
              });
              logInfo(`[MessageController] Triggered analysis for ${mode} changes`);
            } else {
              await vscode.commands.executeCommand('git-context.analyze', undefined, force);
              logInfo(
                `[MessageController] Triggered analysis via git-context.analyze (mode=${mode})`
              );
            }
          } catch (error) {
            logError('[MessageController] Error handling runAnalysis', error);
            getStore().dispatch({
              type: 'ANALYSIS_FAILED',
              payload: { error: error instanceof Error ? error.message : String(error) },
            });
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
          const bundleView = this.callbacks.getBundleView();

          // Populate folder data if needed
          if (frame.level === 'folder' && (!frame.data || frame.data === 'none')) {
            frame = this.explorerController.populateFolderFrame(frame, bundleView);
          }

          // Sync with Redux store
          getStore().dispatch({ type: 'NAVIGATE_TO', payload: { frame } });

          // On-demand analysis
          if (frame.level === 'file' || frame.level === 'symbol') {
            this.analysisController
              .analyzeFrame(frame.id, (tier: number, frameId: string) => {
                // The store update will trigger CockpitProvider to update UI
                logInfo(`[MessageController] Updated webview after tier ${tier} for ${frameId}`);
              })
              .catch(err =>
                logError(`[MessageController] Auto-analysis failed for ${frame.id}`, err)
              );
          }
          break;
        }

        case 'navigateBack':
          getStore().dispatch({ type: 'NAVIGATE_BACK' });
          break;

        case 'switchBundle':
          if (msg.id && msg.id !== 'root') {
            try {
              getStore().dispatch({ type: 'BUNDLE_SWITCH_START' });
              await this.bundleManager.setActiveBundle(msg.id);
              const bundle = await this.bundleManager.getBundle(msg.id);
              if (bundle) {
                const skeleton = await this.analysisController.resolveSkeleton(bundle.config);
                if (skeleton) {
                  const partialFacts = await this.analysisController.generatePartialFacts(skeleton);
                  getStore().dispatch({
                    type: 'BUNDLE_FACTS_UPDATED',
                    payload: { facts: partialFacts },
                  });
                  // And trigger background analysis
                  this.analysisController.startBackgroundAnalysis(
                    bundle.config,
                    skeleton.files,
                    () => {
                      /* handle progress */
                    }
                  );
                }
              }
            } catch (error) {
              logError('[MessageController] Failed to switch bundle', error);
              getStore().dispatch({
                type: 'ANALYSIS_FAILED',
                payload: { error: error instanceof Error ? error.message : String(error) },
              });
            }
          }
          break;

        case 'askAssistant': {
          try {
            const store = getStore();
            const state = store.getState();
            const frame = state.activeFrame; // Use Redux state

            const text = msg.payload?.text || 'Provide a concise summary and next steps.';
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

            const messages: Array<{ role: 'system' | 'user'; content: string }> = [
              {
                role: 'system' as const,
                content:
                  'You are a refactor assistant. Use only provided context. Respond concisely with actions and risks. Do not fabricate code.',
              },
              {
                role: 'user' as const,
                content: `Context: ${JSON.stringify(context, null, 2)}\n\nQuestion: ${text}`,
              },
            ];

            const { getLLMClient } = await import('../../../llm/openrouter');
            const client = getLLMClient();
            const reply = await withTimeout(
              client.complete(messages, {
                maxTokens: 600,
                temperature: 0.2,
              }),
              60000,
              'Assistant response'
            );

            this.callbacks.postMessage({ type: 'assistantResponse', payload: { text: reply } });
          } catch (err) {
            logError('[MessageController] Assistant handling failed', err);
            this.callbacks.postMessage({
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
            await this.analysisController.analyzeFrame(msg.frameId, (tier, fid) => {
              logInfo(`[MessageController] Manual analysis tier ${tier} complete for ${fid}`);
            });
          }
          break;

        case 'getExplorerTree':
          // ExplorerController update is triggered by CockpitProvider usually
          this.callbacks.update();
          break;

        case 'getBundleData':
          this.callbacks.update();
          break;

        case 'updateBundleConfig':
          if (msg.config) {
            const normalizedConfig = normalizeBundleConfig(msg.config);
            await vscode.workspace
              .getConfiguration('git-context')
              .update('bundleConfig', normalizedConfig, vscode.ConfigurationTarget.Workspace);

            // Trigger refresh
            // Ideally dispatch config update
            getStore().dispatch({
              type: 'BUNDLE_CONFIG_UPDATED',
              payload: { config: normalizedConfig },
            });
          }
          break;

        case 'setLastNCommits':
          await vscode.workspace
            .getConfiguration('git-context')
            .update('defaultCommitCount', msg.value, vscode.ConfigurationTarget.Workspace);
          this.callbacks.update();
          break;

        case 'updateCommitIndex': {
          const store = getStore();
          // The message type definition might have changed, handle both value and payload
          const commitIndex =
            'value' in msg && typeof msg.value === 'number' ? msg.value : undefined;

          if (typeof commitIndex === 'number') {
            store.dispatch({
              type: 'COMMIT_INDEX_UPDATED',
              payload: { index: commitIndex },
            });
          }
          break;
        }

        case 'clearError':
          // Dispatch error clear?
          // store.dispatch({ type: 'ERROR_CLEARED' }); // if exists
          this.callbacks.update();
          break;

        case 'getHeadInfo': {
          try {
            const { GitOperations } = await import('../../../analysis/git');
            const gitOps = new GitOperations();
            const headSha = await gitOps.getHeadSha();
            const headCommit = await gitOps.getCommitInfo(headSha);
            const headInfo = {
              sha: headSha,
              date: headCommit.date,
              message: headCommit.message,
              author: headCommit.author,
            };
            this.callbacks.postMessage({
              type: 'setData',
              payload: { headInfo },
            });
          } catch (err) {
            logError('[MessageController] Failed to get HEAD info', err);
          }
          break;
        }

        case 'requestFileDetails': {
          if (msg.payload?.filePath) {
            try {
              const bundleFacts = this.callbacks.getBundleFacts();
              const evidence = extractFileEvidence(bundleFacts, msg.payload.filePath);
              this.callbacks.postMessage({
                type: 'fileDetailsResponse',
                payload: {
                  filePath: msg.payload.filePath,
                  evidence,
                },
              });
            } catch (err) {
              logError('[MessageController] Failed to extract file evidence', err);
              this.callbacks.postMessage({
                type: 'fileDetailsResponse',
                payload: {
                  filePath: msg.payload.filePath,
                  evidence: {},
                },
              });
            }
          }
          break;
        }

        case 'requestSymbolDetails': {
          if (msg.payload?.symbolId) {
            try {
              const bundleFacts = this.callbacks.getBundleFacts();
              const evidence = extractSymbolEvidence(bundleFacts, msg.payload.symbolId);
              this.callbacks.postMessage({
                type: 'symbolDetailsResponse',
                payload: {
                  symbolId: msg.payload.symbolId,
                  evidence,
                },
              });
            } catch (err) {
              logError('[MessageController] Failed to extract symbol evidence', err);
              this.callbacks.postMessage({
                type: 'symbolDetailsResponse',
                payload: {
                  symbolId: msg.payload.symbolId,
                  evidence: {},
                },
              });
            }
          }
          break;
        }
      }
    } catch (error) {
      logError(`[MessageController] Error handling message ${msg.type}`, error);
    }
  }
}
