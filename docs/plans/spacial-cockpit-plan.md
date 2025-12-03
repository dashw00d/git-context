
/* ---- File: docs/plans/spacial-cockpit-plan/intro.md ---- */

# Spacial Cockpit Plan: The "Deep Editor" Transformation

## Goal
Transform the current tab-switching interface (Content ↔ History ↔ Drift ↔ Symbols ↔ Relations) into a single, always-visible, layered “cockpit” where the code is the center and all insights (history, drift, risk, connectivity, time) are overlaid directly on it — without ever leaving the file or losing navigation context.

We keep the familiar VS Code-style file tree (muscle memory preserved) but upgrade it visually and refactor every other part of the UI into a real-time HUD that feels like flying a spaceship instead of reading a document.

## Current State vs. Future State
*   **Current:** Disjointed tabs. You have to switch context to see history or relations. "Drift" is a separate view.
*   **Future:** Unified "Deep Editor". History is a sediment layer in the gutter. Drift is an inline warning. Relations are "portals" on the right. Time is a scrubber at the bottom.

## Core Philosophy (The “Augmented Cockpit” Rules)

1.  **No more tabs** — everything is an overlay or gutter.
2.  **Code is always visible** — never switch away from it.
3.  **Information density through layering**, not pagination.
4.  **100 connections → useful signal**, not noise (aggregation + clustering).
5.  **Time is a first-class dimension** — you can scrub through history and watch the codebase evolve.

## Visual Layout

This layout moves away from "Tabs" and uses a **Three-Pane "Deep Editor"** approach.

```text
+---------------------+---------------------------------------------------------------+
|  VITAL SIGNS (Tree) |  THE COCKPIT (Stage)                                          |
+---------------------+---------------------------------------------------------------+
| EXPLORER            |  [ HUD HEADER ]                                               |
|                     |  📄 AuthService.ts   [Health: ████░]   [🚌 Bus: Dave, Sarah]  |
| 📂 src              |  neighbors: [ User.ts ] [ Session.ts ] [ Token.ts ]           |
| │                   +----------------------+-----------------------+----------------+
| █ 📂 auth           | SEDIMENT | CODE (Zoom: 120%)                 | PORTALS (Refs) |
| ║ 📄 User.ts  ● 12  | (Age)    |                                   | (Aggregated)   |
| ║ 📄 Login.ts ● 4   | ▒▒▒ 40   | export class AuthService {        | +------------+ |
| │                   | ▒▒▒ 41   |                                   | | 📂 UTILS   | |
| │ 📂 utils          | ▓▓▓ 42   |   // ⚠ DRIFT: Legacy method     | | 15 refs    | |
| │ 📄 Helpers.ts     | ▓▓▓ 43   |   public validate(t: Token) {   | | (called by)| |
| │ 📄 Logger.ts      | ▓▓▓ 44   |     const user = db.find(t);    | +------------+ |
| │                   | ▓▓▓ 45   |     return user.isValid();      |                |
| 👻 📄 Legacy.ts ● 0 | ▓▓▓ 46   |   }                             | +------------+ |
|                     | ░░░ 47   |                                 | | 📂 USER    | |
| LEGEND:             | ░░░ 48   |   /* New code (Bright) */       | | 8 refs     | |
| █ New (Today)       | ███ 49   |   public async refresh() {      | | (calls)    | |
| ║ Active (Week)     | ███ 50   |     await this.update();        | +------------+ |
| 👻 Drifted          | ███ 51   |   }                             |                |
| ● Risk Score        | ░░░ 52   | }                               | +------------+ |
| 12 Traffic/Refs     |          |                                 | | ⚛️ UI      | |
|                     |          |                                 | | 3 refs     | |
|                     +----------+-----------------------------------+------------+ |
|                     |  TIME SCRUBBER                                              |
|                     |  [<-------|===========O=================>]                  |
|                     |  3 Months Ago         |               Now                   |
|                     |                       ^ Drift Event                         |
+---------------------+---------------------------------------------------------------+
```

### Breakdown of the Visuals

#### 1. The Vital Signs Sidebar (Left)

- **The "Sentinel" Strip:** Look at the far left edge of the sidebar items.
  - `█` (Solid Block): Edited **today/recently**. Easy to find active work.
  - `║` (Double Pipe): Edited within the **week**.
  - `│` (Single Pipe) or Empty: Old/Stable code.
- **The Telemetry:**
  - `●`: **Risk Dot**. Red/Orange/Green based on complexity/churn.
  - `12`: **Traffic Badge**. Shows this file is heavily connected (12 incoming refs).
  - `👻`: **Drift Icon**. Shows the code implementation has drifted from its name/intent.

