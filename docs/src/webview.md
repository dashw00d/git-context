# Webview Module (`webview/`)

## Purpose

The `webview/` module implements the React-based UI for Git Context, providing the cockpit interface where users interact with analysis results. It follows a tiered loading pattern for progressive data display and integrates with VS Code's webview API for seamless extension UI.

## Key Components

### Cockpit Provider (`cockpit/CockpitProvider.ts`)

Main webview provider that manages the cockpit interface and coordinates between VS Code and React UI.

```typescript
export class CockpitProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private state: CockpitState;
  private unsubscribe?: () => void;

  // Services & Controllers
  private bundleManager: BundleManager;
  private explorerController?: ExplorerController;
  private analysisController?: AnalysisController;
  private messageController?: MessageController;

  constructor(private readonly extensionUri: vscode.Uri) {
    this.state = getStore().getState();
    this.bundleManager = new BundleManager();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    // Subscribe to store changes
    this.unsubscribe = getStore().subscribe(() => {
      const currentState = getStore().getState();
      if (currentState !== this.state) {
        this.handleStateChange(currentState);
        this.state = currentState;
      }
    });

    // Initialize controllers
    this.initializeControllers();

    // Setup webview
    this.setupWebview();
  }

  private initializeControllers() {
    if (!this.view) return;

    this.explorerController = new ExplorerController(this.view);
    this.analysisController = new AnalysisController(this.view);
    this.messageController = new MessageController(this.view, this);
  }

  private setupWebview() {
    if (!this.view) return;

    // Configure webview options
    this.view.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    // Set HTML content
    this.view.webview.html = this.getHtmlForWebview();

    // Setup message handling
    this.view.webview.onDidReceiveMessage(this.handleMessage.bind(this));
  }
}
```

**Key Features:**

- **Store Integration**: Direct subscription to Redux store for state updates
- **Controller Management**: Coordinates multiple controllers for different UI aspects
- **Message Passing**: Bidirectional communication with React frontend
- **Resource Management**: Proper webview resource handling and cleanup

### Analysis Controller (`cockpit/services/AnalysisController.ts`)

Manages analysis operations and frame analysis within the webview.

```typescript
export class AnalysisController {
  public hotspotCache: Map<string, any[]> = new Map();
  public skeletonCache: { files: string[]; roots: string[]; mode: string } | null = null;
  private pipelineDebugger = new PipelineDebugger();
  private bundleViewVersion = 0;

  constructor(private readonly view?: vscode.WebviewView) {}

  async analyzeFrame(frameId: string) {
    // Frame analysis logic with tiered loading
    const analyzer = new FrameAnalyzer(this.view);
    const state = getStore().getState();

    // Tier 1: Structure (always succeeds)
    try {
      const tier1 = await analyzer.analyzeTier1(frameId, targetPath, gitRoot);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_1_COMPLETE',
        payload: { frameId, data: tier1 },
      });
    } catch (error) {
      logError('[Tier 1] Failed', error);
    }

    // Tier 2: Hybrid metadata (best effort)
    try {
      const tier2 = await analyzer.analyzeTier2(frameId, targetPath, gitRoot);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_2_COMPLETE',
        payload: { frameId, data: tier2 },
      });
    } catch (error) {
      logError('[Tier 2] Failed', error);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 2, error: String(error) },
      });
    }

    // Continue with Tier 3...
  }
}
```

**Key Features:**

- **Tiered Loading**: Progressive data loading with error resilience
- **Caching**: Intelligent caching of hotspots and skeleton data
- **Pipeline Debugging**: Integration with pipeline debugging tools
- **State Dispatch**: Direct Redux actions for UI updates

### Frame Analyzer (`cockpit/services/FrameAnalyzer.ts`)

Implements the tiered loading pattern for analyzing individual files and symbols.

