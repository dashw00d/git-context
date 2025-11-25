import * as vscode from 'vscode';
import { logInfo, logError } from '../utils/logger';
import { CockpitClientMessage, CockpitSectionKey, CockpitState } from '../types/cockpit';

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState = {
    repoName: null,
    branchName: null,
    activeSection: 'commits',
    isAnalyzing: false,
    analysisStep: undefined,
    analysisProgress: undefined,
    error: null,
    selectedCommitShas: [],
    selectedStagedPaths: [],
    selectedUnstagedPaths: [],
    selectedFiles: [],
    hasMoreCommits: false,
    commitsFilterText: '',
    commitsFilterScopes: { staged: true, unstaged: true, history: true },
    lastNCommits: 20,
    stagedFiles: [],
    unstagedFiles: [],
    workspaceScope: 'workspace',
    commits: [],
    bundleSummary: null,
    bundleFacts: null,
    bundleReportId: null,
    symbols: [],
    symbolFilterText: '',
    symbolKindFilter: 'all',
    symbolChangeFilter: 'all',
    activeSymbolId: null,
    activeSymbolHistory: [],
    reports: [],
    reportsFilterText: '',
    reportsBranchFilter: 'all',
    reportsShowPinnedOnly: false
  };

  constructor(private readonly extensionUri: vscode.Uri) { }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webviewView.webview.html = this.getHtml(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((msg) => this.handleMessage(msg));
    this.sendState();
  }

  getState(): CockpitState {
    return this.state;
  }

  updateCommits(commits: CockpitState['commits']) {
    this.state = { ...this.state, commits };
    this.sendState();
  }

  updateSelection(
    selectedCommitShas: string[],
    selectedStagedPaths: string[],
    selectedUnstagedPaths: string[],
    workspaceScope: CockpitState['workspaceScope'],
    selectedFiles?: string[]
  ) {
    this.state = {
      ...this.state,
      selectedCommitShas,
      selectedStagedPaths,
      selectedUnstagedPaths,
      selectedFiles,
      workspaceScope
    };
    this.sendState();
  }

  updateWorkspaceFiles(stagedFiles: CockpitState['stagedFiles'], unstagedFiles: CockpitState['unstagedFiles']) {
    this.state = { ...this.state, stagedFiles, unstagedFiles };
    this.sendState();
  }

  updateBundleFacts(bundleFacts: CockpitState['bundleFacts'], bundleSummary?: CockpitState['bundleSummary']) {
    this.state = { ...this.state, bundleFacts, bundleSummary: bundleSummary ?? this.state.bundleSummary };
    this.sendState();
  }

  updateSymbols(symbols: CockpitState['symbols']) {
    this.state = { ...this.state, symbols };
    this.sendState();
  }

  updateReports(reports: CockpitState['reports']) {
    this.state = { ...this.state, reports };
    this.sendState();
  }

  updateState(partial: Partial<CockpitState>) {
    this.state = { ...this.state, ...partial };
    this.sendState();
  }

  updateAnalysisProgress(isAnalyzing: boolean, step?: string, progress?: number) {
    this.state = { ...this.state, isAnalyzing, analysisStep: step, analysisProgress: progress };
    this.sendAnalysisProgress(isAnalyzing, step, progress);
  }

  focusSection(section: CockpitSectionKey) {
    this.state = { ...this.state, activeSection: section };
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
        this.state = { ...this.state, activeSection: msg.section };
        this.sendState();
        break;
      case 'generateReport': {
        const mode = msg.mode as 'selection' | 'lastN' | 'staged' | 'unstaged' | undefined;
        try {
          if (mode === 'staged') {
            await vscode.commands.executeCommand('git-context.analyzeStagedChanges');
          } else if (mode === 'unstaged') {
            await vscode.commands.executeCommand('git-context.analyzeUnstagedChanges');
          } else if (mode === 'lastN') {
            // Show VS Code input box for last N commits
            const { getExtensionConfig } = await import('../utils/config');
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
              this.state = { ...this.state, lastNCommits: lastN };
              this.sendState();
              // Execute the command with the count
              await vscode.commands.executeCommand('git-context.analyzeLastCommits', count);
            }
          } else {
            await vscode.commands.executeCommand('git-context.analyze');
          }
          this.state = { ...this.state, isAnalyzing: true, error: null };
          logInfo(`[Cockpit] Triggered analysis (${mode || 'selection'})`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.state = { ...this.state, isAnalyzing: false, error: errorMessage };
          this.sendState();
          logError('[Cockpit] Failed to trigger analysis', error);
        }
        break;
      }
      case 'cancelAnalysis':
        await vscode.commands.executeCommand('git-context.bundle.cancel');
        this.state = { ...this.state, isAnalyzing: false };
        this.sendState();
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
        this.state = { ...this.state, commitsFilterText: msg.text ?? '' };
        this.sendState();
        break;
      case 'setCommitsFilterScopes':
        this.state = {
          ...this.state,
          commitsFilterScopes: { ...this.state.commitsFilterScopes, ...msg.scopes }
        };
        this.sendState();
        break;
      case 'selectAllStaged':
        await vscode.commands.executeCommand('git-context.selectAllStaged');
        break;
      case 'selectAllUnstaged':
        await vscode.commands.executeCommand('git-context.selectAllUnstaged');
        break;
      case 'clearSelection':
        await vscode.commands.executeCommand('git-context.clearSelection');
        break;
      case 'resetAll':
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
        this.state = { ...this.state, symbolFilterText: msg.text ?? '' };
        this.sendState();
        break;
      case 'setSymbolKindFilter':
        this.state = { ...this.state, symbolKindFilter: msg.kind ?? 'all' };
        this.sendState();
        break;
      case 'setSymbolChangeFilter':
        this.state = { ...this.state, symbolChangeFilter: msg.change ?? 'all' };
        this.sendState();
        break;
      case 'compareFilesToCommit':
        if (msg.sha) {
          await vscode.commands.executeCommand('git-context.compareFilesToCommit', msg.sha);
        }
        break;
      case 'setReportsFilterText':
        this.state = { ...this.state, reportsFilterText: msg.text ?? '' };
        this.sendState();
        break;
      case 'setReportsBranchFilter':
        this.state = { ...this.state, reportsBranchFilter: msg.branch ?? 'all' };
        this.sendState();
        break;
      case 'setReportsShowPinnedOnly':
        this.state = { ...this.state, reportsShowPinnedOnly: msg.value ?? false };
        this.sendState();
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
        this.state = { ...this.state, error: null };
        this.sendState();
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
