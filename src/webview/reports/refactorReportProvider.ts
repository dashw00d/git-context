import * as vscode from 'vscode';
import * as path from 'path';
import { logInfo, logDebug, logError } from '../../utils/logger';
import { LlmAnalysis } from '../../analysis/llmAnalyst/blocks';
import { RefactorBundleFacts } from '../../facts/types';
import { EvidenceLink } from '../../analysis/llmAnalyst/blocks';
import { resolveEvidencePath } from '../../analysis/llmAnalyst/renderer';
import { getGitRoot } from '../../utils/config';

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
    if (!analysis || !facts) {
      vscode.window.showErrorMessage('No analysis available. Run a refactor analysis first.');
      return;
    }
    
    logDebug('[WEBVIEW] showReport called with valid data');
    this._analysis = analysis;
    this._facts = facts;

    if (this._panel) {
      // View is already resolved (sidebar)
      if (this._panel.visible) {
        this._update();
      } else {
        // Focus the sidebar view using the view ID
        vscode.commands.executeCommand('gitContext.refactorReport.focus');
        // Data will be updated via _update called implicitly or explicitly? 
        // resolveWebviewView posts initial data, but if already resolved but hidden, we need to update
        this._update();
      }
    } else {
      // View not resolved yet - focus it to trigger resolution
      vscode.commands.executeCommand('gitContext.refactorReport.focus');
      // Once resolved, resolveWebviewView will be called and will post the data
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
    this._panel = webviewView as any; // Maintaining internal property name for now to minimize changes
    
    // Set title if property exists (it does on WebviewView)
    webviewView.title = 'Refactor Intelligence Report';
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    
    // Post initial data if available
    if (this._analysis && this._facts) {
      this._update();
    }
    
    // Handle disposal
    webviewView.onDidDispose(() => {
      this._panel = undefined;
    });
    
    // Setup message handling
    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        if (message.type === 'evidenceClick') {
          await this._handleEvidenceClick(message.evidence);
        } else if (message.type === 'action') {
          if (message.action === 'delete') {
            await vscode.commands.executeCommand('git-context.applyRefactor', {
              action: 'delete',
              symbolId: message.data.symbolId,
              filePath: message.data.filePath,
              range: message.data.range
            });
          }
        }
      }
    );
  }

  /**
   * Update the webview content
   */
  private _update(): void {
    logDebug('[WEBVIEW] _update called');
    const webview = this._panel?.webview;

    if (!webview) {
      logDebug('[WEBVIEW] No webview available to update');
      return;
    }

    logDebug(`[WEBVIEW] Posting message to webview - hasAnalysis: ${!!this._analysis}, hasFacts: ${!!this._facts}`);

    // Create slim payload to avoid VS Code message size limits (approx 1MB)
    const slimAnalysis = this._analysis ? {
      ...this._analysis,
      // Truncate markdown if too large (8000 chars ~ 2-3KB)
      markdown: this._analysis.markdown?.length > 8000 
        ? this._analysis.markdown.slice(0, 8000) + '... [truncated]' 
        : this._analysis.markdown,
      // Limit block items
      blocks: this._analysis.blocks.map(b => ({
        ...b,
        claims: b.claims.slice(0, 20),
        actions: b.actions.slice(0, 20)
      }))
    } : undefined;

    const slimFacts = this._facts ? {
      ...this._facts,
      // Remove large hybridFacts object - UI uses summaries anyway
      hybridFacts: undefined, 
      evidence: {
        ...this._facts.evidence,
        // Truncate large evidence arrays if they exist in evidence object
        "findings.incompleteness": this._truncateEvidenceArray(this._facts.evidence["findings.incompleteness"]),
        "scope.files": this._facts.evidence["scope.files"]?.slice(0, 100)
      }
    } : undefined;

    const message = {
      type: 'setData',
      analysis: slimAnalysis,
      facts: slimFacts
    };

    // Check size and warn/slim further if needed
    const messageStr = JSON.stringify(message);
    logDebug(`[WEBVIEW] Message size: ${messageStr.length} chars`);
    
    if (messageStr.length > 1000000) {
      logError('[WEBVIEW] Message too large, further slimming needed');
      // Emergency slimming: drop markdown and more evidence
      if (message.analysis) message.analysis.markdown = '';
      if (message.facts && message.facts.evidence) {
        // Clear specific evidence fields
        message.facts.evidence = {} as any; 
      }
    }

    webview.postMessage(message);
    logDebug('[WEBVIEW] Message posted to webview');
  }

  private _truncateEvidenceArray(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    const result: any = {};
    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        result[key] = obj[key].slice(0, 50);
      } else {
        result[key] = obj[key];
      }
    }
    return result;
  }

  /**
   * Navigate to a specific commit section in the report
   */
  public navigateToCommitSection(commitSha: string): void {
    const webview = this._panel?.webview;
    if (!webview) {
      return;
    }

    // Send scroll message to webview
    webview.postMessage({
      type: 'scrollToSection',
      sectionId: `commit-${commitSha.substring(0, 8)}`
    });
  }

  /**
   * Scroll to a specific section in the report (e.g., "overview", "incompleteness", "drift", "legacy", "timeline")
   */
  public scrollToSection(sectionId: string): void {
    const webview = this._panel?.webview;
    if (!webview) {
      return;
    }

    // Send scroll message to webview
    webview.postMessage({
      type: 'scrollToSection',
      sectionId
    });
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
   * Post a message to the report webview (helper for external callers)
   */
  public postMessage(message: any): void {
    const webview = this._panel?.webview;
    if (!webview) {
      return;
    }
    webview.postMessage(message);
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
