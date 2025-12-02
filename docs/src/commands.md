# Commands Module (`commands/`)

## Purpose

The `commands/` module defines VS Code command handlers that provide the extension's functionality through the command palette and menus. These commands bridge user actions with the extension's core capabilities.

## Key Components

### Commands Registration (`commands.ts`)

Central registry of all VS Code commands provided by the extension.

```typescript
import * as vscode from 'vscode';
import { getStore } from '../state/store';
import { logError, logInfo } from '../utils/logger';

export function registerCommands(context: vscode.ExtensionContext) {
  const commands = [
    // Analysis commands
    vscode.commands.registerCommand('git-context.analyzeLastCommits', analyzeLastCommits),
    vscode.commands.registerCommand('git-context.analyzeStagedChanges', analyzeStagedChanges),
    vscode.commands.registerCommand('git-context.compareFilesToCommit', compareFilesToCommit),
    vscode.commands.registerCommand('git-context.explainSymbolChange', explainSymbolChange),

    // Navigation commands
    vscode.commands.registerCommand('git-context.showRefactorReport', showRefactorReport),
    vscode.commands.registerCommand('git-context.openSettings', openSettings),

    // Debug commands
    vscode.commands.registerCommand('git-context.debug.dumpState', dumpState),
    vscode.commands.registerCommand('git-context.debug.loadState', loadState),
  ];

  // Register all commands
  context.subscriptions.push(...commands);
}
```

## Command Handlers

### Analysis Commands

#### `analyzeLastCommits`

Analyzes recent commits and displays results in the cockpit.

```typescript
async function analyzeLastCommits() {
  const config = getExtensionConfig();
  const commitCount = config.defaultCommitCount || 5;

  try {
    // Get recent commits
    const commits = await getRecentCommits(commitCount);

    // Dispatch analysis action
    getStore().dispatch({
      type: 'ANALYSIS_REQUESTED',
      payload: {
        selection: commits.map(c => c.sha),
        force: false,
      },
    });

    // Show progress
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Analyzing ${commitCount} commits...`,
        cancellable: true,
      },
      async (progress, token) => {
        // Progress updates handled by store subscription
        return new Promise(resolve => {
          const unsubscribe = getStore().subscribe(() => {
            const state = getStore().getState();
            if (!state.isAnalyzing) {
              unsubscribe();
              resolve();
            }
          });
        });
      }
    );
  } catch (error) {
    logError('Failed to analyze commits', error);
    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
  }
}
```

#### `analyzeStagedChanges`

Analyzes currently staged changes.

```typescript
async function analyzeStagedChanges() {
  try {
    const git = new GitOperations();
    const stagedFiles = await git.getStagedFiles();

    if (stagedFiles.length === 0) {
      vscode.window.showInformationMessage('No staged changes to analyze.');
      return;
    }

    getStore().dispatch({
      type: 'ANALYSIS_REQUESTED',
      payload: {
        selection: ['HEAD'], // Compare staged to HEAD
        workspaceParts: new Set(['staged']),
      },
    });
  } catch (error) {
    logError('Failed to analyze staged changes', error);
    vscode.window.showErrorMessage(`Staged analysis failed: ${error.message}`);
  }
}
```

#### `compareFilesToCommit`

Allows users to compare selected files to a specific commit.

```typescript
async function compareFilesToCommit() {
  // Get selected files
  const selectedFiles = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: true,
    openLabel: 'Select Files to Compare',
  });

  if (!selectedFiles) return;

  // Get target commit
  const commitSha = await vscode.window.showInputBox({
    prompt: 'Enter commit SHA to compare against',
    placeHolder: 'abc123...',
  });

  if (!commitSha) return;

  // Perform comparison
  const comparison = await compareFiles(selectedFiles, commitSha);

  // Display results
  showComparisonResults(comparison);
}
```

### Navigation Commands

#### `showRefactorReport`

Displays the current analysis report.

```typescript
async function showRefactorReport() {
  const store = getStore();
  const state = store.getState();

  // Get LLM outputs from current analysis
  const llmOutputs = state.llmOutputs;
  const analysis = llmOutputs?.llmAnalysis || llmOutputs;

  if (analysis && analysis.markdown) {
    // Create and show document
    const doc = await vscode.workspace.openTextDocument({
      content: analysis.markdown,
      language: 'markdown',
    });
    await vscode.window.showTextDocument(doc, { preview: true });
  } else {
    vscode.window.showInformationMessage('Run an analysis first to view the report.');
  }
}
```

### Debug Commands

#### `dumpState`

Exports current cockpit state for debugging.

```typescript
async function dumpState() {
  try {
    const state = getStore().getState();

    // Create JSON document
    const doc = await vscode.workspace.openTextDocument({
      content: JSON.stringify(state, null, 2),
      language: 'json',
    });

    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to dump state: ${error.message}`);
  }
}
```

#### `loadState`

Imports cockpit state from JSON for debugging.

```typescript
async function loadState() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor with state JSON');
    return;
  }

  try {
    const text = editor.document.getText();
    const state = JSON.parse(text);

    // Validate state structure
    if (!isValidCockpitState(state)) {
      throw new Error('Invalid state structure');
    }

    // Load state into store
    getStore().dispatch({
      type: 'RESET_ALL_STATE',
    });

    // Apply loaded state
    Object.keys(state).forEach(key => {
      getStore().dispatch({
        type: 'LEGACY_STATE_UPDATED',
        payload: { [key]: state[key] },
      });
    });

    vscode.window.showInformationMessage('Debug state loaded successfully');
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to load state: ${error.message}`);
  }
}
```

## Architecture

### Command Registration

Commands are registered during extension activation:

```typescript
// In extension.ts
import { registerCommands } from './commands/commands';

