# Git Context - Architecture Patterns

**Version**: 1.0  
**Last Updated**: 2025-12-01

This document describes the core architectural patterns used throughout the git-context codebase.

---

## Table of Contents

1. [Pipeline Pattern](#pipeline-pattern)
2. [Action/Reducer/Effects Pattern](#actionreducereffects-pattern)
3. [Tiered Loading Pattern](#tiered-loading-pattern)
4. [Error Handling Philosophy](#error-handling-philosophy)
5. [Service Layer Pattern](#service-layer-pattern)
6. [State Management](#state-management)
7. [Database Access Pattern](#database-access-pattern)

---

## Pipeline Pattern

### Overview
Complex operations are broken into discrete steps with dependency management, allowing for parallelization and graceful degradation.

### Implementation
Location: `src/analysis/runner/pipelineRunner.ts`

**Key Characteristics:**
- Steps run in dependency-based levels
- **Best-effort mode**: Errors don't stop the pipeline (Line 152)
- Errors collected in `state.errors[]` array
- Uses `Promise.allSettled` for parallel execution within levels

### Example

```typescript
const steps: PipelineStep[] = [
  { id: 'symbols', run: extractSymbols, deps: [] },
  { id: 'edges', run: buildEdges, deps: ['symbols'] },
  { id: 'drift', run: detectDrift, deps: ['symbols'] }
];

const state = await runPipeline(steps, initialState, onEvent);
// state.errors contains failures, but pipeline completed
```

### Key Principles
1. **Independence**: Steps should be as independent as possible
2. **Graceful Degradation**: Partial results are better than no results
3. **Explicit Dependencies**: Use `deps` array to define order
4. **Error Collection**: Log and collect, don't throw

---

## Action/Reducer/Effects Pattern

### Overview
Redux-style state management with clear separation between state mutations (reducers), side effects (effects), and user actions.

### Components

#### Actions (`src/state/actions.ts`)
Define what happened:
```typescript
export type Action =
  | { type: 'ANALYSIS_STARTED'; payload: { step: string } }
  | { type: 'ANALYSIS_COMPLETED'; payload: { facts: BundleFactsDTO } }
  | { type: 'ANALYSIS_FAILED'; payload: { error: string } };
```

#### Reducers (`src/state/reducers.ts`)
Pure functions that update state:
```typescript
export function cockpitReducer(state: CockpitState, action: Action): CockpitState {
  switch (action.type) {
    case 'ANALYSIS_STARTED':
      return { ...state, isAnalyzing: true };
    default:
      return state;
  }
}
```

#### Effects (`src/state/effects.ts`)
Side effects like API calls, database queries:
```typescript
private async handleAnalysis(payload: { selection: string[] }) {
  // 1. Dispatch action
  this.store.dispatch({ type: 'ANALYSIS_STARTED', payload: { step: 'Initializing...' } });
  
  // 2. Perform side effect
  await reportService.generateReport(payload.selection);
}
```

### Key Principles
1. **Reducers are pure**: No side effects, always return new state
2. **Effects subscribe to actions**: Effects listen for actions and perform async work
3. **Actions describe events**: Use past tense ("COMPLETED" not "COMPLETE")
4. **Payload typing**: Every action has a strongly-typed payload

---

## Tiered Loading Pattern

### Overview
Progressive data loading strategy that shows users results as they become available, following the "Tiered Fetching" approach from the Master Plan.

### Three Tiers

#### Tier 1: Structure (Instant, Always Succeeds)
- File content from disk
- Line count
- Language detection
- **Never fails** - shows error message if file not found

#### Tier 2: Hybrid Metadata (Fast, Best Effort)
- Git history and diffs
- Bundle facts (hotspots, drift)
- Blast radius edges
- **Continues on failure** - partial data acceptable

#### Tier 3: Semantics (Slow, Optional)
- Symbol parsing via Tree-sitter
- Structural analysis
- Deep drift detection
- **Fully optional** - UI works without symbols

### Implementation
Location: `src/webview/cockpit/services/FrameAnalyzer.ts`

```typescript
export class FrameAnalyzer {
  async analyzeTier1(frameId: string, targetPath: string): Promise<Tier1Data> {
    // Always succeeds - just read file
  }
  
  async analyzeTier2(frameId: string, targetPath: string): Promise<Tier2Data> {
    // Best effort - log errors, return partial data
  }
  
  async analyzeTier3(frameId: string, targetPath: string): Promise<Tier3Data> {
    // Optional - can fail completely
  }
}
```

### Usage in CockpitProvider

```typescript
async analyzeFrame(frameId: string) {
  // Tier 1 - Always succeeds
  const tier1 = await analyzer.analyzeTier1(frameId, targetPath);
  dispatch({ type: 'FRAME_ANALYSIS_TIER_1_COMPLETE', payload: { frameId, data: tier1 } });
  
  // Tier 2 - Best effort
  try {
    const tier2 = await analyzer.analyzeTier2(frameId, targetPath);
    dispatch({ type: 'FRAME_ANALYSIS_TIER_2_COMPLETE', payload: { frameId, data: tier2 } });
  } catch (error) {
    logError('[Tier 2] Failed', error);
    dispatch({ type: 'FRAME_ANALYSIS_TIER_FAILED', payload: { frameId, tier: 2, error } });
  }
  
  // Tier 3 - Continue even if Tier 2 failed
  // ...
}
```

### Key Principles
1. **Progressive Enhancement**: Each tier adds more detail
2. **Independent Execution**: Tier failures don't block subsequent tiers
3. **UI Updates**: Dispatch action after each tier for instant feedback
4. **Backward Compatibility**: Send postMessage for legacy UI support

---

## Error Handling Philosophy

### Core Tenets

#### 1. Best-Effort Mode
Errors should be logged but not blocking. Partial results are valuable.

**Good**:
```typescript
try {
  const symbols = await parseFile(path);
} catch (error) {
  logError('Symbol parsing failed', error);
  return { symbols: [], error: String(error) }; // Return partial data
}
```

**Bad**:
```typescript
const symbols = await parseFile(path); // Throws, blocks entire operation
```

#### 2. Error Collection
Collect errors in state for debugging, don't throw.

```typescript
state.errors.push({ stepId: 'symbols', error });
// Pipeline continues
```

#### 3. Explicit Error States
UI should show errors, not silently fail.

```typescript
dispatch({ 
  type: 'FRAME_ANALYSIS_TIER_FAILED', 
  payload: { frameId, tier: 2, error: String(error) } 
});
```

#### 4. Contextual Logging
Include context in every log message.

```typescript
logError(`[Tier 2] Git history failed for ${targetPath}`, error);
// Not: logError('Failed', error);
```

### Error Handling Levels

| Level | Strategy | Example |
|-------|----------|---------|
| **Critical** | Show error frame, stop process | File system unavailable |
| **Important** | Log error, show partial UI | Git history unavailable |
| **Optional** | Log debug, continue silently | Symbol parsing failed |

---

## Service Layer Pattern

### Overview
Business logic is encapsulated in service classes that are injected into providers.

### Structure

```
src/
├── services/          # Business logic
│   ├── databaseService.ts
│   ├── explorerService.ts
│   └── reportService.ts
├── providers/         # VS Code API integration
│   ├── commitsProvider.ts
│   └── activeBundleProvider.ts
└── webview/cockpit/services/  # Webview-specific services
    ├── BundleManager.ts
    ├── ExplorerController.ts
    └── FrameAnalyzer.ts
```

### Service Characteristics

#### Singleton Pattern
```typescript
let serviceInstance: MyService | null = null;

export function getMyService(): MyService {
  if (!serviceInstance) {
    serviceInstance = new MyService();
  }
  return serviceInstance;
}
```

#### Dependency Injection
```typescript
export class ExplorerController {
  constructor(
    private readonly view: vscode.WebviewView,
    private readonly bundleManager: BundleManager
  ) {}
}
```

#### Clear Responsibilities
- **DatabaseService**: CRUD operations, caching
- **ExplorerService**: Tree generation, static nodes
- **FrameAnalyzer**: Multi-tier frame analysis
- **BundleManager**: Bundle state and persistence

---

## State Management

### Centralized Store
Location: `src/state/store.ts`

```typescript
const store = new CockpitStore(initialState, cockpitReducer);

// Subscribe to changes
store.subscribe((state, action) => {
  console.log('Action:', action.type);
});

// Dispatch actions
store.dispatch({ type: 'ANALYSIS_STARTED', payload: { step: 'symbols' } });
```

### Orchestrator (Legacy, Being Phased Out)
Location: `src/state/cockpitOrchestrator.ts`

The orchestrator provides a compatibility layer during migration to Redux:
```typescript
export class CockpitOrchestrator {
  updateState(partial: Partial<CockpitState>, reason?: string) {
    // Sends to both store and legacy handlers
  }
}
```

**Migration Strategy**: Use `store.dispatch()` for new code, orchestrator will be removed in Phase 4.

---

## Database Access Pattern

### Statement Wrapper
Location: `src/storage/statement-wrapper.ts`

**Always** use the statement wrapper, never access `sql.js` directly:

```typescript
import { prepare } from '../storage/statement-wrapper';

const stmt = prepare('SELECT * FROM symbols WHERE path = ?');
const symbols = stmt.all(path);
stmt.finalize();
```

### Caching Strategy
Location: `src/services/databaseService.ts`

```typescript
export class DatabaseService {
  private cache = new Map<string, any>();

  async getBundles(): Promise<Bundle[]> {
    const cached = this.cache.get('bundles_list');
    if (cached) return cached;
    
    const bundles = this.queryBundles();
    this.cache.set('bundles_list', bundles);
    return bundles;
  }

  async createBundle(name: string, config: any): Promise<string> {
    const id = this.insertBundle(name, config);
    this.cache.delete('bundles_list'); // Invalidate cache
    return id;
  }
}
```

**Cache Invalidation Rules**:
- Delete on mutation (create, update, delete)
- Use specific keys (`bundles_list`, `bundle_{id}`)
- Consider LRU cache for size limits

### Schema Versioning
Location: `src/storage/schema.ts`

Modular schema system with automatic migrations:

```typescript
export const MODULE_SCHEMAS = {
  bundles: {
    version: 1,
    tables: {
      bundles: `CREATE TABLE IF NOT EXISTS bundles (...)`
    }
  }
};

// Migrations run automatically on startup
const moduleOrder = ['base', 'analysis', 'bundles'];
```

---

## Summary

### When to Use Each Pattern

| Pattern | Use When |
|---------|----------|
| **Pipeline** | Multi-step analysis with dependencies |
| **Action/Reducer/Effects** | State changes that affect UI |
| **Tiered Loading** | Progressive data fetching |
| **Services** | Encapsulating business logic |
| **Statement Wrapper** | Any database access |

### Migration Checklist

When adding new features:
- [ ] Define actions in `actions.ts`
- [ ] Add reducer cases in `reducers.ts`
- [ ] Implement effects in `effects.ts` for side effects
- [ ] Use `store.dispatch()` instead of `orchestrator.updateState()`
- [ ] Follow tiered loading for any data fetching
- [ ] Log errors with context, don't throw
- [ ] Use statement wrapper for database access
- [ ] Invalidate caches after mutations

---

## References

- [Unified Master Plan](./unfied-master-plan.md) - Tiered fetching strategy
- [Implementation Plan](../.gemini/antigravity/brain/*/implementation_plan.md) - Tiered frame analysis
- Pipeline Runner: `src/analysis/runner/pipelineRunner.ts`
- State Machine: `src/state/`
- Database: `src/storage/`
