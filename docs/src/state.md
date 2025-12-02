# State Management Module (`state/`)

## Purpose

The `state/` module implements Redux-style state management for the Git Context cockpit UI. It provides a centralized store for application state, action-based updates, pure reducer functions, and side effect handling through effects. The system ensures predictable state transitions and enables complex UI interactions.

## Key Components

### Store (`store.ts`)

Centralized state container implementing the Redux pattern with event emission.

```typescript
export class CockpitStore extends EventEmitter {
  private state: CockpitState;
  private debugger: StateDebugger;

  constructor() {
    super();
    this.state = initialState;
    this.debugger = new StateDebugger();
  }

  getState(): CockpitState {
    return this.state;
  }

  dispatch(action: Action): void {
    const prevState = this.state;
    const nextState = cockpitReducer(prevState, action);

    // Update action history
    const newHistory = [
      {
        type: action.type,
        payload: action.payload,
        timestamp: new Date().toISOString(),
      },
      ...nextState.actionHistory,
    ].slice(0, 50);

    this.state = { ...nextState, actionHistory: newHistory };

    // Debug logging and state persistence
    this.debugger?.logTransition(action, prevState, nextState);

    this.emit('stateChanged', this.state, action);
  }

  subscribe(listener: (state: CockpitState, action: Action) => void): () => void {
    this.on('stateChanged', listener);
    return () => this.off('stateChanged', listener);
  }
}

// Singleton instance
export function getStore(): CockpitStore {
  if (!store) {
    store = new CockpitStore();
  }
  return store;
}
```

**Key Features:**

- **Singleton Pattern**: Single store instance for entire application
- **Action History**: Maintains last 50 actions for debugging
- **Event Emission**: Notifies subscribers of state changes
- **Debug Integration**: Automatic state transition logging

### Actions (`actions.ts`)

Comprehensive action type definitions covering all state mutations.

```typescript
export type Action =
  // Analysis actions
  | { type: 'ANALYSIS_REQUESTED'; payload: { selection: string[]; force?: boolean } }
  | { type: 'ANALYSIS_STARTED'; payload: { step: string } }
  | {
      type: 'ANALYSIS_COMPLETED';
      payload: { facts: BundleFactsDTO; summary: BundleSummaryDTO; reportId: string };
    }
  | { type: 'ANALYSIS_FAILED'; payload: { error: string } }

  // Selection actions
  | { type: 'SELECTION_TOGGLED'; payload: { sha: string } }
  | { type: 'SELECTION_CLEARED' }
  | { type: 'SELECTION_SET'; payload: { shas: string[] } }

  // UI state actions
  | { type: 'SECTION_CHANGED'; payload: { section: CockpitSectionKey } }
  | { type: 'COMMITS_FILTER_TEXT_CHANGED'; payload: { text: string } }

  // Navigation actions
  | { type: 'NAVIGATE_TO'; payload: { frame: ContextFrame } }
  | { type: 'NAVIGATE_BACK' }

  // Frame analysis actions (tiered loading)
  | { type: 'FRAME_ANALYSIS_TIER_1_COMPLETE'; payload: { frameId: string; data: any } }
  | { type: 'FRAME_ANALYSIS_TIER_2_COMPLETE'; payload: { frameId: string; data: any } }
  | {
      type: 'FRAME_ANALYSIS_TIER_FAILED';
      payload: { frameId: string; tier: number; error: string };
    };
```

**Action Categories:**

- **Analysis**: Pipeline execution and progress tracking
- **Selection**: Commit and file selection management
- **UI State**: Filter states, active sections, display preferences
- **Navigation**: Frame-based navigation system
- **Data Updates**: Commits, symbols, reports, workspace files
- **Live Analysis**: Real-time change tracking

### Reducers (`reducers.ts`)

Pure functions that handle state transitions based on actions.

```typescript
export function cockpitReducer(state: CockpitState, action: Action): CockpitState {
  switch (action.type) {
    case 'ANALYSIS_STARTED':
      return {
        ...state,
        isAnalyzing: true,
        error: undefined,
      };

    case 'ANALYSIS_COMPLETED':
      return {
        ...state,
        isAnalyzing: false,
        bundleFacts: action.payload.facts,
        bundleSummary: action.payload.summary,
        bundleReportId: action.payload.reportId,
      };

    case 'SELECTION_TOGGLED':
      const { sha } = action.payload;
      const selectedCommitShas = state.selectedCommitShas.includes(sha)
        ? state.selectedCommitShas.filter(s => s !== sha)
        : [...state.selectedCommitShas, sha];

      return {
        ...state,
        selectedCommitShas,
      };

    case 'SECTION_CHANGED':
      return {
        ...state,
        activeSection: action.payload.section,
      };

    default:
      return state;
  }
}
```

