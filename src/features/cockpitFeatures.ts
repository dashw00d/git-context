import * as vscode from 'vscode';
import { AppShell } from '../core/appShell';
import { updateContexts } from '../core/stateUpdaters';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { getCockpitOrchestrator } from '../state/cockpitOrchestrator';
import { CockpitEffects } from '../state/effects';
import { getStore } from '../state/store';
import { logInfo, logError } from '../utils/logger';
import { RefactorReportProvider } from '../webview/reports/refactorReportProvider';

export async function registerCockpitFeatures(
  shell: AppShell,
  providers: {
    commitsProvider: CommitsProvider;
    activeBundleProvider: ActiveBundleProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
    cockpitProvider?: any;
    refactorReportProvider?: RefactorReportProvider;
  }
): Promise<void> {
  const orchestrator = shell.getOrchestrator();
  const store = getStore();

  // Initialize Effects System
  new CockpitEffects(store, providers);

  // Live Analysis Commands
  shell.registerCommand('git-context.startLiveAnalysis', async () => {
    const liveEngine = (orchestrator as any).liveEngine;
    if (liveEngine) {
      liveEngine.start();
    }
  });

  shell.registerCommand('git-context.stopLiveAnalysis', async () => {
    const liveEngine = (orchestrator as any).liveEngine;
    if (liveEngine) {
      liveEngine.stop();
    }
  });

  // Check if command already exists to avoid duplication error
  // shell.registerCommand already handles registration, but VS Code throws if ID exists.
  // Since we can't easily check existing commands API-side, we rely on single activation.
  // If this error happens, it means registerCockpitFeatures is called twice.

  shell.registerCommand('git-context.generateLiveReport', async () => {
    const liveEngine = (orchestrator as any).liveEngine;
    if (liveEngine) {
      await liveEngine.analyze();
    }
  });

  // Open evidence
  shell.registerCommand('git-context.openEvidence', async (context, args) => {
    try {
      if (Array.isArray(args) && args.length > 0) {
        args = args[0];
      }
      const { filePath, lineNumber, description, path: jsonPath } = args;
      if (filePath) {
        const { getGitRoot } = await import('../utils/config');
        const gitRoot = getGitRoot();
        if (!gitRoot) return;
        const path = await import('path');
        const fs = await import('fs');
        let fullPath = filePath;
        if (!path.isAbsolute(filePath)) {
          fullPath = path.join(gitRoot, filePath);
        }
        if (fs.existsSync(fullPath)) {
          const doc = await vscode.workspace.openTextDocument(fullPath);
          const editor = await vscode.window.showTextDocument(doc);
          if (lineNumber) {
            const line = lineNumber - 1;
            const range = new vscode.Range(line, 0, line, 0);
            editor.selection = new vscode.Selection(range.start, range.end);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
          }
        } else {
          vscode.window.showInformationMessage(
            `Evidence refers to ${filePath} (not found on disk)`
          );
        }
      } else {
        const uri = vscode.Uri.parse(`evidence:${jsonPath}`);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: true });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open evidence: ${error}`);
    }
  });

  // Apply refactor action
  shell.registerCommand('git-context.applyRefactor', async (context, args) => {
    try {
      if (Array.isArray(args) && args.length > 0) {
        args = args[0];
      }
      const { action, symbolId, filePath, range, suggestedName } = args;

      // Basic "Delete Symbol" implementation
      if (action === 'delete' && filePath && range) {
        const { getGitRoot } = await import('../utils/config');
        const gitRoot = getGitRoot();
        if (!gitRoot) return;

        const path = await import('path');
        const fs = await import('fs');

        let fullPath = filePath;
        if (!path.isAbsolute(filePath)) {
          fullPath = path.join(gitRoot, filePath);
        }

        if (!fs.existsSync(fullPath)) {
          vscode.window.showErrorMessage(`File not found: ${filePath}`);
          return;
        }

        const edit = new vscode.WorkspaceEdit();
        const uri = vscode.Uri.file(fullPath);
        const deleteRange = new vscode.Range(
          range.start.line,
          range.start.column,
          range.end.line,
          range.end.column
        );

        edit.delete(uri, deleteRange);
        const applied = await vscode.workspace.applyEdit(edit);

        if (applied) {
          vscode.window.showInformationMessage(`Applied refactor: Deleted symbol in ${filePath}`);
          // Optionally save document
          const doc = await vscode.workspace.openTextDocument(uri);
          await doc.save();
        } else {
          vscode.window.showErrorMessage(`Failed to apply edit to ${filePath}`);
        }
      } else if (action === 'rename' && suggestedName && symbolId) {
        // Try a conservative textual rename with user selection if multiple matches exist
        if (!filePath) {
          vscode.window.showInformationMessage(
            `Suggested rename for ${symbolId}: ${suggestedName} (no file path to apply)`
          );
          return;
        }
        const { getGitRoot } = await import('../utils/config');
        const gitRoot = getGitRoot();
        if (!gitRoot) {
          vscode.window.showInformationMessage(
            `Suggested rename for ${symbolId}: ${suggestedName} (no git root)`
          );
          return;
        }
        const fullPath = vscode.Uri.file(`${gitRoot}/${filePath}`);
        const doc = await vscode.workspace.openTextDocument(fullPath);
        const text = doc.getText();
        const parts = symbolId.split(':');
        const namePart = parts[parts.length - 1];
        const regex = new RegExp(`\\b${namePart}\\b`, 'g');
        const matches: Array<{ start: number; end: number; linePreview: string; line: number }> =
          [];
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
          const start = m.index;
          const end = m.index + namePart.length;
          const line = doc.positionAt(start).line;
          const lineText = doc.lineAt(line).text.trim();
          matches.push({ start, end, linePreview: lineText, line });
        }
        if (matches.length === 0) {
          vscode.window.showInformationMessage(
            `Suggested rename for ${symbolId}: ${suggestedName} (symbol not found)`
          );
          return;
        }

        let target = matches[0];
        if (matches.length > 1) {
          const pick = await vscode.window.showQuickPick(
            matches.map((mtch, idx) => ({
              label: `Line ${mtch.line + 1}`,
              description: mtch.linePreview,
              idx,
            })),
            { placeHolder: 'Select occurrence to rename' }
          );
          if (pick) {
            target = matches[pick.idx];
          }
        }

        const edit = new vscode.WorkspaceEdit();
        const startPos = doc.positionAt(target.start);
        const endPos = doc.positionAt(target.end);
        edit.replace(fullPath, new vscode.Range(startPos, endPos), suggestedName);
        const applied = await vscode.workspace.applyEdit(edit);
        if (applied) {
          await doc.save();
          vscode.window.showInformationMessage(`Renamed ${symbolId} → ${suggestedName}`);
        } else {
          vscode.window.showErrorMessage(`Failed to apply rename for ${symbolId}`);
        }
      } else {
        vscode.window.showErrorMessage(`Unsupported refactor action: ${JSON.stringify(args)}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply refactor: ${error}`);
    }
  });

  // Main analyze command
  shell.registerCommand('git-context.analyze', async (context, forceReanalyze = false) => {
    try {
      const selection = store.getState().selectedCommitShas || [];
      store.dispatch({
        type: 'ANALYSIS_REQUESTED',
        payload: { selection, force: !!forceReanalyze },
      });
    } catch (error) {
      logError('Analysis trigger failed:', error);
      store.dispatch({
        type: 'ANALYSIS_FAILED',
        payload: { error: error instanceof Error ? error.message : String(error) },
      });
      vscode.window.showErrorMessage(
        `Failed to trigger analysis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Open report
  shell.registerCommand('git-context.openReport', async (context, reportId) => {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (report && report.analysis && report.analysis.markdown) {
        // Open as markdown document
        const doc = await vscode.workspace.openTextDocument({
          content: report.analysis.markdown,
          language: 'markdown',
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      } else {
        vscode.window.showErrorMessage('Report not found or missing markdown content');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open report: ${error}`);
    }
  });

  // Regenerate report
  shell.registerCommand('git-context.regenerateReport', async (context, reportId) => {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);
      if (report && report.commitShas) {
        await vscode.commands.executeCommand('git-context.analyze');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to regenerate report: ${error}`);
    }
  });

  // Delete report
  shell.registerCommand('git-context.deleteReport', async (context, reportId) => {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      reportManager.delete(reportId);
      store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'reports' } });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete report: ${error}`);
    }
  });

  // Toggle pin report
  shell.registerCommand('git-context.togglePinReport', async (context, reportId) => {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);
      if (report) {
        report.isPinned = !report.isPinned;
        reportManager.save(report);
        store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'reports' } });
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to toggle pin: ${error}`);
    }
  });

  // Bundle regenerate
  shell.registerCommand('git-context.bundle.regenerate', async context => {
    await vscode.commands.executeCommand('git-context.analyze');
  });

  // Register state effects
  shell.registerFeature({
    effects: [
      {
        key: 'bundleFacts',
        handler: async change => {
          // Auto-update context keys when bundle changes
          await updateContexts();
        },
        priority: 50,
      },
    ],
  });

  logInfo('Cockpit features registered successfully');
}
