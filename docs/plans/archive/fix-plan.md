# Comprehensive Fix Plan: Hook Up All Types and Connections

## Overview

This plan addresses all critical issues found in the codebase audit, ensuring that:

1. All type definitions are properly connected
2. Action types are consistent across files
3. Reducer handles all critical actions
4. No type conflicts exist

---

## Issues Identified

### 1. ✅ RESOLVED: Missing Type Definitions

**Status:** FIXED - All 10 missing DTO types have been added to `src/types/cockpit.ts`

### 2. ❌ CRITICAL: Action Type Import Mismatch

**Location:** `src/state/reducers.ts:1`
**Problem:** Reducer imports generic `Action` interface from `cockpit.ts` instead of discriminated union from `actions.ts`
**Impact:** Type safety is lost, reducer may not properly handle action payloads

**Current:**

```typescript
import { CockpitState, Action } from '../types/cockpit';
```

**Should be:**

```typescript
import { CockpitState } from '../types/cockpit';
import { Action } from './actions';
```

### 3. ❌ CRITICAL: Conflicting Action Interface

**Location:** `src/types/cockpit.ts:118-121`
**Problem:** Generic `Action` interface conflicts with proper discriminated union in `actions.ts`
**Impact:** Creates confusion and type conflicts

**Current:**

```typescript
export interface Action {
  type: string;
  payload?: any;
}
```

**Fix:** Remove this interface entirely - the real Action type is in `actions.ts`

### 4. ❌ IMPORTANT: Incomplete Reducer

**Location:** `src/state/reducers.ts:14-48`
**Problem:** Reducer only handles 4 action types out of 40+ defined actions
**Impact:** Many actions (COMMITS_UPDATED, BUNDLE_FACTS_UPDATED, SYMBOLS_UPDATED, etc.) fall through to default case and don't update state

**Currently Handled:**

- ANALYSIS_STARTED ✅
- ANALYSIS_PROGRESS_UPDATED ✅
- ANALYSIS_COMPLETED ✅
- LIVE_ANALYSIS_UPDATED ✅

**Missing Handlers (Critical):**

- COMMITS_UPDATED ❌
- COMMITS_DATA_UPDATED ❌
- BUNDLE_FACTS_UPDATED ❌
- BUNDLE_VIEW_UPDATED ❌
- SYMBOLS_UPDATED ❌
- REPORTS_UPDATED ❌
- WORKSPACE_FILES_UPDATED ❌
- SELECTION_UPDATED ❌
- SECTION_CHANGED ❌
- NAVIGATE_TO ❌
- EXPLORER_UPDATED ❌
- And many more...

---

## Fix Plan

### Step 1: Fix Action Type Import in Reducer

**File:** `src/state/reducers.ts`

**Change:**

```typescript
// BEFORE
import { CockpitState, Action } from '../types/cockpit';

// AFTER
import { CockpitState } from '../types/cockpit';
import { Action } from './actions';
```

**Reason:** Use the proper discriminated union Action type from actions.ts for type safety

---

### Step 2: Remove Conflicting Action Interface

**File:** `src/types/cockpit.ts`

**Change:** Remove lines 118-121:

```typescript
export interface Action {
  type: string;
  payload?: any;
}
```

**Reason:** This generic interface conflicts with the proper discriminated union in actions.ts. The store.ts and stateDebugger.ts already correctly import from actions.ts.

---

### Step 3: Enhance CockpitState Interface (Optional but Recommended)

**File:** `src/types/cockpit.ts`

**Consider adding explicit fields:**