**Reducer Principles:**

- **Pure Functions**: No side effects, same input always produces same output
- **Immutable Updates**: Return new state objects, never mutate existing state
- **Action Exhaustiveness**: Handle all possible action types
- **Composition**: Complex reducers can delegate to sub-reducers

### Effects (`effects.ts`)

Handles side effects triggered by state changes and actions.

```typescript
export class EffectsManager {
  private effects: StateEffect[] = [];

  register<T extends keyof CockpitState>(effect: StateEffect<T>): void {
    this.effects.push(effect);
    this.effects.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }

  async handleStateChange(change: CockpitStateChange): Promise<void> {
    for (const effect of this.effects) {
      if (this.shouldTrigger(effect, change)) {
        try {
          await effect.handler(change);
        } catch (error) {
          logError('Effect execution failed', error);
        }
      }
    }
  }

  private shouldTrigger(effect: StateEffect, change: CockpitStateChange): boolean {
    if (!effect.key) return true;
    const keys = Array.isArray(effect.key) ? effect.key : [effect.key];
    return keys.some(key => key in change.partial);
  }
}
```

**Effect Types:**

- **Analysis Effects**: Trigger pipeline execution on selection changes
- **Persistence Effects**: Save state to disk on important changes
- **UI Effects**: Update UI components based on state changes
- **Notification Effects**: Show VS Code notifications for important events

### Schemas (`schemas.ts`)

Type definitions and validation schemas for state structure.

```typescript
export interface BundleFactsSchema {
  commitRange: {
    oldest: string;
    newest: string;
  };
  filesChanged: number;
  symbolsChanged: number;
  incompleteness: IncompletenessSummary;
  patternDrift: PatternDriftSummary;
  legacySummary: LegacySummary;
}

export interface CockpitStateSchema {
  // Repository context
  repoName: string | null;
  branchName: string | null;

  // Analysis state
  isAnalyzing: boolean;
  selectedCommitShas: string[];

  // UI state
  activeSection: CockpitSectionKey;
  commitsFilterText: string;

  // Data
  commits: CommitDTO[];
  bundleFacts: BundleFactsDTO | null;
  symbols: SymbolDTO[];

  // Live analysis
  liveAnalysis: {
    isTracking: boolean;
    pendingChanges: number;
    totalEdits: number;
    status: 'idle' | 'analyzing' | 'ready' | 'error';
  };
}
```

### Legacy Orchestrator (`cockpitOrchestrator.ts`)

Compatibility layer during migration from legacy state management.

```typescript
export class CockpitOrchestrator extends EventEmitter {
  private store: CockpitStore;
  private effects: StateEffect[] = [];

  // Debouncing for UI updates
  private pendingPartial: Partial<CockpitState> | null = null;
  private flushTimeout: NodeJS.Timeout | null = null;

  updateState(partial: Partial<CockpitState>, reason?: string): void {
    // Legacy method - forwards to store.dispatch
    // Maintains backward compatibility during migration
  }

  // ... effect management and subscription handling
}
```

**Migration Strategy:**

- **Phase 1**: Orchestrator forwards to store (current state)
- **Phase 2**: Direct store usage in new code
- **Phase 3**: Remove orchestrator completely

## Architecture

### State Flow

```
User Action → Action Creator → dispatch() → Reducer → New State → Subscribers
                                      ↓
                                   Effects → Side Effects
```

### State Structure

The state is organized into logical sections:

```typescript
interface CockpitState {
  // Repository context
  repoName: string | null;
  branchName: string | null;

  // Analysis workflow
  isAnalyzing: boolean;
  selectedCommitShas: string[];
  bundleFacts: BundleFactsDTO | null;

  // UI state
  activeSection: CockpitSectionKey;
  commitsFilterText: string;

  // Data collections
  commits: CommitDTO[];
  symbols: SymbolDTO[];
  reports: ReportDTO[];

  // Live analysis
  liveAnalysis: LiveAnalysisState;

  // Navigation
  navigationStack: ContextFrame[];
  activeFrame: ContextFrame;
}
```

### Subscription Patterns

Multiple subscription patterns are supported:

```typescript
// Direct store subscription
const unsubscribe = store.subscribe((state, action) => {
  console.log('State changed:', action.type);
});

// Orchestrator subscription (legacy)
orchestrator.on('stateChanged', change => {
  updateUI(change.partial);
});

// Selector-based subscription
const selector = state => state.isAnalyzing;
store.subscribe((state, action) => {
  if (selector(state) !== selector(prevState)) {
    updateAnalysisUI(state.isAnalyzing);
  }
});
```

