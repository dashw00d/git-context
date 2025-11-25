import * as vscode from 'vscode';

export interface CockpitCommitDto {
  sha: string;
  message: string;
  author?: string;
  date?: string;
}

export interface CockpitState {
  selectedCommitShas: string[];
  selectedFiles: string[];
  workspaceScope: 'workspace' | 'staged' | 'unstaged';
  commits: CockpitCommitDto[];
  bundleFacts: any;
  symbols: any[];
  reports: any[];
  activeTab: 'commits' | 'bundle' | 'symbols' | 'reports';
}

export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState = {
    selectedCommitShas: [],
    selectedFiles: [],
    workspaceScope: 'workspace',
    commits: [],
    bundleFacts: null,
    symbols: [],
    reports: [],
    activeTab: 'commits'
  };

  constructor(private readonly extensionUri: vscode.Uri) {}

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

  updateCommits(commits: CockpitCommitDto[]) {
    this.state = { ...this.state, commits };
    this.sendState();
  }

  updateSelection(selectedCommitShas: string[], selectedFiles: string[], workspaceScope: CockpitState['workspaceScope']) {
    this.state = { ...this.state, selectedCommitShas, selectedFiles, workspaceScope };
    this.sendState();
  }

  updateBundleFacts(bundleFacts: any) {
    this.state = { ...this.state, bundleFacts };
    this.sendState();
  }

  updateSymbols(symbols: any[]) {
    this.state = { ...this.state, symbols };
    this.sendState();
  }

  updateReports(reports: any[]) {
    this.state = { ...this.state, reports };
    this.sendState();
  }

  updateState(partial: Partial<CockpitState>) {
    this.state = { ...this.state, ...partial };
    this.sendState();
  }

  private async handleMessage(msg: any) {
    switch (msg.type) {
      case 'generateReport':
        await vscode.commands.executeCommand('git-context.analyzeLastCommits');
        break;
      case 'ready':
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
    this.view.webview.postMessage({ type: 'state', payload: this.state });
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
