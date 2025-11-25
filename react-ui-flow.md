## Overall layout

* **Sidebar (Cockpit WebviewView)** in the `gitContext` container.
* **Main editor area**:

  * Your existing `RefactorReport` webview panel (full-width).
* Cockpit’s job:

  * Drive analysis (what to analyze, when).
  * Show bundle/selection summaries.
  * Provide navigation into the report (open report, jump to sections).
  * Expose symbols & reports lists in a way that feels like your current trees.

Think of it as: *“Tree views but smarter, in one place, with accordions.”*

---

## Cockpit: Global header (always visible at top)

**What’s here:**

* **Context line**
  `my-repo • main` (read-only for now; later could be clickable).

* **Primary buttons**:

  * **Analyze** (big primary)

    * Click = “Analyze selection” (commits/files you’ve chosen).
    * Small dropdown arrow:

      * “Analyze selection”
      * “Analyze last N commits”
      * “Analyze staged changes”
      * “Analyze unstaged changes”
  * **Export**

    * “Export LLM Context (JSON)” → calls your existing export command.
  * **Reset**

    * “Reset All” → wipes DB, reloads commits, clears bundle & selections.

* **Status / progress pill**:

  * Idle: `Bundle: none` or `Bundle: 5 commits, 32 files`
  * Running: `Analyzing… (Step 2/4)` + small cancel icon (→ `bundle.cancel`).
  * When bundle exists: a small “Debt: 68%” pill from your stats.

**Behavior:**

* This header never scrolls away.
* It’s the *only* place you need to think about “Run” / “Export” / “Reset.”

---

## Accordion 1 – **Commits & Selection**

This replaces your Commits view + selection header logic.

**Collapsed header content:**

* Title: `Commits & Selection`
* Summary line:
  `3 commits selected • 2 staged files • 4 unstaged files`
* A tiny badge if filters are active: `Filtered`.

**Expanded body:**

1. **Selection controls strip:**

   * Buttons:

     * `Select all staged`
     * `Select all unstaged`
     * `Clear selection`
   * Input:

     * `Add commit by SHA…` (text + “Add” button)

2. **Scope toggles:**

   * Checkbox or pill bar:

     * `[ Staged ] [ Unstaged ] [ History ]`
   * “Last N commits” selector: `N = 5/10/20` (affects “Analyze last N” mode).

3. **Commit search:**

   * Input: `Filter by message, SHA, file…`
   * Live filtering of commit list.

4. **Commit list:**

   * Scrollable (virtualized later).
   * Each row:

     * Checkbox (selected or not).
     * Short SHA + first line of message.
     * Author • date.
     * A small “changes” badge like `12 changes` (optional).
     * Tiny inline icons:

       * `+` / `–` for “Add to bundle” / “Remove from bundle”.
       * “Diff” icon → compare files to commit.

**Interactions:**

* Clicking checkbox or row → posts `toggleCommit(sha)`.
* “Add commit by SHA…” → posts `addCommitBySha(shaOrRef)`.
* “Load more commits” (if you want it here) → small button at bottom of list → `loadMoreCommits`.

---

## Accordion 2 – **Active Bundle**

This is the cockpit side of your old Bundle view, but **the report itself stays in the editor panel**.

**Collapsed header:**

* Title: `Active Bundle`
* Summary line:

  * If none: `No active bundle`
  * If exists: `5 commits, 32 files, 120 symbols` + `Debt: 68%` pill.

**Expanded body:**

1. **Bundle summary card:**

   * “Active bundle built from:”

     * Commit count
     * File count
     * Symbol count
     * Created time (“2h ago”)

2. **Actions:**

   * `Regenerate` – re-run analysis on same bundle SHAs.
   * `Clear bundle` – wipe bundleFacts + summary.
   * `Export JSON` – bundle export.
   * `Open full report` – focuses/opens the full-size report webview in the editor.
   * `Cancel analysis` – only shown when `isAnalyzing = true`.

3. **Quick navigation into the report (but not inline report):**

   * Section links:

     * `Overview`
     * `Incompleteness`
     * `Drift`
     * `Legacy`
     * `Timeline`
   * Clicking → sends `scrollToSection` to the **report webview panel**, not to the sidebar. The panel scroll logic you already added in `main.ts` handles this.

**Important:**
The actual detailed report (cards, blocks, evidence) **stays in the editor webview**, not inside the cockpit. Cockpit just summarizes & controls it.

---

## Accordion 3 – **Symbols**

This is your Symbol History view, turned into a control+list section.

**Collapsed header:**

* Title: `Symbols`
* Summary: `42 symbols • filter: kind=function, changed=modified`.

**Expanded body:**

1. **Search + filters:**

   * Input: `Search symbols…` (name/path).
   * Dropdowns:

     * Kind: `All | function | class | method | constant | component | …`
     * Change: `All | added | modified | removed`.

2. **Symbols list:**

   * Each row:

     * Symbol name.
     * Path (small/secondary).
     * Kind icon (e.g. method/field/class).
     * Commit count badge: `3 commits`.
     * “Last changed” time.

3. **Selection & actions:**

   * Clicking a symbol row:

     * Posts `openSymbolHistory(symbolId)` to backend.
     * Backend opens symbol in editor and/or loads a detail view (could be in a temporary panel, or uses your existing mechanisms).
   * Optional secondary actions:

     * `[Open latest definition]`
     * `[Show diff vs previous]` (opens editor diff).

**No heavy detail view inside the cockpit**; you keep rich navigation there but do deep reading in the main editor.

---

## Accordion 4 – **Saved Reports**

This is what your old Reports tree did, but with better glanceability.

**Collapsed header:**

* Title: `Saved Reports`
* Summary: `5 reports • 2 pinned`.

**Expanded body:**

1. **Filters:**

   * Text filter: `Filter reports…` (by title/summary).
   * Branch filter: dropdown `All branches | main | feature/xyz`.
   * Toggle: `[Pinned only]`.

2. **Reports list:**

   * Rows or cards:

     * Title (e.g. “Refactor bundle – Builder refactor (3 commits)”).
     * Created date.
     * Short one-line summary.
     * Branch badge (if you track).
     * Pin icon (filled if pinned).

3. **Actions:**

   * **Open**:

     * Posts `openReport(reportId)` → backend loads that report’s facts and opens/activates the big full report webview in the editor.
   * **Regenerate**:

     * Posts `regenerateReport(reportId)` → re-runs analysis using stored bundle SHAs.
   * **Delete**:

     * Posts `deleteReport(reportId)` → remove from DB and update list.
   * **Pin/unpin**:

     * Posts `togglePinReport(reportId)`.

No big report content in the sidebar, just a control surface.

---

## Optional Accordion 5 – **Diagnostics / Settings**

If you want it later:

* Show last errors, logs, configuration (OpenRouter key, difftastic path, etc.).
* Actions like “Rebuild database,” “Rescan repo,” etc.

---

## How this relates to what you already have

* The **full report webview panel** keeps doing what it does today (React, `RefactorReportView`).
* The **cockpit**:

  * replaces the *trees* (bundle/commits/symbols/reports),
  * does not try to replace the *full report*,
  * uses **accordions** to mirror those four “views” in one, more flexible UI.

If you want, next step I can rewrite the message contract we just designed to **explicitly treat the report as a separate webview** (i.e., `scrollToSection` and `openReport` target that panel, not the cockpit), so your host code stays conceptually clean.
