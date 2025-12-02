# Features Module (`features/`)

## Purpose

The `features/` module implements the feature registration system that organizes and manages the extension's capabilities. It provides a declarative way to define features with their commands, watchers, effects, and lifecycle hooks, enabling modular development and clean separation of concerns.

## Key Components

### Feature Registration System

Features are defined using a declarative interface that specifies all their components:

```typescript
export interface FeatureRegistration {
  commands?: Array<{
    command: string;
    handler: CommandHandler;
  }>;
  watchers?: Array<WatcherFactory>;
  effects?: Array<{
    key?: keyof CockpitState | Array<keyof CockpitState>;
    handler: StateChangeHandler;
    priority?: number;
  }>;
  onActivate?: (shell: AppShell) => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}
```

### Core Features (`coreFeatures.ts`)

Defines the primary extension features that are always available.

```typescript
export async function registerCoreFeatures(
  shell: AppShell,
  providers: {
    commitsProvider: CommitsProvider;
    activeBundleProvider: ActiveBundleProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
    cockpitProvider: CockpitProvider;
    refactorReportProvider?: RefactorReportProvider;
  }
): Promise<void> {
  const coreFeature: FeatureRegistration = {
    commands: [
      {
        command: 'git-context.analyzeLastCommits',
        handler: analyzeLastCommitsHandler(providers),
      },
      {
        command: 'git-context.analyzeStagedChanges',
        handler: analyzeStagedChangesHandler(providers),
      },
      {
        command: 'git-context.compareFilesToCommit',
        handler: compareFilesToCommitHandler(providers),
      },
    ],

    watchers: [
      createGitCommitWatcher(shell.getOrchestrator()),
      createWorkspaceChangeWatcher(shell.getOrchestrator(), providers),
    ],

    effects: [
      {
        key: 'isAnalyzing',
        handler: analysisProgressEffect,
        priority: 1,
      },
      {
        key: ['bundleFacts', 'bundleSummary'],
        handler: bundleUpdateEffect,
        priority: 2,
      },
    ],

    onActivate: async shell => {
      logInfo('[CoreFeatures] Activating core features...');
      // Initialize core services
      await initializeCoreServices();
    },

    onDeactivate: () => {
      logInfo('[CoreFeatures] Deactivating core features...');
      // Cleanup core resources
      cleanupCoreServices();
    },
  };

  shell.registerFeature(coreFeature);
}
```

### Cockpit Features (`cockpitFeatures.ts`)

Defines features specific to the cockpit webview interface.

```typescript
export async function registerCockpitFeatures(
  shell: AppShell,
  providers: {
    commitsProvider: CommitsProvider;
    activeBundleProvider: ActiveBundleProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
    refactorReportProvider?: RefactorReportProvider;
  }
): Promise<void> {
  const cockpitFeature: FeatureRegistration = {
    commands: [
      {
        command: 'git-context.showRefactorReport',
        handler: showReportHandler(providers),
      },
      {
        command: 'git-context.openCockpit',
        handler: openCockpitHandler(providers),
      },
    ],

    watchers: [createCockpitStateWatcher(shell.getOrchestrator())],

    effects: [
      {
        key: 'activeFrame',
        handler: frameNavigationEffect,
        priority: 3,
      },
      {
        key: 'liveAnalysis',
        handler: liveAnalysisUpdateEffect,
        priority: 1,
      },
    ],

    onActivate: async shell => {
      logInfo('[CockpitFeatures] Activating cockpit features...');
      // Initialize webview resources
      await initializeWebviewResources();
    },
  };

  shell.registerFeature(cockpitFeature);
}
```

### Git Watcher Feature (`gitWatcherFeature.ts`)

Manages automatic analysis triggered by Git events.

```typescript
export async function registerGitWatcherFeature(
  shell: AppShell,
  context: vscode.ExtensionContext
): Promise<void> {
  const gitWatcherFeature: FeatureRegistration = {
    watchers: [
      createPostCommitWatcher(shell.getOrchestrator()),
      createBranchChangeWatcher(shell.getOrchestrator()),
      createStashWatcher(shell.getOrchestrator()),
    ],

    effects: [
      {
        key: 'repoContext',
        handler: repoChangeEffect,
        priority: 2,
      },
    ],

    onActivate: async shell => {
      logInfo('[GitWatcher] Setting up Git watchers...');

      // Install Git hooks if requested
      const config = getExtensionConfig();
      if (config.autoInstallHooks) {
        await installGitHooks();
      }

      // Start watching for Git events
      await startGitEventWatching();
    },

    onDeactivate: () => {
      logInfo('[GitWatcher] Cleaning up Git watchers...');
      stopGitEventWatching();
    },
  };

  shell.registerFeature(gitWatcherFeature);
}
```

## Architecture

### Feature Registration Flow

```
Feature Definition → AppShell.registerFeature() → Feature Storage
                                                              ↓
                                               Activation → Command Registration
                                                              ↓
                                               Watcher Creation → Event Listening
                                                              ↓
                                               Effect Subscription → State Change Handling
```

### Feature Lifecycle

```
Extension Activate → Feature.onActivate() → Feature Active
                                                       ↓
                      User Actions → Commands/Watchers/Effects
                                                       ↓
Extension Deactivate → Feature.onDeactivate() → Feature Inactive
```

## Key Concepts

### Declarative Feature Definition

Features are defined declaratively, making them easy to understand and modify:

