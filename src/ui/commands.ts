import * as vscode from 'vscode';
import { CommitTrackerProvider } from './commitTracker';
import { SymbolHistoryProvider } from './symbolHistory';
import { analyzeLastCommits, analyzeStagedChanges, analyzeCommit } from '../cli/analyze';
import { showCommit, searchSymbol } from '../cli/queries';
import { getExtensionConfig } from '../utils/config';
import { LLMSummarizer } from '../llm/summarizer';

export function registerCommands(
  context: vscode.ExtensionContext,
  commitTracker: CommitTrackerProvider,
  symbolHistory: SymbolHistoryProvider
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

    context.subscriptions.push(
      analyzeLastCommitsCmd,
      analyzeStagedCmd,
      compareFilesCmd,
      explainSymbolCmd,
      searchSymbolsCmd
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
