# Extension Module (`extension.ts`)

## Purpose

The `extension.ts` file serves as the main entry point for the Git Context VS Code extension. It handles the complete extension lifecycle including activation, initialization of all core components, and cleanup on deactivation.

## Key Components

### Activation Flow

The `activate()` function orchestrates the extension startup:

1. **Output Channel Setup** - Creates debug and regular output channels
2. **AppShell Initialization** - Creates the main application shell for feature management
3. **Provider Registration** - Dynamically imports and initializes VS Code tree view providers:
   - `ActiveBundleProvider` - Active bundle tree view
   - `CommitsProvider` - Commit history tree view
   - `SymbolHistoryProvider` - Symbol history tree view
   - `CockpitProvider` - Main webview provider
   - `RefactorReportProvider` - Report webview provider
4. **Live Tracking Setup** - Initializes `LiveDiffTracker` for real-time workspace monitoring
5. **Live Analysis Engine** - Sets up `LiveAnalysisEngine` for incremental analysis
6. **Webview Registration** - Registers webview view providers with VS Code
7. **Feature Registration** - Registers core, cockpit, and git watcher features
8. **Workspace Monitoring** - Sets up file watchers and workspace change handlers
9. **Auto-initialization** - Loads initial commits if database is empty

### Core Services Initialization

#### LiveDiffTracker

```typescript
const liveTracker = new LiveDiffTracker();
```

Monitors workspace changes with debounced analysis triggers based on symbol/line thresholds.

#### LiveAnalysisEngine

```typescript
const liveEngine = new LiveAnalysisEngine(liveTracker, shell.getOrchestrator());
```

Performs incremental analysis of live changes, integrating with the main orchestrator.

### Provider Architecture

All providers follow a consistent pattern:

```typescript
const provider = new ProviderClass(context);
// Register with VS Code
context.subscriptions.push(vscode.window.registerTreeDataProvider('viewId', provider));
```

### Workspace Auto-initialization

On first activation, the extension:

1. Ensures database is initialized
2. Checks for legacy database issues
3. Loads recent commits automatically if database is empty
4. Indexes commits through the analysis pipeline

### File Watcher Setup

```typescript
const fileWatchers = setupFileWatchers(
  context,
  {
    activeBundleProvider,
    commitsProvider,
    symbolHistoryProvider,
  },
  shell.getOrchestrator()
);
```

Monitors workspace changes and triggers UI updates accordingly.

### Debug Commands

The extension provides debug commands for development:

- `git-context.debug.dumpState` - Export current cockpit state as JSON
- `git-context.debug.loadState` - Import cockpit state from JSON
- `git-context.debug.openStateLog` - Open state change log file

### Deactivation

The `deactivate()` function ensures proper cleanup:

- Closes database connections
- Cleans up event listeners
- Logs deactivation

## Key Concepts

### Dynamic Imports

Providers are loaded dynamically to prevent activation-time errors:

```typescript
const { ActiveBundleProvider } = await import('./providers/activeBundleProvider');
```

### Subscription Management

All disposables are properly registered for cleanup:

```typescript
context.subscriptions.push(liveTracker);
context.subscriptions.push(showReportCommand);
```

### Error Handling

Best-effort initialization - individual component failures don't prevent extension activation:

```typescript
try {
  // Component initialization
} catch (error) {
  logError('Component failed', error);
  // Continue with other components
}
```

### State Synchronization

The extension maintains synchronization between:

- Live tracker events
- Orchestrator state updates
- Provider refreshes
- Webview state

## Dependencies

- **core/** - AppShell for feature registration
- **providers/** - VS Code tree view providers
- **webview/** - Webview providers
- **features/** - Feature registration modules
- **liveTracker.ts** - Live change tracking
- **analysis/** - For pipeline initialization
- **storage/** - Database management
- **state/** - State management
- **utils/** - Logging and configuration

## Usage Examples

### Extension Activation Sequence

```typescript
// 1. VS Code calls activate
export async function activate(context: vscode.ExtensionContext) {
  // 2. Initialize core infrastructure
  const shell = new AppShell(context);

  // 3. Register providers
  const commitsProvider = new CommitsProvider(context, activeBundleProvider);

  // 4. Setup live tracking
  const liveTracker = new LiveDiffTracker();
  const liveEngine = new LiveAnalysisEngine(liveTracker, shell.getOrchestrator());

  // 5. Register features
  await registerCoreFeatures(shell, { commitsProvider, ... });
}
```

## Related Documentation

- [Core Module](core.md) - AppShell and feature registration
- [State Module](state.md) - State management and orchestrator
- [Providers Module](providers.md) - Tree view provider implementations
- [Webview Module](webview.md) - Webview provider implementations
- [Live Tracker](liveTracker.md) - Live change tracking system
