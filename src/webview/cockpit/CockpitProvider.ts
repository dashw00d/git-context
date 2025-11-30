import * as vscode from 'vscode';
import { logInfo, logError, logDebug } from '../../utils/logger';
import { CockpitClientMessage, CockpitSectionKey, CockpitState } from '../../types/cockpit';
import { CockpitStateChange, getCockpitOrchestrator } from '../../state/cockpitOrchestrator';

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState;
  private unsubscribe?: () => void;
  private readonly orchestrator = getCockpitOrchestrator();

  constructor(private readonly extensionUri: vscode.Uri) {
    this.state = this.orchestrator.getState();
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
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    webviewView.onDidDispose(() => {
      this.unsubscribe?.();
      this.view = undefined;
    });
    this.sendState();
  }

  private handleStateChange(change: CockpitStateChange) {
    logDebug(`[Cockpit] Applying state change (${change.reason ?? 'unspecified'})`);
    this.state = change.full;
    this.sendState();
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

  private async handleMessage(msg: CockpitClientMessage | { type: 'ready' } | { type: 'clearError' }) {
    logInfo(`[Cockpit] Received message: ${msg.type}`);
    console.log('[Cockpit] Message details:', msg);
    switch (msg.type) {
      case 'setActiveSection':
        this.orchestrator.updatePartial('activeSection', msg.section, 'ui:setActiveSection');
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
          if (mode === 'lastN') {
            // Show VS Code input box for last N commits
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
              // Update state with the selected count
              this.orchestrator.updatePartial('lastNCommits', lastN, 'ui:setLastN');
              // Execute the command with the count
              await vscode.commands.executeCommand('git-context.analyzeLastCommits', count);
            }
          } else {
            await vscode.commands.executeCommand('git-context.analyze', force);
          }

          this.orchestrator.updateState({ isAnalyzing: true, error: null }, 'ui:generateReport:start');
          logInfo(`[Cockpit] Triggered analysis (${mode || 'selection'})`);
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
        this.orchestrator.updatePartial('commitsFilterText', msg.text ?? '', 'ui:setCommitsFilterText');
        break;
      case 'setCommitsFilterScopes':
        this.orchestrator.updateState(
          { commitsFilterScopes: { ...this.state.commitsFilterScopes, ...msg.scopes } },
          'ui:setCommitsFilterScopes'
        );
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
      case 'openActiveReport':
        // Open the bundleReportId if it exists
        const reportId = this.state.bundleReportId;
        if (reportId) {
          await vscode.commands.executeCommand('git-context.openReport', reportId);
        } else {
          vscode.window.showInformationMessage('No active report available');
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
      case 'setSymbolFilterText':
        this.orchestrator.updatePartial('symbolFilterText', msg.text ?? '', 'ui:setSymbolFilterText');
        break;
      case 'setSymbolKindFilter':
        this.orchestrator.updatePartial('symbolKindFilter', msg.kind ?? 'all', 'ui:setSymbolKindFilter');
        break;
      case 'setSymbolChangeFilter':
        this.orchestrator.updatePartial('symbolChangeFilter', msg.change ?? 'all', 'ui:setSymbolChangeFilter');
        break;
      case 'compareFilesToCommit':
        if (msg.sha) {
          await vscode.commands.executeCommand('git-context.compareFilesToCommit', msg.sha);
        }
        break;
      case 'setReportsFilterText':
        this.orchestrator.updatePartial('reportsFilterText', msg.text ?? '', 'ui:setReportsFilterText');
        break;
      case 'setReportsBranchFilter':
        this.orchestrator.updatePartial('reportsBranchFilter', msg.branch ?? 'all', 'ui:setReportsBranchFilter');
        break;
      case 'setReportsShowPinnedOnly':
        this.orchestrator.updatePartial('reportsShowPinnedOnly', msg.value ?? false, 'ui:setReportsShowPinnedOnly');
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
        break;
      case 'clearError':
        this.orchestrator.updatePartial('error', null, 'ui:clearError');
        break;
      default:
        break;
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
}

function getNonce() {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