```typescript
export class FrameAnalyzer {
  constructor(private view?: vscode.WebviewView) {}

  /**
   * Tier 1: Structure (Always succeeds)
   * - File content from disk
   * - Line count
   * - Language detection
   * - Never fails - shows error message if file not found
   */
  async analyzeTier1(frameId: string, targetPath: string, gitRoot: string): Promise<Tier1Data> {
    let content = '';
    let fileExists = true;

    try {
      content = fs.readFileSync(path.join(gitRoot, targetPath), 'utf8');
    } catch {
      content = '[File not found on disk]';
      fileExists = false;
    }

    return {
      content,
      lineCount: content.split('\n').length,
      language: detectLanguage(targetPath),
      filePath: targetPath,
      fileExists,
    };
  }

  /**
   * Tier 2: Hybrid Metadata (Best effort)
   * - Git history and diffs
   * - Bundle facts (hotspots, drift)
   * - Blast radius edges
   * - Continues on failure - partial data acceptable
   */
  async analyzeTier2(frameId: string, targetPath: string, gitRoot: string): Promise<Tier2Data> {
    // Load git history, bundle facts, symbol analysis
    const gitHistory = await this.loadGitHistory(targetPath);
    const bundleFacts = await this.loadBundleFactsForFile(targetPath);
    const symbolAnalysis = await this.analyzeSymbols(targetPath);

    return {
      gitHistory,
      bundleFacts,
      symbolAnalysis,
      // ... other metadata
    };
  }

  /**
   * Tier 3: Deep Semantics (Optional)
   * - Symbol parsing via Tree-sitter
   * - Structural analysis
   * - Deep drift detection
   * - Fully optional - UI works without symbols
   */
  async analyzeTier3(frameId: string, targetPath: string, gitRoot: string): Promise<Tier3Data> {
    // Deep semantic analysis - can fail completely
    const symbols = await this.parseSymbols(targetPath);
    const structuralAnalysis = await this.analyzeStructure(symbols);
    const deepDrift = await this.detectDeepDrift(symbols);

    return {
      symbols,
      structuralAnalysis,
      deepDrift,
    };
  }
}
```

**Key Features:**

- **Three-Tier Architecture**: Progressive enhancement with graceful degradation
- **Error Resilience**: Each tier can fail independently without blocking others
- **Resource Efficient**: Only loads data as needed for current frame
- **Language Aware**: Uses Tree-sitter for semantic analysis

### Bundle Manager (`cockpit/services/BundleManager.ts`)

Manages bundle state and persistence for analysis results.

```typescript
export class BundleManager {
  private currentBundle: BundleState | null = null;
  private bundlePath: string;

  constructor() {
    this.bundlePath = this.getBundlePath();
  }

  async loadBundle(bundleId: string): Promise<BundleState | null> {
    try {
      const bundleData = await this.readBundleFromDisk(bundleId);
      this.currentBundle = bundleData;
      return bundleData;
    } catch (error) {
      logError('Failed to load bundle', error);
      return null;
    }
  }

  async saveBundle(bundle: BundleState): Promise<void> {
    try {
      await this.writeBundleToDisk(bundle);
      this.currentBundle = bundle;
    } catch (error) {
      logError('Failed to save bundle', error);
      throw error;
    }
  }

  getCurrentBundle(): BundleState | null {
    return this.currentBundle;
  }

  clearBundle(): void {
    this.currentBundle = null;
    // Clean up disk storage
    this.deleteBundleFromDisk();
  }
}
```

### Message Controller (`cockpit/services/MessageController.ts`)

Handles bidirectional communication between webview and extension.

```typescript
export class MessageController {
  constructor(
    private view: vscode.WebviewView,
    private provider: CockpitProvider
  ) {
    this.setupMessageHandling();
  }

  private setupMessageHandling() {
    this.view.webview.onDidReceiveMessage(async (message: CockpitClientMessage) => {
      await this.handleClientMessage(message);
    });
  }

  private async handleClientMessage(message: CockpitClientMessage) {
    switch (message.type) {
      case 'ANALYZE_REQUEST':
        await this.handleAnalysisRequest(message.payload);
        break;
      case 'NAVIGATE_TO':
        await this.handleNavigation(message.payload);
        break;
      case 'FILTER_CHANGE':
        await this.handleFilterChange(message.payload);
        break;
      default:
        logWarn('Unknown message type:', message.type);
    }
  }

  private async handleAnalysisRequest(payload: { selection: string[] }) {
    // Dispatch analysis action
    getStore().dispatch({
      type: 'ANALYSIS_REQUESTED',
      payload,
    });

    // Send acknowledgment
    this.sendMessage({
      type: 'ANALYSIS_STARTED',
      payload: { timestamp: Date.now() },
    });
  }
}
```

