# Audit Report: Super Webview Implementation

**Date**: 2025-12-01
**Target**: `docs/unfied-master-plan.md` vs. Workspace Implementation

## Executive Summary

The implementation of the "Super Webview" is a strong "Phase 1" prototype that successfully renders the core UI shell (Sidebar, Stage, Inspector). However, there are significant architectural divergences from the Master Plan, particularly in **State Management** and **Data Flow**, which may lead to synchronization bugs and "zombie" states as complexity grows.

## 1. Critical Architectural Divergences

### A. Split State Management (Risk: High)
*   **Plan**: Defines a single "Global State" driven by `ContextFrame`.
*   **Implementation**:
    *   `SuperWebview.tsx` maintains its own local `activeFrame` and `history` state.
    *   `CockpitProvider.ts` maintains the extension-side `CockpitState`.
    *   **Issue**: There is no single source of truth for "Where is the user?". If the extension triggers an update (e.g., analysis finishes), it pushes a message, but `SuperWebview` manually merges this. This bidirectional syncing is prone to race conditions.
    *   **Recommendation**: Move `activeFrame` and `history` entirely into the Redux store (`src/state/store.ts`). The Webview should be a "dumb" renderer of the state received from the extension.

### B. Data Flow & Hydration (Risk: Medium)
*   **Plan**: Tiered Fetching (Structure -> Hybrid -> Semantics).
*   **Implementation**:
    *   `CockpitProvider` implements "Skeleton" (Structure) and "Hybrid" updates, which is excellent.
    *   **Gap**: The `Inspector` lenses expect detailed data (e.g., `relations.imports`, `risk.legacyDead`) that isn't fully mapped or populated in `CockpitProvider.ts`. The `analyzeFrame` method constructs some of this, but it looks partial.

### C. "Live" Analysis (Risk: Medium)
*   **Plan**: `FileSystemWatcher` triggers updates.
*   **Implementation**:
    *   No active watcher logic found in `CockpitProvider` that pushes updates to the current frame.
    *   **Issue**: The UI claims to be "Live" but currently requires manual triggers or specific message events.

## 2. Component & Feature Gaps

### A. Navigation & Explorer
*   **Hardcoded Nodes**: `SuperWebview.tsx` manually injects "Bundle Overview" and "Reports" nodes. This logic should be in the `ExplorerProvider` or `CockpitProvider` so the tree is consistent.
*   **History**: The "Back" button logic relies on local state. If the user navigates via "Open in Editor" and then comes back, the history might be lost or inconsistent.

### B. The Stage
*   **BundleStage**: The "Configuration" panel (Depth, Scope) is implemented but lacks persistence. It resets or relies on `cockpitState` which might not be saved to `vscode.workspace.configuration`.
*   **BlastRadius**: Implemented as a simple radial graph (good for MVP), but lacks the "Force-directed" depth mentioned in the plan.

### C. The Inspector
*   **Lenses**: The `Inspector` component exists and has tabs, but the data feeding it (`frame.data.drift`, `frame.data.risk`) seems to be constructed ad-hoc in `CockpitProvider.analyzeFrame`. This transformation logic is brittle.

## 3. Code Quality & Refactoring

*   **God Class**: `CockpitProvider.ts` is doing too much:
    *   Message handling
    *   State management
    *   Data transformation (Treemap building)
    *   Skeleton generation
    *   Git operations
*   **Recommendation**: Extract `TreemapBuilder`, `FrameAnalyzer`, and `MessageDispatcher` into separate services.

## 4. Immediate Recommendations

1.  **Centralize Navigation State**: Move `activeFrame` and `history` to the `CockpitOrchestrator` / Redux store.
2.  **Unify Explorer Logic**: Move the "Reports" and "Bundle" node injection to the extension side (`getExplorerTree`).
3.  **Refactor `CockpitProvider`**: Extract the heavy data transformation logic (like `buildTreemap` and `analyzeFrame`) into dedicated helper classes.
4.  **Implement Persistence**: Ensure Bundle Scope configuration is saved to Workspace Settings so it survives reloads.

## 5. Conclusion

The UI looks great and the "Skeleton/Hybrid" loading strategy is a standout feature. The main work remaining is "plumbing" — ensuring the state flows unidirectionally from the Extension Host to the Webview to prevent desyncs.
