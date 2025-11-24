import * as vscode from 'vscode';
import { CommitTrackerProvider } from './commitTracker';
import { SymbolHistoryProvider } from './symbolHistory';
import { analyzeLastCommits, analyzeStagedChanges, analyzeCommit } from '../cli/analyze';
import { showCommit, searchSymbol } from '../cli/queries';
import { getExtensionConfig } from '../utils/config';
import { LLMSummarizer } from '../llm/summarizer';
import { generateRefactorBundleReport } from './report';
import { RefactorReportProvider } from '../webview/refactorReportProvider';
import * as fs from 'fs';
import * as path from 'path';

export function registerCommands(
  context: vscode.ExtensionContext,
  commitTracker: CommitTrackerProvider,
  symbolHistory: SymbolHistoryProvider,
  refactorReportProvider?: RefactorReportProvider
) {
  try {
    // Analyze last N commits
    const analyzeLastCommitsCmd = vscode.commands.registerCommand(
      'git-context.analyzeLastCommits',
      async () => {
        const config = getExtensionConfig();
        const count = await vscode.window.showInputBox({
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
            cancellable: false
          }, async (progress) => {
            try {
              // Ensure database is initialized before analyzing
              await commitTracker.initializeDatabase();
              await analyzeLastCommits(parseInt(count));
              commitTracker.refresh();
              vscode.window.showInformationMessage(`Analyzed last ${count} commits`);
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to analyze commits: ${error}`);
            }
          });
        }
      }
    );

    // Analyze staged changes
    const analyzeStagedCmd = vscode.commands.registerCommand(
      'git-context.analyzeStagedChanges',
      async () => {
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Analyzing staged changes...',
          cancellable: false
        }, async (progress) => {
          try {
            // Ensure database is initialized before analyzing
            await commitTracker.initializeDatabase();
            await analyzeStagedChanges();
            commitTracker.refresh();
            vscode.window.showInformationMessage('Analyzed staged changes');
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze staged changes: ${error}`);
          }
        });
      }
    );

    // Compare files to commit
    const compareFilesCmd = vscode.commands.registerCommand(
      'git-context.compareFilesToCommit',
      async () => {
        // Pick commit
        const commit = await vscode.window.showQuickPick(
          await getRecentCommits(),
          {
            placeHolder: 'Select commit to compare against'
          }
        );

        if (!commit) return;

        // Pick files
        const files = await vscode.window.showOpenDialog({
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: true,
          openLabel: 'Compare Selected Files'
        });

        if (!files || files.length === 0) return;

        // Get current commit
        const currentCommit = await getCurrentCommit();
        if (!currentCommit) {
          vscode.window.showErrorMessage('Could not determine current commit');
          return;
        }

        // Compare files
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Comparing files...',
          cancellable: false
        }, async (progress) => {
          try {
            const llm = new LLMSummarizer();
            const filePaths = files.map(f => vscode.workspace.asRelativePath(f.fsPath));

            const explanation = await llm.compareFiles(
              currentCommit,
              'HEAD',
              commit.detail || commit.label,
              commit.description || 'Selected commit',
              filePaths,
              'File comparison requested',
              []
            );

            // Show result in new document
            const doc = await vscode.workspace.openTextDocument({
              content: `# File Comparison: HEAD vs ${commit.label}\n\n${explanation}`,
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);

          } catch (error) {
            vscode.window.showErrorMessage(`Failed to compare files: ${error}`);
          }
        });
      }
    );

    // Explain symbol change
    const explainSymbolCmd = vscode.commands.registerCommand(
      'git-context.explainSymbolChange',
      async () => {
        // Get symbol from current cursor position or selection
        const symbol = await getSymbolAtCursor();
        if (!symbol) {
          vscode.window.showErrorMessage('No symbol found at cursor position');
          return;
        }

        // Get commit to compare against
        const commit = await vscode.window.showQuickPick(
          await getRecentCommits(),
          {
            placeHolder: 'Select commit to compare symbol against'
          }
        );

        if (!commit) return;

        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Explaining symbol changes...',
          cancellable: false
        }, async (progress) => {
          try {
            const llm = new LLMSummarizer();

            // TODO: Get actual symbol code before/after
            const explanation = await llm.explainSymbolChange(
              symbol.name,
              'modified',
              symbol.file,
              symbol.line,
              '// Previous code',
              '// Current code',
              commit.detail || commit.label,
              commit.description || 'Selected commit'
            );

            // Show result in new document
            const doc = await vscode.workspace.openTextDocument({
              content: `# Symbol Change: ${symbol.name}\n\n${explanation}`,
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc);

          } catch (error) {
            vscode.window.showErrorMessage(`Failed to explain symbol: ${error}`);
          }
        });
      }
    );

    // Search symbols
    const searchSymbolsCmd = vscode.commands.registerCommand(
      'git-context.searchSymbols',
      async () => {
        const query = await vscode.window.showInputBox({
          placeHolder: 'Search for a symbol (e.g. function name, class name)',
          prompt: 'Enter symbol name to search history'
        });

        if (query !== undefined) {
          symbolHistory.setSearchQuery(query);
        }
      }
    );

    // Initialize database (lazy initialization)
    const initializeDatabaseCmd = vscode.commands.registerCommand(
      'git-context.initializeDatabase',
      async () => {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Initializing database...',
          cancellable: false
        }, async (progress) => {
          try {
            await commitTracker.initializeDatabase();
            vscode.window.showInformationMessage('Database initialized successfully');
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to initialize database: ${error}`);
          }
        });
      }
    );

    // Open symbol in file
    const openSymbolCmd = vscode.commands.registerCommand(
      'git-context.openSymbol',
      async (sha: string, filePath: string, range?: vscode.Range) => {
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
      }
    );

    // Generate commit analysis report
    const generateReportCmd = vscode.commands.registerCommand(
      'git-context.generateReport',
      async () => {
        if (commitTracker.runningTask) {
          vscode.window.showWarningMessage('Analysis already running');
          return;
        }

        const selectedCount = commitTracker.selectedCommits.size;
        if (selectedCount > 0) {
          // Generate report for selected commits
          const shas = Array.from(commitTracker.selectedCommits) as string[];
          const cancellationTokenSource = new vscode.CancellationTokenSource();
          commitTracker.runningTask = { cancel: () => cancellationTokenSource.cancel(), token: cancellationTokenSource.token };

          try {
            await generateRefactorBundleReport(shas, refactorReportProvider, cancellationTokenSource.token, commitTracker);
          } finally {
            commitTracker.runningTask = null;
            commitTracker.refresh();
          }
          // Selection persists after bundle generation for iterative workflow
        } else {
          vscode.window.showWarningMessage('Please select commits first (use checkboxes in tree view) to analyze as a refactor bundle.');
        }
      }
    );

    // Toggle commit selection
    const toggleSelectionCmd = vscode.commands.registerCommand(
      'git-context.toggleCommitSelection',
      async (item: any) => {
        if (item && item.id) {
          commitTracker.toggleCommitSelection(item.id);
        }
      }
    );

    // Clear selection
    const clearSelectionCmd = vscode.commands.registerCommand(
      'git-context.clearSelection',
      () => {
        commitTracker.clearSelection();
      }
    );

    // Export LLM Context
    const exportContextCmd = vscode.commands.registerCommand(
      'git-context.exportLlmContext',
      async () => {
        const selectedShas = Array.from(commitTracker.selectedCommits);
        if (selectedShas.length === 0) {
          vscode.window.showErrorMessage('Please select commits first (use checkboxes in tree view)');
          return;
        }

        try {
          const { ContextExporter } = await import('../analysis/contextExporter');
          const exporter = new ContextExporter();

          const filePath = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('.git/commit-tracker/commit-context.json'),
            filters: {
              'JSON files': ['json'],
              'All files': ['*']
            }
          });

          if (filePath) {
            const outputPath = await exporter.exportToFile(selectedShas, filePath.fsPath);
            const openFile = await vscode.window.showInformationMessage(
              `LLM Context exported to ${outputPath}`,
              'Open File'
            );

            if (openFile === 'Open File') {
              const doc = await vscode.workspace.openTextDocument(outputPath);
              await vscode.window.showTextDocument(doc);
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to export LLM context: ${error}`);
        }
      }
    );

    // Show refactor report command
    const showRefactorReportCmd = vscode.commands.registerCommand(
      'git-context.showRefactorReport',
      async () => {
        try {
          const { getGitRoot } = await import('../utils/config');
          const gitRoot = getGitRoot();
          if (!gitRoot) return;

          const fs = await import('fs');
          const path = await import('path');

          // Try to load cached analysis and facts
          const analysisPath = path.join(gitRoot, '.git', 'commit-tracker', 'last-bundle-analysis.json');
          const factsPath = path.join(gitRoot, '.git', 'commit-tracker', 'last-bundle-facts.json');

          if (fs.existsSync(analysisPath) && fs.existsSync(factsPath)) {
            const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
            const facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));

            const { AnalysisRenderer } = await import('../analysis/llmAnalyst/renderer');
            const renderer = new AnalysisRenderer();
            const markdown = renderer.renderAnalysis(analysis, facts);

            const doc = await vscode.workspace.openTextDocument({
              content: markdown,
              language: 'markdown'
            });
            await vscode.window.showTextDocument(doc, { preview: false });
          } else {
            // If no cached report, check if commits are selected to generate one
            if (commitTracker.selectedCommits.size >= 2) {
              vscode.commands.executeCommand('git-context.generateReport');
            } else {
              vscode.window.showInformationMessage('No report available. Select commits in the sidebar and click "Generate Report".');
            }
          }
        } catch (error) {
          console.error('Failed to show refactor report:', error);
          vscode.window.showErrorMessage(`Failed to show report: ${error}`);
        }
      }
    );

    // Regenerate bundle command
    const regenerateBundleCmd = vscode.commands.registerCommand(
      'commit-tracker.regenerateBundle',
      async () => {
        if (commitTracker.runningTask) {
          vscode.window.showWarningMessage('Analysis already running');
          return;
        }

        const selectedCount = commitTracker.selectedCommits.size;
        if (selectedCount >= 2) {
          const shas = Array.from(commitTracker.selectedCommits) as string[];
          const cancellationTokenSource = new vscode.CancellationTokenSource();
          commitTracker.runningTask = { cancel: () => cancellationTokenSource.cancel(), token: cancellationTokenSource.token };

          try {
            await generateRefactorBundleReport(shas, refactorReportProvider, cancellationTokenSource.token, commitTracker);
          } finally {
            commitTracker.runningTask = null;
            commitTracker.refresh();
          }
        } else {
          vscode.window.showWarningMessage('Select at least 2 commits to regenerate bundle analysis.');
        }
      }
    );

    // Clear bundle command
    const clearBundleCmd = vscode.commands.registerCommand(
      'commit-tracker.clearBundle',
      () => {
        commitTracker.selectedCommits.clear();
        commitTracker.lastBundleFacts = null;
        commitTracker.runningTask = null;
        commitTracker.persistState();
        commitTracker.refresh();
        vscode.window.showInformationMessage('Refactor bundle cleared');
      }
    );

    // Cancel analysis command
    const cancelAnalysisCmd = vscode.commands.registerCommand(
      'commit-tracker.cancelAnalysis',
      () => {
        if (commitTracker.runningTask) {
          commitTracker.runningTask.cancel();
          commitTracker.runningTask = null;
          commitTracker.refresh();
          vscode.window.showInformationMessage('Analysis cancelled');
        } else {
          vscode.window.showInformationMessage('No analysis currently running');
        }
      }
    );

    // Add to bundle command
    const addToBundleCmd = vscode.commands.registerCommand(
      'commit-tracker.addToBundle',
      async (item: any) => {
        if (item && item.id) {
          commitTracker.toggleCommitSelection(item.id);
          vscode.window.showInformationMessage(`Added commit to bundle (${commitTracker.selectedCommits.size} selected)`);
        }
      }
    );

    // Remove from bundle command
    const removeFromBundleCmd = vscode.commands.registerCommand(
      'commit-tracker.removeFromBundle',
      async (item: any) => {
        if (item && item.id) {
          commitTracker.toggleCommitSelection(item.id);
          vscode.window.showInformationMessage(`Removed commit from bundle (${commitTracker.selectedCommits.size} remaining)`);
        }
      }
    );

    // Open evidence command
    const openEvidenceCmd = vscode.commands.registerCommand(
      'git-context.openEvidence',
      async (args: any) => {
        try {
          // VS Code passes the arguments directly if they were JSON encoded in the command URI
          // If we wrapped them in an array in renderer.ts, we might get the first element
          // But let's handle both cases or just assume the object structure

          // If args is an array (from our previous fix attempt), extract the first item
          if (Array.isArray(args) && args.length > 0) {
            args = args[0];
          }

          const { filePath, lineNumber, description, path: jsonPath } = args;

          if (filePath) {
            const { getGitRoot } = await import('../utils/config');
            const gitRoot = getGitRoot();
            if (!gitRoot) return;

            // If filePath is just a filename, try to find it in workspace or use as is if absolute
            let fullPath = filePath;
            if (!path.isAbsolute(filePath)) {
              fullPath = path.join(gitRoot, filePath);
            }

            if (fs.existsSync(fullPath)) {
              const doc = await vscode.workspace.openTextDocument(fullPath);
              const editor = await vscode.window.showTextDocument(doc);

              if (lineNumber) {
                const line = lineNumber - 1; // VS Code is 0-indexed
                const range = new vscode.Range(line, 0, line, 0);
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
              }
            } else {
              // If file doesn't exist, maybe it's a deleted file or abstract path
              vscode.window.showInformationMessage(`Evidence refers to ${filePath} (not found on disk)`);
            }
          } else {
            // If no file path, show the raw evidence data
            // We can reuse the evidence provider logic or just show a quick pick/message
            const uri = vscode.Uri.parse(`evidence:${jsonPath}`);
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc, { preview: true });
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open evidence: ${error}`);
        }
      }
    );

    context.subscriptions.push(
      analyzeLastCommitsCmd,
      analyzeStagedCmd,
      compareFilesCmd,
      explainSymbolCmd,
      searchSymbolsCmd,
      initializeDatabaseCmd,
      openSymbolCmd,
      generateReportCmd,
      toggleSelectionCmd,
      clearSelectionCmd,
      exportContextCmd,
      showRefactorReportCmd,
      regenerateBundleCmd,
      clearBundleCmd,
      cancelAnalysisCmd,
      addToBundleCmd,
      removeFromBundleCmd,
      openEvidenceCmd
    );

    console.log('Git Context commands registered successfully');
  } catch (error) {
    console.error('Failed to register Git Context commands:', error);
    vscode.window.showErrorMessage(`Failed to register Git Context commands: ${error}`);
  }
}

async function getRecentCommits(): Promise<vscode.QuickPickItem[]> {
  // TODO: Get commits from database
  // For now, return dummy data
  return [
    {
      label: 'HEAD',
      description: 'Current commit',
      detail: 'Most recent commit'
    },
    {
      label: 'HEAD~1',
      description: 'Previous commit',
      detail: 'One commit back'
    }
  ];
}

async function getCurrentCommit(): Promise<string | undefined> {
  try {
    const { GitOperations } = await import('../analysis/git');
    const git = new GitOperations();
    return git.getHeadSha();
  } catch {
    return 'HEAD';
  }
}

async function getSymbolAtCursor(): Promise<{ name: string, file: string, line: number } | undefined> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return undefined;

  const document = editor.document;
  const position = editor.selection.active;

  // Get word at cursor
  const range = document.getWordRangeAtPosition(position);
  if (!range) return undefined;

  const symbolName = document.getText(range);
  const filePath = vscode.workspace.asRelativePath(document.uri);
  const line = position.line + 1;

  return {
    name: symbolName,
    file: filePath,
    line
  };
}