### React Components (`cockpit/components/`)

The React UI components that render the cockpit interface.

#### Main Components

**CockpitProvider (`CockpitProvider.tsx`)**
Root component that manages overall layout and state.

**Header (`Header.tsx`)**
Top navigation and status bar.

**Sidebar (`Sidebar.tsx`)**
Left panel with navigation and filters.

**Tabs (`Tabs.tsx`)**
Main content area with tabbed interface.

**Inspector (`Inspector.tsx`)**
Detailed view for selected items.

#### Stage Components (`stages/`)

Components for different analysis stages:

- **BundleTabContent**: Analysis results and findings
- **CommitsTabContent**: Commit history and selection
- **SymbolsTabContent**: Symbol search and history
- **LiveTabContent**: Real-time analysis results
- **ReportsTabContent**: Generated reports

## Architecture

### Tiered Loading Pattern

The webview implements a sophisticated three-tier loading system:

```
User Selects Frame → Tier 1 (Instant) → UI Shows Basic Info
                      ↓
                Tier 2 (Fast) → UI Shows Rich Metadata
                      ↓
                Tier 3 (Slow) → UI Shows Deep Analysis
```

#### Tier Characteristics

| Tier       | Purpose         | Timing           | Failure Handling                               |
| ---------- | --------------- | ---------------- | ---------------------------------------------- |
| **Tier 1** | Structure       | Instant (<100ms) | Never fails - shows error message              |
| **Tier 2** | Hybrid Metadata | Fast (<500ms)    | Continues on failure - partial data acceptable |
| **Tier 3** | Deep Semantics  | Slow (<2s)       | Fully optional - UI works without it           |

### State Management Integration

The webview integrates with Redux store through direct subscription:

```typescript
// In CockpitProvider
useEffect(() => {
  const unsubscribe = store.subscribe(() => {
    const newState = store.getState();
    setState(newState);
  });

  return unsubscribe;
}, []);
```

### Message Passing Protocol

Bidirectional communication uses structured message types:

```typescript
// Client → Extension
type CockpitClientMessage =
  | { type: 'ANALYZE_REQUEST'; payload: { selection: string[] } }
  | { type: 'NAVIGATE_TO'; payload: { frame: ContextFrame } }
  | { type: 'FILTER_CHANGE'; payload: { filter: any } };

// Extension → Client
type CockpitHostMessage =
  | { type: 'STATE_UPDATE'; payload: CockpitState }
  | { type: 'ANALYSIS_COMPLETE'; payload: { facts: BundleFactsDTO } }
  | { type: 'ERROR'; payload: { message: string } };
```

## Key Concepts

### Progressive Enhancement

The UI works at multiple levels of fidelity:

```typescript
// Basic functionality without analysis
function renderBasicView() {
  return <div>Loading...</div>;
}

// Enhanced with analysis results
function renderEnhancedView(facts: BundleFactsDTO) {
  return (
    <div>
      <AnalysisSummary facts={facts} />
      <DetailedBreakdown facts={facts} />
    </div>
  );
}
```

### Error Boundaries

React error boundaries prevent crashes:

```typescript
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error and show fallback UI
    logError('React component error', error);
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong. Please refresh.</div>;
    }
    return this.props.children;
  }
}
```

### Resource Management

Proper cleanup of webview resources:

```typescript
componentWillUnmount() {
  // Cleanup subscriptions
  this.unsubscribe?.();

  // Cleanup controllers
  this.analysisController?.dispose();
  this.explorerController?.dispose();
}
```

### Performance Optimization

The webview uses several optimization techniques:

