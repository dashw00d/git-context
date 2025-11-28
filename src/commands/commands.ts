import * as vscode from 'vscode';
import { logInfo, logError } from '../utils/logger';
import { CommitsProvider } from '../providers/commitsProvider';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { getReportService } from '../services/reportService';
import { getCockpitProvider } from '../extension';
import { RefactorReportProvider } from '../webview/reports/refactorReportProvider';
import { updateContexts, refreshCockpitState } from '../extension';
import { getCockpitOrchestrator } from '../state/cockpitOrchestrator';
import { makeWorkspaceSha, parseWorkspaceSha, isWorkspaceSha } from '../utils/workspace';
import { GitOperations } from '../analysis/git';

export async function registerCommands(
  context: vscode.ExtensionContext,
  commitsProvider: CommitsProvider,
  activeBundleProvider: ActiveBundleProvider,
  symbolHistory: SymbolHistoryProvider,
  refactorReportProvider?: RefactorReportProvider
) {
  const orchestrator = getCockpitOrchestrator();

  try {
    // Analyze last N commits
    const analyzeLastCommitsCmd = vscode.commands.registerCommand(
      'git-context.analyzeLastCommits',
      async (countArg?: string) => {
        const { getExtensionConfig } = await import('../utils/config');
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
              await commitsProvider.initializeDatabase();
              const { getRefactorPipeline } = await import('../extension');
              const pipeline = await getRefactorPipeline();
              const git = new GitOperations();
              const commits = git.getRecentCommits(parseInt(count));
              const shas = commits.map(c => c.sha);

              // Just index commits (quick metadata load)
              await pipeline.indexCommits(shas);

              // Refresh UI to show indexed commits
              commitsProvider.refresh();
              await refreshCockpitState('command:analyzeLastCommits');

              vscode.window.showInformationMessage(`Indexed ${shas.length} commits`);
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
        try {
          await commitsProvider.initializeDatabase();
          const { getRefactorPipeline } = await import('../extension');
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

          commitsProvider.refresh();
          await refreshCockpitState('command:analyzeStaged');

          vscode.window.showInformationMessage(`Analyzed ${facts.filesChanged} staged files`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to analyze staged changes: ${error}`);
        }
      }
    );

    const analyzeUnstagedCmd = vscode.commands.registerCommand(
      'git-context.analyzeUnstagedChanges',
      async () => {
        try {
          await commitsProvider.initializeDatabase();
          const { getRefactorPipeline } = await import('../extension');
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

          commitsProvider.refresh();
          await refreshCockpitState('command:analyzeUnstaged');
          vscode.window.showInformationMessage(`Analyzed ${facts.filesChanged} unstaged files`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to analyze unstaged changes: ${error}`);
        }
      }
    );

    // Open symbol in file (used by Cockpit)
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

    // Toggle commit selection (Cockpit)
    const toggleCommitSelectionCmd = vscode.commands.registerCommand(
      'git-context.toggleCommitSelection',
      async (shaOrItem: string | any) => {
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
      }
    );

    // Clear selection (Cockpit)
    const clearSelectionCmd = vscode.commands.registerCommand(
      'git-context.clearSelection',
      async () => {
        orchestrator.updateState({
          selectedCommitShas: [],
          selectedStagedPaths: [],
          selectedUnstagedPaths: []
        }, 'command:clearSelection');
        await updateContexts();
      }
    );

    // Open evidence (Cockpit)
    const openEvidenceCmd = vscode.commands.registerCommand(
      'git-context.openEvidence',
      async (args: any) => {
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
      }
    );

    // Copy SHA (useful utility, keep)
    const copyShaCmd = vscode.commands.registerCommand(
      'git-context.copySha',
      async (sha: string) => {
        await vscode.env.clipboard.writeText(sha);
        vscode.window.showInformationMessage(`Copied SHA: ${sha.substring(0, 8)}`);
      }
    );


    // Main analyze command (Cockpit)
    const analyzeCmd = vscode.commands.registerCommand(
      'git-context.analyze',
      async (forceReanalyze = false) => {
        try {
          const state = orchestrator.getState();
          const selected = new Set(state.selectedCommitShas);
          const { getRefactorPipeline } = await import('../extension');
          const refactorPipeline = await getRefactorPipeline();

          let branchLoaded = false;
          let branchName: string | null = null;
          const ensureBranch = async (): Promise<string | null> => {
            if (!branchLoaded) {
              const { GitOperations } = await import('../analysis/git');
              const git = new GitOperations();
              branchName = git.getCurrentBranch();
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
                const files = git.getFileChanges(sha);
                estFiles += files.length;
              } catch (error) {
                // Skip on error
              }
            }
            if (estFiles < 10) {
              try {
                const headSha = git.getHeadSha();
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
            const reportService = await getReportService();
            await reportService.generateReport(
              shas,
              'full',
              { force: forceReanalyze, cancellationToken: cancellationTokenSource.token }
            );
            await updateContexts();
            await refreshCockpitState('command:analyze');
          } finally {
            commitsProvider.refresh();
          }
        } catch (error) {
          // Update UI state on error
          orchestrator.updateState({ isAnalyzing: false, error: error instanceof Error ? error.message : String(error) }, 'command:analyze:error');
          vscode.window.showErrorMessage(`Failed to analyze selection: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          // Ensure UI state is reset
          orchestrator.updateState({ isAnalyzing: false }, 'command:analyze:complete');
        }
      }
    );

    // Open report (Cockpit)
    const openReportCmd = vscode.commands.registerCommand(
      'git-context.openReport',
      async (reportId: string) => {
        try {
          const { getReportManager } = await import('../storage/reportManager');
          const reportManager = getReportManager();
          const report = reportManager.load(reportId);
          if (report && report.facts && refactorReportProvider) {
            // Report manager stores the full analysis and facts
            await refactorReportProvider.showReport(report.analysis, report.facts);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open report: ${error}`);
        }
      }
    );

    // Regenerate report (Cockpit)
    const regenerateReportCmd = vscode.commands.registerCommand(
      'git-context.regenerateReport',
      async (reportId: string) => {
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
      }
    );

    // Delete report (Cockpit)
    const deleteReportCmd = vscode.commands.registerCommand(
      'git-context.deleteReport',
      async (reportId: string) => {
        try {
          const { getReportManager } = await import('../storage/reportManager');
          const reportManager = getReportManager();
          reportManager.delete(reportId);
          await refreshCockpitState();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete report: ${error}`);
        }
      }
    );

    // Toggle pin report (Cockpit)
    const togglePinReportCmd = vscode.commands.registerCommand(
      'git-context.togglePinReport',
      async (reportId: string) => {
        try {
          const { getReportManager } = await import('../storage/reportManager');
          const reportManager = getReportManager();
          const report = reportManager.load(reportId);
          if (report) {
            report.isPinned = !report.isPinned;
            reportManager.save(report);
            await refreshCockpitState();
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to toggle pin: ${error}`);
        }
      }
    );

    // Add commit by SHA (Cockpit)
    const addCommitByShaCmd = vscode.commands.registerCommand(
      'git-context.addCommitBySha',
      async (shaOrRef: string) => {
        try {
          let sha = shaOrRef;
          // Simple validation - if it looks like a SHA, use it
          if (!/^[0-9a-f]{7,40}$/i.test(shaOrRef)) {
            // Try to resolve as a ref using git command
            const { execSync } = await import('child_process');
            const { getGitRoot } = await import('../utils/config');
            const gitRoot = getGitRoot();
            if (gitRoot) {
              try {
                sha = execSync(`git rev-parse ${shaOrRef}`, { cwd: gitRoot, encoding: 'utf8' }).trim();
              } catch {
                vscode.window.showErrorMessage(`Could not resolve ref: ${shaOrRef}`);
                return;
              }
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
      }
    );

    // Select all staged (Cockpit)
    const selectAllStagedCmd = vscode.commands.registerCommand(
      'git-context.selectAllStaged',
      async () => {
        const state = orchestrator.getState();
        const stagedPaths = state.stagedFiles.map(f => f.path);
        orchestrator.updateState({ selectedStagedPaths: stagedPaths }, 'command:selectAllStaged');
      }
    );

    // Select all unstaged (Cockpit)
    const selectAllUnstagedCmd = vscode.commands.registerCommand(
      'git-context.selectAllUnstaged',
      async () => {
        const state = orchestrator.getState();
        const unstagedPaths = state.unstagedFiles.map(f => f.path);
        orchestrator.updateState({ selectedUnstagedPaths: unstagedPaths }, 'command:selectAllUnstaged');
      }
    );

    // Add more commits (Cockpit)
    const addMoreCommitsCmd = vscode.commands.registerCommand(
      'git-context.addMoreCommits',
      async () => {
        try {
          commitsProvider.loadMoreOffset += 20;
          commitsProvider.refresh();
          await refreshCockpitState();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to load more commits: ${error}`);
        }
      }
    );

    // Reset all (Cockpit)
    const resetAllCmd = vscode.commands.registerCommand(
      'git-context.resetAll',
      async () => {
        orchestrator.updateState({
          selectedCommitShas: [],
          selectedStagedPaths: [],
          selectedUnstagedPaths: [],
          bundleFacts: null,
          bundleSummary: null
        }, 'command:resetAll');
        commitsProvider.loadMoreOffset = 0;
        await updateContexts();
        await refreshCockpitState();
      }
    );

    // Bundle regenerate (Cockpit)
    const bundleRegenerateCmd = vscode.commands.registerCommand(
      'git-context.bundle.regenerate',
      async () => {
        await vscode.commands.executeCommand('git-context.analyze');
      }
    );

    // Bundle clear (Cockpit)
    const bundleClearCmd = vscode.commands.registerCommand(
      'git-context.bundle.clear',
      async () => {
        orchestrator.updateState({
          bundleFacts: null,
          bundleSummary: null
        }, 'command:bundleClear');
        // Clear bundle state (provider method may not exist, that's ok)
        await updateContexts();
      }
    );

    // Bundle cancel (Cockpit)
    const bundleCancelCmd = vscode.commands.registerCommand(
      'git-context.bundle.cancel',
      async () => {
        // Cancel any running analysis
        orchestrator.updateState({ isAnalyzing: false }, 'command:bundleCancel');
      }
    );

    // Bundle export (Cockpit)
    const bundleExportCmd = vscode.commands.registerCommand(
      'git-context.bundle.export',
      async () => {
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
      }
    );

    // Scroll to report section (Cockpit)
    const scrollToReportSectionCmd = vscode.commands.registerCommand(
      'git-context.scrollToReportSection',
      async (sectionId: string) => {
        // Forward to report webview
        logInfo(`Scroll to section: ${sectionId}`);
      }
    );

    // Open symbol history (Cockpit)
    const openSymbolHistoryCmd = vscode.commands.registerCommand(
      'git-context.openSymbolHistory',
      async (symbolId: string) => {
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
      }
    );

    // Register downloadWasmFiles command
    const downloadWasmFilesCmd = vscode.commands.registerCommand(
      'git-context.downloadWasmFiles',
      async () => {
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
      }
    );

    // Register generateLiveReport command
    const generateLiveReportCmd = vscode.commands.registerCommand(
      'git-context.generateLiveReport',
      async () => {
        try {
          const liveEngine = (orchestrator as any).liveEngine;
          if (!liveEngine) {
            vscode.window.showWarningMessage('Live analysis engine not available. Please reload the window.');
            return;
          }
          
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Generating live analysis report...',
            cancellable: false
          }, async () => {
            await liveEngine.analyze();
          });
        } catch (error) {
          logError('Failed to generate live report', error);
          vscode.window.showErrorMessage(`Failed to generate live report: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    );

    // Register all commands
    context.subscriptions.push(
      analyzeLastCommitsCmd,
      analyzeStagedCmd,
      analyzeUnstagedCmd,
      openSymbolCmd,
      toggleCommitSelectionCmd,
      clearSelectionCmd,
      openEvidenceCmd,
      copyShaCmd,
      analyzeCmd,
      openReportCmd,
      regenerateReportCmd,
      deleteReportCmd,
      togglePinReportCmd,
      addCommitByShaCmd,
      selectAllStagedCmd,
      selectAllUnstagedCmd,
      addMoreCommitsCmd,
      resetAllCmd,
      bundleRegenerateCmd,
      bundleClearCmd,
      bundleCancelCmd,
      bundleExportCmd,
      scrollToReportSectionCmd,
      openSymbolHistoryCmd,
      generateLiveReportCmd,
      downloadWasmFilesCmd
    );

    logInfo('Git Context commands registered successfully');
  } catch (error) {
    logError('Failed to register Git Context commands', error);
    vscode.window.showErrorMessage(`Failed to register Git Context commands: ${error}`);
  }
}
