import * as vscode from 'vscode';
import { AppShell } from '../core/appShell';
import { updateContexts } from '../core/stateUpdaters';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { CockpitEffects } from '../state/effects';
import { getStore } from '../state/store';
import { logError, logInfo } from '../utils/logger';
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

  new CockpitEffects(store, providers);

  // Keep the Cockpit view in sync with the latest analysis/facts
  if (providers.cockpitProvider) {
    let lastFactsKey: string | null = null;
    let lastSummaryKey: string | null = null;

    const pushCockpitUpdate = async () => {
      const state = orchestrator.getState();
      const facts = state.bundleFacts;
      const summary = state.bundleSummary;

      if (!facts || !summary) return;

      const factsKey = `${facts.generated_at || ''}|${facts.bundle?.newestSha || ''}|${facts.bundle?.shas?.join(',') || ''}`;
      const summaryKey = `${summary.id || ''}|${summary.commitCount || 0}|${summary.fileCount || 0}`;

      if (factsKey === lastFactsKey && summaryKey === lastSummaryKey) {
        return;
      }

      lastFactsKey = factsKey;
      lastSummaryKey = summaryKey;

      try {
        const { GitOperations } = await import('../analysis/git');
        const { getGitRoot } = await import('../utils/config');
        const git = new GitOperations();
        const gitRoot = getGitRoot();
        let repoName: string | null = null;
        let branchName: string | null = null;
        try {
          repoName = gitRoot ? gitRoot.split('/').pop() || null : null;
          branchName = await git.getCurrentBranch();
        } catch {
          // Ignore errors
        }

        providers.cockpitProvider!.showCockpit(facts, summary, {
          llmOutputs: state.llmOutputs,
          retrievedHistory: state.retrievedHistory,
          repoName,
          branchName,
        });
      } catch (error) {
        logError('[CockpitFeatures] Failed to update cockpit', error);
      }
    };

    // Initial sync in case facts already exist
    pushCockpitUpdate();

    // Sync live analysis state to cockpit provider
    const pushLiveAnalysisUpdate = () => {
      const state = orchestrator.getState();
      const liveAnalysis = state.liveAnalysis;

      if (!providers.cockpitProvider || !liveAnalysis) return;

      try {
        // Update live analysis state in provider
        providers.cockpitProvider.updateLiveAnalysis(liveAnalysis);
      } catch (error) {
        logError('[CockpitFeatures] Failed to update live analysis', error);
      }
    };

    shell.registerFeature({
      effects: [
        {
          key: ['bundleFacts', 'bundleSummary'],
          priority: 50,
          handler: pushCockpitUpdate,
        },
        {
          key: ['liveAnalysis'],
          priority: 50,
          handler: pushLiveAnalysisUpdate,
        },
      ],
    });
  }

  // Keep the Refactor Report view in sync with the latest analysis/facts (including skeleton data)
  if (providers.refactorReportProvider) {
    let lastFactsKey: string | null = null;
    let lastAnalysisKey: string | null = null;

    const pushReportUpdate = () => {
      const state = orchestrator.getState();
      const facts = state.bundleFacts as any;
      const analysis = (state.llmOutputs as any)?.llmAnalysis || (state.llmOutputs as any);

      if (!facts || !analysis) return;

      const factsKey = `${facts.generated_at || ''}|${facts.bundle?.newestSha || ''}|${facts.bundle?.shas?.join(',') || ''}`;
      const analysisKey = `${analysis.summary || analysis.title || ''}|${(analysis.markdown || '').length}`;

      if (factsKey === lastFactsKey && analysisKey === lastAnalysisKey) {
        return;
      }

      lastFactsKey = factsKey;
      lastAnalysisKey = analysisKey;

      providers.refactorReportProvider!.showReport(analysis, facts);
    };

    // Initial sync in case facts already exist
    pushReportUpdate();

    shell.registerFeature({
      effects: [
        {
          key: ['bundleFacts', 'llmOutputs'],
          priority: 50,
          handler: pushReportUpdate,
        },
      ],
    });
  }

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

  shell.registerCommand('git-context.generateLiveReport', async () => {
    const liveEngine = (orchestrator as any).liveEngine;
    if (liveEngine) {
      await liveEngine.analyze();
    }
  });

  shell.registerCommand('git-context.openEvidence', async (_context, args) => {
    try {
      if (Array.isArray(args) && args.length > 0) {
        args = args[0];
      }
      const { filePath, lineNumber, description: _description, path: jsonPath } = args;
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

  shell.registerCommand('git-context.applyRefactor', async (_context, args) => {
    try {
      if (Array.isArray(args) && args.length > 0) {
        args = args[0];
      }
      const { action, symbolId, filePath, range, suggestedName } = args;

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

          const doc = await vscode.workspace.openTextDocument(uri);
          await doc.save();
        } else {
          vscode.window.showErrorMessage(`Failed to apply edit to ${filePath}`);
        }
      } else if (action === 'rename' && suggestedName && symbolId) {
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

  shell.registerCommand('git-context.openReport', async (_context, reportId) => {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      const report = reportManager.load(reportId);

      if (report && report.analysis && report.analysis.markdown) {
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

  shell.registerCommand('git-context.regenerateReport', async (_context, reportId) => {
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

  shell.registerCommand('git-context.deleteReport', async (_context, reportId) => {
    try {
      const { getReportManager } = await import('../storage/reportManager');
      const reportManager = getReportManager();
      reportManager.delete(reportId);
      store.dispatch({ type: 'REFRESH_REQUESTED', payload: { scope: 'reports' } });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete report: ${error}`);
    }
  });

  shell.registerCommand('git-context.togglePinReport', async (_context, reportId) => {
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

  shell.registerCommand('git-context.bundle.regenerate', async _context => {
    await vscode.commands.executeCommand('git-context.analyze');
  });

  shell.registerFeature({
    effects: [
      {
        key: 'bundleFacts',
        handler: async _change => {
          await updateContexts();
        },
        priority: 50,
      },
    ],
  });

  logInfo('Cockpit features registered successfully');
}
