# Prototype: Super Webview (Context-Centric Navigation)

**Goal**: Create a "Spatial Context" interface where users navigate their codebase hierarchically.
**Refinement**: The view is **Selection-First**. It starts from what the user selected (Commit, File, or Symbol) rather than always defaulting to the Bundle. It also features a persistent **Sidebar Explorer** for navigation and visibility into "Scanning" status.

## The Core Concept: "Context Frame"

The **Context Frame** determines the Stage content.
*   **Initial Frame**: Derived from user selection.
    *   *Select Commit* -> **Timeline Lens** focused on that commit's changes.
    *   *Select File* -> **File Stage** for that file.
    *   *Select Symbol* -> **Symbol Stage** for that symbol.

### Zoom Levels (The Hierarchy)
1.  **Bundle / Repo** (Overview)
2.  **Connected Set** (Blast Radius)
3.  **File** (Structure)
4.  **Symbol** (Detail)

---

## UI Organization

### 1. The Explorer (Left Sidebar)
*   **Purpose**: Persistent navigation tree (File -> Symbol).
*   **Features**:
    *   **Structure**: Hierarchical view of files and their symbols.
    *   **Status Indicators**:
        *   🟢 **Ready**: Analysis complete.
        *   🟡 **Scanning**: Currently analyzing.
        *   ⚪ **Unknown**: Not yet analyzed (click to trigger).
*   **Interaction**: Clicking an item sets it as the **Active Frame** on the Stage.

### 2. The Stage (Center / Main)
*   **Purpose**: Visualizes the current **Context Frame**.
*   **Scanning State**: If the active frame is "Scanning", the Stage shows a skeleton loader or progress indicator, but still renders known structure (e.g., file name, raw code) if available.

### 3. The Inspector (Right Sidebar)
*   **Purpose**: Detailed **Lenses** (Timeline, Drift, Relations, Risk).
*   **Context**: Updates based on the Active Frame.

### 4. The Assistant (Bottom / Overlay)
*   **Purpose**: Context-aware LLM chat.

---

## User Journey Example

1.  **Selection**: User selects `auth.ts` in the VS Code file explorer and clicks "Open in Super Webview".
2.  **Initial State**:
    *   *Explorer*: `auth.ts` is highlighted.
    *   *Stage*: **File View** for `auth.ts` loads.
    *   *Status*: `auth.ts` shows 🟢 (Ready).
3.  **Navigation**: User expands `auth.ts` in the Explorer and clicks `login()`.
    *   *Explorer*: `login()` is selected. Status is 🟡 (Scanning) because deep analysis is pending.
    *   *Stage*: Shows `login()` code with a "Analyzing History..." overlay.
4.  **Completion**: Analysis finishes.
    *   *Explorer*: `login()` turns 🟢.
    *   *Stage*: Updates to show the full **Symbol View** with Diff History and Blast Radius.

---

## Technical Implementation (POC)

### State Management
*   `activeFrame`: `{ level, id, status: 'ready' | 'scanning' | 'unknown' }`
*   `explorerData`: Tree structure with status flags.
*   `bundleSummary`: `{ commits, files, symbols, hotspots }` from bundleFacts.
*   `timeline`: recent commits touching the current frame (file/symbol) with deltas.
*   `blastRadius`: incoming/outgoing edges for the current frame.

### Components
*   `<Sidebar />`: Recursive tree component with status icons.
*   `<Stage />`: Handles `status === 'scanning'` by showing loaders.
*   `<SuperWebview />`: Accepts `initialSelection` prop.
*   `<Inspector />`: Renders lenses (timeline, drift, legacy, hotspots).
*   `<Assistant />`: Scoped LLM queries (off by default).

### Data Flow (implemented/in-progress)
* Host → Webview:
  * `updateState`: cockpit state snapshot (selection, bundle summary, lastN).
  * `updateBundle`: `{hotspots, summary}` from bundleFacts.
  * `updateExplorerTree`: files/symbols built from `bundleFacts.evidence['scope.files']` and symbol facts.
  * `updateFrame`: scoped data for a zoom target (file/symbol).
* Webview → Host:
  * `generateReport`: triggers ANALYSIS_REQUESTED (store effects auto-select depth/workspace).
  * `getExplorerTree` / `getBundleData`: request latest facts.
  * `analyzeFrame`: request scoped analysis for a file/symbol (uses current bundle facts + on-disk content).

### Minimal MVP behavior (target)
1) When bundleFacts exist, Sidebar shows real files; Stage bundle view lists hotspots + summary.
2) “Apply & Analyze” auto-selects last N (unstaged → staged → HEAD → recent) and populates bundle facts.
3) Clicking a file in Sidebar sends `analyzeFrame` and Stage shows file content + symbols + hotspot badge.
4) No LLM auto-run; “Ask” uses currently visible scope as context.
5) Errors/empty selection surface as toasts and logs in devtools.

### Known gaps
* Explorer tree still mock if no bundle facts; needs symbol list from facts for per-file children.
* Blast radius data limited; awaiting Tree-sitter edge extraction and reverse edges.
* Timeline lens needs commit/symbol deltas per frame; currently absent.
* Virtual commit stats (staged/unstaged) not yet shown in bundle view.
