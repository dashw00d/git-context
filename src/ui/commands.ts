import * as vscode from 'vscode';
import { logInfo, logError } from '../utils/logger';
import { CommitsProvider } from './commitsProvider';
import { ActiveBundleProvider } from './activeBundleProvider';
import { SymbolHistoryProvider } from './symbolHistory';
import { ReportsProvider } from './reportsProvider';
// Analysis functions moved to AnalysisPipeline service
import { showCommit, searchSymbol } from '../cli/queries';
import { getExtensionConfig } from '../utils/config';
import { LLMSummarizer } from '../llm/summarizer';
import { generateRefactorBundleReport } from './report';
import { getCockpitProvider } from '../extension';
import { RefactorReportProvider } from '../webview/refactorReportProvider';
import { updateContexts, syncCockpitState } from '../extension';
import * as fs from 'fs';
import * as path from 'path';

export async function registerCommands(
  context: vscode.ExtensionContext,
  commitsProvider: CommitsProvider,
  activeBundleProvider: ActiveBundleProvider,
  symbolHistory: SymbolHistoryProvider,
  refactorReportProvider?: RefactorReportProvider,
  reportsProvider?: ReportsProvider
) {
  // Initialize context keys
  await updateContexts();
  try {
    // Analyze last N commits
    const analyzeLastCommitsCmd = vscode.commands.registerCommand(
      'git-context.analyzeLastCommits',
      async (countArg?: string) => {
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
              // Ensure database is initialized before analyzing
              await commitsProvider.initializeDatabase();

              const { getAnalysisPipeline } = await import('../analysis/pipeline');
              const pipeline = await getAnalysisPipeline();

              // Load metadata first, then analyze
              const commits = await pipeline.loadRecentCommits(parseInt(count));
              const shas = commits.map(c => c.sha);
              await pipeline.analyzeCommits(shas);

              // Generate bundle report for analyzed commits
              const { generateRefactorBundleReport } = await import('./report');
              await generateRefactorBundleReport(
                shas,
                refactorReportProvider,
                token,
                activeBundleProvider,
                undefined, // selectedFiles - analyze all files in commits
                'full',
                undefined // existingReportId - create new report
              );

              commitsProvider.refresh();
              const { syncCockpitState } = await import('../extension');
              await syncCockpitState();
              vscode.window.showInformationMessage(`Analyzed last ${count} commits and generated report`);
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
          cancellable: true
        }, async (progress, token) => {
          try {
            // Check if there are staged files first
            const { GitOperations } = await import('../analysis/git');
            const git = new GitOperations();
            const stagedFiles = git.getStagedFiles();

            if (stagedFiles.length === 0) {
              vscode.window.showWarningMessage('No staged files to analyze');
              return;
            }

            // Ensure database is initialized before analyzing
            await commitsProvider.initializeDatabase();

            const { getAnalysisPipeline } = await import('../analysis/pipeline');
            const pipeline = await getAnalysisPipeline();
            await pipeline.analyzeStagedChanges();

            commitsProvider.refresh();
            const { syncCockpitState } = await import('../extension');
            await syncCockpitState();

            // Generate report for staged changes
            const { generateRefactorBundleReport } = await import('./report');
            const headSha = git.getHeadSha();
            // Use HEAD as the base commit for staged analysis
            const commitShas = headSha ? [headSha] : [];

            await generateRefactorBundleReport(
              commitShas,
              refactorReportProvider,
              token,
              activeBundleProvider,
              undefined, // selectedFiles - analyze all staged files
              'staged' as const,
              undefined // existingReportId - create new report
            );

            vscode.window.showInformationMessage('Analyzed staged changes and generated report');
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze staged changes: ${error}`);
          }
        });
      }
    );

    const analyzeUnstagedCmd = vscode.commands.registerCommand(
      'git-context.analyzeUnstagedChanges',
      async () => {
        vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Analyzing unstaged changes...',
          cancellable: true
        }, async (progress, token) => {
          try {
            // Check if there are unstaged files first
            const { GitOperations } = await import('../analysis/git');
            const git = new GitOperations();
            const unstagedFiles = git.getUnstagedFiles();

            if (unstagedFiles.length === 0) {
              vscode.window.showWarningMessage('No unstaged files to analyze');
              return;
            }

            // Ensure database is initialized before analyzing
            await commitsProvider.initializeDatabase();

            const { getAnalysisPipeline } = await import('../analysis/pipeline');
            const pipeline = await getAnalysisPipeline();
            await pipeline.analyzeUnstagedChanges();

            commitsProvider.refresh();
            const { syncCockpitState } = await import('../extension');
            await syncCockpitState();

            // Generate report for unstaged changes
            const { generateRefactorBundleReport } = await import('./report');
            const headSha = git.getHeadSha();
            // Use HEAD as the base commit for unstaged analysis
            const commitShas = headSha ? [headSha] : [];

            await generateRefactorBundleReport(
              commitShas,
              refactorReportProvider,
              token,
              activeBundleProvider,
              undefined, // selectedFiles - analyze all unstaged files
              'unstaged' as const,
              undefined // existingReportId - create new report
            );

            vscode.window.showInformationMessage('Analyzed unstaged changes and generated report');
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to analyze unstaged changes: ${error}`);
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

            // Extract commit SHA from commit label (format: "SHA: message" or just SHA)
            const commitSha = commit.detail?.split(':')[0] || commit.label.split(':')[0] || commit.label;

            // Get actual symbol code before/after from database
            let codeBefore = '// Previous code not available';
            let codeAfter = '// Current code not available';

            try {
              const { getDatabaseManager } = await import('../storage/database');
              const db = getDatabaseManager().getDatabase();

              // Query for symbol diff snippets
              const symbolStmt = db.prepare(`
                SELECT diff_snippet_pre, diff_snippet_post, change_type
                FROM symbols
                WHERE sha = ? AND path = ? AND name = ?
                ORDER BY id DESC
                LIMIT 1
              `);

              const symbolRow = symbolStmt.get(commitSha, symbol.file, symbol.name) as any;

              if (symbolRow) {
                codeBefore = symbolRow.diff_snippet_pre || codeBefore;
                codeAfter = symbolRow.diff_snippet_post || codeAfter;
              }
            } catch (dbError) {
              logError('Failed to fetch symbol diff snippets from database', dbError);
            }

            const explanation = await llm.explainSymbolChange(
              symbol.name,
              'modified',
              symbol.file,
              symbol.line,
              codeBefore,
              codeAfter,
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
            await commitsProvider.initializeDatabase();
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
        if (commitsProvider.runningTask) {
          vscode.window.showWarningMessage('Analysis already running');
          return;
        }

        const selectedCount = commitsProvider.selectedCommits.size;
        if (selectedCount > 0) {
          // Generate report for selected commits
          const shas = Array.from(commitsProvider.selectedCommits) as string[];
          const cancellationTokenSource = new vscode.CancellationTokenSource();
          commitsProvider.runningTask = { cancel: () => cancellationTokenSource.cancel(), token: cancellationTokenSource.token };

          try {
            await generateRefactorBundleReport(shas, refactorReportProvider, cancellationTokenSource.token, activeBundleProvider, undefined, undefined, undefined);
            await updateContexts();
          } finally {
            commitsProvider.runningTask = null;
            commitsProvider.refresh();
          }
          // Selection persists after bundle generation for iterative workflow
        } else {
          vscode.window.showWarningMessage('Please select commits first (use checkboxes in tree view) to analyze as a refactor bundle.');
        }
      }
    );

    // Toggle commit selection
    const toggleCommitSelectionCmd = vscode.commands.registerCommand(
      'git-context.toggleCommitSelection',
      async (shaOrItem: string | any) => {
        // Handle both direct SHA string and object with id property
        const sha = typeof shaOrItem === 'string' ? shaOrItem : (shaOrItem?.id || shaOrItem?.sha);
        if (sha) {
          commitsProvider.toggleCommitSelection(sha);
          await updateContexts();
        }
      }
    );

    // Clear selection
    const clearSelectionCmd = vscode.commands.registerCommand(
      'git-context.clearSelection',
      async () => {
        commitsProvider.clearSelection();
        await updateContexts();
      }
    );

    // Export LLM Context
    const exportContextCmd = vscode.commands.registerCommand(
      'git-context.exportLlmContext',
      async () => {
        const selectedShas = Array.from(commitsProvider.selectedCommits);
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

            // Save to temp file and open in markdown preview
            const os = require('os');
            const reportPath = path.join(os.tmpdir(), 'git-context-cached-report.md');
            fs.writeFileSync(reportPath, markdown, 'utf8');
            await vscode.commands.executeCommand('markdown.showPreviewToSide', vscode.Uri.file(reportPath));
          } else {
            // If no cached report, check if commits are selected to generate one
            if (commitsProvider.selectedCommits.size >= 2) {
              vscode.commands.executeCommand('git-context.generateReport');
            } else {
              vscode.window.showInformationMessage('No report available. Select commits in the sidebar and click "Generate Report".');
            }
          }
        } catch (error) {
          logError('Failed to show refactor report', error);
          vscode.window.showErrorMessage(`Failed to show report: ${error}`);
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
        const full = commitsProvider.workspaceParts.size === 2;
        commitsProvider.workspaceParts.clear();
        if (!full) {
          commitsProvider.workspaceParts.add('staged');
          commitsProvider.workspaceParts.add('unstaged');
        }
        commitsProvider.refresh();
      }
    );

    // Toggle workspace part
    const toggleWorkspacePartCmd = vscode.commands.registerCommand(
      'git-context.toggleWorkspacePart',
      (part: 'staged' | 'unstaged') => {
        if (commitsProvider.workspaceParts.has(part)) {
          commitsProvider.workspaceParts.delete(part);
        } else {
          commitsProvider.workspaceParts.add(part);
        }
        commitsProvider.refresh();
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
          const includeStaged = commitsProvider.workspaceParts.has('staged');
          const includeUnstaged = commitsProvider.workspaceParts.has('unstaged');

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
          const selectedShas = Array.from(commitsProvider.selectedCommits);
          const workspaceLabel = commitsProvider.workspaceParts.has('staged') && commitsProvider.workspaceParts.has('unstaged')
            ? 'Full Workspace'
            : commitsProvider.workspaceParts.has('staged')
              ? 'Staged Only'
              : commitsProvider.workspaceParts.has('unstaged')
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
          if (!activeBundleProvider.lastBundleFacts) {
            vscode.window.showWarningMessage('No bundle facts available');
            return;
          }

          const facts = activeBundleProvider.lastBundleFacts;
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
          if (!activeBundleProvider.lastBundleFacts) {
            vscode.window.showWarningMessage('No bundle facts available');
            return;
          }

          const facts = activeBundleProvider.lastBundleFacts;
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
          if (!activeBundleProvider.lastBundleFacts) {
            vscode.window.showWarningMessage('No bundle facts available');
            return;
          }

          const facts = activeBundleProvider.lastBundleFacts;
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

    // Qdrant-enhanced commands
    const findSimilarCommitsCmd = vscode.commands.registerCommand(
      'git-context.findSimilarCommits',
      async (sha?: string) => {
        try {
          const { getSearchIndex } = await import('../storage/index');
          const searchIndex = getSearchIndex();

          // Get SHA if not provided
          if (!sha) {
            const currentSha = await getCurrentCommit();
            if (!currentSha) {
              vscode.window.showErrorMessage('No commit selected');
              return;
            }
            sha = currentSha;
          }

          const similar = await searchIndex.findSimilarCommits(sha, 10);
          if (similar.length === 0) {
            vscode.window.showInformationMessage('No similar commits found');
            return;
          }

          const items = similar.map(c => ({
            label: c.sha.substring(0, 8),
            description: c.message.split('\n')[0],
            detail: `${c.author} • ${c.date} • Similarity: ${(c.similarity * 100).toFixed(0)}%`,
            sha: c.sha
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a similar commit to view'
          });

          if (selected) {
            await showCommit(selected.sha);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to find similar commits: ${error}`);
        }
      }
    );

    const searchCommitsSemanticCmd = vscode.commands.registerCommand(
      'git-context.searchCommitsSemantic',
      async () => {
        try {
          const query = await vscode.window.showInputBox({
            prompt: 'Search commits semantically',
            placeHolder: 'e.g., "authentication refactor" or "API migration"'
          });

          if (!query) return;

          const { getSearchIndex } = await import('../storage/index');
          const searchIndex = getSearchIndex();

          const results = await searchIndex.searchCommits(query, 10);
          if (results.length === 0) {
            vscode.window.showInformationMessage('No matching commits found');
            return;
          }

          const items = results.map(c => ({
            label: c.sha.substring(0, 8),
            description: c.message.split('\n')[0],
            detail: `${c.author} • ${c.date} • Similarity: ${(c.similarity * 100).toFixed(0)}%`,
            sha: c.sha
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a commit to view'
          });

          if (selected) {
            await showCommit(selected.sha);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to search commits: ${error}`);
        }
      }
    );

    const findSimilarSymbolsCmd = vscode.commands.registerCommand(
      'git-context.findSimilarSymbols',
      async (symbolId?: string) => {
        try {
          const { getSearchIndex } = await import('../storage/index');
          const searchIndex = getSearchIndex();

          // Get symbol ID if not provided
          if (!symbolId) {
            const symbol = await getSymbolAtCursor();
            if (!symbol) {
              vscode.window.showErrorMessage('No symbol selected');
              return;
            }
            // Try to find symbol ID from database
            const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
            await ensureDatabaseInitialized();
            const db = getDatabaseManager().getDatabase();
            const stmt = db.prepare(`
              SELECT symbol_id FROM symbols
              WHERE name = ? AND path LIKE ?
              ORDER BY sha DESC
              LIMIT 1
            `);
            const result = stmt.get(symbol.name, `%${symbol.file}%`) as any;
            if (!result) {
              vscode.window.showErrorMessage('Symbol not found in database');
              return;
            }
            symbolId = result.symbol_id;
          }

          if (!symbolId) {
            vscode.window.showErrorMessage('Symbol ID not found');
            return;
          }

          const similar = await searchIndex.findSimilarSymbols(symbolId, 10);
          if (similar.length === 0) {
            vscode.window.showInformationMessage('No similar symbols found');
            return;
          }

          const items = similar.map(s => ({
            label: s.name,
            description: s.path,
            detail: `Similarity: ${(s.rank * 100).toFixed(0)}% • Commit: ${s.sha.substring(0, 8)}`,
            symbolId: `${s.path}:${s.name}`
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a similar symbol to view'
          });

          if (selected) {
            await vscode.commands.executeCommand('git-context.openSymbol', selected.symbolId);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to find similar symbols: ${error}`);
        }
      }
    );

    const findConventionDriftCmd = vscode.commands.registerCommand(
      'git-context.findConventionDrift',
      async () => {
        try {
          const { getSearchIndex } = await import('../storage/index');
          const searchIndex = getSearchIndex();

          // Get current bundle or workspace
          const selectedShas = Array.from(commitsProvider.selectedCommits);
          if (selectedShas.length === 0) {
            vscode.window.showInformationMessage('Select commits or generate a bundle to analyze convention drift');
            return;
          }

          // Get drift data from facts if available
          const facts = activeBundleProvider.lastBundleFacts;
          if (facts?.findings?.patternDrift?.conventionDrift) {
            const drift = facts.findings.patternDrift.conventionDrift;
            const driftSymbols = (facts.evidence?.['findings.patternDrift.conventionDrift']?.driftSymbols || []) as Array<{
              symbolId: string;
              name: string;
              convention: string;
              suggestedName: string;
              path: string;
            }>;

            const message = `Convention Drift: ${drift.driftPercent.toFixed(1)}% (${driftSymbols.length} symbols)\nDominant: ${drift.dominantConvention}`;
            const action = await vscode.window.showInformationMessage(
              message,
              'View Details',
              'Show Migration List'
            );

            if (action === 'View Details') {
              // Open report section
              await vscode.commands.executeCommand('git-context.generateReport');
            } else if (action === 'Show Migration List') {
              // Show quick pick with drift symbols
              const items = driftSymbols.slice(0, 50).map((ds: {
                symbolId: string;
                name: string;
                convention: string;
                suggestedName: string;
                path: string;
              }) => ({
                label: ds.name,
                description: `${ds.convention} → ${drift.dominantConvention}`,
                detail: `Suggested: ${ds.suggestedName} | ${ds.path}`,
                symbolId: ds.symbolId
              }));

              const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a symbol to view migration suggestion'
              });

              if (selected) {
                await vscode.commands.executeCommand('git-context.openSymbol', selected.symbolId);
              }
            }
          } else {
            vscode.window.showInformationMessage('No convention drift data available. Generate a bundle report first.');
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to analyze convention drift: ${error}`);
        }
      }
    );

    const showConventionTimelineCmd = vscode.commands.registerCommand(
      'git-context.showConventionTimeline',
      async () => {
        try {
          type NamingConvention = 'camelCase' | 'PascalCase' | 'snake_case' | 'SCREAMING_SNAKE' | 'kebab-case' | 'hungarian' | 'mixed' | 'unknown';

          const convention = await vscode.window.showQuickPick([
            { label: 'camelCase', value: 'camelCase' as NamingConvention },
            { label: 'PascalCase', value: 'PascalCase' as NamingConvention },
            { label: 'snake_case', value: 'snake_case' as NamingConvention },
            { label: 'SCREAMING_SNAKE', value: 'SCREAMING_SNAKE' as NamingConvention }
          ], {
            placeHolder: 'Select convention to track'
          });

          if (!convention) return;

          const { getSearchIndex } = await import('../storage/index');
          const searchIndex = getSearchIndex();

          const timeline = await searchIndex.getConventionTimeline(convention.value);
          if (timeline.length === 0) {
            vscode.window.showInformationMessage('No timeline data available for this convention');
            return;
          }

          // Show timeline in quick pick
          const items = timeline.slice(-20).map(entry => ({
            label: `${entry.adoptionPercent.toFixed(1)}% adoption`,
            description: entry.date.substring(0, 10),
            detail: `${entry.newSymbols} symbols, ${entry.driftSymbols} drift | ${entry.sha.substring(0, 8)}`,
            sha: entry.sha
          }));

          const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Convention adoption timeline (newest first)'
          });

          if (selected) {
            await showCommit(selected.sha);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to show convention timeline: ${error}`);
        }
      }
    );

    context.subscriptions.push(
      analyzeLastCommitsCmd,
      analyzeStagedCmd,
      analyzeUnstagedCmd,
      compareFilesCmd,
      explainSymbolCmd,
      searchSymbolsCmd,
      initializeDatabaseCmd,
      openSymbolCmd,
      generateReportCmd,
      toggleCommitSelectionCmd,
      clearSelectionCmd,
      exportContextCmd,
      showRefactorReportCmd,
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
      refreshDebtMeterAndRevealCmd,
      findSimilarCommitsCmd,
      searchCommitsSemanticCmd,
      findSimilarSymbolsCmd,
      findConventionDriftCmd,
      showConventionTimelineCmd
    );

    // New report-centric commands
    const analyzeCmd = vscode.commands.registerCommand(
      'git-context.analyze',
      async () => {
        const selectedFiles = commitsProvider.getSelectedFiles();
        const selectedCommits = Array.from(commitsProvider.selectedCommits);
        const workspaceScope = commitsProvider.getWorkspaceScope();

        if (selectedFiles.size === 0 && selectedCommits.length === 0) {
          vscode.window.showWarningMessage('Please select files and/or commits to analyze');
          return;
        }

        try {
          await commitsProvider.initializeDatabase();
          await generateRefactorBundleReport(
            selectedCommits,
            refactorReportProvider,
            undefined,
            activeBundleProvider,
            Array.from(selectedFiles),
            workspaceScope === 'workspace' ? 'full' : workspaceScope,
            undefined,
          );
          commitsProvider.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to analyze: ${error}`);
        }
      }
    );

    const openReportCmd = vscode.commands.registerCommand(
      'git-context.openReport',
      async (reportId: string) => {
        const { getReportManager } = await import('../storage/reportManager');
        const reportManager = getReportManager();
        const report = reportManager.load(reportId);

        if (!report) {
          vscode.window.showErrorMessage(`Report ${reportId} not found`);
          return;
        }

        // Reuse existing report display logic
        if (refactorReportProvider && report.analysis && report.facts) {
          refactorReportProvider.showReport(report.analysis, report.facts);
        } else {
          vscode.window.showErrorMessage('Report provider not available or report data incomplete');
        }
      }
    );

    const regenerateReportCmd = vscode.commands.registerCommand(
      'git-context.regenerateReport',
      async (reportId: string) => {
        const { getReportManager } = await import('../storage/reportManager');
        const reportManager = getReportManager();
        const report = reportManager.load(reportId);

        if (!report) {
          vscode.window.showErrorMessage(`Report ${reportId} not found`);
          return;
        }

        try {
          await commitsProvider.initializeDatabase();
          await generateRefactorBundleReport(
            report.commitShas,
            refactorReportProvider,
            undefined,
            activeBundleProvider,
            report.selectedFiles,
            report.workspaceScope,
            reportId  // Pass existing report ID to update instead of create new
          );
          commitsProvider.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to regenerate report: ${error}`);
        }
      }
    );

    const deleteReportCmd = vscode.commands.registerCommand(
      'git-context.deleteReport',
      async (reportId: string) => {
        const confirm = await vscode.window.showWarningMessage(
          'Are you sure you want to delete this report?',
          { modal: true },
          'Delete'
        );

        if (confirm === 'Delete') {
          const { getReportManager } = await import('../storage/reportManager');
          const reportManager = getReportManager();
          reportManager.delete(reportId);
          commitsProvider.refresh();
        }
      }
    );

    const toggleFileSelectionCmd = vscode.commands.registerCommand(
      'git-context.toggleFileSelection',
      async (filePath: string) => {
        commitsProvider.toggleFileSelection(filePath);
        const { syncCockpitState } = await import('../extension');
        await syncCockpitState();
      }
    );

    const toggleSelectionCmd = vscode.commands.registerCommand(
      'git-context.toggleSelection',
      async (elementIdOrItem: string | any) => {
        // Handle both direct string and object with id property
        const elementId = typeof elementIdOrItem === 'string' ? elementIdOrItem : elementIdOrItem?.id;

        if (elementId && typeof elementId === 'string') {
          // Parse element ID to determine if file or commit
          if (elementId.startsWith('select-file-')) {
            const filePath = elementId.replace('select-file-', '');
            commitsProvider.toggleFileSelection(filePath);
          } else if (elementId.startsWith('select-commit-')) {
            const sha = elementId.replace('select-commit-', '');
            commitsProvider.toggleCommitSelection(sha);
          }
          const { syncCockpitState } = await import('../extension');
          await syncCockpitState();
        }
      }
    );

    const togglePinReportCmd = vscode.commands.registerCommand(
      'git-context.togglePinReport',
      async (reportId: string) => {
        const { getReportManager } = await import('../storage/reportManager');
        const reportManager = getReportManager();
        reportManager.togglePin(reportId);
        commitsProvider.refresh();
      }
    );

    const addCommitByShaCmd = vscode.commands.registerCommand(
      'git-context.addCommitBySha',
      async () => {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter commit SHA or branch name',
          placeHolder: 'abc123 or feature/my-branch',
          validateInput: async (value) => {
            if (!value) {
              return 'Please enter a commit SHA or branch name';
            }
            try {
              const { GitOperations } = await import('../analysis/git');
              const git = new GitOperations();
              // Validate commit exists - getCommitInfo handles both SHA and branch names
              git.getCommitInfo(value);
              return undefined; // Valid
            } catch {
              return 'Commit or branch not found';
            }
          }
        });

        if (input) {
          try {
            const { getAnalysisPipeline } = await import('../analysis/pipeline');
            const pipeline = await getAnalysisPipeline();

            // Load metadata only (no analysis)
            const metadata = await pipeline.loadCommitMetadata(input);

            commitsProvider.toggleCommitSelection(metadata.sha);
            // Mark as manually added to preserve during Pull Latest
            commitsProvider.markCommitAsManual(metadata.sha);

            // Sync UI
            const { syncCockpitState } = await import('../extension');
            await syncCockpitState();
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to add commit: ${error}`);
          }
        }
      }
    );

    const viewLatestReportCmd = vscode.commands.registerCommand(
      'git-context.viewLatestReport',
      async () => {
        const { getReportManager } = await import('../storage/reportManager');
        const reportManager = getReportManager();
        const reports = reportManager.list();

        if (reports.length === 0) {
          vscode.window.showInformationMessage('No saved reports available');
          return;
        }

        const latestReport = reports[0]; // Already sorted by date DESC
        if (refactorReportProvider && latestReport.analysis && latestReport.facts) {
          refactorReportProvider.showReport(latestReport.analysis, latestReport.facts);
        } else {
          vscode.window.showErrorMessage('Report provider not available or report data incomplete');
        }
      }
    );

    const openReportSectionCmd = vscode.commands.registerCommand(
      'git-context.openReportSection',
      async (reportId: string, commitSha: string) => {
        const { getReportManager } = await import('../storage/reportManager');
        const reportManager = getReportManager();
        const report = reportManager.load(reportId);

        if (!report) {
          vscode.window.showErrorMessage(`Report ${reportId} not found`);
          return;
        }

        // Open report and navigate to section
        if (refactorReportProvider && report.analysis && report.facts) {
          refactorReportProvider.showReport(report.analysis, report.facts);
          // Navigate to specific commit section in report
          if (report.commitShas && report.commitShas.length > 0) {
            // Use the first SHA or the selected commit SHA
            const commitSha = report.commitShas[0];
            setTimeout(() => {
              refactorReportProvider.navigateToCommitSection(commitSha);
            }, 500); // Wait for webview to render
          }
        } else {
          vscode.window.showErrorMessage('Report provider not available or report data incomplete');
        }
      }
    );

    const selectAllStagedCmd = vscode.commands.registerCommand(
      'git-context.selectAllStaged',
      async () => {
        commitsProvider.selectAllStaged();
        const { syncCockpitState } = await import('../extension');
        await syncCockpitState();
      }
    );

    const selectAllUnstagedCmd = vscode.commands.registerCommand(
      'git-context.selectAllUnstaged',
      async () => {
        commitsProvider.selectAllUnstaged();
        const { syncCockpitState } = await import('../extension');
        await syncCockpitState();
      }
    );

    // Add More Commits command (cumulative loading)
    const addMoreCommitsCmd = vscode.commands.registerCommand(
      'git-context.addMoreCommits',
      async () => {
        const { getAnalysisPipeline } = await import('../analysis/pipeline');
        const pipeline = await getAnalysisPipeline();

        // Calculate which commits to load
        const nextOffset = commitsProvider.loadMoreOffset;
        const { GitOperations } = await import('../analysis/git');
        const git = new GitOperations();

        // Get the next batch of commits from git
        const recentCommits = git.getRecentCommits(nextOffset + commitsProvider.PAGE_SIZE);
        const startIndex = nextOffset;
        const endIndex = Math.min(nextOffset + commitsProvider.PAGE_SIZE, recentCommits.length);
        const nextShas = recentCommits.slice(startIndex, endIndex).map(c => c.sha);

        // Load metadata only (no analysis)
        await pipeline.loadCommitsMetadata(nextShas);

        commitsProvider.loadMoreOffset += commitsProvider.PAGE_SIZE;
        commitsProvider.refresh();
      }
    );

    // Pull Latest command (re-analyze latest N commits, preserving manual selections)
    const pullLatestCmd = vscode.commands.registerCommand(
      'git-context.pullLatest',
      async () => {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Pulling latest commits...',
            cancellable: false
          }, async (progress) => {
            const config = getExtensionConfig();
            const configCount = config.defaultCommitCount;

            // Preserve manual commits
            const manualShas = Array.from(commitsProvider.manualCommits);

            // Load metadata for latest N commits from git (no analysis)
            const { getAnalysisPipeline } = await import('../analysis/pipeline');
            const pipeline = await getAnalysisPipeline();
            await pipeline.loadRecentCommits(configCount);

            // Restore manual commits to selection (they're preserved)
            manualShas.forEach(sha => {
              commitsProvider.selectedCommits.add(sha);
            });
            commitsProvider.manualCommits = new Set(manualShas);

            // Reset offset since we've refreshed the list
            commitsProvider.loadMoreOffset = 0;
            commitsProvider.refresh();

            vscode.window.showInformationMessage(`Analyzed ${configCount} latest commits`);
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to pull latest commits: ${error}`);
          logError('Pull latest error', error);
        }
      }
    );

    // Reset Analysis command (clear selection and reload)
    const resetAnalysisCmd = vscode.commands.registerCommand(
      'git-context.resetAnalysis',
      async () => {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Resetting analysis...',
            cancellable: false
          }, async (progress) => {
            const config = getExtensionConfig();
            const configCount = config.defaultCommitCount;

            // Clear state
            commitsProvider.selectedCommits.clear();
            commitsProvider.manualCommits.clear();
            commitsProvider.selectedFiles.clear();
            commitsProvider.loadMoreOffset = 0;

            // Pull fresh commits (load metadata and analyze)
            const { getAnalysisPipeline } = await import('../analysis/pipeline');
            const pipeline = await getAnalysisPipeline();
            const commits = await pipeline.loadRecentCommits(configCount);
            const shas = commits.map(c => c.sha);
            await pipeline.analyzeCommits(shas);

            commitsProvider.refresh();

            vscode.window.showInformationMessage('Analysis reset complete');
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to reset analysis: ${error}`);
          logError('Reset analysis error', error);
        }
      }
    );

    // Reset All command (clear DB, reports, commits)
    const resetAllCmd = vscode.commands.registerCommand(
      'git-context.resetAll',
      async () => {
        const confirm = await vscode.window.showWarningMessage(
          'Reset ALL data? This will clear the database, all reports, and reload commits from scratch.',
          { modal: true },
          'Reset All'
        );

        if (confirm === 'Reset All') {
          try {
            await vscode.window.withProgress({
              location: vscode.ProgressLocation.Notification,
              title: 'Resetting all data...',
              cancellable: false
            }, async (progress) => {
              // 1. Clear reports using reportManager
              const { getReportManager } = await import('../storage/reportManager');
              const reportManager = getReportManager();
              const reports = reportManager.list();
              reports.forEach(r => reportManager.delete(r.id));

              // 2. FORCE database reset by deleting the file and reinitializing
              const { getDatabaseManager, closeDatabase } = await import('../storage/database');
              const manager = getDatabaseManager();

              // Close and delete the database file to force complete rebuild
              closeDatabase();
              const fs = require('fs');
              const path = require('path');
              const { getGitRoot } = await import('../utils/config');
              const gitRoot = getGitRoot();
              if (gitRoot) {
                const dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.sqlite');
                if (fs.existsSync(dbPath)) {
                  fs.unlinkSync(dbPath);
                  logInfo('Deleted database file for complete reset');
                }
              }

              // 3. Clear state
              commitsProvider.selectedCommits.clear();
              commitsProvider.manualCommits.clear();
              commitsProvider.selectedFiles.clear();
              commitsProvider.loadMoreOffset = 0;
              await updateContexts();

              // 4. Force database reinitialization with new schema
              await commitsProvider.initializeDatabase();

              // 5. Pull fresh commits with new pipeline
              const config = getExtensionConfig();
              const { getAnalysisPipeline } = await import('../analysis/pipeline');
              const pipeline = await getAnalysisPipeline();
              const commits = await pipeline.loadRecentCommits(config.defaultCommitCount);
              const shas = commits.map(c => c.sha);
              await pipeline.analyzeCommits(shas);

              commitsProvider.refresh();

              vscode.window.showInformationMessage('Complete database reset and reload finished');
            });
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to reset all: ${error}`);
            logError('Reset all error', error);
          }
        }
      }
    );

    // Bundle root view command (alias to showRefactorReport)
    const viewBundleCmd = vscode.commands.registerCommand(
      'git-context.viewBundle',
      async () => {
        await vscode.commands.executeCommand('git-context.showRefactorReport');
      }
    );

    // Bundle commands
    const bundleRegenerateCmd = vscode.commands.registerCommand(
      'git-context.bundle.regenerate',
      async () => {
        if (activeBundleProvider?.lastBundleFacts) {
          // Trigger regeneration of the current bundle
          await vscode.commands.executeCommand('git-context.generateReport');
        } else {
          vscode.window.showWarningMessage('No active bundle to regenerate');
        }
      }
    );

    const bundleClearCmd = vscode.commands.registerCommand(
      'git-context.bundle.clear',
      async () => {
        if (activeBundleProvider) {
          activeBundleProvider.lastBundleFacts = null;
          activeBundleProvider.refresh();
          commitsProvider.clearSelection();
          await syncCockpitState();
          vscode.window.showInformationMessage('Bundle cleared');
        }
      }
    );

    const bundleCancelCmd = vscode.commands.registerCommand(
      'git-context.bundle.cancel',
      async () => {
        if (commitsProvider.runningTask) {
          commitsProvider.runningTask.cancel();
          commitsProvider.runningTask = null;
          const cockpitProvider = getCockpitProvider();
          cockpitProvider?.updateAnalysisProgress(false);
          vscode.window.showInformationMessage('Analysis cancelled');
        } else {
          vscode.window.showWarningMessage('No analysis currently running');
        }
      }
    );

    const bundleAddCommitCmd = vscode.commands.registerCommand(
      'git-context.bundle.addCommit',
      async (commitSha: string) => {
        if (commitSha) {
          commitsProvider.selectedCommits.add(commitSha);
          commitsProvider.refresh();
          await syncCockpitState();
        }
      }
    );

    const bundleRemoveCommitCmd = vscode.commands.registerCommand(
      'git-context.bundle.removeCommit',
      async (commitSha: string) => {
        if (commitSha) {
          commitsProvider.selectedCommits.delete(commitSha);
          commitsProvider.refresh();
          await syncCockpitState();
        }
      }
    );

    // Bundle export command (alias to exportLlmContext)
    const bundleExportCmd = vscode.commands.registerCommand(
      'git-context.bundle.export',
      async () => {
        await vscode.commands.executeCommand('git-context.exportLlmContext');
      }
    );

    // Scroll to report section command
    const scrollToReportSectionCmd = vscode.commands.registerCommand(
      'git-context.scrollToReportSection',
      async (sectionId: string) => {
        if (refactorReportProvider && sectionId) {
          refactorReportProvider.scrollToSection(sectionId);
        }
      }
    );

    // Open symbol history command
    const openSymbolHistoryCmd = vscode.commands.registerCommand(
      'git-context.openSymbolHistory',
      async (symbolId: string) => {
        if (!symbolId) {
          vscode.window.showWarningMessage('No symbol ID provided');
          return;
        }

        try {
          // Focus the Symbol History view (which shows recent symbols)
          await vscode.commands.executeCommand('symbolHistory.focus');
          vscode.window.showInformationMessage(`Showing symbol history. Search for "${symbolId.split(':').pop()}" to find this symbol.`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open symbol history: ${error}`);
        }
      }
    );

    context.subscriptions.push(
      analyzeCmd,
      openReportCmd,
      regenerateReportCmd,
      deleteReportCmd,
      toggleFileSelectionCmd,
      toggleCommitSelectionCmd,
      toggleSelectionCmd,
      togglePinReportCmd,
      addCommitByShaCmd,
      viewLatestReportCmd,
      openReportSectionCmd,
      selectAllStagedCmd,
      selectAllUnstagedCmd,
      addMoreCommitsCmd,
      pullLatestCmd,
      resetAnalysisCmd,
      resetAllCmd,
      viewBundleCmd,
      bundleRegenerateCmd,
      bundleClearCmd,
      bundleCancelCmd,
      bundleAddCommitCmd,
      bundleRemoveCommitCmd,
      bundleExportCmd,
      scrollToReportSectionCmd,
      openSymbolHistoryCmd
    );


    logInfo('Git Context commands registered successfully');
  } catch (error) {
    logError('Failed to register Git Context commands', error);
    vscode.window.showErrorMessage(`Failed to register Git Context commands: ${error}`);
  }
}

async function getRecentCommits(): Promise<vscode.QuickPickItem[]> {
  try {
    const { getDatabaseManager, ensureDatabaseInitialized } = await import('../storage/database');
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();

    // Query recent commits from database
    const stmt = db.prepare(`
      SELECT sha, message, author, date
      FROM commits_metadata
      ORDER BY date DESC
      LIMIT 20
    `);

    const commits = stmt.all() as Array<{
      sha: string;
      message: string;
      author: string;
      date: string;
    }>;

    return commits.map(commit => ({
      label: commit.sha.substring(0, 8),
      description: commit.message.split('\n')[0].substring(0, 60),
      detail: `${commit.sha}: ${commit.message.split('\n')[0]}`
    }));
  } catch (error) {
    logError('Failed to get recent commits from database', error);
    // Fallback to dummy data
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
