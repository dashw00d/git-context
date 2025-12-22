import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { ContextExporter } from '../analysis/contextExporter';
import { GitOperations } from '../analysis/git';
import { refreshCockpitState, updateContexts } from '../core/stateUpdaters';
import { ActiveBundleProvider } from '../providers/activeBundleProvider';
import { CommitsProvider } from '../providers/commitsProvider';
import { SymbolHistoryProvider } from '../providers/symbolHistoryProvider';
import { getReportService } from '../services/reportService';
import { getCockpitOrchestrator } from '../state/cockpitOrchestrator';
import { getStore } from '../state/store';
import { prepare } from '../storage/statement-wrapper';
import { logDebug, logError, logInfo } from '../utils/logger';
import { isWorkspaceSha, makeWorkspaceSha, parseWorkspaceSha } from '../utils/workspace';
import { RefactorReportProvider } from '../webview/reports/refactorReportProvider';

export async function registerCommands(
  context: vscode.ExtensionContext,
  commitsProvider: CommitsProvider,
  activeBundleProvider: ActiveBundleProvider,
  symbolHistory: SymbolHistoryProvider,
  refactorReportProvider?: RefactorReportProvider
) {
  const orchestrator = getCockpitOrchestrator();
  const store = getStore();

  try {
    const analyzeLastCommitsCmd = vscode.commands.registerCommand(
      'git-context.analyzeLastCommits',
      async (countArg?: string) => {
        const { getExtensionConfig } = await import('../utils/config');
        const config = getExtensionConfig();
        const count =
          countArg ||
          (await vscode.window.showInputBox({
            prompt: 'Number of commits to analyze',
            value: config.defaultCommitCount.toString(),
            validateInput: value => {
              const num = parseInt(value);
              if (isNaN(num) || num <= 0) {
                return 'Please enter a positive number';
              }
              return undefined;
            },
          }));

        if (count) {
          vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Analyzing commits...',
              cancellable: true,
            },
            async (progress, token) => {
              try {
                await commitsProvider.initializeDatabase();
                const { getRefactorPipeline } = await import('../services/pipelineFactory');
                const pipeline = await getRefactorPipeline();
                const git = new GitOperations();
                const commits = await git.getRecentCommits(parseInt(count));
                const shas = commits.map(c => c.sha);

                progress.report({
                  increment: 0,
                  message: `Analyzing ${shas.length} commits...`,
                });

                if (token.isCancellationRequested) {
                  return;
                }

                progress.report({
                  increment: 25,
                  message: 'Indexing commits...',
                });
                if (token.isCancellationRequested) return;

                await pipeline.indexCommits(shas);

                progress.report({ increment: 50, message: 'Refreshing UI...' });
                if (token.isCancellationRequested) return;

                store.dispatch({ type: 'SELECTION_SET', payload: { shas } });
                await updateContexts();

                await commitsProvider.refresh();
                await refreshCockpitState(
                  orchestrator,
                  {
                    commitsProvider,
                    activeBundleProvider,
                    symbolHistoryProvider: symbolHistory,
                  },
                  'command:analyzeLastCommits'
                );

                progress.report({
                  increment: 100,
                  message: 'Starting analysis...',
                });
                vscode.window.showInformationMessage(
                  `Indexed ${shas.length} commits. Starting analysis...`
                );

                await vscode.commands.executeCommand('git-context.analyze');
              } catch (error) {
                vscode.window.showErrorMessage(`Failed to analyze commits: ${error}`);
              }
            }
          );
        }
      }
    );

    const analyzeStagedCmd = vscode.commands.registerCommand(
      'git-context.analyzeStagedChanges',
      async () => {
        try {
          await commitsProvider.refresh();
          const state = store.getState();
          const stagedPaths = state.stagedFiles.map(f => f.path);

          if (stagedPaths.length === 0) {
            vscode.window.showInformationMessage('No staged changes to analyze');
            return;
          }

          store.dispatch({
            type: 'STAGED_SELECTION_UPDATED',
            payload: { paths: stagedPaths },
          });
          await updateContexts();

          await vscode.commands.executeCommand('git-context.analyze');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to analyze staged changes: ${error}`);
        }
      }
    );

    const analyzeUnstagedCmd = vscode.commands.registerCommand(
      'git-context.analyzeUnstagedChanges',
      async () => {
        try {
          await commitsProvider.refresh();
          const state = store.getState();
          const unstagedPaths = state.unstagedFiles.map(f => f.path);

          if (unstagedPaths.length === 0) {
            vscode.window.showInformationMessage('No unstaged files to analyze');
            return;
          }

          store.dispatch({
            type: 'UNSTAGED_SELECTION_UPDATED',
            payload: { paths: unstagedPaths },
          });
          await updateContexts();

          await vscode.commands.executeCommand('git-context.analyze');
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to analyze unstaged changes: ${error}`);
        }
      }
    );

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

    const toggleCommitSelectionCmd = vscode.commands.registerCommand(
      'git-context.toggleCommitSelection',
      async (shaOrItem: string | any) => {
        const sha = typeof shaOrItem === 'string' ? shaOrItem : shaOrItem?.id || shaOrItem?.sha;
        if (sha) {
          const state = store.getState();
          const selected = new Set(state.selectedCommitShas);
          if (selected.has(sha)) {
            selected.delete(sha);
          } else {
            selected.add(sha);
          }
          store.dispatch({
            type: 'SELECTION_SET',
            payload: { shas: Array.from(selected) },
          });
          await updateContexts();
        }
      }
    );

    const clearSelectionCmd = vscode.commands.registerCommand(
      'git-context.clearSelection',
      async () => {
        store.dispatch({ type: 'SELECTION_CLEARED' });
        await updateContexts();
      }
    );

    const openEvidenceCmd = vscode.commands.registerCommand(
      'git-context.openEvidence',
      async (args: any) => {
        try {
          if (Array.isArray(args) && args.length > 0) {
            args = args[0];
          }
          const { filePath, lineNumber, path: jsonPath } = args;
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
      }
    );

    const copyShaCmd = vscode.commands.registerCommand(
      'git-context.copySha',
      async (sha: string) => {
        await vscode.env.clipboard.writeText(sha);
        vscode.window.showInformationMessage(`Copied SHA: ${sha.substring(0, 8)}`);
      }
    );

    const analyzeCmd = vscode.commands.registerCommand(
      'git-context.analyze',
      async (forceReanalyze = false) => {
        try {
          const state = store.getState();
          logDebug(`🔍 [AnalyzeCmd] State selectedCommitShas: ${state.selectedCommitShas.length}`);
          logDebug(
            `🔍 [AnalyzeCmd] State SHAs: ${state.selectedCommitShas.slice(0, 10).join(', ')}${state.selectedCommitShas.length > 10 ? '...' : ''}`
          );
          const selected = new Set(state.selectedCommitShas);

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
            workspaceRequests.set('staged', {
              sha: undefined,
              fromPaths: true,
            });
          }
          if (state.selectedUnstagedPaths.length > 0) {
            workspaceRequests.set('unstaged', {
              sha: undefined,
              fromPaths: true,
            });
          }

          for (const sha of Array.from(selected).filter(isWorkspaceSha)) {
            const parsed = parseWorkspaceSha(sha);
            if (parsed) {
              const existing = workspaceRequests.get(parsed.mode) || {
                sha: undefined,
                fromPaths: false,
              };
              workspaceRequests.set(parsed.mode, {
                sha,
                fromPaths: existing.fromPaths,
              });
            }
          }

          for (const [mode, request] of workspaceRequests.entries()) {
            if (!request.sha) {
              const currentBranch = await ensureBranch();
              request.sha = makeWorkspaceSha(mode, currentBranch);
            }

            const parsed = request.sha ? parseWorkspaceSha(request.sha) : null;
            if (parsed && !request.sha.includes('@')) {
              const currentBranch = await ensureBranch();
              request.sha = makeWorkspaceSha(mode, currentBranch);
            }

            const { GitOperations } = await import('../analysis/git');
            const git = new GitOperations();
            const files =
              mode === 'staged' ? await git.getStagedFiles() : await git.getUnstagedFiles();

            if (files.length > 0) {
              selected.add(request.sha!);
            } else if (request.fromPaths) {
              vscode.window.showInformationMessage(`No ${mode} files to analyze`);
            }
          }

          const shas = Array.from(selected);
          logDebug(`🔍 [AnalyzeCmd] Selected SHAs from state: ${shas.length}`);
          logDebug(
            `🔍 [AnalyzeCmd] SHAs: ${shas.slice(0, 10).join(', ')}${shas.length > 10 ? '...' : ''}`
          );

          if (shas.length === 0) {
            vscode.window.showWarningMessage(
              'Please select commits or workspace changes to analyze.'
            );
            return;
          }

          const commitShas = shas.filter(sha => !isWorkspaceSha(sha));
          logDebug(`🔍 [AnalyzeCmd] Commit SHAs (non-workspace): ${commitShas.length}`);
          logDebug(`🔍 [AnalyzeCmd] Workspace SHAs: ${shas.filter(isWorkspaceSha).length}`);
          if (commitShas.length > 0) {
            const git = new GitOperations();
            let estFiles = 0;
            for (const sha of commitShas) {
              try {
                const files = await git.getFileChanges(sha);
                estFiles += files.length;
              } catch (error) {
                //empty
              }
            }
            if (estFiles < 10) {
              try {
                const headSha = await git.getHeadSha();
                if (!shas.includes(headSha)) {
                  logInfo(
                    `[Auto-include] Adding HEAD (${headSha.substring(
                      0,
                      8
                    )}) to selection (${estFiles} files < 10 threshold)`
                  );
                  shas.push(headSha);
                }
              } catch (error) {
                //empty
              }
            }
          }

          const cancellationTokenSource = new vscode.CancellationTokenSource();
          try {
            const reportService = await getReportService();
            await reportService.generateReport(shas, 'full', {
              force: forceReanalyze,
              cancellationToken: cancellationTokenSource.token,
            });
            await updateContexts();
            await refreshCockpitState(
              orchestrator,
              {
                commitsProvider,
                activeBundleProvider,
                symbolHistoryProvider: symbolHistory,
              },
              'command:analyze'
            );
          } finally {
            await commitsProvider.refresh();
          }
        } catch (error) {
          store.dispatch({
            type: 'ANALYSIS_FAILED',
            payload: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
          vscode.window.showErrorMessage(
            `Failed to analyze selection: ${error instanceof Error ? error.message : String(error)}`
          );
        } finally {
          store.dispatch({
            type: 'ANALYSIS_PROGRESS_UPDATED',
            payload: {
              isAnalyzing: false,
              step: undefined,
              progress: undefined,
            },
          });
        }
      }
    );

    const openReportCmd = vscode.commands.registerCommand(
      'git-context.openReport',
      async (reportId: string) => {
        try {
          const { getReportManager } = await import('../storage/reportManager');
          const reportManager = getReportManager();
          const report = reportManager.load(reportId);
          if (report && report.facts && refactorReportProvider) {
            await refactorReportProvider.showReport(report.analysis, report.facts);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to open report: ${error}`);
        }
      }
    );

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

    const deleteReportCmd = vscode.commands.registerCommand(
      'git-context.deleteReport',
      async (reportId: string) => {
        try {
          const { getReportManager } = await import('../storage/reportManager');
          const reportManager = getReportManager();
          reportManager.delete(reportId);
          await refreshCockpitState(orchestrator, {
            commitsProvider,
            activeBundleProvider,
            symbolHistoryProvider: symbolHistory,
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete report: ${error}`);
        }
      }
    );

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
            await refreshCockpitState(orchestrator, {
              commitsProvider,
              activeBundleProvider,
              symbolHistoryProvider: symbolHistory,
            });
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to toggle pin: ${error}`);
        }
      }
    );

    const addCommitByShaCmd = vscode.commands.registerCommand(
      'git-context.addCommitBySha',
      async (shaOrRef: string) => {
        try {
          let sha = shaOrRef;

          if (!/^[0-9a-f]{7,40}$/i.test(shaOrRef)) {
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
            const state = store.getState();
            const selected = new Set(state.selectedCommitShas);
            selected.add(sha);
            store.dispatch({
              type: 'SELECTION_SET',
              payload: { shas: Array.from(selected) },
            });
            await updateContexts();
          }
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to add commit: ${error}`);
        }
      }
    );

    const selectAllStagedCmd = vscode.commands.registerCommand(
      'git-context.selectAllStaged',
      async () => {
        const state = store.getState();
        const stagedPaths = state.stagedFiles.map(f => f.path);
        store.dispatch({
          type: 'STAGED_SELECTION_UPDATED',
          payload: { paths: stagedPaths },
        });
      }
    );

    const selectAllUnstagedCmd = vscode.commands.registerCommand(
      'git-context.selectAllUnstaged',
      async () => {
        const state = store.getState();
        const unstagedPaths = state.unstagedFiles.map(f => f.path);
        store.dispatch({
          type: 'UNSTAGED_SELECTION_UPDATED',
          payload: { paths: unstagedPaths },
        });
      }
    );

    const addMoreCommitsCmd = vscode.commands.registerCommand(
      'git-context.addMoreCommits',
      async () => {
        try {
          commitsProvider.loadMoreOffset += 20;
          await commitsProvider.refresh();
          await refreshCockpitState(orchestrator, {
            commitsProvider,
            activeBundleProvider,
            symbolHistoryProvider: symbolHistory,
          });
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to load more commits: ${error}`);
        }
      }
    );

    const resetAllCmd = vscode.commands.registerCommand('git-context.resetAll', async () => {
      store.dispatch({ type: 'SELECTION_CLEARED' });
      store.dispatch({ type: 'BUNDLE_CLEARED' });
      commitsProvider.loadMoreOffset = 0;
      await updateContexts();
      await refreshCockpitState(orchestrator, {
        commitsProvider,
        activeBundleProvider,
        symbolHistoryProvider: symbolHistory,
      });
    });

    const bundleRegenerateCmd = vscode.commands.registerCommand(
      'git-context.bundle.regenerate',
      async () => {
        await vscode.commands.executeCommand('git-context.analyze');
      }
    );

    const bundleClearCmd = vscode.commands.registerCommand('git-context.bundle.clear', async () => {
      store.dispatch({ type: 'BUNDLE_CLEARED' });

      await updateContexts();
    });

    const bundleCancelCmd = vscode.commands.registerCommand(
      'git-context.bundle.cancel',
      async () => {
        store.dispatch({ type: 'ANALYSIS_CANCELLED' });
      }
    );

    const bundleExportCmd = vscode.commands.registerCommand(
      'git-context.bundle.export',
      async () => {
        const state = store.getState();
        if (!state.bundleFacts) {
          vscode.window.showWarningMessage('No active bundle to export');
          return;
        }
        try {
          const filePath = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file('bundle-facts.json'),
            filters: { 'JSON files': ['json'], 'All files': ['*'] },
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

    const exportContextCmd = vscode.commands.registerCommand(
      'git-context.exportContext',
      async () => {
        const state = store.getState();
        const shas = state.bundleFacts?.bundle.shas || state.selectedCommitShas;

        if (!shas || shas.length === 0) {
          vscode.window.showWarningMessage(
            'Select commits or generate a bundle before exporting context.'
          );
          return;
        }

        try {
          const exporter = new ContextExporter();
          const gitRoot = (await import('../utils/config')).getGitRoot();
          if (!gitRoot) {
            vscode.window.showWarningMessage('Not in a git repository. Cannot export context.');
            return;
          }

          const defaultUri = vscode.Uri.file(
            path.join(gitRoot, '.git', 'commit-tracker', 'commit-context.json')
          );

          const target = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { 'JSON files': ['json'], 'All files': ['*'] },
            saveLabel: 'Export Context',
          });

          if (!target) {
            return;
          }

          const outputPath = await exporter.exportToFile(shas, target.fsPath);
          vscode.window.showInformationMessage(`Context exported to ${outputPath}`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to export context: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    );

    const scrollToReportSectionCmd = vscode.commands.registerCommand(
      'git-context.scrollToReportSection',
      async (sectionId: string) => {
        logInfo(`Scroll to section: ${sectionId}`);
      }
    );

    const openSymbolHistoryCmd = vscode.commands.registerCommand(
      'git-context.openSymbolHistory',
      async (symbolId: string) => {
        try {
          const history = prepare(`
            SELECT sha, name, path, change_type, diff_snippet_post
            FROM symbols
            WHERE symbol_id = ?
            ORDER BY id DESC
            LIMIT 20
          `).all(symbolId);

          const content = `# Symbol History: ${symbolId}\n\n${history
            .map(
              (h: any) =>
                `## ${h.sha.substring(0, 8)} - ${h.change_type}\n\`\`\`\n${
                  h.diff_snippet_post || 'N/A'
                }\n\`\`\`\n`
            )
            .join('\n')}`;

          const doc = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown',
          });
          await vscode.window.showTextDocument(doc);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to show symbol history: ${error}`);
        }
      }
    );

    const downloadWasmFilesCmd = vscode.commands.registerCommand(
      'git-context.downloadWasmFiles',
      async () => {
        try {
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Downloading required WASM files...',
              cancellable: false,
            },
            async progress => {
              return new Promise<void>((resolve, reject) => {
                const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'download-wasm.js');
                const nodeProcess = spawn('node', [scriptPath], {
                  cwd: path.join(__dirname, '..', '..'),
                  stdio: 'pipe',
                });

                let output = '';
                nodeProcess.stdout.on('data', (data: Buffer) => {
                  output += data.toString();
                  const lines = data
                    .toString()
                    .split('\n')
                    .filter((l: string) => l.trim());
                  lines.forEach((line: string) => {
                    if (
                      line.includes('Downloading') ||
                      line.includes('Downloaded') ||
                      line.includes('%')
                    ) {
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
            }
          );
        } catch (error) {
          logError('Failed to download WASM files:', error);
          vscode.window.showErrorMessage(`Failed to download WASM files: ${error}`);
        }
      }
    );

    const generateLiveReportCmd = vscode.commands.registerCommand(
      'git-context.generateLiveReport',
      async () => {
        try {
          const liveEngine = (orchestrator as any).liveEngine;
          if (!liveEngine) {
            vscode.window.showWarningMessage(
              'Live analysis engine not available. Please reload the window.'
            );
            return;
          }

          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: 'Generating live analysis report...',
              cancellable: false,
            },
            async () => {
              await liveEngine.analyze();
            }
          );
        } catch (error) {
          logError('Failed to generate live report', error);
          vscode.window.showErrorMessage(
            `Failed to generate live report: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    );

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
      exportContextCmd,
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