```typescript
export interface CockpitState {
  activeFrame?: ContextFrame;
  history?: ContextFrame[];
  bundleView?: BundleView;
  explorerData?: ExplorerNode[]; // More specific type

  // Data fields
  commits?: CommitDTO[];
  hasMoreCommits?: boolean;
  bundleFacts?: BundleFactsDTO;
  bundleSummary?: BundleSummaryDTO;
  symbols?: SymbolDTO[];
  reports?: ReportDTO[];
  stagedFiles?: StagedFileDTO[];
  unstagedFiles?: UnstagedFileDTO[];
  workspaceFacts?: any;

  // UI State
  selectedCommitShas?: string[];
  selectedStagedPaths?: string[];
  selectedUnstagedPaths?: string[];
  activeSection?: CockpitSectionKey;
  commitsFilterText?: string;
  commitsFilterScopes?: { staged: boolean; unstaged: boolean; history: boolean };
  lastNCommits?: number;

  // Analysis State
  actionHistory?: any[];
  isAnalyzing?: boolean;
  analysisStep?: string;
  analysisProgress?: number;
  status?: string;

  // Navigation
  repoContext?: { repoName: string | null; branchName: string | null };

  // Keep for backward compatibility
  [key: string]: any;
}
```

**Note:** The `[key: string]: any` index signature allows flexibility, but explicit fields improve type safety and IntelliSense.

---

### Step 4: Expand Reducer to Handle Critical Actions

**File:** `src/state/reducers.ts`

**Add handlers for critical data update actions:**

```typescript
export function cockpitReducer(state: CockpitState, action: Action): CockpitState {
  switch (action.type) {
    // Existing handlers...
    case 'ANALYSIS_STARTED':
    case 'ANALYSIS_PROGRESS_UPDATED':
    case 'ANALYSIS_COMPLETED':
    case 'LIVE_ANALYSIS_UPDATED':
    // ... existing code ...

    // Commits
    case 'COMMITS_UPDATED':
      return {
        ...state,
        commits: action.payload.commits,
        hasMoreCommits: action.payload.hasMore,
      };

    case 'COMMITS_DATA_UPDATED':
      return {
        ...state,
        commits: action.payload.commits,
      };

    // Bundle
    case 'BUNDLE_FACTS_UPDATED':
      return {
        ...state,
        bundleFacts: action.payload.facts,
        bundleSummary: action.payload.summary ?? state.bundleSummary,
      };

    case 'BUNDLE_VIEW_UPDATED':
      return {
        ...state,
        bundleView: action.payload.view,
      };

    case 'BUNDLE_CLEARED':
      return {
        ...state,
        bundleFacts: undefined,
        bundleSummary: undefined,
        bundleView: undefined,
      };

    // Symbols
    case 'SYMBOLS_UPDATED':
      return {
        ...state,
        symbols: action.payload.symbols,
      };

    // Reports
    case 'REPORTS_UPDATED':
      return {
        ...state,
        reports: action.payload.reports,
      };

    // Workspace Files
    case 'WORKSPACE_FILES_UPDATED':
      return {
        ...state,
        stagedFiles: action.payload.staged,
        unstagedFiles: action.payload.unstaged,
      };

    case 'WORKSPACE_FACTS_UPDATED':
      return {
        ...state,
        workspaceFacts: action.payload.workspaceFacts,
      };

    // Selection
    case 'SELECTION_UPDATED':
      return {
        ...state,
        selectedCommitShas: action.payload.selectedCommitShas,
        selectedStagedPaths: action.payload.selectedStagedPaths,
        selectedUnstagedPaths: action.payload.selectedUnstagedPaths,
      };

    // UI State
    case 'SECTION_CHANGED':
      return {
        ...state,
        activeSection: action.payload.section,
      };

    case 'COMMITS_FILTER_TEXT_CHANGED':
      return {
        ...state,
        commitsFilterText: action.payload.text,
      };

    case 'COMMITS_FILTER_SCOPES_CHANGED':
      return {
        ...state,
        commitsFilterScopes: action.payload.scopes,
      };

    case 'LAST_N_COMMITS_CHANGED':
      return {
        ...state,
        lastNCommits: action.payload.n,
      };

    // Navigation
    case 'NAVIGATE_TO':
      return {
        ...state,
        activeFrame: action.payload.frame,
        history: [...(state.history || []), state.activeFrame].filter(Boolean) as ContextFrame[],
      };

    case 'NAVIGATE_BACK':
      return {
        ...state,
        activeFrame: state.history?.[state.history.length - 1],
        history: state.history?.slice(0, -1) || [],
      };

    case 'EXPLORER_UPDATED':
      return {
        ...state,
        explorerData: action.payload.nodes,
      };

    // Context
    case 'REPO_CONTEXT_UPDATED':
      return {
        ...state,
        repoContext: {
          repoName: action.payload.repoName,
          branchName: action.payload.branchName,
        },
      };

    // Reset
    case 'RESET_ALL_STATE':
      return initialState;

    // Error handling
    case 'ANALYSIS_FAILED':
    case 'ERROR_SET':
      return {
        ...state,
        status: 'error',
        isAnalyzing: false,
      };

    case 'ERROR_CLEARED':
      return {
        ...state,
        status: undefined,
      };

    default:
      return state;
  }
}
```

