# Git Context - Project Overview

**git-context** is a VS Code extension and CLI tool designed to provide deep commit intelligence. It analyzes git history using semantic parsing (Tree-sitter) and structural diffing (Difftastic) to extract meaningful symbols and changes. It then leverages Large Language Models (LLMs) via OpenRouter or Ollama to generate summaries, explain changes, and identify risks.

## Key Technologies
*   **Language:** TypeScript (Node.js / VS Code API)
*   **Parsing:** Tree-sitter (WASM bindings)
*   **Diffing:** Difftastic (Structural diffs)
*   **Database:** SQLite (`sql.js`) with a custom schema migration system.
*   **Vector Search:** Qdrant (Optional) for semantic search.
*   **UI:** React (Webview) for the "Cockpit" and "Symbol History" views.
*   **Testing:** Vitest (Unit/Integration), Custom benchmarking scripts.

## Architecture
1.  **Git Event Layer:** Hooks/Watchers trigger analysis.
2.  **Analysis Layer:** Tree-sitter + Difftastic extract symbols and structural changes.
3.  **Intelligence Layer:** LLMs generate summaries and insights.

## Core Invariants
*   **Tree View:** IDs must be globally unique and stable.
*   **Database:** All reads via `statement-wrapper`.
*   **Change Semantics:** Types normalized to `added | modified | signature_changed | removed | renamed | moved`.
*   **LLM Context:** JSON is source of truth.

## Directory Structure
*   `src/extension.ts`: Main VS Code extension entry point.
*   `src/cli/`: CLI tool entry point.
*   `src/analysis/`: Core logic for Git operations, parsing, and diffing.
*   `src/storage/`: Database management.
*   `src/webview/`: React components.
*   `src/services/`: Service layer.
*   `benchmarks/`: Performance testing.
