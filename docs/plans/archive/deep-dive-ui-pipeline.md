# Deep Dive: UI ↔ Pipeline Communication Flow

**Date**: 2024-12-03
**Status**: Architecture Analysis

## Executive Summary

The UI and Pipeline are correctly using the right communication tools through a Redux-style state management system. The architecture follows a clean separation of concerns with well-defined boundaries.

### Key Findings

✅ **State Management**: Centralized Redux store with actions/reducers
✅ **Event Flow**: Proper UI → Actions → Effects → Pipeline → State Updates → UI cycle
✅ **Type Safety**: Zod schemas validate all messages between host and webview
✅ **Caching**: Multi-layer caching (hotspots, skeleton, bundle views)
✅ **Fixed**: BundleConfig mode propagation and scope calculation issues resolved

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         WEBVIEW (React)                          │
│  User clicks "Generate Report" → sends CockpitClientMessage     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MessageController                             │
│  • Validates incoming messages (Zod)                            │
│  • Dispatches actions to Redux store                            │
│  • Routes commands to VSCode commands                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Redux Store                                 │
│  • Central state: CockpitState                                  │
│  • Actions: analysisActions, bundleActions, etc.                │
│  • Reducers: cockpitReducer                                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CockpitEffects                                │
│  • Observes state changes                                       │
│  • Triggers side effects (refresh, analyze)                     │
│  • ANALYSIS_REQUESTED → calls ReportService                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ReportService                                 │
│  • Main orchestrator for analysis                               │
│  • Cache management (fingerprints)                              │
│  • Calls pipeline.analyzeBundle()                               │
│  • Pipeline event handler dispatches state updates              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  RefactorPipeline                                │
│  • Builds pipeline steps via buildPipelineSteps()               │
│  • Constructs explicit timeline                                 │
│  • Calls runPipeline() with steps and state                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Pipeline Runner                                │
│  • Topological sort of steps (dependency graph)                 │
│  • Parallel execution per level                                 │
│  • Emits events: start, complete, error, finished               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│             Pipeline Steps (via PipelineManifest)                │
│  scope → history → working → bundle_facts → hotspots...         │
│  Each step mutates PipelineState                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ReportService (callback)                      │
│  • Receives pipeline events                                     │
│  • Dispatches ANALYSIS_STEP_UPDATED                             │
│  • On finished: dispatches ANALYSIS_COMPLETED with facts        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CockpitProvider (observer)                      │
│  • Listens to store changes                                     │
│  • When bundleFacts changes:                                    │
│    - Clears skeleton cache                                      │
│    - Calls analysisController.updateBundleData()                │
│    - Updates explorer tree                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  AnalysisController                              │
│  • Builds BundleView from facts                                 │
│  • Generates hotspots, treemap, risks                           │
│  • Dispatches BUNDLE_VIEW_UPDATED                               │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Store → WEBVIEW_MESSAGE Action                      │
│  • sendState() validates with Zod                               │
│  • Sends CockpitHostMessage to webview                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      WEBVIEW (React)                             │
│  Receives updateState → Re-renders with new bundleView          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Component Analysis

### 1. Message Flow (UI → Backend)

#### Entry Point: MessageController.handleMessage()