**Priority Actions to Handle:**

1. ✅ COMMITS_UPDATED - Critical for commit display
2. ✅ BUNDLE_FACTS_UPDATED - Critical for analysis results
3. ✅ SYMBOLS_UPDATED - Critical for symbol display
4. ✅ WORKSPACE_FILES_UPDATED - Critical for workspace state
5. ✅ SELECTION_UPDATED - Critical for user interactions
6. ✅ NAVIGATE_TO/NAVIGATE_BACK - Critical for navigation
7. ✅ SECTION_CHANGED - Critical for UI state

**Lower Priority (can be added incrementally):**

- Filter actions (COMMITS*FILTER*_, SYMBOL*FILTER*_, REPORTS*FILTER*\*)
- Frame analysis tier actions
- Pipeline health updates
- Other UI state actions

---

## Implementation Order

### Phase 1: Critical Type Fixes (MUST DO)

1. ✅ **Fix Action import in reducers.ts** - Use discriminated union
2. ✅ **Remove conflicting Action interface** from cockpit.ts
3. ✅ **Verify no compilation errors**

### Phase 2: Essential Reducer Handlers (SHOULD DO)

1. ✅ **Add COMMITS_UPDATED handler**
2. ✅ **Add BUNDLE_FACTS_UPDATED handler**
3. ✅ **Add SYMBOLS_UPDATED handler**
4. ✅ **Add WORKSPACE_FILES_UPDATED handler**
5. ✅ **Add SELECTION_UPDATED handler**
6. ✅ **Add NAVIGATE_TO/NAVIGATE_BACK handlers**

### Phase 3: Enhanced State Type (OPTIONAL)

1. Consider adding explicit fields to CockpitState
2. Update initialState to match
3. Update all reducer handlers to use explicit fields

### Phase 4: Complete Reducer (FUTURE)

1. Add remaining action handlers incrementally
2. Add comprehensive error handling
3. Add state validation

---

## Testing Checklist

After implementing fixes:

- [ ] TypeScript compiles without errors
- [ ] No linter errors
- [ ] Actions can be dispatched without type errors
- [ ] Reducer properly updates state for COMMITS_UPDATED
- [ ] Reducer properly updates state for BUNDLE_FACTS_UPDATED
- [ ] Reducer properly updates state for SYMBOLS_UPDATED
- [ ] Store correctly uses Action type from actions.ts
- [ ] No conflicting Action type definitions exist

---

## Files to Modify

1. **src/state/reducers.ts** - Fix Action import, add handlers
2. **src/types/cockpit.ts** - Remove conflicting Action interface, optionally enhance CockpitState

---

## Summary

**Critical Issues:**

- ❌ Action type mismatch (reducer uses wrong import)
- ❌ Conflicting Action interface definition
- ❌ Reducer missing handlers for critical actions

**All other types are properly defined and connected!** ✅

---

## Notes

- The `[key: string]: any` index signature in CockpitState provides flexibility but reduces type safety
- Consider gradually adding explicit fields to improve type checking
- All DTO types are now properly defined in cockpit.ts ✅
- Store.ts correctly imports Action from actions.ts ✅
- Actions.ts correctly imports all DTO types ✅