## Key Concepts

### Action Design Principles

- **Descriptive Types**: Use past tense for completed actions (`COMPLETED` not `COMPLETE`)
- **Payload Typing**: Strongly typed payloads for all actions
- **Discriminator Unions**: TypeScript discriminated unions for type safety
- **Serializable**: Actions should be JSON serializable for debugging

### Reducer Composition

Reducers follow the composition pattern:

```typescript
function rootReducer(state: AppState, action: Action): AppState {
  return {
    analysis: analysisReducer(state.analysis, action),
    ui: uiReducer(state.ui, action),
    data: dataReducer(state.data, action),
  };
}
```

### Effect Timing

Effects are triggered based on state change keys:

```typescript
// Trigger on analysis state changes
{
  key: ['isAnalyzing', 'bundleFacts'],
  handler: async (change) => {
    if (change.partial.isAnalyzing === false && change.partial.bundleFacts) {
      await showAnalysisCompleteNotification();
    }
  }
}
```

### State Immutability

All state updates follow immutability principles:

```typescript
// Good: Immutable update
return {
  ...state,
  selectedCommitShas: [...state.selectedCommitShas, sha],
};

// Bad: Mutation
state.selectedCommitShas.push(sha);
return state;
```

### Debounced Updates

UI updates are debounced to prevent excessive re-renders:

```typescript
private flushPendingChanges(): void {
  if (this.pendingPartial && this.flushTimeout) {
    clearTimeout(this.flushTimeout);
    this.emit('stateChanged', {
      full: this.store.getState(),
      partial: this.pendingPartial,
      timestamp: Date.now()
    });
    this.pendingPartial = null;
  }
}
```

## Dependencies

- **types/** - State type definitions and schemas
- **utils/** - Logger, state debugger, error handling
- **services/** - State logger service for persistence

## Usage Examples

### Basic State Dispatch

```typescript
import { getStore } from './state/store';

const store = getStore();

// Dispatch analysis start
store.dispatch({
  type: 'ANALYSIS_STARTED',
  payload: { step: 'Initializing...' },
});

// Subscribe to changes
const unsubscribe = store.subscribe((state, action) => {
  if (action.type === 'ANALYSIS_COMPLETED') {
    updateUI(state.bundleFacts);
  }
});
```

### Effect Registration

```typescript
import { getEffectsManager } from './state/effects';

// Register effect for analysis completion
effectsManager.register({
  key: 'bundleFacts',
  handler: async change => {
    if (change.partial.bundleFacts) {
      await generateReport(change.partial.bundleFacts);
      await showNotification('Analysis complete!');
    }
  },
  priority: 1,
});
```

### Legacy Orchestrator Usage

```typescript
import { getCockpitOrchestrator } from './state/cockpitOrchestrator';

const orchestrator = getCockpitOrchestrator();

// Legacy update method (forwards to store)
orchestrator.updateState(
  {
    isAnalyzing: true,
    selectedCommitShas: ['abc123'],
  },
  'user_selection'
);
```

### State Selection

```typescript
// Create memoized selectors
const selectAnalysisState = (state: CockpitState) => ({
  isAnalyzing: state.isAnalyzing,
  progress: state.analysisProgress,
  error: state.error,
});

const selectBundleData = (state: CockpitState) => ({
  facts: state.bundleFacts,
  summary: state.bundleSummary,
  reportId: state.bundleReportId,
});
```

## Performance Characteristics

- **Efficient Updates**: Only changed parts of state trigger re-renders
- **Debounced Notifications**: UI updates batched to prevent excessive re-renders
- **Action History**: Capped at 50 entries to prevent memory leaks
- **Lazy Initialization**: Store created only when first accessed

## Debugging Features

- **Action History**: Complete log of all dispatched actions
- **State Transitions**: Before/after state snapshots for each action
- **Effect Tracing**: Performance timing and error logging for effects
- **State Logger**: Persistent logging to disk for debugging sessions

## Migration Notes

The system is currently in transition from orchestrator-based to direct store-based state management:

- **New Code**: Use `store.dispatch()` directly
- **Legacy Code**: Continues to work through orchestrator compatibility layer
- **Future**: Orchestrator will be removed in favor of direct store usage

## Related Documentation

- [Webview Module](webview.md) - UI integration with state management
- [Core Module](core.md) - AppShell integration
- [Types Module](types.md) - State type definitions
