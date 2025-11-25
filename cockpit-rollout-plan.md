# Cockpit Webview Rollout Plan

Plan to consolidate the Git Context sidebar into a single React-based cockpit webview, while keeping existing tree views alive long enough to avoid regressions.

## Current State Checks
- Manifest (`package.json`) uses container `gitContext` with tree views `bundle`, `commits`, `symbols`, `reports`; activation events are `onView:*` for those plus wildcard commands.
- Extension startup (`src/extension.ts`) registers the four tree providers and a refactor report webview; no cockpit provider exists yet.
- Build pipeline is `tsc` only (`vscode:prepublish` -> `compile`), so we need an explicit bundle step for any new webview assets (JS/CSS under `media/`).

## Manifest Wiring (Phase 0 prep)
- Add cockpit view to the `gitContext` container with id `cockpit`, name `Cockpit`, `type: "webview"`. Keep existing tree views for transition.
- Activation events should include `onView:cockpit` plus needed `onCommand:*` entries (at minimum `git-context.analyzeLastCommits` for the Analyze button).
- Registration must use the view id only: `registerWebviewViewProvider('cockpit', cockpitProvider)`.

## CockpitProvider Backend
- Constructor should take and store `extensionUri` (drop `_extensionUri` usages).
- `resolveWebviewView` must set `webview.options` with `enableScripts: true` and `localResourceRoots: [joinPath(extensionUri, 'media')]` so cockpit.js/css load.
- `getHtml(webview)` should build URIs for `media/cockpit.js` and `media/cockpit.css` via `asWebviewUri`, set a strict CSP, and embed initial state bootstrap if needed.
- Keep `_state` as a serializable POJO/arrays; convert any Sets/Maps before `sendState()`.
- Minimal message handling for Phase 1: `generateReport` posts `vscode.commands.executeCommand('git-context.analyzeLastCommits')`. Defer `toggleCommit` wiring to Phase 2.
- Add `updateCommits(commits: CommitDto[])` (or similar) to push data from existing providers; guard with `if (!this.view) return;`.

## Frontend Cockpit (React)
- Single entry file (e.g., `src/webview/cockpit/Cockpit.tsx`) that calls `const vscode = acquireVsCodeApi();` once and reuses it for `postMessage`.
- Initialize state with the full `CockpitState` shape (empty arrays/nulls, `activeTab: 'commits'`) to avoid undefined access.
- Phase 1 UI: header with “Analyze” button (`postMessage({ type: 'generateReport' })`) and a `<pre>` dump of the received state to validate plumbing.
- Tabs, commit toggles, etc. can be added in Phase 2 once backend wiring is proven.

## Data Plumbing
- Short-term (Phase 1): after `analyzeLastCommits` completes or when existing trees refresh, call `cockpitProvider.updateCommits(...)` with DTOs exported from `CommitsProvider` (add a helper like `exportCommitsDto()` to avoid tree-shape coupling).
- Longer-term: mirror other data (bundle facts, symbols, reports) by adding lightweight export helpers in their providers; send via `cockpitProvider.sendState()` updates.
- Keep command/event wiring simple: defer live-selection mirroring until the cockpit handles `toggleCommit` end-to-end.

## Build & Assets
- Add `media/cockpit.js` and `media/cockpit.css` outputs (ESBuild recommended) plus a script (e.g., `npm run build:webview`) invoked from `compile` or `vscode:prepublish`.
- Ensure CSP in HTML matches generated asset names (hash or nonce if needed); use `webview.cspSource`.
- Decide on asset placement: `/media` alongside `resources/` keeps `localResourceRoots` minimal.

## Rollout Steps
1) Phase 1 (read-only cockpit): add manifest entry + activation; implement `CockpitProvider` with `generateReport` handler; stub `updateCommits`; build minimal React view with state dump; verify activation + Analyze button fires.
2) Phase 2 (commit list): implement `toggleCommit` flow (webview -> provider -> existing selection logic) and feed commit DTOs from `CommitsProvider`; show commit list UI.
3) Phase 3 (replace trees): mirror bundle/symbols/reports into cockpit tabs; keep tree providers registered but hidden in UI until cockpit reaches parity; then remove tree views/menus from manifest.
4) Phase 4 (polish): performance passes, error handling, CSP tighten, styling, and cleanup of obsolete commands/menus.

## Risks & Mitigations
- Missing assets due to empty `localResourceRoots`: ensure media folder is included and URIs built with `asWebviewUri`.
- State serialization: avoid putting Sets/Maps directly into `postMessage`; convert to arrays first.
- Build gaps: add webview bundle step before relying on new assets in published builds.
- Activation mismatch: use view id `cockpit` everywhere (manifest `views` and registration) to prevent the webview from never showing.
