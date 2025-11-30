import * as vscode from 'vscode';
import { AppShell } from '../core/appShell';
import { CommitsProvider } from '../providers/commitsProvider';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { RefactorReportProvider } from '../webview/reports/refactorReportProvider';
import { getRefactorPipeline } from '../services/pipelineFactory';
import { GitOperations } from '../analysis/git';
import { updateContexts, refreshCockpitState } from '../core/stateUpdaters';
import { getCockpitOrchestrator } from '../state/cockpitOrchestrator';
import { getExtensionConfig } from '../utils/config';
import { logInfo, logError } from '../utils/logger';

export async function registerCoreFeatures(
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

  // Analyze last N commits
  shell.registerCommand('git-context.analyzeLastCommits', async (context, countArg) => {
    const config = getExtensionConfig();
    const count = countArg || await vscode.window.showInputBox({
      prompt: 'Number of commits to analyze',
      value: config.defaultCommitCount.toString(),
      validateInput: (value) => {
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a positive number';
        }
        return undefined;
      }
    });

    if (count) {
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing commits...',
        cancellable: true
      }, async (progress, token) => {
        try {
          await providers.commitsProvider.initializeDatabase();
          const pipeline = await getRefactorPipeline();
          const git = new GitOperations();
          const commits = await git.getRecentCommits(parseInt(count));
          const shas = commits.map(c => c.sha);

          // Report progress
          progress.report({ increment: 0, message: `Analyzing ${shas.length} commits...` });

          // Check for cancellation
          if (token.isCancellationRequested) {
            return;
          }

          // Just index commits (quick metadata load)
          progress.report({ increment: 25, message: 'Indexing commits...' });
          if (token.isCancellationRequested) return;

          await pipeline.indexCommits(shas);

          // Refresh UI to show indexed commits
          progress.report({ increment: 50, message: 'Refreshing UI...' });
          if (token.isCancellationRequested) return;

          await providers.commitsProvider.refresh();
          await refreshCockpitState(orchestrator, providers, 'command:analyzeLastCommits');

          progress.report({ increment: 100, message: 'Complete' });
          vscode.window.showInformationMessage(`Indexed ${shas.length} commits`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to analyze commits: ${error}`);
        }
      });
    }
  });

  // Analyze staged changes
  shell.registerCommand('git-context.analyzeStagedChanges', async (context) => {
    try {
      await providers.commitsProvider.initializeDatabase();
      const pipeline = await getRefactorPipeline();
      const workspaceIndexer = pipeline.workspaceIndexer; // Expose as property

      const facts = await workspaceIndexer.analyzeWorkspace('staged');

      if (!facts) {
        vscode.window.showInformationMessage('No staged changes to analyze');
        return;
      }

      orchestrator.updateState({
        workspaceFacts: facts,
        activeSection: 'live'
      }, 'command:analyzeStagedChanges');

      await providers.commitsProvider.refresh();
      await refreshCockpitState(orchestrator, providers, 'command:analyzeStaged');

      vscode.window.showInformationMessage(`Analyzed ${facts.filesChanged} staged files`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze staged changes: ${error}`);
    }
  });

  // Analyze unstaged changes
  shell.registerCommand('git-context.analyzeUnstagedChanges', async (context) => {
    try {
      await providers.commitsProvider.initializeDatabase();
      const pipeline = await getRefactorPipeline();
      const workspaceIndexer = pipeline.workspaceIndexer;

      const facts = await workspaceIndexer.analyzeWorkspace('unstaged');
      if (!facts) {
        vscode.window.showInformationMessage('No unstaged files to analyze');
        return;
      }

      orchestrator.updateState({
        workspaceFacts: facts,
        activeSection: 'live'
      }, 'command:analyzeUnstagedChanges');

      await providers.commitsProvider.refresh();
      await refreshCockpitState(orchestrator, providers, 'command:analyzeUnstaged');
      vscode.window.showInformationMessage(`Analyzed ${facts.filesChanged} unstaged files`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze unstaged changes: ${error}`);
    }
  });

  // Open symbol in file
  shell.registerCommand('git-context.openSymbol', async (context, sha, filePath, range) => {
    try {
      const { getGitRoot } = await import('../utils/config');
      const gitRoot = getGitRoot();
      if (!gitRoot) {
        vscode.window.showErrorMessage('Not in a git repository');
        return;
      }
      const fullPath = vscode.Uri.file(`${gitRoot}/${filePath}`);
      const doc = await vscode.workspace.openTextDocument(fullPath);
      const editor = await vscode.window.showTextDocument(doc);
      if (range) {
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  });

  // Toggle commit selection
  shell.registerCommand('git-context.toggleCommitSelection', async (context, shaOrItem) => {
    const sha = typeof shaOrItem === 'string' ? shaOrItem : (shaOrItem?.id || shaOrItem?.sha);
    if (sha) {
      // Update orchestrator state instead of provider
      const state = orchestrator.getState();
      const selected = new Set(state.selectedCommitShas);
      if (selected.has(sha)) {
        selected.delete(sha);
      } else {
        selected.add(sha);
      }
      orchestrator.updateState({ selectedCommitShas: Array.from(selected) }, 'command:toggleCommit');
      await updateContexts();
    }
  });

  // Clear selection
  shell.registerCommand('git-context.clearSelection', async (context) => {
    orchestrator.updateState({
      selectedCommitShas: [],
      selectedStagedPaths: [],
      selectedUnstagedPaths: []
    }, 'command:clearSelection');
    await updateContexts();
  });

  // Copy SHA
  shell.registerCommand('git-context.copySha', async (context, sha) => {
    await vscode.env.clipboard.writeText(sha);
    vscode.window.showInformationMessage(`Copied SHA: ${sha.substring(0, 8)}`);
  });

  // Add commit by SHA
  shell.registerCommand('git-context.addCommitBySha', async (context, shaOrRef) => {
    try {
      let sha = shaOrRef;
      // Simple validation - if it looks like a SHA, use it
      if (!/^[0-9a-f]{7,40}$/i.test(shaOrRef)) {
        // Try to resolve as a ref using git command
        const { GitOperations } = await import('../analysis/git');
        try {
          const git = new GitOperations();
          const simpleGit = require('simple-git');
          const gitRoot = git.getRoot();
          const gitInstance = simpleGit(gitRoot);
          sha = await gitInstance.revparse([shaOrRef]);
        } catch {
          vscode.window.showErrorMessage(`Could not resolve ref: ${shaOrRef}`);
          return;
        }
      }
      if (sha) {
        const state = orchestrator.getState();
        const selected = new Set(state.selectedCommitShas);
        selected.add(sha);
        orchestrator.updateState({ selectedCommitShas: Array.from(selected) }, 'command:addCommitBySha');
        await updateContexts();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add commit: ${error}`);
    }
  });

  // Select all staged
  shell.registerCommand('git-context.selectAllStaged', async (context) => {
    const state = orchestrator.getState();
    const stagedPaths = state.stagedFiles.map(f => f.path);
    orchestrator.updateState({ selectedStagedPaths: stagedPaths }, 'command:selectAllStaged');
  });

  // Select all unstaged
  shell.registerCommand('git-context.selectAllUnstaged', async (context) => {
    const state = orchestrator.getState();
    const unstagedPaths = state.unstagedFiles.map(f => f.path);
    orchestrator.updateState({ selectedUnstagedPaths: unstagedPaths }, 'command:selectAllUnstaged');
  });

  // Add more commits
  shell.registerCommand('git-context.addMoreCommits', async (context) => {
    try {
      providers.commitsProvider.loadMoreOffset += 20;
      await providers.commitsProvider.refresh();
      await refreshCockpitState(orchestrator, providers, 'command:addMoreCommits');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to load more commits: ${error}`);
    }
  });

  // Reset all
  shell.registerCommand('git-context.resetAll', async (context) => {
    orchestrator.updateState({
      selectedCommitShas: [],
      selectedStagedPaths: [],
      selectedUnstagedPaths: [],
      bundleFacts: null,
      bundleSummary: null
    }, 'command:resetAll');
    providers.commitsProvider.loadMoreOffset = 0;
    await updateContexts();
    await refreshCockpitState(orchestrator, providers, 'command:resetAll');
  });

  // Bundle clear
  shell.registerCommand('git-context.bundle.clear', async (context) => {
    orchestrator.updateState({
      bundleFacts: null,
      bundleSummary: null
    }, 'command:bundleClear');
    // Clear bundle state (provider method may not exist, that's ok)
    await updateContexts();
  });

  // Bundle cancel
  shell.registerCommand('git-context.bundle.cancel', async (context) => {
    // Cancel any running analysis
    orchestrator.updateState({ isAnalyzing: false }, 'command:bundleCancel');
  });

  // Bundle export
  shell.registerCommand('git-context.bundle.export', async (context) => {
    const state = orchestrator.getState();
    if (!state.bundleFacts) {
      vscode.window.showWarningMessage('No active bundle to export');
      return;
    }
    try {
      const filePath = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('bundle-facts.json'),
        filters: { 'JSON files': ['json'], 'All files': ['*'] }
      });
      if (filePath) {
        const fs = await import('fs');
        fs.writeFileSync(filePath.fsPath, JSON.stringify(state.bundleFacts, null, 2));
        vscode.window.showInformationMessage(`Bundle exported to ${filePath.fsPath}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export bundle: ${error}`);
    }
  });

  // Scroll to report section
  shell.registerCommand('git-context.scrollToReportSection', async (context, sectionId) => {
    // Forward to report webview
    logInfo(`Scroll to section: ${sectionId}`);
  });

  // Open symbol history
  shell.registerCommand('git-context.openSymbolHistory', async (context, symbolId) => {
    try {
      // Show symbol history in a new document
      const { getDatabaseManager } = await import('../storage/database');
      const db = getDatabaseManager().getDatabase();
      const history = db.prepare(`
        SELECT sha, name, path, change_type, diff_snippet_post
        FROM symbols
        WHERE symbol_id = ?
        ORDER BY id DESC
        LIMIT 20
      `).all(symbolId);

      const content = `# Symbol History: ${symbolId}\n\n${history.map((h: any) =>
        `## ${h.sha.substring(0, 8)} - ${h.change_type}\n\`\`\`\n${h.diff_snippet_post || 'N/A'}\n\`\`\`\n`
      ).join('\n')}`;

      const doc = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
      await vscode.window.showTextDocument(doc);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show symbol history: ${error}`);
    }
  });

  // Download WASM files
  shell.registerCommand('git-context.downloadWasmFiles', async (context) => {
    try {
      const { spawn } = require('child_process');
      const path = require('path');

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading required WASM files...',
        cancellable: false
      }, async (progress) => {
        return new Promise<void>((resolve, reject) => {
          const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'download-wasm.js');
          const nodeProcess = spawn('node', [scriptPath], {
            cwd: path.join(__dirname, '..', '..'),
            stdio: 'pipe'
          });

          let output = '';
          nodeProcess.stdout.on('data', (data: Buffer) => {
            output += data.toString();
            const lines = data.toString().split('\n').filter((l: string) => l.trim());
            lines.forEach((line: string) => {
              if (line.includes('Downloading') || line.includes('Downloaded') || line.includes('%')) {
                progress.report({ message: line });
              }
            });
          });

          nodeProcess.stderr.on('data', (data: Buffer) => {
            output += data.toString();
          });

          nodeProcess.on('close', (code: number) => {
            if (code === 0) {
              vscode.window.showInformationMessage('WASM files downloaded successfully!');
              resolve();
            } else {
              vscode.window.showErrorMessage(`Failed to download WASM files: ${output}`);
              reject(new Error(`Process exited with code ${code}`));
            }
          });
        });
      });
    } catch (error) {
      logError('Failed to download WASM files:', error);
      vscode.window.showErrorMessage(`Failed to download WASM files: ${error}`);
    }
  });

  logInfo('Core features registered successfully');
}