- **Virtual Scrolling**: For large lists of commits/symbols
- **Memoization**: React.memo for expensive components
- **Lazy Loading**: Components loaded on demand
- **Debounced Updates**: State updates batched to prevent excessive re-renders
- **Pipeline Health**: Cockpit shows current pipeline step, recent step timings, and error count during analysis.

### Live Analysis Guardrails

- Live mode uses a **cheap** pipeline (`mode: cheap_live`) that skips heavy steps (hotspots, embeddings, LLM) and tolerates optional step failures.
- Only one live analysis runs at a time; overlapping triggers are ignored.
- Thresholds for auto-run are controlled via `git-context.live.thresholds.*` (lines, symbols, extensions) and `autoRunAfterEdits`.

## Dependencies

- **state/** - Redux store integration
- **types/** - TypeScript definitions for cockpit
- **utils/** - Logging and configuration utilities
- **analysis/** - Frame analysis and Tree-sitter integration

## Usage Examples

### Setting up Webview Provider

```typescript
// In extension.ts
const cockpitProvider = new CockpitProvider(context.extensionUri);

context.subscriptions.push(vscode.window.registerWebviewViewProvider('cockpit', cockpitProvider));
```

### Handling Client Messages

```typescript
// In MessageController
private async handleClientMessage(message: CockpitClientMessage) {
  switch (message.type) {
    case 'ANALYZE_REQUEST':
      // Start analysis
      await analysisService.runAnalysis(message.payload.selection);

      // Send progress updates
      this.sendMessage({
        type: 'ANALYSIS_PROGRESS',
        payload: { step: 'Processing commits...' }
      });
      break;

    case 'NAVIGATE_TO':
      // Update navigation state
      store.dispatch({
        type: 'NAVIGATE_TO',
        payload: { frame: message.payload.frame }
      });
      break;
  }
}
```

### Tiered Frame Analysis

```typescript
// In AnalysisController
async analyzeFrame(frameId: string) {
  const analyzer = new FrameAnalyzer(this.view);

  // Tier 1 - Always succeeds
  const tier1 = await analyzer.analyzeTier1(frameId, targetPath, gitRoot);
  store.dispatch({
    type: 'FRAME_ANALYSIS_TIER_1_COMPLETE',
    payload: { frameId, data: tier1 }
  });

  // Tier 2 - Best effort
  try {
    const tier2 = await analyzer.analyzeTier2(frameId, targetPath, gitRoot);
    store.dispatch({
      type: 'FRAME_ANALYSIS_TIER_2_COMPLETE',
      payload: { frameId, data: tier2 }
    });
  } catch (error) {
    // Continue to Tier 3 even if Tier 2 fails
    logWarn('Tier 2 failed, continuing', error);
  }

  // Tier 3 - Optional
  // ... continues with deep analysis
}
```

### React Component Integration

```typescript
// In React components
function BundleTab({ bundleFacts, isAnalyzing }: Props) {
  if (isAnalyzing) {
    return <LoadingSpinner />;
  }

  if (!bundleFacts) {
    return <EmptyState message="Run analysis to see results" />;
  }

  return (
    <div className="bundle-content">
      <BundleSummary facts={bundleFacts} />
      <DriftAnalysis drift={bundleFacts.drift} />
      <LegacyReport legacy={bundleFacts.legacy} />
    </div>
  );
}
```

## Performance Characteristics

- **Progressive Loading**: UI becomes useful immediately with basic data
- **Background Updates**: Analysis continues while user interacts with partial results
- **Memory Efficient**: Large datasets virtualized and paginated
- **Responsive**: Debounced state updates prevent UI lag

## Error Handling

- **Graceful Degradation**: Each tier can fail independently
- **User Feedback**: Clear error messages and recovery options
- **Logging**: Comprehensive error tracking for debugging
- **Recovery**: Automatic retry mechanisms for transient failures

## Related Documentation

- [State Module](state.md) - Redux store integration
- [Analysis Module](analysis.md) - Frame analysis and tiered loading
- [Extension Module](extension.md) - Webview provider registration
- [Core Module](core.md) - Feature registration including cockpit