**Location**: [src/webview/cockpit/services/MessageController.ts:54](src/webview/cockpit/services/MessageController.ts#L54)

```typescript
// User clicks "Generate Report" in UI
{
  type: 'generateReport',
  mode: 'selection' | 'lastN' | 'staged' | 'unstaged' | 'changes',
  force?: boolean,
  lastN?: number
}
```

**Processing**:

1. **Validation**: Message validated against `CockpitClientMessageSchema` (Zod)
2. **BundleConfig Update**: When mode is specified, updates `bundleConfig.mode` to ensure state consistency:

   ```typescript
   if (mode === 'changes' || mode === 'staged' || mode === 'unstaged') {
     const currentConfig = state.bundleConfig || { mode: 'repo', ... };
     const modeToSet = mode === 'changes' ? 'changes' : currentConfig.mode;
     if (modeToSet !== currentConfig.mode) {
       getStore().dispatch(bundleActions.configUpdated({
         ...currentConfig,
         mode: modeToSet,
       }));
     }
   }
   ```

3. **Scope Translation**: Uses centralized utility function:
   ```typescript
   const workspaceScope = deriveWorkspaceScopeFromMode(mode);
   ```
   This ensures consistent scope derivation across the codebase. The actual analysis scope determination happens later in `CockpitEffects.handleAnalysis()` using `deriveAnalysisScope()`.
4. **Action Dispatch**:
   ```typescript
   getStore().dispatch(analysisActions.request(selection, force));
   ```

#### Action Creator: analysisActions.request()

**Location**: [src/state/actionCreators.ts](src/state/actionCreators.ts)

Dispatches:

```typescript
{
  type: 'ANALYSIS_REQUESTED',
  payload: { selection: string[], force?: boolean }
}
```

---

### 2. Side Effects Layer (CockpitEffects)

**Location**: [src/state/effects.ts:23](src/state/effects.ts#L23)

Observes action `ANALYSIS_REQUESTED` and calls:

```typescript
await this.handleAnalysis(action.payload);
```

#### Effect Handler: handleAnalysis()

**Location**: [src/state/effects.ts:258](src/state/effects.ts#L258)

**Key Logic**:

1. **Scope Determination**: Uses centralized utility functions from `scopeUtils.ts`:

   ```typescript
   const workspaceScope = state.workspaceScope || 'workspace';
   const bundleConfigMode = state.bundleConfig?.mode;

   // Use centralized scope derivation logic
   const scope = deriveAnalysisScope(workspaceScope, bundleConfigMode);
   const forceWorkspaceOnly = shouldForceWorkspaceOnly(bundleConfigMode);
   ```

   This ensures consistent scope calculation and respects the `'changes'` mode to force workspace-only analysis.

2. **Selection Building**:

   ```typescript
   const ordered: string[] = [];
   if (includeUnstagedFinal) pushUnique(makeWorkspaceSha('unstaged', branch));
   if (includeStagedFinal) pushUnique(makeWorkspaceSha('staged', branch));
   explicitSelection.forEach(pushUnique);
   ```

3. **Backfill Logic**:
   - If no commits and no workspace changes: Backfills with HEAD + recent commits
   - If under depth limit: Backfills to reach `lastNCommits` depth

4. **Report Generation**:
   ```typescript
   await reportService.generateReport(ordered, scope, { force: payload.force });
   ```

---

### 3. Report Service (Orchestration Layer)

**Location**: [src/services/reportService.ts:34](src/services/reportService.ts#L34)

#### Cache Check

```typescript
const fingerprint = makeBundleFingerprint(shas, scope, PIPELINE_VERSION, PROMPT_VERSION);
const cachedReport = reportManager.loadByFingerprint(fingerprint);
```

If cache hit and not empty:

- Dispatches `ANALYSIS_COMPLETED` immediately
- Returns cached report ID
- **No pipeline execution**

#### Pipeline Invocation

```typescript
const result = await pipeline.analyzeBundle(
  commitShas, // Historical commits
  includeWorkspace, // true if scope !== 'partial'
  workspaceParts, // Set<'staged' | 'unstaged'> or undefined
  onEvent // Event handler
);
```

#### Event Handler

**Location**: [src/services/reportService.ts:136](src/services/reportService.ts#L136)

Dispatches Redux actions for each pipeline event:

- `start` → `ANALYSIS_STEP_UPDATED` with step label
- `complete` → `ANALYSIS_STEP_UPDATED` with progress 100%
- `error` → `ANALYSIS_FAILED`
- `finished` → Extracts facts, builds report, dispatches `ANALYSIS_COMPLETED`

---

### 4. Pipeline Execution Layer

#### RefactorPipeline.analyzeBundle()

**Location**: [src/analysis/refactorPipeline.ts:62](src/analysis/refactorPipeline.ts#L62)

1. **Timeline Construction**:

   ```typescript
   function buildExplicitTimeline(options: {
     includeUnstaged: boolean;
     includeStaged: boolean;
     selectedCommitShas: string[];
   }): string[] {
     const timeline: string[] = [];
     if (options.includeUnstaged) timeline.push('workspace-unstaged');
     if (options.includeStaged) timeline.push('workspace-staged');
     if (options.selectedCommitShas.length > 0) timeline.push('HEAD');
     timeline.push(...options.selectedCommitShas);
     return timeline;
   }
   ```

2. **Step Building**:

   ```typescript
   const steps = buildPipelineSteps({
     commitIndexer,
     workspaceIndexer,
     embeddingIndexer,
     storyEngine,
     concurrency: this.config.concurrency,
     git: this.git,
     skipEmbedding: this.config.skipEmbedding,
     skipLLM: this.config.skipLLM,
   });
   ```

3. **Initial State**:
   ```typescript
   const initialState: PipelineState = {
     selectedCommitShas: commitShas,
     includeWorkspace,
     workspaceParts,
     explicitTimeline,
     completedSteps: new Set(),
     errors: [],
   };
   ```

#### Pipeline Runner

**Location**: [src/analysis/runner/pipelineRunner.ts:74](src/analysis/runner/pipelineRunner.ts#L74)

1. **Dependency Resolution**:
   - Builds dependency graph from step definitions
   - Performs topological sort (Kahn's algorithm)
   - Groups steps into parallel execution levels

2. **Parallel Execution**:

   ```typescript
   for (const level of levels) {
     const promises = level.map(stepId => {
       const step = steps.find(s => s.id === stepId)!;
       return withTimeout(
         Promise.resolve(step.run(state)),
         300000, // 5 minutes
         `Pipeline step '${step.id}'`
       );
     });
     await Promise.allSettled(promises);
   }
   ```

3. **Event Emission**:
   - Calls `onEvent()` callback for each step transition
   - Propagates back to ReportService event handler

#### Pipeline Steps

**Location**: [src/analysis/runner/pipelineManifest.ts](src/analysis/runner/pipelineManifest.ts)

Typical execution order:

```
Level 0: scope
Level 1: history
Level 2: working
Level 3: bundle_facts
Level 4: hotspots, moved_blocks (parallel)
Level 5: embedding_index (if enabled)
Level 6: retrieve_history (if enabled)
Level 7: llm_story (if enabled)
```

Each step mutates `PipelineState` directly:

```typescript
async run(state: PipelineState) {
  // Scope step now uses state.workspaceParts (set by ReportService)
  // This allows staged-only or unstaged-only analysis
  const workspaceParts = state.workspaceParts;
  const scope = await computeScope(..., workspaceParts, ...);
  state.scope = scope;
}
```

**Important**: The scope step (`scopeStep.ts`) now correctly uses `state.workspaceParts` instead of overriding it, allowing proper staged-only or unstaged-only analysis.

---

### 5. Scope Utilities (Centralized Logic)

**Location**: [src/utils/scopeUtils.ts](src/utils/scopeUtils.ts) (new)

Centralized utilities for deriving analysis scope from UI modes and bundle config:

```typescript
// Derive workspace scope from generateReport mode
export function deriveWorkspaceScopeFromMode(mode: GenerateReportMode | undefined): WorkspaceScope;

// Derive analysis scope from workspace scope and bundle config mode
export function deriveAnalysisScope(
  workspaceScope: WorkspaceScope,
  bundleConfigMode?: BundleConfigMode
): AnalysisScope;

// Check if we should force workspace-only analysis
export function shouldForceWorkspaceOnly(bundleConfigMode?: BundleConfigMode): boolean;
```

This ensures consistent scope determination across MessageController, Effects, and ReportService.

### 6. Scope Computation

**Location**: [src/facts/scope.ts:139](src/facts/scope.ts#L139)

#### computeScope() Function

```typescript
export async function computeScope(
  commitShas: string[],
  workspaceParts?: Set<'staged' | 'unstaged'>,
  explicitTimeline?: string[],
  liveOverridePaths?: Iterable<string>,
  gitInstance?: GitOperations
): Promise<ScopeSet>;
```

**Logic**:

1. **Commit Files**: For each SHA, get file changes
2. **Working Changes**:

   ```typescript
   if (workspaceParts) {
     const includeStaged = workspaceParts.has('staged');
     const includeUnstaged = workspaceParts.has('unstaged');

     if (includeStaged) {
       stagedFiles.forEach(f => {
         scope.workingChanged.add(f.path);
         scope.stagedFiles.add(f.path);
       });
     }

     if (includeUnstaged) {
       unstagedFiles.forEach(f => {
         scope.workingChanged.add(f.path);
         scope.unstagedFiles.add(f.path);
       });
     }
   } else {
     // Include ALL working changes
     workingChanges.forEach(f => scope.workingChanged.add(f.path));
   }
   ```

3. **Blast Radius**: Graph-based neighbor discovery
4. **Path Filtering**: Applies `.gitignore` patterns
5. **File Version Map**: Maps each file to its source commit/workspace SHA

**Important**: The scope step (`scopeStep.ts`) correctly passes `state.workspaceParts` to `computeScope()`, which allows staged-only or unstaged-only analysis. Previously, the scope step was overriding `workspaceParts` and always including both staged and unstaged files, which has been fixed.

**Returns**:

```typescript
{
  commitFiles: Set<string>,
  workingChanged: Set<string>,
  stagedFiles: Set<string>,
  unstagedFiles: Set<string>,
  blastRadius: Set<string>,
  allPaths: Set<string>, // Filtered union of all above
  fileVersionMap?: Map<string, string>
}
```

---

### 6. State Update Layer

#### Reducer: cockpitReducer

**Location**: [src/state/reducers.ts:82](src/state/reducers.ts#L82)

Handles `ANALYSIS_COMPLETED`:

```typescript
case 'ANALYSIS_COMPLETED':
  return {
    ...state,
    isAnalyzing: false,
    analysisStep: undefined,
    bundleFacts: action.payload.facts,
    bundleSummary: action.payload.summary,
    bundleReportId: action.payload.reportId,
    retrievedHistory: action.payload.history,
    pipelineErrors: [],
  };
```

#### Observer: CockpitProvider

**Location**: [src/webview/cockpit/CockpitProvider.ts:159](src/webview/cockpit/CockpitProvider.ts#L159)

```typescript
private handleStateChange(change: any) {
  const partialKeys = Object.keys(change.partial);
  const factsChanged = partialKeys.includes('bundleFacts');
  const configChanged = partialKeys.includes('bundleConfig');

  if (factsChanged) {
    if (this.analysisController) {
      this.analysisController.skeletonCache = null;
      await this.analysisController.updateBundleData();
    }
  }

  if (factsChanged || configChanged) {
    await this.updateExplorerTree();
    await this.refreshNodeMetrics();
  }
}
```

---

### 7. Bundle View Generation

**Location**: [src/webview/cockpit/services/AnalysisController.ts:171](src/webview/cockpit/services/AnalysisController.ts#L171)

#### AnalysisController.updateBundleData()

1. **Hotspot Extraction**:

   ```typescript
   hotspots =
     (facts as any)?.evidence?.hotspots ||
     (facts as any)?.findings?.hotspots ||
     (facts as any)?.hotspots ||
     [];
   ```

2. **Risk Extraction**:

   ```typescript
   const driftSymbols =
     ((facts?.findings as any)?.patternDrift?.conventionDrift?.driftSymbols as any[]) || [];
   const topRisks = driftSymbols.slice(0, 5).map((d: any) => ({
     path: d.path,
     name: d.name,
     issue: 'Naming drift',
     detail: d.suggestedName ? `Suggested: ${d.suggestedName}` : '',
   }));
   ```

3. **Treemap Generation**:

   ```typescript
   const treemap = this.buildTreemap(hotspots);
   ```

4. **Bundle View Construction**:

   ```typescript
   const payload: BundleView = {
     hotspots,
     summary: {
       commits: facts.bundle?.shas?.length || 0,
       files: facts.scope?.files || 0,
       symbols: facts.working?.symbols || 0,
     },
     risks: topRisks,
     treemap,
     tier: 'semantics',
   };
   ```

5. **Dispatch**:
   ```typescript
   store.dispatch({
     type: 'BUNDLE_VIEW_UPDATED',
     payload: { view, version: this.bundleViewVersion },
   });
   ```

---

### 8. State Broadcast to Webview

#### CockpitProvider.sendState()

**Location**: [src/webview/cockpit/CockpitProvider.ts:326](src/webview/cockpit/CockpitProvider.ts#L326)

1. **Sanitization**:

   ```typescript
   const sanitizedState = {
     ...this.state,
     bundleConfig: normalizeBundleConfig(this.state.bundleConfig),
     commits: this.state.commits.map(c => ({
       ...c,
       scope: c.scope || ('history' as const),
     })),
   };
   ```

2. **Validation**:

   ```typescript
   const stateResult = CockpitStateSchema.safeParse(sanitizedState);
   if (!stateResult.success) {
     throw new Error(`State validation failed: ${formatZodIssues(stateResult.error)}`);
   }
   ```

3. **Message Creation**:

   ```typescript
   const hostMessage: CockpitHostMessage = {
     type: 'updateState',
     payload: sanitizedState,
   };
   ```

4. **Dispatch to Webview**:

   ```typescript
   getStore().dispatch({
     type: 'WEBVIEW_MESSAGE',
     payload: { message: hostMessage, target: 'cockpit' },
   });
   ```

5. **Actual Transmission**:
   ```typescript
   // In store subscriber (CockpitProvider.resolveWebviewView:66)
   if (action.type === 'WEBVIEW_MESSAGE' && this.view) {
     this.view.webview.postMessage(action.payload.message);
   }
   ```

---

## Data Structures

### CockpitState (Core State Schema)

**Location**: [src/types/cockpit.ts:131](src/types/cockpit.ts#L131)

```typescript
interface CockpitState {
  // Context
  repoName: string | null;
  branchName: string | null;
  workspaceScope?: 'workspace' | 'staged' | 'unstaged';

  // Analysis state
  isAnalyzing: boolean;
  analysisStep?: string;
  analysisProgress?: number;
  error?: string | null;

  // Pipeline execution state
  currentStepId?: string | null;
  pipelineErrors?: Array<{ stepId: string; error: string }>;
  pipelineStepTimings?: Record<string, number>;

  // Data
  commits: CommitDTO[];
  stagedFiles: StagedFileDTO[];
  unstagedFiles: UnstagedFileDTO[];
  bundleFacts: BundleFactsDTO;
  bundleSummary?: BundleSummaryDTO | null;
  bundleView: BundleView | null;
  bundleViewVersion: number;

  // Config
  bundleConfig: BundleConfig;

  // Navigation
  activeFrame: ContextFrame;
  history: ContextFrame[];
  explorerData: ExplorerNode[];

  // Metrics
  nodeMetrics: Record<string, NodeMetrics>;
  currentTimeFilter: number;
}
```

### BundleConfig

**Location**: [src/types/cockpit.ts:7](src/types/cockpit.ts#L7)

```typescript
interface BundleConfig {
  mode: 'repo' | 'module' | 'changes' | 'custom';
  roots: string[];
  includeConnected: boolean;
  exclusions: string[];
}
```

**Modes**:

- `'repo'`: Analyze entire repository
- `'module'`: Analyze specific modules (defined by roots)
- `'changes'`: **Force workspace-only analysis** (no history backfill)
- `'custom'`: Custom paths (defined by roots)

### PipelineState

**Location**: [src/analysis/runner/pipelineTypes.ts](src/analysis/runner/pipelineTypes.ts)

```typescript
interface PipelineState {
  selectedCommitShas: string[];
  includeWorkspace: boolean;
  workspaceParts?: Set<'staged' | 'unstaged'>;
  explicitTimeline: string[];

  // Mutable state (modified by steps)
  scope?: ScopeSet;
  bundleInfo?: BundleInfo;
  commitFacts?: any[];
  workspaceFacts?: any;
  bundleFacts?: RefactorBundleFacts;
  llmOutputs?: any;
  history?: any;

  // Execution tracking
  completedSteps: Set<string>;
  errors: Array<{ stepId: string; error: any }>;
  stepTimings?: Record<string, any>;
  partialReasons?: string[];
  currentStepId?: string | null;
  pipelineDuration?: number;

  // Event handler
  onEvent?: (event: PipelineEvent) => void;
}
```

---

## Critical Issue: Scope Calculation vs UI Expectations

### Problem Statement

The UI allows the user to select `mode: 'changes'` which should analyze **only workspace changes** (staged and/or unstaged). However, the scope calculation logic has multiple layers that may override this intent.

### Issue Flow

1. **UI Selection**:

   ```typescript
   { type: 'generateReport', mode: 'changes' }
   ```

2. **MessageController Translation**:

   ```typescript
   const workspaceScope = mode === 'changes' ? 'workspace' : 'workspace';
   // Result: workspaceScope = 'workspace'
   ```

3. **CockpitEffects.handleAnalysis()**:

   ```typescript
   const isChangesMode = state.bundleConfig?.mode === 'changes';
   const effectiveWorkspaceScope = isChangesMode ? 'workspace' : workspaceScope;
   // Result: effectiveWorkspaceScope = 'workspace' (if bundleConfig.mode === 'changes')
   ```

4. **Selection Building**:

   ```typescript
   const forceWorkspaceOnly = isChangesMode;
   const includeStagedFinal = forceWorkspaceOnly ? true : includeStaged;
   const includeUnstagedFinal = forceWorkspaceOnly ? true : includeUnstaged;

   if (includeUnstagedFinal) pushUnique(makeWorkspaceSha('unstaged', branch));
   if (includeStagedFinal) pushUnique(makeWorkspaceSha('staged', branch));
   explicitSelection.forEach(pushUnique);
   ```

5. **Backfill Logic** (THE ISSUE):

   ```typescript
   const shouldBackfillHistory =
     hasCommitCount() === 0 && !includeStagedFinal && !includeUnstagedFinal && !forceWorkspaceOnly; // <-- Should prevent backfill

   if (shouldBackfillHistory) {
     // Add HEAD + recent commits
   }
   ```

   **BUT** if user has no workspace changes, `includeStagedFinal` and `includeUnstagedFinal` are both true, so `shouldBackfillHistory` becomes false, but then:

   ```typescript
   else if (
     hasCommitCount() < depth &&
     scope !== 'full' &&
     !includeStagedFinal &&
     !includeUnstagedFinal &&
     !forceWorkspaceOnly  // <-- Should also check this
   ) {
     // Backfill to depth
   }
   ```

   **This second condition doesn't check `forceWorkspaceOnly`**, so if user selected `mode: 'changes'` but has few commits selected, it will still backfill.

### Fix Recommendation

**Location**: [src/state/effects.ts:343](src/state/effects.ts#L343)

```typescript
// Current code
else if (
  hasCommitCount() < depth &&
  scope !== 'full' &&
  !includeStagedFinal &&
  !includeUnstagedFinal &&
  !forceWorkspaceOnly  // <-- Add this check
) {
  const recent = await git.getRecentCommits(depth * 2);
  for (const commit of recent) {
    if (hasCommitCount() >= depth) break;
    pushUnique(commit.sha);
  }
}

// Suggested fix
else if (
  hasCommitCount() < depth &&
  scope !== 'full' &&
  !includeStagedFinal &&
  !includeUnstagedFinal &&
  !forceWorkspaceOnly  // Already checked above
) {
  // This branch should never execute if forceWorkspaceOnly is true
  // But the condition already prevents it, so no change needed here
}
```

**Actually, the current code IS correct** - the condition already checks `!forceWorkspaceOnly` on line 349. The logic prevents backfill when in "changes mode".

Let me re-examine...

### Re-Analysis

Looking more carefully at [src/state/effects.ts:343](src/state/effects.ts#L343):

```typescript
} else if (
  hasCommitCount() < depth &&
  scope !== 'full' &&         // <-- This is the issue
  !includeStagedFinal &&
  !includeUnstagedFinal &&
  !forceWorkspaceOnly
) {
```

When `mode === 'changes'`:

- `forceWorkspaceOnly = true`
- `includeStagedFinal = true`
- `includeUnstagedFinal = true`
- `scope = 'full'` (because `effectiveWorkspaceScope === 'workspace'` → scope = 'full')

So the condition becomes:

```typescript
hasCommitCount() < depth &&
scope !== 'full' &&  // FALSE (scope === 'full')
...
```

**Result**: The branch never executes. ✅ **No issue here.**

**Verification**: The backfill logic correctly prevents history backfill when `mode === 'changes'` because:

- `forceWorkspaceOnly = true` prevents the first backfill condition
- `scope === 'full'` prevents the second backfill condition
- Both conditions check `!forceWorkspaceOnly`, ensuring no backfill occurs

### ✅ Fixed: BundleConfig Mode Propagation

**Status**: **RESOLVED** (2024-12-03)

The issue where `generateReport.mode` wasn't updating `bundleConfig.mode` has been fixed.

#### What Was Fixed

1. **MessageController** now updates `bundleConfig.mode` when `generateReport` is received:

   ```typescript
   // In MessageController.handleMessage()
   if (mode === 'changes' || mode === 'staged' || mode === 'unstaged') {
     const currentConfig = state.bundleConfig || { mode: 'repo', ... };
     const modeToSet = mode === 'changes' ? 'changes' : currentConfig.mode;
     if (modeToSet !== currentConfig.mode) {
       getStore().dispatch(bundleActions.configUpdated({
         ...currentConfig,
         mode: modeToSet,
       }));
     }
   }
   ```

2. **Centralized Scope Logic** created in `src/utils/scopeUtils.ts`:
   - `deriveWorkspaceScopeFromMode()` - Converts UI mode to workspace scope
   - `deriveAnalysisScope()` - Converts workspace scope + bundle config to analysis scope
   - `shouldForceWorkspaceOnly()` - Determines if history backfill should be skipped

3. **Effects** now uses centralized utilities for consistent scope derivation

4. **Scope Step** fixed to use `state.workspaceParts` instead of overriding it, allowing proper staged-only or unstaged-only analysis

#### Result

- ✅ Mode propagation is now consistent across the codebase
- ✅ `generateReport` can be sent without `updateBundleConfig` and still work correctly
- ✅ Scope calculation respects staged-only, unstaged-only, and changes mode
- ✅ All scope logic is centralized in `scopeUtils.ts` for maintainability

---

## Caching Strategy

### 1. Report Cache (Fingerprint-based)

**Location**: [src/services/reportService.ts:62](src/services/reportService.ts#L62)

```typescript
const fingerprint = makeBundleFingerprint(shas, scope, PIPELINE_VERSION, PROMPT_VERSION);
const cachedReport = reportManager.loadByFingerprint(fingerprint);
```

**Cache Key**: `${shas.sort().join(',')}:${scope}:${pipelineVersion}:${promptVersion}`

**Cache Hit**: Returns immediately with cached facts, skips entire pipeline

**Cache Miss**: Runs full pipeline, saves report with fingerprint

### 2. Hotspot Cache

**Location**: [src/webview/cockpit/services/AnalysisController.ts:9](src/webview/cockpit/services/AnalysisController.ts#L9)

```typescript
public hotspotCache: Map<string, any[]> = new Map();
```

**Cache Key**: Comma-joined SHAs or `'workspace'`

**Eviction**: LRU with max size 10

**Cleared**: When `bundleConfig` changes

### 3. Skeleton Cache

**Location**: [src/webview/cockpit/services/AnalysisController.ts:10](src/webview/cockpit/services/AnalysisController.ts#L10)

```typescript
public skeletonCache: { files: string[]; roots: string[]; mode: string } | null = null;
```

**Lifetime**: Until next `bundleFacts` update

**Purpose**: Fast initial UI render while pipeline runs

### 4. Bundle View Versioning

**Location**: [src/webview/cockpit/services/AnalysisController.ts:12](src/webview/cockpit/services/AnalysisController.ts#L12)

```typescript
private bundleViewVersion = 0;
```

**Purpose**: Prevent stale updates from overwriting newer data

**Check**: In reducer at [src/state/reducers.ts:206](src/state/reducers.ts#L206):

```typescript
if (incomingVersion < state.bundleViewVersion) {
  logWarn(`Dropping stale bundle view update`);
  return state;
}
```

---

## Progressive Rendering Strategy

The system provides 3-tier progressive rendering:

### Tier 1: Structure (Skeleton)

**Trigger**: Before pipeline starts
**Source**: `workspaceIndexer.getSkeleton()`
**Data**: File list, config mode/roots
**UI Shows**: File tree, "scanning" status

### Tier 2: Hybrid (Fast Metrics)

**Trigger**: During pipeline execution
**Source**: Git operations (staged/unstaged files, quick churn)
**Data**: Virtual commits, fast hotspots
**UI Shows**: Treemap with basic hotspots

### Tier 3: Semantics (Full Analysis)

**Trigger**: After pipeline completes
**Source**: Full `bundleFacts`
**Data**: Symbol-level analysis, drift detection, risks
**UI Shows**: Complete bundle view with all insights

**Implementation**: [src/webview/cockpit/services/AnalysisController.ts:473-584](src/webview/cockpit/services/AnalysisController.ts#L473-L584)

---

## Concurrency & Race Conditions

### Protection Mechanisms

1. **Bundle View Versioning**:
   - Each update increments version
   - Reducer drops updates with version < current

2. **Pipeline Cancellation**:
   - `CancellationToken` passed through ReportService
   - Checked before dispatching final results

3. **Frame Staleness Detection**:
   - Tier updates check `activeFrame.id` before applying
   - Logs warning and drops update if frame changed

4. **Cache Invalidation**:
   - Skeleton cache cleared when facts arrive
   - Hotspot cache cleared on config change

---

## Key Observations

### ✅ Correct Architecture Decisions

1. **Redux Store as Single Source of Truth**: All state flows through centralized store
2. **Effects Layer for Side Effects**: Clean separation between reducers and async operations
3. **Zod Validation**: Strong typing enforced at message boundaries
4. **Event-Driven Pipeline**: Clean callback interface for progress updates
5. **Multi-Tier Caching**: Aggressive caching at multiple levels
6. **Progressive Rendering**: UI feels fast even during long analysis

### ⚠️ Potential Improvements

1. ✅ **Mode Propagation**: **FIXED** - `generateReport.mode` now updates `bundleConfig.mode` automatically
2. ✅ **Scope Logic Centralization**: **FIXED** - All scope derivation logic centralized in `scopeUtils.ts`
3. **Scope Types**: Could be unified further (currently `WorkspaceScope` vs `AnalysisScope` are separate but related)
4. **Dead Code**: `updateState()` and `injectState()` marked deprecated but not removed
5. **Cache Observability**: No metrics on cache hit rate

### 🔴 Critical Flows to Preserve

1. **Cache Invalidation on Config Change**: Must clear caches when `bundleConfig` changes
2. **Version Checking**: Must not apply stale bundle views
3. **Timeline Construction**: Order matters: unstaged → staged → HEAD → commits
4. **Scope Filtering**: Path filter must be applied to prevent analyzing node_modules, etc.

---

## Testing Recommendations

### Integration Tests Needed

1. **UI → Pipeline Round Trip**:
   - Send `generateReport` message
   - Verify `ANALYSIS_COMPLETED` dispatched
   - Verify `bundleView` contains expected data

2. **Cache Hit Flow**:
   - Run analysis twice with same parameters
   - Verify second run returns immediately
   - Verify `bundleFacts` identical

3. **Mode Override**:
   - Set `bundleConfig.mode = 'changes'`
   - Trigger analysis
   - Verify no history backfill occurs

4. **Progressive Rendering**:
   - Subscribe to `BUNDLE_VIEW_UPDATED` actions
   - Verify 3 dispatches: structure → hybrid → semantics
   - Verify versions are monotonically increasing

5. **Race Condition**:
   - Start analysis
   - Change active frame
   - Verify tier updates dropped for old frame

---

## Conclusion

The architecture is **fundamentally sound** and uses the **correct tools** for communication:

- ✅ Redux store for state management
- ✅ Action creators for mutations
- ✅ Effects for side effects
- ✅ Zod for message validation
- ✅ Event callbacks for pipeline progress
- ✅ Version tracking for staleness detection

**All identified issues have been resolved**:

- ✅ **Mode Propagation**: `generateReport.mode` now automatically updates `bundleConfig.mode` in `MessageController.handleMessage()`
- ✅ **Scope Logic Centralization**: Created `scopeUtils.ts` with centralized scope derivation functions used across MessageController, Effects, and ReportService
- ✅ **Scope Step Bug**: Fixed to use `state.workspaceParts` instead of overriding it, enabling proper staged-only/unstaged-only analysis
- ✅ **State Consistency**: `workspaceScope` and `bundleConfig.mode` are now kept in sync automatically

The architecture is now more robust and centralized, with consistent scope determination logic throughout the codebase.

---

## File Reference Index

| Component          | Location                                                                                                 | Line |
| ------------------ | -------------------------------------------------------------------------------------------------------- | ---- |
| MessageController  | [src/webview/cockpit/services/MessageController.ts](src/webview/cockpit/services/MessageController.ts)   | 54   |
| CockpitEffects     | [src/state/effects.ts](src/state/effects.ts)                                                             | 23   |
| ReportService      | [src/services/reportService.ts](src/services/reportService.ts)                                           | 34   |
| RefactorPipeline   | [src/analysis/refactorPipeline.ts](src/analysis/refactorPipeline.ts)                                     | 62   |
| Pipeline Runner    | [src/analysis/runner/pipelineRunner.ts](src/analysis/runner/pipelineRunner.ts)                           | 74   |
| Scope Computation  | [src/facts/scope.ts](src/facts/scope.ts)                                                                 | 139  |
| Scope Utilities    | [src/utils/scopeUtils.ts](src/utils/scopeUtils.ts)                                                       | 1    |
| AnalysisController | [src/webview/cockpit/services/AnalysisController.ts](src/webview/cockpit/services/AnalysisController.ts) | 171  |
| CockpitProvider    | [src/webview/cockpit/CockpitProvider.ts](src/webview/cockpit/CockpitProvider.ts)                         | 159  |
| Reducers           | [src/state/reducers.ts](src/state/reducers.ts)                                                           | 82   |
| BundleConfig       | [src/state/bundleConfig.ts](src/state/bundleConfig.ts)                                                   | 6    |

---

**End of Deep Dive**
