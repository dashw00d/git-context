# Git Context - Developer Context

## Project Overview

**git-context** is a VS Code extension and CLI tool designed to provide deep commit intelligence. It analyzes git history using semantic parsing (Tree-sitter) and structural diffing (Difftastic) to extract meaningful symbols and changes. It then leverages Large Language Models (LLMs) via OpenRouter or Ollama to generate summaries, explain changes, and identify risks.

### Key Technologies
*   **Language:** TypeScript (Node.js / VS Code API)
*   **Parsing:** Tree-sitter (WASM bindings)
*   **Diffing:** Difftastic (Structural diffs)
*   **Database:** SQLite (`sql.js`) with a custom schema migration system.
*   **Vector Search:** Qdrant (Optional) for semantic search.
*   **UI:** React (Webview) for the "Cockpit" and "Symbol History" views.
*   **Testing:** Vitest (Unit/Integration), Custom benchmarking scripts.

## Architecture

The system consists of three main layers:
1.  **Git Event Layer:** Hooks/Watchers trigger analysis.
2.  **Analysis Layer:** Tree-sitter + Difftastic extract symbols and structural changes.
3.  **Intelligence Layer:** LLMs generate summaries and insights.

### Core Invariants (Strictly Adhere)
*   **Tree View:** IDs must be globally unique and stable. No re-fetching for defined children. Discriminated unions for node types.
*   **Database:** All reads via `statement-wrapper`. Symbol identity = `symbol_id` (semantic) + `id` (row PK).
*   **Change Semantics:** Types normalized to `added | modified | signature_changed | removed | renamed | moved`.
*   **LLM Context:** JSON is source of truth. Budget tracking for tokens.

## Building and Running

### Prerequisites
*   Node.js 16+
*   VS Code 1.74+
*   Difftastic (optional, but recommended)

### Commands
*   **Build:** `npm run compile` (Compiles TS, downloads WASM, builds Webview)
*   **Watch:** `npm run watch` (Development mode)
*   **Test:** `npm run test` (Runs Vitest)
*   **Lint:** `npm run lint` (ESLint)
*   **Benchmarks:** `npx ts-node benchmarks/pipeline_benchmark.ts`

### CLI Usage
The CLI is located at `./out/cli/index.js` and is aliased as `ct` in instructions.
*   `ct analyze`: Analyze recent commits.
*   `ct index --reindex`: Force re-indexing of commits.

## Directory Structure
*   `src/extension.ts`: Main VS Code extension entry point.
*   `src/cli/`: CLI tool entry point and commands.
*   `src/analysis/`: Core logic for Git operations, parsing (CST/AST), and diffing.
*   `src/storage/`: Database management and schema migrations.
*   `src/webview/`: React components for the extension UI.
*   `src/services/`: Service layer (Pipelines, Reports, Database access).
*   `benchmarks/`: Performance testing and pipeline diagnostics.

## Development Conventions
*   **Database:** Use the modular schema system. Migrations are applied automatically. Do not access `sql.js` directly outside of `database.ts`.
*   **Testing:** Write tests in `benchmarks/` for pipeline logic or alongside source files for units. Use `vitest` conventions.
*   **Logs:** Use `logInfo`, `logDebug`, `logError` from `src/utils/logger`.
*   **Providers:** Use the Dependency Injection pattern seen in `extension.ts` (passing providers to features).