```typescript
const myFeature: FeatureRegistration = {
  commands: [{ command: 'myExtension.doSomething', handler: doSomethingHandler }],
  watchers: [createMyWatcher(orchestrator)],
  effects: [{ key: 'myState', handler: myEffectHandler }],
  onActivate: initializeMyFeature,
  onDeactivate: cleanupMyFeature,
};
```

### Watcher Factory Pattern

Watchers are created through factories to encapsulate dependencies:

```typescript
export type WatcherFactory = (
  orchestrator: CockpitOrchestrator,
  pipeline?: RefactorPipeline
) => vscode.Disposable;

function createGitCommitWatcher(orchestrator: CockpitOrchestrator): WatcherFactory {
  return () => {
    return vscode.workspace.onDidChangeTextDocument(event => {
      if (isGitCommit(event.document)) {
        orchestrator.updateState({ lastCommit: event.document.uri });
      }
    });
  };
}
```

### Effect System

Effects respond to state changes with priority ordering:

```typescript
effects: [
  {
    key: ['isAnalyzing', 'bundleFacts'],
    handler: async change => {
      if (change.partial.isAnalyzing === false && change.partial.bundleFacts) {
        await updateUI(change.partial.bundleFacts);
      }
    },
    priority: 1, // Higher priority = executed first
  },
];
```

### Lifecycle Hooks

Features can perform initialization and cleanup:

```typescript
onActivate: async (shell) => {
  // Initialize resources
  await setupDatabase();
  await startBackgroundServices();
},

onDeactivate: () => {
  // Cleanup resources
  stopBackgroundServices();
  closeDatabase();
}
```

## Feature Categories

### Core Features

- **Analysis Operations**: Commit analysis, staged changes analysis
- **State Management**: Bundle updates, progress tracking
- **Navigation**: Frame navigation, cockpit opening

### Cockpit Features

- **UI Integration**: Webview management, report display
- **Live Analysis**: Real-time change tracking
- **Frame Analysis**: File/symbol analysis within cockpit

### Git Integration Features

- **Automatic Analysis**: Post-commit hooks, branch change detection
- **Repository Monitoring**: Stash operations, repository changes
- **Background Processing**: Non-intrusive analysis triggers

## Dependencies

- **core/** - AppShell for feature registration
- **commands/** - Command handlers
- **watchers/** - Watcher implementations
- **state/** - State management for effects
- **utils/** - Configuration and logging

## Usage Examples

### Defining a New Feature

```typescript
export function createMyFeature(providers: MyProviders): FeatureRegistration {
  return {
    commands: [
      {
        command: 'myExtension.myCommand',
        handler: async () => {
          await performMyOperation(providers);
        },
      },
    ],

    watchers: [orchestrator => createMyWatcher(orchestrator)],

    effects: [
      {
        key: 'myState',
        handler: change => handleMyStateChange(change),
        priority: 1,
      },
    ],

    onActivate: async () => {
      logInfo('My feature activated');
      await initializeMyResources();
    },

    onDeactivate: () => {
      logInfo('My feature deactivated');
      cleanupMyResources();
    },
  };
}
```

### Registering Features in Extension

```typescript
// In extension.ts
export async function activate(context: vscode.ExtensionContext) {
  const shell = new AppShell(context);

  // Register core features
  await registerCoreFeatures(shell, providers);

  // Register cockpit features
  await registerCockpitFeatures(shell, providers);

  // Register Git watcher features
  await registerGitWatcherFeature(shell, context);

  // Register custom features
  shell.registerFeature(createMyCustomFeature(providers));
}
```

### Creating a Watcher Factory

```typescript
function createFileChangeWatcher(orchestrator: CockpitOrchestrator): WatcherFactory {
  return () => {
    return vscode.workspace.onDidSaveTextDocument(document => {
      // Only process supported files
      if (isSupportedFile(document)) {
        orchestrator.updateState({
          lastSavedFile: document.uri.fsPath,
          pendingAnalysis: true,
        });
      }
    });
  };
}
```

### Implementing Effects

```typescript
function analysisCompleteEffect(change: CockpitStateChange): void {
  // Only trigger when analysis completes
  if (change.partial.isAnalyzing === false && change.partial.bundleFacts) {
    // Show notification
    vscode.window.showInformationMessage('Analysis complete!');

    // Update UI
    updateAnalysisResults(change.partial.bundleFacts);

    // Trigger follow-up actions
    scheduleReportGeneration(change.partial.bundleFacts);
  }
}

// Register effect
effects: [
  {
    key: ['isAnalyzing', 'bundleFacts'],
    handler: analysisCompleteEffect,
    priority: 1,
  },
];
```

## Feature Isolation

Features are designed to be independent and composable:

- **No Shared State**: Each feature manages its own concerns
- **Dependency Injection**: Dependencies passed explicitly
- **Error Containment**: Feature failures don't affect others
- **Optional Features**: Features can be enabled/disabled independently

## Performance Characteristics

- **Lazy Initialization**: Features activated only when needed
- **Efficient Watchers**: Debounced and filtered event handling
- **Priority Effects**: High-priority effects executed first
- **Resource Cleanup**: Proper disposal on deactivation

## Error Handling

- **Feature Isolation**: Feature failures contained within the feature
- **Graceful Degradation**: Extension continues with failed features disabled
- **Logging**: Comprehensive error logging for debugging
- **Recovery**: Features can be reactivated on configuration changes

## Related Documentation

- [Core Module](core.md) - AppShell and feature registration system
- [Commands Module](commands.md) - Command handlers used in features
- [Watchers Module](watchers.md) - Watcher implementations
- [State Module](state.md) - State management for effects
