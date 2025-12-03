import * as path from 'path';
import * as vscode from 'vscode';
import { EvidenceLink, LlmAnalysis } from '../../analysis/llmAnalyst/blocks';
import { resolveEvidencePath } from '../../analysis/llmAnalyst/renderer';
import { LlmAnalysisSchema } from '../../analysis/llmAnalyst/schemas';
import { RefactorBundleFacts } from '../../facts/types';
import { BundleFactsSchema } from '../../state/schemas';
import { getStore } from '../../state/store';
import {
  ReportClientMessageSchema,
  ReportHostMessage,
  ReportHostMessageSchema,
} from '../../types/reportWebview';
import { getGitRoot } from '../../utils/config';
import { logDebug, logError } from '../../utils/logger';

/**
 * Webview provider for the refactor report
 */
export class RefactorReportProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'gitContext.refactorReport';
  private _panel: vscode.WebviewPanel | undefined;
  private _analysis: LlmAnalysis | undefined;
  private _facts: RefactorBundleFacts | undefined;

  constructor(private readonly _extensionUri: vscode.Uri) {
    //empty
  }

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
      if (this._panel.visible) {
        this._update();
      } else {
        vscode.commands.executeCommand('gitContext.refactorReport.focus');

        this._update();
      }
    } else {
      vscode.commands.executeCommand('gitContext.refactorReport.focus');
    }
  }

  /**
   * VS Code WebviewViewProvider interface
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._panel = webviewView as any;

    webviewView.title = 'Refactor Intelligence Report';

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    if (this._analysis && this._facts) {
      this._update();
    }

    webviewView.onDidDispose(() => {
      this._panel = undefined;
    });

    webviewView.webview.onDidReceiveMessage(async message => {
      const parsed = ReportClientMessageSchema.safeParse(message);
      if (!parsed.success) {
        logError('[WEBVIEW] Invalid report message received', message);
        return;
      }

      if (parsed.data.type === 'evidenceClick') {
        await this._handleEvidenceClick(parsed.data.evidence);
        return;
      }

      if (parsed.data.type === 'action' && parsed.data.action === 'delete') {
        await vscode.commands.executeCommand('git-context.applyRefactor', {
          action: 'delete',
          symbolId: parsed.data.data?.symbolId,
          filePath: parsed.data.data?.filePath,
          range: parsed.data.data?.range,
        });
      }
    });
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

    if (!this._analysis || !this._facts) {
      logDebug('[WEBVIEW] Skipping update - analysis or facts missing');
      return;
    }

    logDebug('[WEBVIEW] Posting message to webview with validated data');

    const slimAnalysis = this._analysis
      ? {
          ...this._analysis,

          markdown:
            this._analysis.markdown?.length > 8000
              ? this._analysis.markdown.slice(0, 8000) + '... [truncated]'
              : this._analysis.markdown,

          blocks: this._analysis.blocks.map(b => ({
            ...b,
            claims: b.claims.slice(0, 20),
            actions: b.actions.slice(0, 20),
          })),
        }
      : undefined;

    const slimFacts = this._facts
      ? {
          ...this._facts,

          hybridFacts: undefined,
          evidence: {
            ...this._facts.evidence,

            'findings.incompleteness': this._truncateEvidenceArray(
              this._facts.evidence['findings.incompleteness']
            ),
            'scope.files': this._facts.evidence['scope.files']?.slice(0, 100),
          },
        }
      : undefined;

    const validatedAnalysis = LlmAnalysisSchema.parse(slimAnalysis);
    const validatedFacts = BundleFactsSchema.parse(slimFacts as any);

    const message: ReportHostMessage = {
      type: 'setData',
      analysis: validatedAnalysis,
      facts: validatedFacts,
    };

    const messageStr = JSON.stringify(message);
    logDebug(`[WEBVIEW] Message size: ${messageStr.length} chars`);

    if (messageStr.length > 1000000) {
      logError('[WEBVIEW] Message too large, further slimming needed');

      if (message.analysis) message.analysis.markdown = '';
      if (message.facts && message.facts.evidence) {
        message.facts.evidence = {} as any;
      }
    }

    this._postMessage(message);
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

  public navigateToCommitSection(commitSha: string): void {
    this._postMessage({
      type: 'scrollToSection',
      sectionId: `commit-${commitSha.substring(0, 8)}`,
    });
  }

  public scrollToSection(sectionId: string): void {
    this._postMessage({
      type: 'scrollToSection',
      sectionId,
    });
  }

  private async _handleEvidenceClick(evidence: EvidenceLink): Promise<void> {
    try {
      if (!this._facts) {
        vscode.window.showErrorMessage('Facts data not available');
        return;
      }

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
          preview: false,
        };

        if (resolved.lineNumber !== undefined) {
          options.selection = new vscode.Range(
            resolved.lineNumber - 1,
            0,
            resolved.lineNumber - 1,
            1000
          );
        }

        await vscode.window.showTextDocument(doc, options);
      } else if (evidence.filePath) {
        const uri = vscode.Uri.file(evidence.filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
          preview: false,
          selection: evidence.lineNumber
            ? new vscode.Range(evidence.lineNumber - 1, 0, evidence.lineNumber - 1, 0)
            : undefined,
        });
      } else if (evidence.symbolId) {
        const filePath = evidence.symbolId.split(':')[0];
        if (filePath) {
          const uri = vscode.Uri.file(filePath);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      } else {
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
              : undefined,
          });
        } else {
          vscode.window.showInformationMessage(
            `Evidence: ${evidence.description}\nPath: ${evidence.path}`
          );
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open evidence: ${error}`);
    }
  }

  public postMessage(message: any): void {
    const webview = this._panel?.webview;
    if (!webview) {
      return;
    }
    this._postMessage(message as ReportHostMessage);
  }

  private _postMessage(message: ReportHostMessage): void {
    const parsed = ReportHostMessageSchema.safeParse(message);
    if (!parsed.success) {
      logError('[WEBVIEW] Refusing to send invalid report message', message);
      return;
    }

    getStore().dispatch({
      type: 'WEBVIEW_MESSAGE',
      payload: { message: parsed.data, target: 'report' },
    });
  }

  private _resolveEvidencePath(
    pathParts: string[],
    facts?: RefactorBundleFacts
  ): { filePath?: string; lineNumber?: number } | null {
    if (!facts) return null;

    try {
      let current: any = facts;

      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];

        if (part.includes('[')) {
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
      //empty
    }

    return null;
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'styles.css')
    );

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

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
