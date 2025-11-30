# Report & UI Roadmap (facts-first, guided by LLM add-ons)

## Vision
Target: messy, half-finished refactors in large repos. Deliver a facts-driven experience (rich, clickable, grounded in pipeline outputs) with LLM addenda for prioritized actions. Avoid LLM-only narratives; facts render first, LLM augments.

## Top-Level Tabs (Overview → Action)
- Overview: Health, missing/zombies/divergent, unresolved callers, drift %, legacy debt, hotspots; “What to do next” list (LLM-curated addendum) with links; cards are clickable to filtered detail.
- Blast Radius: Interactive graph of changed symbols/callers/callees and unresolved edges. Click → file/snippet/intended vs working; filters for imports/calls/changed/unresolved; mini list of top impacted callers/callees.
- Incomplete Refactor: Clusters of missing/zombie/divergent; intended vs working vs history; partial migrations (replacedLeftovers, symbol lineage); “stranded state” (state vs locals divergence) list.
- Conventions & Drift: Naming/import/file-naming drift tables (dominant vs drift %, impacted files), mixed targets, old namespaces, unresolved callers/imports with guessed targets; filters by type/severity; suggested renames/normalization.
- Legacy & Dead Code: Dead symbols, legacyUsed, replacedLeftovers; “safe to delete” checklist with confidence; open old/new links.
- Hotspots & History: Top hotspots (DNA-based), moved blocks, similar past refactors from vectors; click to pull snippets/prior fixes.
- Symbols & Edges: Searchable list with filters (kind/change/drift/legacy); hover for snippets; edge view highlighting unresolved callers/imports with guessed targets.
- Commits/Timeline: Bundle commits with file/symbol changes and risk flags; expandable to diffs/snippets; timeline of refactor evolution.

## Report Structure (Saved Markdown)
- Scope & Metrics: commits/files/symbols/edges; workspace/cache notes.
- Incompleteness: missing/zombie/divergent tables with links.
- Drift: naming/import/file drift, mixed files, unresolved callers; suggested renames/fixes.
- Legacy: dead/legacyUsed/replacedLeftovers; removal/cleanup plan.
- Hotspots & Moved Blocks: top risky files/symbols and moved DNA.
- Blast Radius Summary: key impacted callers/callees/unresolved edges.
- Timeline: commit list with risk notes.
- Actions: LLM-curated prioritized steps with evidence links/snippets.
- LLM Addendum (optional): narrative + guidance, grounded with evidence paths.

## Granular Mini-Reports
- Stranded State: state vs locals divergence; missing setters; unresolved edges expecting state.
- Unfinished Migrations: replacedLeftovers + missing symbols + unresolved callers to old names.
- Convention/Import Hygiene: drift tables and quick fixes.
- Unresolved Callers/Imports: list with guessed targets + severity.

## UI Behaviors
- Everything clickable to file/line; hover shows snippets (diff_snippet_pre/post, symbol bodies truncated).
- Filters: severity, scope (bundle/staged/unstaged), domain (state, naming, imports, legacy).
- “Fix pack” export: JSON/MD with links/snippets for batch cleanup.

## Pipeline Enhancements (to support UI)
- Ensure evidence includes locs/snippets for missing/zombies/drift/legacy/unresolved callers/import drift.
- Drift detectors: include import and file-naming drift (done), consider “state divergence” patterns (class fields vs locals).
- Unresolved callers/imports: severity, guessed targets, file/line.
- Incomplete refactor clustering: use DNA lineage and replacedLeftovers to group partial migrations.

## LLM Usage (Assist, Not Primary)
- Curate prioritized action list with snippets and evidence paths.
- Summarize tab highlights with links.
- Suggest concrete fixes (rename/remove/align imports) with file/line refs; avoid hallucination by grounding in facts.

## Vector DB Usage
- Retrieve similar past refactors/hotspots to suggest proven fixes.
- Contextual “related” panel when inspecting an issue (symbols/files similar to current item).

