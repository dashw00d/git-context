# Core Module (`core/`)

## Purpose

The `core/` module provides the foundational infrastructure for the Git Context extension. It implements the AppShell pattern for feature registration, manages file watchers for workspace monitoring, and handles state synchronization between components.

## Key Components

### AppShell (`appShell.ts`)

The AppShell is the central orchestrator for feature registration and lifecycle management.

#### Feature Registration System

```typescript
export interface FeatureRegistration {
  commands?: Array<{
    command: string;
    handler: CommandHandler;
  }>;
  watchers?: Array<WatcherFactory>;
  effects?: Array<{
    key?: keyof CockpitState | Array<keyof CockpitState>;
    handler: (change: CockpitStateChange) => void | Promise<void>;
    priority?: number;
  }>;
  onActivate?: (shell: AppShell) => void | Promise<void>;
  onDeactivate?: () => void | Promise<void>;
}
```

#### AppShell Class

```typescript
export class AppShell {
  constructor(private context: vscode.ExtensionContext) {}

  registerFeature(feature: FeatureRegistration): void {
    // Register commands, watchers, effects
  }

  getOrchestrator(): CockpitOrchestrator {
    // Return state orchestrator
  }
}
```

**Responsibilities:**

- Command registration with VS Code
- Watcher factory management
- Effect subscription handling
- Lifecycle callbacks (activate/deactivate)

### File Watchers (`fileWatchers.ts`)

Manages workspace file system monitoring for automatic UI updates.

#### Watcher Types

- **Git Watcher**: Monitors `.git/` directory for commit changes
- **Workspace Watcher**: Monitors source files for modifications
- **Bundle Watcher**: Monitors bundle configuration changes

#### Debounced Updates

```typescript
const scheduleWorkspaceRefresh = (reason: string) => {
  if (workspaceRefreshTimeout) {
    clearTimeout(workspaceRefreshTimeout);
  }
  workspaceRefreshTimeout = setTimeout(async () => {
    await updateWorkspaceFilesState(orchestrator, commitsProvider, reason);
    workspaceRefreshTimeout = null;
  }, 300);
};
```

### State Updaters (`stateUpdaters.ts`)

Handles synchronization between different state sources and UI components.

#### Key Functions

**updateWorkspaceFilesState**

```typescript
export async function updateWorkspaceFilesState(
  orchestrator: CockpitOrchestrator,
  commitsProvider: CommitsProvider,
  reason: string
): Promise<void>;
```

Updates workspace file state and refreshes providers accordingly.

**updateReportsState**

```typescript
export async function updateReportsState(
  orchestrator: CockpitOrchestrator,
  reason: string
): Promise<void>;
```

Synchronizes report state across components.

**refreshCockpitState**

```typescript
export async function refreshCockpitState(
  orchestrator: CockpitOrchestrator,
  providers: {
    commitsProvider: CommitsProvider;
    activeBundleProvider: ActiveBundleProvider;
    symbolHistoryProvider: SymbolHistoryProvider;
  }
): Promise<void>;
```

Performs complete cockpit state refresh from all providers.

## Architecture

### AppShell Lifecycle

```
1. Extension Activation
   ↓
2. AppShell Creation
   ↓
3. Feature Registration
   ↓
4. Component Initialization
   ↓
5. Watcher Setup
   ↓
6. State Synchronization
```

### Feature Registration Flow

```
Feature Definition → AppShell.registerFeature() → VS Code Registration
     ↓                                                ↓
  Command Handlers                           Command Palette
  Watcher Factories                           File Monitoring
  Effect Handlers                             State Changes
  Lifecycle Callbacks                         Activate/Deactivate
```

## Key Concepts

### Feature Registration Pattern

Features are registered declaratively:

```typescript
const feature: FeatureRegistration = {
  commands: [
    {
      command: 'git-context.analyze',
      handler: async context => {
        /* ... */
      },
    },
  ],
  watchers: [createGitWatcher],
  effects: [
    {
      key: 'analysisState',
      handler: change => updateUI(change.payload),
    },
  ],
  onActivate: shell => initializeFeature(shell),
  onDeactivate: () => cleanupFeature(),
};

shell.registerFeature(feature);
```

### Watcher Factory Pattern

Watchers are created through factories to encapsulate dependencies:

```typescript
export type WatcherFactory = (
  orchestrator: CockpitOrchestrator,
  pipeline: RefactorPipeline
) => vscode.Disposable;
```

### Effect System

Effects respond to state changes with optional priority ordering:

```typescript
effects: [
  {
    key: 'analysisState',
    handler: async change => {
      if (change.payload.isAnalyzing) {
        await showProgressIndicator();
      }
    },
    priority: 1, // Higher priority = executed first
  },
];
```

### Debounced State Updates

Workspace changes trigger debounced updates to prevent excessive refreshes:

```typescript
vscode.workspace.onDidChangeTextDocument(e => {
  if (e.document.uri.scheme === 'output') return;
  scheduleWorkspaceRefresh('workspace:textChange');
});
```

## Dependencies

- **state/** - CockpitOrchestrator for state management
- **providers/** - Provider instances for state updates
- **analysis/** - Pipeline instances for watchers
- **services/** - Service instances for business logic
- **utils/** - Logging and error handling

## Usage Examples

### Registering a Feature

```typescript
import { registerCoreFeatures } from './features/coreFeatures';

export async function activate(context: vscode.ExtensionContext) {
  const shell = new AppShell(context);

  // Register all core features
  await registerCoreFeatures(shell, {
    commitsProvider,
    activeBundleProvider,
    symbolHistoryProvider,
    cockpitProvider,
  });
}
```

### Creating a File Watcher

```typescript
export function createWorkspaceWatcher(
  orchestrator: CockpitOrchestrator,
  pipeline: RefactorPipeline
): vscode.Disposable {
  return vscode.workspace.onDidSaveTextDocument(async doc => {
    if (isSupportedFile(doc)) {
      await pipeline.analyzeWorkspaceChanges([doc.uri]);
      orchestrator.updateState({ lastSavedFile: doc.uri.fsPath });
    }
  });
}
```

### State Synchronization

```typescript
// Update workspace state when files change
await updateWorkspaceFilesState(orchestrator, commitsProvider, 'workspace:fileChange');

// Refresh all cockpit state
await refreshCockpitState(orchestrator, {
  commitsProvider,
  activeBundleProvider,
  symbolHistoryProvider,
});
```

## Related Documentation

- [Extension Module](extension.md) - Extension activation and AppShell usage
- [State Module](state.md) - Orchestrator and state management
- [Features Module](features.md) - Feature registration implementations
- [Watchers Module](watchers.md) - Watcher implementations
- [Services Module](services.md) - Service integration
