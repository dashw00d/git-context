import * as vscode from 'vscode';
import { AppShell } from '../core/appShell';
import { CommitsProvider } from '../providers/commitsProvider';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { RefactorReportProvider } from '../webview/reports/refactorReportProvider';
import { getReportService } from '../services/reportService';
import { getCockpitOrchestrator } from '../state/cockpitOrchestrator';
import { makeWorkspaceSha, parseWorkspaceSha, isWorkspaceSha } from '../utils/workspace';
import { GitOperations } from '../analysis/git';
import { updateContexts, refreshCockpitState } from '../core/stateUpdaters';
import { logInfo, logError } from '../utils/logger';

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
          vscode.window.showInformationMessage(`Evidence refers to ${filePath} (not found on disk)`);
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
      const { action, symbolId, filePath, range } = args;

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
          range.start.line, range.start.column,
          range.end.line, range.end.column
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
      const state = orchestrator.getState();
      const selected = new Set(state.selectedCommitShas);
      const reportService = await getReportService();

      let branchLoaded = false;
      let branchName: string | null = null;
      const ensureBranch = async (): Promise<string | null> => {
        if (!branchLoaded) {
          const { GitOperations } = await import('../analysis/git');
          const git = new GitOperations();
          branchName = await git.getCurrentBranch();
          branchLoaded = true;
        }
        return branchName;
      };

      type WorkspaceRequest = {
        sha?: string;
        fromPaths: boolean;
      };
      const workspaceRequests = new Map<'staged' | 'unstaged', WorkspaceRequest>();

      if (state.selectedStagedPaths.length > 0) {
        workspaceRequests.set('staged', { sha: undefined, fromPaths: true });
      }
      if (state.selectedUnstagedPaths.length > 0) {
        workspaceRequests.set('unstaged', { sha: undefined, fromPaths: true });
      }

      for (const sha of Array.from(selected).filter(isWorkspaceSha)) {
        const parsed = parseWorkspaceSha(sha);
        if (parsed) {
          const existing = workspaceRequests.get(parsed.mode) || { sha: undefined, fromPaths: false };
          workspaceRequests.set(parsed.mode, { sha, fromPaths: existing.fromPaths });
        }
      }

      // In new architecture, workspace analysis happens as part of the pipeline
      // Just ensure workspace SHAs are in the selected set
      for (const [mode, request] of workspaceRequests.entries()) {
        if (!request.sha) {
          const currentBranch = await ensureBranch();
          request.sha = makeWorkspaceSha(mode, currentBranch);
        }
        // Normalize legacy workspace SHAs to include branch for lookup consistency
        const parsed = request.sha ? parseWorkspaceSha(request.sha) : null;
        if (parsed && !request.sha.includes('@')) {
          const currentBranch = await ensureBranch();
          request.sha = makeWorkspaceSha(mode, currentBranch);
        }

        // Check if there are actually files to analyze for this workspace mode
        const { GitOperations } = await import('../analysis/git');
        const git = new GitOperations();
        const files = mode === 'staged'
          ? await git.getStagedFiles()
          : await git.getUnstagedFiles();

        if (files.length > 0) {
          selected.add(request.sha!);
        } else if (request.fromPaths) {
          vscode.window.showInformationMessage(`No ${mode} files to analyze`);
        }
      }

      const shas = Array.from(selected);
      if (shas.length === 0) {
        vscode.window.showWarningMessage('Please select commits or workspace changes to analyze.');
        return;
      }

      // Auto-include HEAD if selection has few files
      const commitShas = shas.filter(sha => !isWorkspaceSha(sha));
      if (commitShas.length > 0) {
        const git = new GitOperations();
        let estFiles = 0;
        for (const sha of commitShas) {
          try {
            const files = await git.getFileChanges(sha);
            estFiles += files.length;
          } catch (error) {
            // Skip on error
          }
        }
        if (estFiles < 10) {
          try {
            const headSha = await git.getHeadSha();
            if (!shas.includes(headSha)) {
              logInfo(`[Auto-include] Adding HEAD (${headSha.substring(0, 8)}) to selection (${estFiles} files < 10 threshold)`);
              shas.push(headSha);
            }
          } catch (error) {
            // Skip HEAD inclusion on error
          }
        }
      }

      const cancellationTokenSource = new vscode.CancellationTokenSource();
      try {
        await reportService.generateReport(
          shas,
          'full',
          { force: forceReanalyze, cancellationToken: cancellationTokenSource.token }
        );
        await updateContexts();
        await refreshCockpitState(orchestrator, providers, 'command:analyze');
      } finally {
        await providers.commitsProvider.refresh();
      }
    } catch (error) {
      // Update UI state on error
      orchestrator.updateState({ isAnalyzing: false, error: error instanceof Error ? error.message : String(error) }, 'command:analyze:error');
      vscode.window.showErrorMessage(`Failed to analyze selection: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // Ensure UI state is reset
      orchestrator.updateState({ isAnalyzing: false }, 'command:analyze:complete');
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
          language: 'markdown'
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
      await refreshCockpitState(orchestrator, providers, 'command:deleteReport');
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
        await refreshCockpitState(orchestrator, providers, 'command:togglePinReport');
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to toggle pin: ${error}`);
    }
  });

  // Bundle regenerate
  shell.registerCommand('git-context.bundle.regenerate', async (context) => {
    await vscode.commands.executeCommand('git-context.analyze');
  });

  // Register state effects
  shell.registerFeature({
    effects: [{
      key: 'bundleFacts',
      handler: async (change) => {
        // Auto-update context keys when bundle changes
        await updateContexts();
      },
      priority: 50
    }]
  });

  logInfo('Cockpit features registered successfully');
}
