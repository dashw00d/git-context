# Repository Guidelines

## Project Structure & Module Organization
The VS Code extension lives in `src`, split by responsibility: `analysis/` for symbol+diff parsing, `cli/` for the `ct` binary, `state/` and `services/` for Cockpit orchestration, and `webview/` for the React cockpit UI that bundles to `media/cockpit.js`. Tree-sitter grammars and other static assets reside in `resources/`, while compiled JS ends up in `out/`. Keep generated data inside `.git/commit-tracker/` or `out/`.

## Coding Style & Naming Conventions
Follow the existing 2-space indentation, `const`-first mindset, and explicit return types for exported functions. Module boundaries mirror the folder names—prefer domain-based filenames such as `liveTracker.ts` or `cockpitOrchestrator.ts`, and export discriminated unions for node types per the invariants in `README.md`. Keep imports ordered from Node built-ins → packages → local modules, and document nuanced logic with short comments rather than narrating every line.