#### 2. The HUD Header (Top)

- **Context:** Shows not just the name, but the **Bus Factor** (who owns this?) and a visual **Health Bar**.
- **Navigation:** The "Neighbors" line allows jumping to sibling files (`User.ts`, `Session.ts`) without going back to the tree.

#### 3. The Code Microscope (Center)

- **Sediment Gutter:** The column with `▒▒▒`, `▓▓▓`, `███`.
  - **Dark (▓):** Old, hardened code.
  - **Bright (█):** Fresh, liquid code.
  - _Why?_ You instantly know which lines are new and potentially unstable.
- **Inline Warnings:** Drift (`// ⚠ DRIFT`) is shown right in context, not in a separate tab.

#### 4. The Portals (Right Rail)

- Instead of a list of "100 connected files," we group them.
- **`[ 📂 UTILS ]`**: Shows that 15 files from the "Utils" module depend on this file.
- This solves the "hairball" graph problem.

#### 5. The Time Scrubber (Bottom)

- An interactive slider. Dragging the `O` handle to the left would:
  1.  Revert the code in the center view.
  2.  Remove the "New" (`███`) sediment layers.
  3.  Remove the Drift warnings (if they didn't exist back then).

## Execution Order (What to Build First for Maximum Impact)

1.  **[Phase 1] Data Foundation**: Unify metrics in `NodeMetrics`. Everything else depends on this.
2.  **[Phase 2] Smart Sidebar**: Instant "wow" effect, safe to ship. Replaces standard file tree.
3.  **[Phase 3] Unified Stage**: The core "Code Microscope". Replaces `FileStage.tsx` and `Inspector.tsx`.
    *   3.1 StageHeader
    *   3.2 Sediment Gutter
    *   3.3 Center Code View
    *   3.4 Portals (Right Rail)
4.  **[Phase 4] Semantic Zoom**: Adds depth to the microscope.
5.  **[Phase 5] Time Scrubber**: The final polish.

## Success Criteria
- [ ] User can see risk, churn, and drift without clicking anything.
- [ ] Navigation between related files is faster via "Neighbors" and "Portals".
- [ ] "Context Switching" is eliminated; all data is present in the "Deep Editor".



/* ---- File: docs/plans/spacial-cockpit-plan/step1.md ---- */

# Phase 1: Data Foundation

**Goal:** Unify all metrics in one place so every component can access them without prop-drilling hell. We need a single source of truth for "Risk", "Churn", "Drift", and "Connectivity".

## 1. Define the `NodeMetrics` Interface

We need to add `NodeMetrics` to `src/types/cockpit.ts`. This will hold the aggregated data for each file/node.

```typescript
// src/types/cockpit.ts

export interface NodeMetrics {
  riskScore: number;      // 0–100 (Calculated from complexity + churn)
  churnScore: number;     // 0–100 (Frequency of changes)
  lastModified: number;   // Timestamp of last commit
  driftCount: number;     // Number of drift warnings
  incomingRefs: number;   // Count of incoming edges
  outgoingRefs: number;   // Count of outgoing edges
  authors: string[];      // Top 3 authors (Bus Factor)
  ageDays: number;        // Days since creation or last major refactor
}
```

## 2. Update `CockpitState`

Add `nodeMetrics` to the global state in `src/types/cockpit.ts`.

```typescript
export interface CockpitState {
  // ... existing fields
  nodeMetrics: Record<string, NodeMetrics>; // key = node.path (or id)
  currentTimeFilter: number; // timestamp for time travel (default Date.now())
}
```

## 3. Data Aggregation Logic

We need a service or utility (e.g., `src/services/metricsService.ts`) to compute these metrics from the raw data:
-   **Churn/Age/Authors:** From `commits` analysis.
-   **Drift:** From `drift` analysis (CST/AST mismatches).
-   **Refs:** From `edges` (graph analysis).

## Checklist
- [ ] Update `src/types/cockpit.ts` with `NodeMetrics` and `CockpitState` changes.
- [ ] Create `src/services/metricsService.ts` (or similar) to aggregate data.
- [ ] Ensure backend sends this data populated in the `updateState` message.
- [ ] Verify that the frontend receives and stores this data correctly.



/* ---- File: docs/plans/spacial-cockpit-plan/step2.md ---- */

# Phase 2: Smart Sidebar ("Vital Signs" Explorer)

**Goal:** Replace the boring file tree with HUD rows that provide instant context ("Vital Signs") without needing to open the file.

## 1. Create `RichTreeItem.tsx`

This component will render a single row in the sidebar. It needs to consume `NodeMetrics` for the given node.

```tsx
// src/webview/cockpit/components/RichTreeItem.tsx

interface RichTreeItemProps {
  node: ExplorerNode;
  metrics: NodeMetrics;
  onSelect: (id: string) => void;
}

export const RichTreeItem: React.FC<RichTreeItemProps> = ({ node, metrics }) => {
  // ... implementation
};
```

### Visual Specs
-   **Sentinel Strip (Left 3px):**
    -   `Green`: Edited today (Age < 1 day).
    -   `Blue`: Edited this week (Age < 7 days).
    -   `Transparent/Grey`: Older.
-   **Name:**
    -   `Orange Wavy Underline`: If `driftCount > 0`.
-   **Telemetry (Right Side):**
    -   `Risk Dot`: Green (Low), Orange (Med), Red (High). Based on `riskScore`.
    -   `Traffic Badge`: Number of `incomingRefs` (only show if > 5).
    -   `Ghost Icon`: If `driftCount > 0`.

## 2. Update `Sidebar.tsx`

Modify `src/webview/cockpit/components/Sidebar.tsx` to render `RichTreeItem` instead of the standard tree node.

-   It needs to look up `NodeMetrics` from the global `CockpitState` using the node's ID/path.
-   Pass the metrics down to `RichTreeItem`.

## 3. Interaction Design
-   **Hover on Traffic Badge:** Highlight referencing files in the tree (optional "glow" effect).
-   **Click:** Opens the file in the "Stage" (Phase 3).

## Checklist
- [ ] Create `src/webview/cockpit/components/RichTreeItem.tsx`.
- [ ] Implement the "Sentinel Strip" logic based on `metrics.lastModified`.
- [ ] Implement the "Risk Dot" and "Traffic Badge".
- [ ] Update `Sidebar.tsx` to use `RichTreeItem`.
- [ ] Verify that the sidebar updates in real-time when metrics change.



/* ---- File: docs/plans/spacial-cockpit-plan/step3.md ---- */

# Phase 3: Unified Stage Layout ("CodeMicroscope")

**Goal:** Create the "Deep Editor" experience. Delete `FileStage.tsx` and `Inspector.tsx` and replace them with a single `CodeMicroscope.tsx`.

## 1. Create `CodeMicroscope.tsx`

This is the main container. It uses a flex row layout.

```tsx
// src/webview/cockpit/components/CodeMicroscope.tsx

export const CodeMicroscope = () => {
  return (
    <div className="flex flex-col h-full">
      <StageHeader />
      <div className="flex flex-1 overflow-hidden">
        <SedimentGutter />
        <div className="flex-1 relative">
           {/* Code View / Editor */}
           <CodeEditor />
        </div>
        <PortalsRail />
      </div>
      <TimeScrubber /> {/* Phase 5 */}
    </div>
  );
};
```

## 2. Component Breakdown

### 2.1 `StageHeader.tsx` (HUD)
-   **Health Bar:** Gradient background based on `riskScore`.
-   **Bus Factor:** Display top authors.
-   **Neighbors:** Quick links to sibling files.

### 2.2 `SedimentGutter.tsx` (Left)
-   **Width:** 12px fixed.
-   **Visualization:**
    -   Map line numbers to commit timestamps.
    -   Color scale: Bright Green (New) → Dark Blue (Old).
    -   Use `frame.data.timeline` or `git blame` data.

### 2.3 `CodeEditor.tsx` (Center)
-   **Rendering:** Render code line-by-line.
-   **Drift:**
    -   If line has drift, add `bg-orange-500/10` and an inline warning icon.
    -   Hovering the warning shows the drift explanation.
-   **Risk:**
    -   High-risk symbols (complex/churned) get a subtle red underline.

### 2.4 `PortalsRail.tsx` (Right)
-   **Mode:** Split view or toggle.
-   **Top Half:** Structure (Symbols) with ref counts.
-   **Bottom Half:** Clustered Portals.
    -   Group incoming references by folder/module.
    -   Example: `[ 📂 UTILS (15 refs) ]`.
    -   Clicking expands to show specific files.

## 3. Cleanup
-   Delete `src/webview/cockpit/components/stages/FileStage.tsx`.
-   Delete `src/webview/cockpit/components/Inspector.tsx`.

## Checklist
- [ ] Create `StageHeader.tsx`.
- [ ] Create `SedimentGutter.tsx`.
- [ ] Create `PortalsRail.tsx`.
- [ ] Create `CodeMicroscope.tsx` and assemble components.
- [ ] Implement "Drift" inline warnings in the code view.
- [ ] Delete legacy `FileStage.tsx` and `Inspector.tsx`.



/* ---- File: docs/plans/spacial-cockpit-plan/step4.md ---- */

# Phase 4: Semantic Zoom / Microscope Feel

**Goal:** Allow users to zoom in/out of the code to see different levels of abstraction, from high-level architecture to low-level implementation.

## 1. Zoom Levels

We need to track `zoomLevel` in `CodeMicroscope` state.

### Level 0: Overview (Architecture)
-   **Visual:** Show only class/function signatures. Collapse all bodies.
-   **Badges:** Show risk/drift badges next to signatures.
-   **Use Case:** Quickly scanning a file's public API and health.

### Level 1: Normal (Standard Editor)
-   **Visual:** Standard code view (what we built in Phase 3).
-   **Use Case:** Reading and editing code.

### Level 2: Focus (Deep Dive)
-   **Visual:**
    -   Selected function expands to 120% font size.
    -   Rest of the file dims to 50% opacity.
    -   Right rail (Portals) filters to show *only* references for this specific symbol.
-   **Use Case:** Debugging a specific function without distraction.

## 2. Implementation Strategy

### 2.1 `SymbolBlock` Component
Instead of rendering a giant `<pre>` tag, we must render the code as a list of `SymbolBlock` components.

```tsx
<div className="code-scroll-view">
  {symbols.map(symbol => (
    <SymbolBlock
      key={symbol.id}
      symbol={symbol}
      zoomLevel={zoomLevel}
      isFocused={focusedSymbolId === symbol.id}
    />
  ))}
</div>
```

### 2.2 Tree-sitter Dependency
This relies on accurate start/end lines for every symbol. We must ensure the `analysis` layer provides this in the `SymbolDTO`.

## Checklist
- [ ] Add `zoomLevel` (0, 1, 2) to `CodeMicroscope` state.
- [ ] Create `SymbolBlock` component that handles collapsing/expanding.
- [ ] Implement "Focus Mode" styling (opacity/font-size changes).
- [ ] Connect "Focus Mode" to the Portals rail (filter refs by focused symbol).
- [ ] Add Zoom Controls (Slider or Ctrl+Scroll) to `StageHeader`.



/* ---- File: docs/plans/spacial-cockpit-plan/step5.md ---- */

# Phase 5: Time Travel Scrubber

**Goal:** Allow users to "scrub" through the history of the file to see how it evolved, identify when drift was introduced, and understand the context of changes.

## 1. Create `TimeScrubber.tsx`

A horizontal slider component that sits at the bottom of the `CodeMicroscope`.

```tsx
// src/webview/cockpit/components/TimeScrubber.tsx

export const TimeScrubber = () => {
  const { currentTimeFilter, projectStartTimestamp } = useCockpitState();

  return (
    <div className="time-scrubber">
      <input
        type="range"
        min={projectStartTimestamp}
        max={Date.now()}
        value={currentTimeFilter}
        onChange={e => updateTimeFilter(+e.target.value)}
      />
      <div className="timestamp-label">
        {new Date(currentTimeFilter).toLocaleDateString()}
      </div>
    </div>
  );
};
```

## 2. Connect to Global State

We need to use `currentTimeFilter` (added in Phase 1) to filter the data shown in the `CodeMicroscope`.

### Effects of Scrubbing
When `currentTimeFilter` < `Date.now()`:

1.  **Code View:**
    -   Lines added *after* the selected time should be hidden (or faded out completely).
    -   *Implementation:* Compare `line.commitDate` with `currentTimeFilter`.
2.  **Sediment Gutter:**
    -   Colors shift. The "New" (Green) color now applies to the commit closest to `currentTimeFilter`.
3.  **Drift Warnings:**
    -   Hide warnings that were detected *after* the selected time.
4.  **Portals:**
    -   Filter references to show only those that existed at that time (requires historical graph data).

## 3. "Magic" Moments
-   **Drift Discovery:** Scrub back to see exactly when a "Drift" warning disappears. That's the commit that introduced the violation.
-   **Context Recovery:** Scrub back to see the code *before* a major refactor.

## Checklist
- [ ] Create `TimeScrubber.tsx`.
- [ ] Implement `useTimeTravel` hook to filter data based on `currentTimeFilter`.
- [ ] Update `CodeMicroscope` to respect the time filter (hide lines).
- [ ] Update `SedimentGutter` to respect the time filter (re-calculate colors).
- [ ] (Advanced) Update `Portals` to show historical connections.


