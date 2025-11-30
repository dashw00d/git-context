# UI Inventory

## 1. Header (Header.tsx)
**Purpose:** Main control bar and status display.
*   **Controls:**
    *   `Analyze` (Button): Triggers analysis of selected items (`generateReport` mode: `selection`).
    *   `Force Reanalyze` (Button): Forces re-analysis (`generateReport` mode: `selection`, `force: true`).
    *   `Analyze staged` (Button): Analyzes only staged changes (`generateReport` mode: `staged`).
    *   `Analyze unstaged` (Button): Analyzes only unstaged changes (`generateReport` mode: `unstaged`).
    *   `Analyze last N` (Button): Analyzes the last N commits (prompts for number) (`generateReport` mode: `lastN`).
    *   `Export bundle` (Button): Exports the current analysis bundle to JSON (`bundleExport`).
    *   `Reset all` (Button): Clears all selections and resets state (`resetAll`).
    *   `Cancel` (Button): Cancels ongoing analysis (`cancelAnalysis`).
*   **Display:**
    *   Repo/Branch name.
    *   Analysis status (Analyzing... / Bundle summary).
    *   Error messages (dismissible).

## 2. Selection Panel (SelectionPanel.tsx)
**Purpose:** Shows currently selected items for analysis.
*   **Display:**
    *   List of selected Commits.
    *   List of selected Staged Files.
    *   List of selected Unstaged Files.
*   **Controls:**
    *   `Clear Selection` (Button): Deselects all items (`clearSelection`).

## 3. Bundle Panel (BundlePanel.tsx)
**Purpose:** Summary of the active analysis results.
*   **Display:**
    *   Scope counts (Commits, Files, Symbols).
    *   Key Findings counts (Critical issues, Warnings).
    *   Incompleteness summary (Missing symbols, Zombies, Dead code).
*   **Controls:**
    *   `Open Full Report` (Button): Opens the detailed report webview (`openActiveReport`).
    *   Quick Links (Buttons): Scroll report to sections (Overview, Incompleteness, Drift, Legacy, Timeline).

## 4. Tabs (Tabs.tsx)
**Purpose:** Navigation between different views.
*   **Tabs:**
    *   `Live`: Real-time change tracking.
    *   `Commits`: History browsing and selection.
    *   `Bundle`: Current analysis details.
    *   `Symbols`: Symbol search and history.
    *   `Reports`: Saved reports management.

## 5. Commits Tab (CommitsTabContent.tsx + CommitList.tsx)
**Purpose:** Browse and select git history.
*   **Controls:**
    *   `Clear selection` (Button): Clears selection.
    *   `Add commit by SHA` (Button): Manually adds a commit by hash/ref (`addCommitBySha`).
    *   Filter Input: Filters commits by message/author/hash (`setCommitsFilterText`).
    *   Scope Toggles: Show/Hide Staged, Unstaged, History commits (`setCommitsFilterScopes`).
    *   `Load more` (Button): Loads older commits (`loadMoreCommits`).
    *   Commit Checkboxes: Select/deselect individual commits (`toggleCommit`).
    *   File Checkboxes: Select/deselect individual files within commits/workspace (`toggleFileSelection`).
    *   `Compare` (Button on commit): Opens diff view (`compareFilesToCommit`).

## 6. Live Tab (LiveTabContent.tsx)
**Purpose:** Real-time monitoring of working directory changes.
*   **Display:**
    *   Status badge (Tracking Active/Paused).
    *   Metrics (Pending Files, Total Edits).
    *   Analysis Results (Zombies, Missing, Drift, Ghosts, Hybrid).
    *   Zombies List: Detailed list of detected zombies.
*   **Controls:**
    *   `Start Live Analysis` (Button): Enables the tracker (`startLiveAnalysis`).
    *   `Analyze Pending Changes` (Button): Triggers analysis if changes exist (`generateLiveReport`).
    *   `Run Manual Scan` (Button): Forces an immediate scan (`generateLiveReport`).

## 7. Symbols Tab (SymbolsTabContent.tsx + SymbolList.tsx)
**Purpose:** Search and explore code symbols.
*   **Controls:**
    *   Search Input: Filter symbols by name (`setSymbolFilterText`).
    *   Kind Filter: Filter by type (function, class, etc.) (`setSymbolKindFilter`).
    *   Change Filter: Filter by change type (added, modified, removed) (`setSymbolChangeFilter`).
    *   Symbol Item (Click): Opens symbol in editor (`openSymbolInEditor`).
    *   History Icon (Click): Shows symbol history (`openSymbolHistory`).

## 8. Reports Tab (ReportsTabContent.tsx + ReportList.tsx)
**Purpose:** Manage saved analysis reports.
*   **Controls:**
    *   Filter Input: Filter reports by title/summary (`setReportsFilterText`).
    *   Branch Filter: Filter by branch (`setReportsBranchFilter`).
    *   `Pinned only` (Checkbox): Toggle pinned reports (`setReportsShowPinnedOnly`).
    *   Report Item (Click): Opens the report (`openReport`).
    *   `Pin` (Button): Pins/unpins report (`togglePinReport`).
    *   `Delete` (Button): Deletes report (`deleteReport`).
    *   `Regenerate` (Button): Re-runs analysis for report's commits (`regenerateReport`).

## 9. Registered Commands (Backend)
**File:** `src/features/cockpitFeatures.ts` & `src/features/coreFeatures.ts`

| Command | Purpose |
| :--- | :--- |
| `git-context.startLiveAnalysis` | Starts the live file watcher/tracker. |
| `git-context.stopLiveAnalysis` | Stops the live file watcher/tracker. |
| `git-context.generateLiveReport` | Triggers immediate analysis of live changes. |
| `git-context.openEvidence` | Opens a file/location from an evidence link. |
| `git-context.applyRefactor` | Applies a refactoring action (e.g., delete symbol). |
| `git-context.analyze` | Analyzes currently selected items. |
| `git-context.analyzeLastCommits` | Analyzes the last N commits (input box). |
| `git-context.analyzeStagedChanges` | Analyzes staged files. |
| `git-context.analyzeUnstagedChanges` | Analyzes unstaged files. |
| `git-context.openSymbol` | Opens a specific symbol in the editor. |
| `git-context.toggleCommitSelection` | Toggles selection of a commit. |
| `git-context.clearSelection` | Clears all selections. |
| `git-context.copySha` | Copies commit SHA to clipboard. |
| `git-context.addCommitBySha` | Adds a specific commit to the list by SHA. |
| `git-context.selectAllStaged` | Selects all staged files. |
| `git-context.selectAllUnstaged` | Selects all unstaged files. |
| `git-context.addMoreCommits` | Loads older commits into the history view. |
| `git-context.resetAll` | Resets all state and selections. |
| `git-context.bundle.clear` | Clears the active analysis bundle. |
| `git-context.bundle.cancel` | Cancels running analysis. |
| `git-context.bundle.export` | Exports analysis facts to JSON. |
| `git-context.scrollToReportSection` | Scrolls the report webview to a section. |
| `git-context.openSymbolHistory` | Shows history of a symbol. |
| `git-context.downloadWasmFiles` | Downloads Tree-sitter WASM binaries. |
| `git-context.openReport` | Opens a saved report. |
| `git-context.regenerateReport` | Re-runs a saved report. |
| `git-context.deleteReport` | Deletes a saved report. |
| `git-context.togglePinReport` | Pins/unpins a saved report. |