## Interactivity & Fact-Rich UI (LLM optional)
- Clickable IDs and evidence: open file/line; “open caller/callee”; “copy evidence link”.
- Hovers show code snippets (diff_snippet_pre/post, symbol bodies truncated) for symbols/files/evidence rows.
- Expand/collapse sections with counts; “load more” for long lists.
- Filters everywhere: severity (critical/warn/info), scope (bundle/staged/unstaged), type (missing/zombie/drift/legacy/imports), sort (severity/recency/hotspots).
- Inline actions: suggested rename/normalize, remove, open history, mark reviewed.
- Graph interactions: filter edges/nodes by type/change/unresolved; click to open detail sidebar.
- Hotspot/history: click hotspot → symbol history with diffs/snippets; vector-suggested similar refactors.
- Unresolved callers/imports: list with guessed targets, severity, file/line links; quick “open caller”/“open file”.
- Convention drift: tables with suggested rename/apply; mixed files expandable.
- Legacy: “safe to delete” checklist with confidence badges and links to occurrences.
- LLM toggle: “Skip LLM” mode renders full facts; LLM addendum optional for guided actions.

## File/Symbol/Neighborhood History Focus
- Symbol/Method Focus: pick a symbol (method/function/class) + commit depth (e.g., 10/30). Show timeline of commits touching that symbol, mod_reason, diff snippets (pre/post), edge deltas (callers/callees/imports), unresolved callers/imports, hotspots, drift/legacy flags, state-vs-local checks.
- File Focus mode: pick a file + commit depth. Timeline of commits touching the file, symbol/edge deltas with snippets, and risk flags.
- Current vs past: “Used to have” (removed/missing symbols), “Still here” (legacy/zombies), “Moved” (moved blocks), “Unfinished migrations” (replacedLeftovers).
- Main file deep detail: per-symbol/method cards with history, edges, drift/legacy flags, snippets.
- Connected context with diminishing detail: pull neighbors (callers/callees/imports) and track their changes; direct neighbors get symbol-level summaries and edge deltas; second-degree neighbors get file-level summaries; farther out summarized by counts/risks.
- Edge evolution: per commit edge changes (new/removed/changed calls/imports), unresolved callers/imports with guessed targets; highlight new dependencies introduced and removed ones.
- Legacy/drift hits for the symbol/file/neighbors: dead/legacyUsed/replacedLeftovers; convention/import drift rows with file/line links; mixed files.
- Hotspots: per-symbol/per-file scores and trends; top risky symbols in the focus set; moved blocks involving the symbol/file.
- Filters: depth selector, include neighbors (edges) checkbox, show only removals/missing/unresolved, severity; scope to “symbol only”, “file only”, or “file + connected set”; degree slider for diminishing detail.
- Export: facts-only markdown/JSON for the symbol/file scope (and neighbors if included); optional LLM addendum for “what’s missing/where we went wrong” with references/snippets; allow grouping multiple symbols/files into one report.
- Live analysis: when a symbol/file is edited, auto-fetch its deep history (configurable depth) plus connected context and show the same timeline/diff/drift/legacy views inline, without needing full pipeline rerun.

## Webview Reports & Zoomable Scope
- Zoom controls: file tree of connected paths (focus file + neighbors); click a file → methods list; click a method → method-only history view (timeline, snippets, edges, drift/legacy flags).
- Scope levels: symbol → file → connected set → bundle; toggle “include neighbors” and degree slider.
- Generate report at current zoom: export facts (and optional LLM addendum) for current scope (symbol/file/neighbors).
- Left nav: tree of connected files with severity badges (missing/zombie/drift/legacy/hotspot); clicking updates main pane.
- Main pane: tabs for Timeline, Diffs, Edges, Legacy/Drift, Hotspots for the current zoom.
- Context overlays: hover snippets, file/line links, edge highlights; “open in editor” buttons.
