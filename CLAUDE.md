# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Git Context is a VS Code extension that analyzes git commit history using Tree-sitter, Difftastic, and LLM analysis to provide intelligent commit summaries, symbol tracking, dependency graphs, and risk detection. The extension stores analysis in a local SQLite database and provides a React-based "Cockpit" UI for exploring commit history and code changes.

## Development Commands

### Building and Compiling
```bash
npm run compile          # Compile TypeScript, download WASM files, build Cockpit UI
npm run watch            # Compile in watch mode (TypeScript only)
npm run build:cockpit    # Build React UI for Cockpit webview
```

### Testing and Linting
```bash
npm run test             # Run tests (currently no tests configured)
npm run lint             # Run ESLint on src directory
```

### CLI Tool
The extension includes a CLI tool (`ct`) for command-line analysis:
```bash
ct analyze [count]       # Analyze last N commits
ct staged                # Analyze staged changes
ct show <sha>            # Show commit analysis
ct symbol <name>         # Search symbol history
ct last [count]          # Show recent analyzed commits
ct install-hooks         # Install git hooks for automatic analysis
```

## Architecture

### Three-Layer Architecture

1. **Git Event Layer**: Git hooks trigger analysis on commits (optional, via `ct install-hooks`)
2. **Analysis Layer**: Tree-sitter + Difftastic extract symbols and structural changes
3. **Intelligence Layer**: OpenRouter/Ollama LLM generates summaries and explanations

### Core Components

**AnalysisPipeline** ([src/analysis/pipeline.ts](src/analysis/pipeline.ts))
- Central orchestrator for all analysis operations
- Separates lightweight metadata loading from heavyweight analysis
- Manages caching, deduplication, and workspace analysis
- Key methods:
  - `loadCommitMetadata()` - Fast metadata loading without analysis
  - `analyzeCommit()` - Full analysis pipeline (symbols, edges, LLM, Qdrant)
  - `analyzeWorkspace()` - Analyze staged/unstaged changes
  - `migrateWorkspaceToCommit()` - Migrate workspace analysis to real commit SHA

**DatabaseManager** ([src/storage/database.ts](src/storage/database.ts))
- Wraps sql.js to provide better-sqlite3-like API
- **CRITICAL**: All DB reads must use `database.prepare()` wrapper, not raw sql.js `Statement`
- Uses `StatementWrapper` to handle statement lifecycle (bind → step → reset → free)
- Supports transactions via `BEGIN/COMMIT/ROLLBACK`
- Database location: `.git/commit-tracker/commit_tracker.db`

**CockpitOrchestrator** ([src/state/cockpitOrchestrator.ts](src/state/cockpitOrchestrator.ts))
- Singleton state manager for Cockpit UI
- Debounces state updates (25ms default) for performance
- Emits events for state changes to drive webview updates
- Manages workspace analysis, bundle facts, and live tracking

**LlmAnalyst** ([src/analysis/llmAnalyst/runner.ts](src/analysis/llmAnalyst/runner.ts))
- Multi-pass LLM analysis pipeline:
  1. Intent & Story Analysis
  2. Drift Verification
  3. Cleanup Plan Generation
  4. Pattern Discovery (optional)
- Uses structured prompts from [src/llm/prompts.ts](src/llm/prompts.ts)
- Tracks token usage and call counts

### Key Data Flows

**Commit Analysis Flow**:
1. Load commit metadata (git info + file changes) → `commits_metadata` table
2. Extract symbols via Tree-sitter → `SymbolInfo[]`
3. Extract dependency edges → `EdgeInfo[]`
4. Calculate blast radius (impact analysis)
5. Generate LLM summary → `LLMResponse`
6. Store in `commits_analysis` table + cache
7. Optionally sync to Qdrant vector DB

**Workspace Analysis Flow**:
1. Get staged/unstaged files via `git diff`
2. Generate synthetic SHA: `workspace-{mode}-{branch}`
3. Analyze symbols/edges from working tree
4. Store with workspace SHA
5. After commit: migrate workspace SHA → real SHA

**Cockpit UI Flow**:
1. Extension activates → initialize `CockpitProvider` webview
2. Orchestrator emits state changes → webview receives messages
3. User actions in webview → `postMessage` to extension
4. Extension updates state → orchestrator propagates to UI

## Configuration

Configuration is loaded in priority order:
1. `.git-context.config.json` (local file, highest priority)
2. VS Code settings (`git-context.*`)
3. Environment variables (fallback)

