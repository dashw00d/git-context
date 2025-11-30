# Prototype: Super Webview (Proof of Concept)

Goal: build a POC webview that exercises advanced, zoomable, facts-first reporting with rich interactivity (clicks, hovers, filters) and optional LLM addendum. This is a sandbox to validate UX/tech choices before full integration.

## Core Scenarios to Prototype
- Zoomable scope:
  - Start with a connected file tree (focus file + neighbors).
  - Click file → show methods; click method → method-only view (timeline, diffs, edges, drift/legacy flags).
  - Scope toggles: symbol → file → connected set → bundle; degree slider for neighbors.
  - “Export report at current zoom” (facts + optional LLM addendum).
- Timeline & Diffs:
  - List commits touching current scope (last N).
  - For each commit: symbol/edge deltas, mod_reason, diff snippets (pre/post), edge changes (calls/imports added/removed), risk flags.
  - Hover for code snippets; click to open file/line in editor.
- Edges & Dependencies:
  - List/graph of callers/callees/imports; unresolved callers/imports with guessed targets.
  - Edge evolution per commit; filter imports vs calls, resolved vs unresolved.
- Drift & Legacy:
  - Naming/import/file-naming drift rows (with file/line links, suggestions).
  - Legacy: dead/legacyUsed/replacedLeftovers; “safe to delete” checklist with confidence.
- Hotspots & History:
  - Hotspot list (per-symbol/per-file) with scores/trends; moved blocks; similar refactors from vectors.
- Actions/LLM (optional):
  - “Skip LLM” toggle; if enabled, show facts-only actions (top issues by severity/hotspot).
  - If LLM on, add an “LLM Addendum” section with guided steps, grounded by evidence paths/snippets.

## Data Inputs (facts-first)
- From bundleFacts/evidence:
  - Symbols per commit (added/modified/removed), mod_reason, diff_snippet_pre/post, locs.
  - Edges per commit (imports/calls), unresolved callers/imports, guessed targets.
  - Drift (naming/import/file), mixed files, convention drift symbols, import drift rows.
  - Legacy (dead/legacyUsed/replacedLeftovers).
  - Hotspots, moved blocks.
  - Timeline (bundle shas), scope files, working symbols/edges.
- For vectors (optional):
  - Similar refactors/hotspots to suggest prior fixes/snippets.

## UI Structure (POC)
- Left nav: connected file tree with badges (severity: missing/zombie/drift/legacy/hotspot). Clicking updates main pane.
- Top controls: scope selector (symbol/file/connected/bundle), degree slider for neighbors, depth selector (commits), “Include neighbors” toggle, “Skip LLM” toggle, “Export current view” button.
- Main pane tabs for current zoom:
  - Timeline: commits touching scope, deltas, snippets, risk flags.
  - Diffs: per-symbol/method cards with history and snippets.
  - Edges: callers/callees/imports, unresolved; evolution per commit.
  - Drift/Legacy: tables for drift/legacy hits with links/suggestions.
  - Hotspots/History: hotspot list, moved blocks, similar refactors.
  - Actions: fact-driven top issues; optional LLM addendum.
- Hovers: show code snippets on any symbol/file/evidence row.
- Clicks: open file/line in editor; expand sections; copy evidence link.

## Technical Notes (POC)
- Data: use current bundleFacts/evidence; add a small adapter to derive per-scope slices (symbol/file/neighbors) from existing facts.
- Webview: standalone React panel (POC) loading precomputed JSON (mock or actual bundleFacts).
- Graph: simple Mermaid or lightweight canvas; start with list + mini-graph for dependencies.
- Export: render facts-only markdown for current scope; append LLM addendum if available.

## Success Criteria
- Can zoom from bundle → connected → file → method and see appropriate level of detail.
- Hovers/snippets and links work; “open in editor” navigates correctly.
- Filters/toggles/degree slider change the view without confusion.
- Facts-only report is useful; LLM addendum is optional and grounded.

## Default Behavior (Intended Baseline)
- Reports are generated facts-first in this webview; this becomes the default report experience.
- LLM does **not** run automatically; user explicitly asks questions.
- LLM context is scoped to current zoom/view (symbol/file/connected/bundle) so answers stay relevant; context includes the visible facts/evidence/snippets at that scope.
- Provide an “Ask LLM” affordance per view, passing only the scoped evidence, timeline, edges, drift/legacy hits, and hotspots. The LLM response is rendered as an addendum; facts remain the primary source.
