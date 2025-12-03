# UI State Events Audit - Spatial Cockpit

This document audits which orchestrator state events from `orchestrator-state-events.md` are properly handled in the new Spatial Cockpit UI.

## ✅ Fully Handled Events

### Analyze Flow

- ✅ **`isAnalyzing`** - Used in `BundleStage`, `FolderStage`, `TreemapView`, `ConfigPanel`
- ✅ **`analysisStep`** - Received via `updateState` and `analysisProgress` messages
- ✅ **`analysisProgress`** - Received via `analysisProgress` message type
- ✅ **`bundleFacts`** - Received via `updateState` and `updateBundle` messages, used throughout UI
- ✅ **`bundleSummary`** - Received via `updateState` and `updateBundle` messages, displayed in `BundleStage`
- ✅ **`bundleReportId`** - Received via `updateState`
- ✅ **`retrievedHistory`** - Received via `updateState`
- ✅ **`pipelineErrors`** - Displayed in `StatsSection` component
- ✅ **`pipelineStepTimings`** - Displayed in `StatsSection` component

### Selection & Commits

- ✅ **`selectedCommitShas`** - Used in `CodeMicroscope` and `StatsSection`
- ✅ **`selectedStagedPaths`** - Used in `StatsSection` for selection count
- ✅ **`selectedUnstagedPaths`** - Used in `StatsSection` for selection count
- ✅ **`commits`** - Received via `updateState`, used in commit-related components

### Bundle Controls

- ✅ **`bundleFacts: null`** - Handled via `updateState` (clears bundle data)
- ✅ **`bundleSummary: null`** - Handled via `updateState` (clears bundle data)

### UI State (Filters & Sections)

- ✅ **`activeSection`** - Received via `focusSection` message and `updateState`
- ✅ **`symbolFilterText`** - Handled via `MessageController.setSymbolFilterText`
- ✅ **`symbolKindFilter`** - Handled via `MessageController.setSymbolKindFilter`
- ✅ **`symbolChangeFilter`** - Handled via `MessageController.setSymbolChangeFilter`
- ✅ **`reportsFilterText`** - Handled via `MessageController.setReportsFilterText`
- ✅ **`reportsBranchFilter`** - Handled via `MessageController.setReportsBranchFilter`
- ✅ **`reportsShowPinnedOnly`** - Handled via `MessageController.setReportsShowPinnedOnly`

## ⚠️ Partially Handled / Missing

### Error Display

- ⚠️ **`error`** - State is received via `updateState` but **NOT displayed in UI**
  - Currently only logged to console in `SuperWebview`
  - Should be displayed as an error banner/notification

### Commits Filters (Legacy UI Removed)

- ⚠️ **`commitsFilterText`** - State exists but no UI component uses it
  - Old `CommitsTabContent` was removed
  - New Spatial Cockpit doesn't have a commits list view
  - **Status**: Intentionally removed, not needed in new UI

- ⚠️ **`commitsFilterScopes`** - State exists but no UI component uses it
  - Same as above - old commits list removed
  - **Status**: Intentionally removed, not needed in new UI

## 📋 Implementation Details

### Message Flow

1. **Store → CockpitProvider**: Store changes trigger `handleStateChange()`
2. **CockpitProvider → Webview**: `sendState()` dispatches `WEBVIEW_MESSAGE` action
3. **Webview → React State**: `index.tsx` receives `updateState` message and updates React state
4. **React State → Components**: `SuperWebview` receives `cockpitState` prop and passes to children

### Message Types Handled

- ✅ `updateState` - Full state update (handles all state fields)
- ✅ `analysisProgress` - Analysis progress updates
- ✅ `focusSection` - Section navigation
- ✅ `updateExplorerTree` - Explorer tree updates
- ✅ `updateBundle` - Bundle-specific updates
- ✅ `analysisError` - Error messages (logged but not displayed)

## 🔧 Recommended Fixes

### 1. Add Error Display Component

Create an error banner component that displays `cockpitState.error` when present:

```typescript
// In SuperWebview.tsx
{cockpitState.error && (
  <ErrorBanner
    message={cockpitState.error}
    onDismiss={() => postMessage({ type: 'clearError' })}
  />
)}
```

### 2. Verify All State Fields Are Passed

Ensure `SuperWebview` receives and passes all state fields to child components that need them.

## Notes

- The new Spatial Cockpit UI is frame-based, not tab-based, so some legacy state fields (like `commitsFilterText`) are intentionally unused
- All critical state for the new UI architecture is properly handled
- Error display is the main missing piece for complete event handling