export function activate(context: vscode.ExtensionContext) {
  registerCommands(context);
  // ... other initialization
}
```

### State Integration

Commands interact with the Redux store for state management:

```typescript
// Commands dispatch actions
getStore().dispatch({
  type: 'ANALYSIS_REQUESTED',
  payload: { selection: commitShas },
});

// Commands can read current state
const state = getStore().getState();
if (state.isAnalyzing) {
  vscode.window.showInformationMessage('Analysis already in progress');
}
```

### Error Handling

Commands provide user-friendly error handling:

```typescript
async function someCommand() {
  try {
    await performOperation();
    vscode.window.showInformationMessage('Operation completed successfully');
  } catch (error) {
    logError('Command failed', error);

    // User-friendly error message
    const message = error instanceof UserError ? error.message : 'An unexpected error occurred';

    vscode.window.showErrorMessage(message);
  }
}
```

## Key Concepts

### Command Naming Convention

Commands follow VS Code naming conventions:

- **Prefix**: `git-context.` for all extension commands
- **Action**: Descriptive action name (analyze, show, compare)
- **Target**: What the command acts on (commits, changes, files)
- **Context**: Additional context (staged, last)

### Asynchronous Operations

Most commands are async to handle analysis and I/O operations:

```typescript
vscode.commands.registerCommand('git-context.analyzeLastCommits', async () => {
  // Async command implementation
  await performAnalysis();
});
```

### Progress Indication

Long-running commands show progress to users:

```typescript
await vscode.window.withProgress(
  {
    location: vscode.ProgressLocation.Notification,
    title: 'Analyzing commits...',
    cancellable: true,
  },
  async (progress, token) => {
    // Report progress updates
    progress.report({ increment: 25, message: 'Loading commits...' });
    // ... operation
    progress.report({ increment: 50, message: 'Running analysis...' });
    // ... completion
  }
);
```

### User Input Collection

Commands collect input through VS Code APIs:

```typescript
// Text input
const commitSha = await vscode.window.showInputBox({
  prompt: 'Enter commit SHA',
  placeHolder: 'abc123...',
});

// File selection
const files = await vscode.window.showOpenDialog({
  canSelectFiles: true,
  canSelectMany: true,
});

// Quick pick
const action = await vscode.window.showQuickPick([
  'Analyze commits',
  'Compare files',
  'Show report',
]);
```

## Dependencies

- **state/** - Redux store for state management
- **analysis/** - Analysis operations
- **services/** - Business logic services
- **utils/** - Logging and configuration

## Usage Examples

### Command Registration

```typescript
// Register a simple command
const disposable = vscode.commands.registerCommand('git-context.hello', () => {
  vscode.window.showInformationMessage('Hello from Git Context!');
});

context.subscriptions.push(disposable);
```

### State-Aware Command

```typescript
vscode.commands.registerCommand('git-context.conditionalAction', async () => {
  const state = getStore().getState();

  if (state.isAnalyzing) {
    const choice = await vscode.window.showWarningMessage(
      'Analysis in progress. Continue anyway?',
      'Yes',
      'No'
    );

    if (choice !== 'Yes') return;
  }

  // Perform action
  await performAction();
});
```

### Complex Command with Progress

```typescript
vscode.commands.registerCommand('git-context.complexAnalysis', async () => {
  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectMany: true,
  });

  if (!files) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Running complex analysis...',
      cancellable: true,
    },
    async (progress, token) => {
      // Check for cancellation
      if (token.isCancellationRequested) return;

      progress.report({ increment: 0, message: 'Initializing...' });

      // Step 1
      await step1(files);
      progress.report({ increment: 25, message: 'Step 1 complete' });

      // Step 2
      await step2(files);
      progress.report({ increment: 50, message: 'Step 2 complete' });

      // Final step
      const result = await step3(files);
      progress.report({ increment: 25, message: 'Analysis complete' });

      // Show results
      showResults(result);
    }
  );
});
```

## Command Palette Integration

Commands appear in VS Code's command palette (`Ctrl+Shift+P`) with titles and descriptions:

```json
{
  "contributes": {
    "commands": [
      {
        "command": "git-context.analyzeLastCommits",
        "title": "Git Context: Analyze Last Commits",
        "category": "Git Context"
      },
      {
        "command": "git-context.showRefactorReport",
        "title": "Git Context: Show Refactor Report",
        "category": "Git Context"
      }
    ]
  }
}
```

## Keybindings

Commands can have default keybindings:

```json
{
  "contributes": {
    "keybindings": [
      {
        "command": "git-context.analyzeLastCommits",
        "key": "ctrl+shift+g ctrl+shift+a",
        "when": "gitContextAvailable"
      }
    ]
  }
}
```

## Performance Characteristics

- **Non-blocking**: Async commands don't freeze the UI
- **Progress Feedback**: Users see progress for long operations
- **Cancellation Support**: Long-running commands can be cancelled
- **State Consistency**: Commands work with current application state

## Error Handling

- **User-Friendly Messages**: Clear error messages for users
- **Logging**: Detailed error logging for developers
- **Recovery Options**: Suggestions for fixing common issues
- **Graceful Degradation**: Commands fail gracefully when dependencies unavailable

## Related Documentation

- [Extension Module](extension.md) - Command registration during activation
- [State Module](state.md) - State management integration
- [Analysis Module](analysis.md) - Analysis operations triggered by commands
