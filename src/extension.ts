import * as vscode from 'vscode';
import type { CommitTrackerProvider } from './ui/commitTracker';
import type { SymbolHistoryProvider } from './ui/symbolHistory';

let commitTrackerProvider: CommitTrackerProvider;
let symbolHistoryProvider: SymbolHistoryProvider;

export async function activate(context: vscode.ExtensionContext) {
  try {
    console.log('Git Context extension is activating...');

    // Dynamically import providers and commands to prevent load-time errors
    // from native dependencies or ESM issues
    const { CommitTrackerProvider } = await import('./ui/commitTracker');
    const { SymbolHistoryProvider } = await import('./ui/symbolHistory');
    const { registerCommands } = await import('./ui/commands');

    console.log('Modules loaded successfully');

    // Initialize providers
    commitTrackerProvider = new CommitTrackerProvider(context);
    symbolHistoryProvider = new SymbolHistoryProvider(context);

    // Register tree data providers
    vscode.window.registerTreeDataProvider('commitTracker', commitTrackerProvider);
    vscode.window.registerTreeDataProvider('symbolHistory', symbolHistoryProvider);

    // Register commands
    registerCommands(context, commitTrackerProvider, symbolHistoryProvider);

    // Refresh providers when workspace changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (commitTrackerProvider) {
          commitTrackerProvider.refresh();
        }
        if (symbolHistoryProvider) {
          symbolHistoryProvider.refresh();
        }
      })
    );

    console.log('Git Context extension activated successfully');
  } catch (error) {
    console.error('Failed to activate Git Context extension:', error);
    // This is the critical part: show the error to the user!
    vscode.window.showErrorMessage(
      `Git Context extension failed to activate. Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function deactivate() {
  console.log('Git Context extension is now deactivated!');
}