See [CONFIG.md](CONFIG.md) for full details.

**Critical settings**:
- `openRouterApiKey` - API key for LLM (or use `OPENROUTER_API_KEY` env var)
- `apiEndpoint` - Switch between OpenRouter and Ollama
- `difftasticPath` - Path to difftastic binary (auto-detected if not set)

## Database Schema

**Key tables**:
- `commits_metadata` - Lightweight commit info (author, date, message, parent)
- `commits_analysis` - Analysis results (symbols, edges, risks, LLM summary)
- `symbols` - Individual symbol changes with metadata
- `edges` - Dependency relationships
- `files` - File changes per commit
- `branches` - Branch tracking for filtering
- `fts_symbols` - Full-text search index

**Symbol identity**: Each symbol has both `symbol_id` (semantic ID like `path:class:method`) and `id` (row PK).

## Core Invariants (from README)

**Tree View Invariants**:
- Every tree item ID must be globally unique and stable across refreshes
- IDs must be derived from primary keys or deterministic hashes, never display names
- Tree children are either pre-populated OR dynamic; never both
- Node types use discriminated unions, not regex patterns

**Database Invariants**:
- All DB reads must go through `database.prepare()` wrapper
- Raw sql.js `Statement` is banned outside `database.ts`
- Symbol identity is `symbol_id` (semantic) + `id` (row PK)
- Edges reference `symbol_id`; UI uses row `id`

**Change Semantics Invariants**:
- Change types are normalized to: `added | modified | signature_changed | removed | renamed | moved`
- UI never queries raw types; it queries normalized sets
- Modification reasons: `body_changed | signature_changed | doc_changed | visibility_changed | annotation_changed`

**LLM Context Invariants**:
- Reports render Markdown, but source of truth is JSON
- LLM context contract defines canonical data structure
- Context budget is tracked and truncated predictably
- Lowest-priority sections are truncated first when exceeding token limits

## Supported Languages

Tree-sitter parsers are downloaded for:
- PHP
- TypeScript
- JavaScript

To add more languages: Add to `src/analysis/tree-sitter.ts` and ensure WASM is available at `https://unpkg.com/tree-sitter-wasms/out/tree-sitter-<language>.wasm`

## Testing

When running tests or using the CLI outside VS Code, create `.git-context.config.json` in the project root:
```bash
cp .git-context.config.example.json .git-context.config.json
# Edit with your API keys and paths
```

## Common Patterns

**Working with the database**:
```typescript
const db = getDatabaseManager().getDatabase();
const stmt = db.prepare('SELECT * FROM commits WHERE sha = ?');
const row = stmt.get(sha);  // Single row
const rows = stmt.all();     // All rows
stmt.run(sha, author);       // Execute with params
```

**Working with the pipeline**:
```typescript
const pipeline = await getAnalysisPipeline();
await pipeline.loadCommitMetadata(sha);  // Fast metadata load
const analysis = await pipeline.analyzeCommit(sha);  // Full analysis
```

**Updating Cockpit state**:
```typescript
const orchestrator = getCockpitOrchestrator();
orchestrator.merge({ isAnalyzing: true, analysisStep: 'symbols' });
```

## Debugging

- Extension logs: VS Code Developer Console (`Help` → `Toggle Developer Tools`)
- CLI logs: Uses `console.log` with structured prefixes like `[PIPELINE]`, `[LLM]`, etc.
- Logger functions: `logInfo()`, `logDebug()`, `logError()` from [src/utils/logger.ts](src/utils/logger.ts)

## File Organization

- `src/analysis/` - Analysis pipeline, Tree-sitter, Difftastic, symbol extraction
- `src/llm/` - LLM integration (OpenRouter, prompts, summarization)
- `src/storage/` - Database, Qdrant, embeddings, report management
- `src/webview/` - Cockpit UI (React), webview providers
- `src/state/` - State management (CockpitOrchestrator)
- `src/commands/` - VS Code command handlers
- `src/providers/` - Tree view data providers
- `src/cli/` - CLI tool implementation
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utilities (config, logger, workspace helpers)

## Cursor Rules

This project uses a Cursor rule ([.cursor/rules/plan-mode.mdc](.cursor/rules/plan-mode.mdc)):
- When in ask mode, treat it as plan mode
- Check project files thoroughly before answering
- Compile all context needed to understand the question
- Provide comprehensive plans with ample context and code examples
