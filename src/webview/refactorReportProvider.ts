import * as vscode from 'vscode';
import * as path from 'path';
import { LlmAnalysis } from '../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../facts/types';
import { EvidenceLink } from '../analysis/llmAnalyst/blocks';
import { resolveEvidencePath } from '../analysis/llmAnalyst/renderer';
import { getGitRoot } from '../utils/config';

/**
 * Webview provider for the refactor report
 */
export class RefactorReportProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gitContext.refactorReport';
  private _panel: vscode.WebviewPanel | undefined;
  private _analysis: LlmAnalysis | undefined;
  private _facts: RefactorBundleFacts | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  /**
   * Set the analysis data and show the webview
   */
  public showReport(analysis: LlmAnalysis, facts: RefactorBundleFacts): void {
    console.log('[WEBVIEW] showReport called');
    console.log(`[WEBVIEW] Analysis provided: ${!!analysis}`);
    console.log(`[WEBVIEW] Facts provided: ${!!facts}`);

    if (analysis) {
      console.log(`[WEBVIEW] Analysis keys: ${Object.keys(analysis).join(', ')}`);
    }
    if (facts) {
      console.log(`[WEBVIEW] Facts keys: ${Object.keys(facts).join(', ')}`);
      console.log(`[WEBVIEW] Facts findings: ${JSON.stringify(facts.findings)}`);
    }

    this._analysis = analysis;
    this._facts = facts;

    if (this._panel) {
      console.log('[WEBVIEW] Updating existing panel');
      this._panel.reveal(vscode.ViewColumn.Two);
      this._update();
    } else {
      console.log('[WEBVIEW] Creating new panel');
      this._panel = vscode.window.createWebviewPanel(
        RefactorReportProvider.viewType,
        'Refactor Intelligence',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
      console.log('[WEBVIEW] Panel created and HTML set');
      this._update();

      this._panel.onDidDispose(() => {
        console.log('[WEBVIEW] Panel disposed');
        this._panel = undefined;
      });
    }
  }

  /**
   * VS Code WebviewViewProvider interface
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this._panel = webviewView as any; // Type assertion for compatibility
    this._update();
  }

  /**
   * Update the webview content
   */
  private _update(): void {
    console.log('[WEBVIEW] _update called');
    const webview = this._panel?.webview;

    if (!webview) {
      console.warn('[WEBVIEW] No webview available to update');
      return;
    }

    // Set panel title if it's a WebviewPanel
    if (this._panel && 'title' in this._panel) {
      (this._panel as any).title = 'Refactor Intelligence Report';
    }

    console.log(`[WEBVIEW] Posting message to webview - hasAnalysis: ${!!this._analysis}, hasFacts: ${!!this._facts}`);

    const message = {
      type: 'setData',  // Changed from 'update' to match webview listener
      analysis: this._analysis,
      facts: this._facts
    };

    // Log size of message being sent
    const messageStr = JSON.stringify(message);
    console.log(`[WEBVIEW] Message size: ${messageStr.length} chars`);
    console.log(`[WEBVIEW] Message preview (first 500 chars): ${messageStr.substring(0, 500)}`);

    webview.postMessage(message);
    console.log('[WEBVIEW] Message posted to webview');

    // Set up message handler for clicks
    webview.onDidReceiveMessage(
      async (message) => {
        console.log(`[WEBVIEW] Received message from webview: ${message.type}`);
        if (message.type === 'evidenceClick') {
          console.log(`[WEBVIEW] Evidence click: ${JSON.stringify(message.evidence)}`);
          await this._handleEvidenceClick(message.evidence);
        }
      }
    );
  }

  /**
   * Handle evidence click from the webview
   */
  private async _handleEvidenceClick(evidence: EvidenceLink): Promise<void> {
    try {
      if (!this._facts) {
        vscode.window.showErrorMessage('Facts data not available');
        return;
      }

      // Resolve evidence path to file location
      const resolved = resolveEvidencePath(evidence.path, this._facts);

      if (resolved) {
        const gitRoot = getGitRoot();
        if (!gitRoot) {
          vscode.window.showErrorMessage('Not in a git repository');
          return;
        }

        const fullPath = path.join(gitRoot, resolved.filePath);
        const uri = vscode.Uri.file(fullPath);
        const doc = await vscode.workspace.openTextDocument(uri);

        const options: vscode.TextDocumentShowOptions = {
          preview: false
        };

        if (resolved.lineNumber !== undefined) {
          options.selection = new vscode.Range(
            resolved.lineNumber - 1, 0,
            resolved.lineNumber - 1, 1000
          );
        }

        await vscode.window.showTextDocument(doc, options);
      } else if (evidence.filePath) {
        // Fallback: Direct file path provided
        const uri = vscode.Uri.file(evidence.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
          preview: false,
          selection: evidence.lineNumber
            ? new vscode.Range(evidence.lineNumber - 1, 0, evidence.lineNumber - 1, 0)
            : undefined
        });
      } else if (evidence.symbolId) {
        // Symbol-based navigation
        const filePath = evidence.symbolId.split(':')[0];
        if (filePath) {
          const uri = vscode.Uri.file(filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      } else {
        // Try to resolve from facts JSON path using utility function
        const resolved = resolveEvidencePath(evidence.path, this._facts!);
        if (resolved && resolved.filePath) {
          const gitRoot = getGitRoot();
          if (!gitRoot) {
            vscode.window.showErrorMessage('Not in a git repository');
            return;
          }

          const fullPath = path.join(gitRoot, resolved.filePath);
          const uri = vscode.Uri.file(fullPath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, {
            preview: false,
            selection: resolved.lineNumber
              ? new vscode.Range(resolved.lineNumber - 1, 0, resolved.lineNumber - 1, 1000)
              : undefined
          });
        } else {
          // Fallback: show a notification
          vscode.window.showInformationMessage(`Evidence: ${evidence.description}\nPath: ${evidence.path}`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open evidence: ${error}`);
    }
  }

  /**
   * Resolve evidence path to file location
   */
  private _resolveEvidencePath(pathParts: string[], facts?: RefactorBundleFacts): { filePath?: string; lineNumber?: number } | null {
    if (!facts) return null;

    try {
      let current: any = facts;

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];

        if (part.includes('[')) {
          // Handle array access like findings.incompleteness.missing[2]
          const match = part.match(/^([^[]+)\[(\d+)\]$/);
          if (match) {
            const [, arrayName, index] = match;
            current = current[arrayName];
            if (Array.isArray(current)) {
              current = current[parseInt(index)];
            }
          }
        } else {
          current = current[part];
        }
      }

      // Try to extract file information from the resolved data
      if (current && typeof current === 'object') {
        if (current.symbol_id) {
          const filePath = current.symbol_id.split(':')[0];
          return { filePath };
        }
        if (current.filePath || current.path) {
          return { filePath: current.filePath || current.path };
        }
      }
    } catch (error) {
      // Ignore resolution errors
    }

    return null;
  }

  /**
   * Generate HTML for the webview
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'styles.css'));

    // Use a nonce to only allow specific scripts to run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Refactor Intelligence Report</title>
        <link href="${styleUri}" rel="stylesheet">
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

/**
 * Generate a nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
