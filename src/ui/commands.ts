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
      async (shaOrItem: string | any) => {
        // Handle both direct SHA string and object with id property
        const sha = typeof shaOrItem === 'string' ? shaOrItem : (shaOrItem?.id || shaOrItem?.sha);
        if (sha) {
          commitTracker.toggleCommitSelection(sha);
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
    // Refresh debt meter and reveal bundle command (for debt meter click)
    const refreshDebtMeterAndRevealCmd = vscode.commands.registerCommand(
      'git-context.refreshDebtMeterAndReveal',
      async () => {
        try {
          const { getDebtMeter } = await import('./refactorDebtMeter');
          const debtMeter = getDebtMeter();
          
          // Refresh tree and reveal bundle
          await debtMeter.refreshTreeAndRevealBundle();
          
          // Also open the report
          await vscode.commands.executeCommand('git-context.showRefactorReport');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to refresh sidebar: ${error}`);
        }
      }
    );

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

    // Toggle workspace full
    const toggleWorkspaceFullCmd = vscode.commands.registerCommand(
      'git-context.toggleWorkspaceFull',
      () => {
        const full = commitTracker.workspaceParts.size === 2;
        commitTracker.workspaceParts.clear();
        if (!full) {
          commitTracker.workspaceParts.add('staged');
          commitTracker.workspaceParts.add('unstaged');
        }
        commitTracker.persistState();
        commitTracker.refresh();
      }
    );

    // Toggle workspace part
    const toggleWorkspacePartCmd = vscode.commands.registerCommand(
      'git-context.toggleWorkspacePart',
      (part: 'staged' | 'unstaged') => {
        if (commitTracker.workspaceParts.has(part)) {
          commitTracker.workspaceParts.delete(part);
        } else {
          commitTracker.workspaceParts.add(part);
        }
        commitTracker.persistState();
        commitTracker.refresh();
      }
    );

    // Copy SHA command
    const copyShaCmd = vscode.commands.registerCommand(
      'git-context.copySha',
      async (sha: string) => {
        await vscode.env.clipboard.writeText(sha);
        vscode.window.showInformationMessage(`Copied SHA: ${sha.substring(0, 8)}`);
      }
    );

    /**
     * View diff of a commit vs workspace (root/base)
     * 
     * IMPORTANT: Workspace is the ROOT/BASE, not HEAD.
     * - Workspace = current working directory state (staged/unstaged files)
     * - This compares a commit against the workspace state
     * - HEAD is just another commit - it has no special status here
     */
    const viewDiffVsWorkspaceCmd = vscode.commands.registerCommand(
      'git-context.viewDiffVsWorkspace',
      async (sha: string, filePath?: string) => {
        try {
          const { GitOperations } = await import('../analysis/git');
          const { getGitRoot } = await import('../utils/config');
          const git = new GitOperations();
          const gitRoot = getGitRoot();
          
          if (!gitRoot) {
            vscode.window.showErrorMessage('Git root not found');
            return;
          }
          
          if (filePath) {
            // Show diff for specific file
            const uri = vscode.Uri.parse(`git:${filePath}?${sha}`);
            await vscode.commands.executeCommand('vscode.diff', 
              vscode.Uri.file(path.join(gitRoot, filePath)),
              uri,
              `${path.basename(filePath)} (workspace vs ${sha.substring(0, 8)})`
            );
          } else {
            // Show diff for all changed files
            const files = git.getFileChanges(sha);
            if (files.length === 0) {
              vscode.window.showInformationMessage('No changes found');
              return;
            }
            
            // Open first file diff, or show list
            if (files.length === 1) {
              const uri = vscode.Uri.parse(`git:${files[0].path}?${sha}`);
              await vscode.commands.executeCommand('vscode.diff',
                vscode.Uri.file(path.join(gitRoot, files[0].path)),
                uri,
                `${path.basename(files[0].path)} (workspace vs ${sha.substring(0, 8)})`
              );
            } else {
              vscode.window.showInformationMessage(`Commit ${sha.substring(0, 8)} changed ${files.length} files. Open individual files to view diffs.`);
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to show diff: ${error}`);
        }
      }
    );

    /**
     * Compare workspace (root/base) vs a commit
     * 
     * Workspace is the ROOT/BASE for comparisons:
     * - Workspace = current working directory state (staged/unstaged files)
     * - This is the baseline against which commits are compared
     * - HEAD is just another commit - it has no special role here
     * 
     * The comparison respects workspaceParts filter (staged/unstaged/full)
     */
    const compareWorkspaceVsCommitCmd = vscode.commands.registerCommand(
      'git-context.compareWorkspaceVsCommit',
      async (commitSha: string) => {
        try {
          const { GitOperations } = await import('../analysis/git');
          const { getGitRoot } = await import('../utils/config');
          const git = new GitOperations();
          const gitRoot = getGitRoot();
          
          if (!gitRoot) {
            vscode.window.showErrorMessage('Git root not found');
            return;
          }
          
          // Get files changed in workspace (based on workspaceParts filter)
          const includeStaged = commitTracker.workspaceParts.has('staged');
          const includeUnstaged = commitTracker.workspaceParts.has('unstaged');
          
          const workspaceFiles: string[] = [];
          if (includeStaged) {
            const staged = git.getStagedFiles();
            workspaceFiles.push(...staged.map(f => f.path));
          }
          if (includeUnstaged) {
            const unstaged = git.getUnstagedFiles();
            workspaceFiles.push(...unstaged.map(f => f.path));
          }
          
          // Get files changed in commit
          const commitFiles = git.getFileChanges(commitSha);
          const commitFilePaths = commitFiles.map(f => f.path);
          
          // Find common files or show all
          const commonFiles = workspaceFiles.filter(f => commitFilePaths.includes(f));
          const filesToShow = commonFiles.length > 0 ? commonFiles : [...new Set([...workspaceFiles, ...commitFilePaths])];
          
          if (filesToShow.length === 0) {
            vscode.window.showInformationMessage('No overlapping files to compare');
            return;
          }
          
          // Show diff for first file (or let user pick)
          if (filesToShow.length === 1) {
            const filePath = filesToShow[0];
            const uri = vscode.Uri.parse(`git:${filePath}?${commitSha}`);
            await vscode.commands.executeCommand('vscode.diff',
              vscode.Uri.file(path.join(gitRoot, filePath)),
              uri,
              `${path.basename(filePath)} (workspace vs ${commitSha.substring(0, 8)})`
            );
          } else {
            // Show quick pick to select file
            const items = filesToShow.map(fp => ({
              label: path.basename(fp),
              description: fp,
              filePath: fp
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
              placeHolder: `Select file to compare (workspace vs ${commitSha.substring(0, 8)})`
            });
            
            if (selected) {
              const uri = vscode.Uri.parse(`git:${selected.filePath}?${commitSha}`);
              await vscode.commands.executeCommand('vscode.diff',
                vscode.Uri.file(path.join(gitRoot, selected.filePath)),
                uri,
                `${path.basename(selected.filePath)} (workspace vs ${commitSha.substring(0, 8)})`
              );
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to compare workspace vs commit: ${error}`);
        }
      }
    );

    /**
     * Compare two commits (neither is workspace/root)
     * 
     * Both commits are treated equally - neither is special.
     * HEAD is just another commit here, no different from any other SHA.
     * 
     * Note: For comparing against workspace (root/base), use compareWorkspaceVsCommit
     */
    const compareCommitsCmd = vscode.commands.registerCommand(
      'git-context.compareCommits',
      async (sha1: string, sha2: string) => {
        try {
          // Show diff between two commits using VS Code's built-in git diff
          // Both are just commits - no special status for either
          await vscode.commands.executeCommand('git.diff', sha1, sha2);
          vscode.window.showInformationMessage(`Comparing ${sha1.substring(0, 8)} vs ${sha2.substring(0, 8)}`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to compare commits: ${error}`);
        }
      }
    );

    /**
     * Compare HEAD vs commit (backward compatibility)
     * 
     * NOTE: HEAD is just another commit - it has no special status.
     * This command exists for backward compatibility, but HEAD is treated
     * the same as any other commit. For comparing against workspace (root/base),
     * use compareWorkspaceVsCommit instead.
     */
    const compareHeadVsCommitCmd = vscode.commands.registerCommand(
      'git-context.compareHeadVsCommit',
      async (commitSha: string) => {
        try {
          const { GitOperations } = await import('../analysis/git');
          const git = new GitOperations();
          const headSha = git.getHeadSha();
          
          // HEAD is just another commit - use general compare command
          await vscode.commands.executeCommand('git-context.compareCommits', headSha, commitSha);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to compare commits: ${error}`);
        }
      }
    );

    /**
     * Show comparison options dialog
     * 
     * IMPORTANT: Workspace is the ROOT/BASE, not HEAD.
     * - Workspace = current working directory state (staged/unstaged files) - this is the baseline
     * - HEAD = just another commit in the history - no special status
     * - Options include: workspace vs commits, and commit vs commit pairs
     */
    const showGroupingOptionsCmd = vscode.commands.registerCommand(
      'git-context.showGroupingOptions',
      async () => {
        try {
          const selectedShas = Array.from(commitTracker.selectedCommits);
          const workspaceLabel = commitTracker.workspaceParts.has('staged') && commitTracker.workspaceParts.has('unstaged')
            ? 'Full Workspace'
            : commitTracker.workspaceParts.has('staged')
            ? 'Staged Only'
            : commitTracker.workspaceParts.has('unstaged')
            ? 'Unstaged Only'
            : 'No Workspace';
          
          if (selectedShas.length === 0) {
            vscode.window.showInformationMessage('Select at least 1 commit to compare with workspace (root/base)');
            return;
          }
          
          // Generate comparison options:
          // 1. Workspace (root/base) vs each commit
          // 2. Commit vs commit pairs (HEAD is just another commit here)
          const items: vscode.QuickPickItem[] = [];
          
          // Workspace (root/base) vs each selected commit
          for (const sha of selectedShas) {
            items.push({
              label: `Workspace vs ${sha.substring(0, 8)}`,
              description: `Compare ${workspaceLabel} with commit`,
              detail: `Compare workspace state with ${sha.substring(0, 8)}`
            });
          }
          
          // Commit vs commit pairs
          for (let i = 0; i < selectedShas.length; i++) {
            for (let j = i + 1; j < selectedShas.length; j++) {
              const sha1 = selectedShas[i];
              const sha2 = selectedShas[j];
              items.push({
                label: `${sha1.substring(0, 8)} vs ${sha2.substring(0, 8)}`,
                description: `Compare these two commits`,
                detail: `Compare ${sha1.substring(0, 8)} with ${sha2.substring(0, 8)}`
              });
            }
          }
          
          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select comparison to perform'
          });
          
          if (selected) {
            if (selected.label.startsWith('Workspace vs')) {
              // Extract SHA from "Workspace vs abc12345"
              const match = selected.label.match(/Workspace vs (\w+)/);
              if (match) {
                const sha = selectedShas.find(s => s.startsWith(match[1]));
                if (sha) {
                  await vscode.commands.executeCommand('git-context.compareWorkspaceVsCommit', sha);
                }
              }
            } else {
              // Extract SHAs from "abc12345 vs def67890"
              const match = selected.label.match(/(\w+)\s+vs\s+(\w+)/);
              if (match) {
                const sha1 = selectedShas.find(s => s.startsWith(match[1]));
                const sha2 = selectedShas.find(s => s.startsWith(match[2]));
                if (sha1 && sha2) {
                  await vscode.commands.executeCommand('git-context.compareCommits', sha1, sha2);
                }
              }
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to show comparison options: ${error}`);
        }
      }
    );

    /**
     * Scroll to markdown section command
     * 
     * Navigates to a specific section in the refactor bundle markdown report.
     * Handles both standard markdown anchors and Pandoc-style anchors {#anchor-id}
     * 
     * IMPORTANT: Markdown links need to be decoded - they may be encoded in the markdown.
     */
    const scrollToMDSectionCmd = vscode.commands.registerCommand(
      'git-context.scrollToMDSection',
      async (sectionId: string) => {
        try {
          // Map tree node IDs to markdown anchor IDs
          const anchorMap: Record<string, string> = {
            'incompleteness-missing': 'incompleteness-missing',
            'incompleteness-zombies': 'incompleteness-zombies',
            'drift-hotspots': 'drift-hotspots',
            'legacy-dead': 'legacy-dead',
            'refactor-bundle-incompleteness': 'incompleteness',
            'refactor-bundle-drift': 'drift',
            'refactor-bundle-legacy': 'legacy',
            'refactor-bundle-timeline': 'timeline'
          };
          
          // Decode section ID if it's encoded (handle URL encoding)
          let decodedSectionId = sectionId;
          try {
            decodedSectionId = decodeURIComponent(sectionId);
          } catch {
            // If decoding fails, use original
          }
          
          const anchorId = anchorMap[decodedSectionId] || decodedSectionId;
          
          // Find open markdown document (check for report content)
          let doc = vscode.window.activeTextEditor?.document;
          if (!doc || !doc.fileName.endsWith('.md')) {
            // Search all open documents
            const docs = vscode.workspace.textDocuments.filter(d => 
              d.fileName.endsWith('.md') && 
              (d.getText().includes(`{#${anchorId}}`) || 
               d.getText().includes(`#${anchorId}`) ||
               d.getText().includes('Findings Overview'))
            );
            
            if (docs.length > 0) {
              doc = docs[0];
            } else {
              // Try to open the report
              await vscode.commands.executeCommand('git-context.showRefactorReport');
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for doc to open
              doc = vscode.window.activeTextEditor?.document;
            }
          }
          
          if (!doc) {
            vscode.window.showWarningMessage('No markdown report found. Generate a refactor bundle report first.');
            return;
          }
          
          const text = doc.getText();
          
          // Try Pandoc-style anchor first: {#anchor-id}
          let anchorPattern = new RegExp(`(?:^|\\n)#+\\s+[^\\n]*\\{#${anchorId}\\}`, 'i');
          let match = text.match(anchorPattern);
          
          // If not found, try standard markdown anchor: # anchor-id
          if (!match) {
            anchorPattern = new RegExp(`(?:^|\\n)#+\\s+[^\\n]*${anchorId.replace(/-/g, '[\\s-]')}`, 'i');
            match = text.match(anchorPattern);
          }
          
          // If still not found, try finding section header with anchor ID nearby
          if (!match) {
            const lines = text.split('\n');
            let foundIndex = -1;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              // Check for header with anchor on same or next line
              if ((line.match(/^#+\s+.*$/i) && lines[i + 1]?.includes(`{#${anchorId}}`)) ||
                  (line.includes(`{#${anchorId}}`) && lines[i - 1]?.match(/^#+\s+.*$/i))) {
                foundIndex = text.indexOf(line);
                break;
              }
            }
            if (foundIndex >= 0) {
              // Create a match-like object for consistency
              const beforeMatch = text.substring(0, foundIndex);
              match = text.substring(foundIndex).match(/^.*$/m) as RegExpMatchArray;
              if (match) {
                // Adjust index to account for the substring
                (match as any).index = foundIndex;
              }
            }
          }
          
          if (match && match.index !== undefined) {
            const lineNumber = text.substring(0, match.index).split('\n').length - 1;
            const editor = await vscode.window.showTextDocument(doc);
            const position = new vscode.Position(Math.max(0, lineNumber), 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            vscode.window.showInformationMessage(`Scrolled to ${anchorId} section`);
          } else {
            vscode.window.showWarningMessage(`Section ${anchorId} not found in report. The report may need to be regenerated.`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to scroll to section: ${error}`);
        }
      }
    );

    // Copy section JSON command
    const copySectionJsonCmd = vscode.commands.registerCommand(
      'git-context.copySectionJson',
      async (sectionId: string) => {
        try {
          if (!commitTracker.lastBundleFacts) {
            vscode.window.showWarningMessage('No bundle facts available');
            return;
          }
          
          const facts = commitTracker.lastBundleFacts;
          let jsonData: any = null;
          
          // Extract relevant section data
          switch (sectionId) {
            case 'incompleteness-missing':
              jsonData = facts.evidence?.['findings.incompleteness.missing'] || [];
              break;
            case 'incompleteness-zombies':
              jsonData = facts.evidence?.['findings.incompleteness.zombies'] || [];
              break;
            case 'drift-hotspots':
              jsonData = facts.evidence?.['findings.drift.hotspots'] || [];
              break;
            case 'legacy-dead':
              jsonData = facts.evidence?.['findings.legacyAudit.dead'] || [];
              break;
            default:
              jsonData = facts.evidence?.[sectionId] || facts.findings;
          }
          
          const jsonString = JSON.stringify(jsonData, null, 2);
          await vscode.env.clipboard.writeText(jsonString);
          vscode.window.showInformationMessage(`Copied ${sectionId} JSON to clipboard`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to copy JSON: ${error}`);
        }
      }
    );

    // Generate LLM context command
    const generateLlmContextCmd = vscode.commands.registerCommand(
      'git-context.generateLlmContext',
      async (elementId: string) => {
        try {
          if (!commitTracker.lastBundleFacts) {
            vscode.window.showWarningMessage('No bundle facts available');
            return;
          }
          
          const facts = commitTracker.lastBundleFacts;
          let context = '';
          
          // Generate context based on element type
          if (elementId.startsWith('file:')) {
            const filePath = elementId.replace('file:', '');
            context = `File: ${filePath}\n\n`;
            // Add file-specific context from facts
            const fileEvidence = Object.entries(facts.evidence || {}).filter(([key, value]) => {
              if (Array.isArray(value)) {
                return value.some((item: any) => item.path === filePath || item.symbol_id?.startsWith(filePath));
              }
              return false;
            });
            context += JSON.stringify(fileEvidence, null, 2);
          } else if (elementId.startsWith('symbol:')) {
            const symbolId = elementId.replace('symbol:', '');
            context = `Symbol: ${symbolId}\n\n`;
            // Find symbol in evidence
            const symbolEvidence = Object.entries(facts.evidence || {}).find(([key, value]) => {
              if (Array.isArray(value)) {
                return value.some((item: any) => item.symbol_id === symbolId);
              }
              return false;
            });
            if (symbolEvidence) {
              context += JSON.stringify(symbolEvidence[1], null, 2);
            }
          } else {
            // Category context
            const sectionData = facts.evidence?.[elementId] || facts.evidence?.[`findings.${elementId}`] || {};
            context = `Section: ${elementId}\n\n${JSON.stringify(sectionData, null, 2)}`;
          }
          
          await vscode.env.clipboard.writeText(context);
          vscode.window.showInformationMessage('LLM context copied to clipboard');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to generate context: ${error}`);
        }
      }
    );

    // Open file command
    const openFileCmd = vscode.commands.registerCommand(
      'git-context.openFile',
      async (filePath: string, sha?: string) => {
        try {
          const { getGitRoot } = await import('../utils/config');
          const gitRoot = getGitRoot();
          
          if (!gitRoot) {
            vscode.window.showErrorMessage('Git root not found');
            return;
          }
          
          if (sha) {
            // Open file at specific commit
            const uri = vscode.Uri.parse(`git:${filePath}?${sha}`);
            await vscode.window.showTextDocument(uri);
          } else {
            // Open current workspace file
            await vscode.window.showTextDocument(vscode.Uri.file(path.join(gitRoot, filePath)));
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
      }
    );

    // Copy drift table command
    const copyDriftTableCmd = vscode.commands.registerCommand(
      'git-context.copyDriftTable',
      async () => {
        try {
          if (!commitTracker.lastBundleFacts) {
            vscode.window.showWarningMessage('No bundle facts available');
            return;
          }
          
          const facts = commitTracker.lastBundleFacts;
          const drift = facts.findings.patternDrift;
          
          // Create markdown table
          const table = `| Metric | Count |\n|--------|-------|\n| Mixed Targets | ${drift.mixedTargets} |\n| Old Namespaces | ${drift.oldNamespaces} |`;
          
          await vscode.env.clipboard.writeText(table);
          vscode.window.showInformationMessage('Drift table copied to clipboard');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to copy drift table: ${error}`);
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
      openEvidenceCmd,
      toggleWorkspaceFullCmd,
      toggleWorkspacePartCmd,
      copyShaCmd,
      viewDiffVsWorkspaceCmd,
      compareWorkspaceVsCommitCmd,
      compareCommitsCmd,
      compareHeadVsCommitCmd,
      scrollToMDSectionCmd,
      copySectionJsonCmd,
      generateLlmContextCmd,
      openFileCmd,
      copyDriftTableCmd,
      showGroupingOptionsCmd,
      refreshDebtMeterAndRevealCmd
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

