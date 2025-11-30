# Git Context - Commit Intelligence Extension

A VS Code extension that provides deep commit intelligence by analyzing diffs with Tree-sitter and Difftastic, then using LLM to produce consistent summaries and searchable history.

## Features

- **Automatic Commit Analysis**: Analyzes commits using Tree-sitter for symbol extraction and Difftastic for structural diffs
- **LLM-Powered Summaries**: Uses OpenRouter API for intelligent commit summaries and explanations
- **Symbol Tracking**: Tracks function/class additions, modifications, and removals across commits
- **Dependency Graph**: Analyzes import/export relationships and call graphs
- **Risk Detection**: Identifies breaking changes, migrations, security issues, and refactoring opportunities
- **Searchable History**: Full-text search across symbols, commits, and summaries
- **VS Code Integration**: Native UI with commit tracker panel and symbol history view
- **CLI Tools**: Command-line interface for analysis and queries

## Architecture

The extension consists of three main layers:

1. **Git Event Layer**: Git hooks automatically trigger analysis on commits
2. **Analysis Layer**: Tree-sitter + Difftastic extract symbols and structural changes
3. **Intelligence Layer**: OpenRouter LLM generates summaries and explanations

## Core Invariants

These architectural invariants ensure stability and prevent common bugs:

### Tree View Invariants
- **Every tree item ID must be globally unique** and stable across refreshes.
  - *Rule:* IDs must be derived from primary keys or deterministic hashes, never display names.
- **Tree children are either pre-populated OR dynamic; never both.**
  - *Rule:* if `children` is defined, `getChildren()` must not re-fetch for that node type.
- **Node types use discriminated unions, not regex patterns.**
  - *Rule:* `node.type` determines collapsibility, not ID patterns.

### Database Invariants
- **All DB reads must go through statement-wrapper prepare().**
  - *Rule:* raw sql.js `Statement` is banned outside `database.ts`.
- **Symbol identity is `symbol_id` (semantic) + `id` (row PK).**
  - *Rule:* edges reference `symbol_id`; UI uses row `id`.

### Change Semantics Invariants
- **Change types are normalized to one of:** `added | modified | signature_changed | removed | renamed | moved`.
  - *Rule:* UI never queries raw types; it queries normalized sets.
- **Modification reasons are classified as:** `body_changed | signature_changed | doc_changed | visibility_changed | annotation_changed`.
  - *Rule:* Store `mod_reason` metadata on symbol changes.

### LLM Context Invariants
- **Reports render Markdown, but source of truth is JSON.**
  - *Rule:* LLM context contract defines the canonical data structure.
- **Context budget is tracked and truncated predictably.**
  - *Rule:* Lowest-priority sections are truncated first when exceeding token limits.

## Installation

### Prerequisites

- VS Code 1.74+
- Node.js 16+
- Git repository
- [Difftastic](https://github.com/Wilfred/difftastic) (optional, for enhanced structural diffs)

### Setup

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Install the extension in VS Code

### Configuration

#### OpenRouter (Default)
Set your OpenRouter API key in VS Code settings:
```json
{
  "git-context.openRouterApiKey": "your-api-key-here",
  "git-context.openRouterModel": "anthropic/claude-3-haiku:beta",
  "git-context.apiEndpoint": "https://openrouter.ai/api/v1"
}
```

Or set the environment variable:
```bash
export OPENROUTER_API_KEY=your-api-key-here
```

#### Ollama (Local)
To use Ollama instead of OpenRouter:
```json
{
  "git-context.apiEndpoint": "http://localhost:11434/v1",
  "git-context.openRouterModel": "llama2"
}
```

Note: No API key needed for Ollama - it runs locally!

#### Setting up Ollama
1. Install Ollama: https://ollama.ai/download
2. Pull a model: `ollama pull llama2` (or any other model)
3. Start Ollama: `ollama serve`
4. Configure the extension to use `http://localhost:11434/v1` as the API endpoint

### VS Code Extension

1. **Commit Tracker Panel**: View analyzed commits with summaries and symbol changes
2. **Symbol History View**: Search for symbols and see their change history
3. **Commands**:
   - `CommitTracker: Analyze Last 5 Commits` - Analyze recent commits
   - `CommitTracker: Analyze Staged Changes` - Analyze current staged changes
   - `CommitTracker: Compare Files to Commit...` - Compare selected files between commits
   - `CommitTracker: Explain Symbol Change...` - Get LLM explanation for symbol changes

### CLI Tool

The `ct` command provides command-line access:

```bash
# Analyze recent commits
ct analyze
ct analyze --count 10

# Show commit details
ct show abc1234

# Search symbols
ct symbol UserService

# Show recent analyzed commits
ct last
ct last 10

# Install git hooks for automatic analysis
ct install-hooks
```

### Git Hooks

Install hooks to automatically analyze commits:

```bash
ct install-hooks
```

This creates a `post-commit` hook that analyzes each new commit.

## Database Schema

The extension uses a **modular schema system** (v2.0+) with per-module versioning and safe migrations. The schema is organized into 9 logical modules:

- **core**: Migration tracking (`migration_log`)
- **commits**: Commit metadata and analysis (`commits_metadata`, `commits_analysis`)
- **symbols**: Symbol tracking (`symbol_versions`, `symbol_changes`)
- **edges**: Dependency edges and renames (`edges`, `renames`, `import_conventions`)
- **conventions**: Code style conventions (`import_conventions`)
- **structural**: File snapshots and workspace analysis (`file_snapshots`, `workspace_analysis`)
- **hotspots**: Hotspot detection (`file_hotspots`, `symbol_hotspots`)
- **moved**: Block movement tracking (`moved_blocks`, `symbol_lineage`)
- **reports**: Analysis reports (`reports`)

Each module has its own version and migration history. Migrations are applied automatically on startup using `safeAddColumn` to prevent failures on existing databases.

The extension stores analysis results in a local SQLite database at `.git/commit-tracker/commit_tracker.sqlite`:

- `commits`: Commit metadata and LLM summaries
- `files`: Files changed in each commit
- `symbols`: Extracted symbols with change tracking
- `edges`: Dependency relationships between symbols
- `fts_symbols`: Full-text search index for symbols

## Analysis Pipeline

For each commit, the pipeline:

1. **Extracts raw git data** (diff, file changes, commit info)
2. **Parses code with Tree-sitter** to extract symbols (functions, classes, etc.)
3. **Runs Difftastic** for structural diff highlights
4. **Builds dependency graph** of imports and calls
5. **Applies risk heuristics** to detect breaking changes, migrations, etc.
6. **Generates LLM summary** using two-stage prompting
7. **Stores results** in local database

### Useful Testing Commands
 - `npx ts-node benchmarks/pipeline_diagnostics.ts --commit-count=6 --include-workspace --reset-db`
 - `npx ts-node benchmarks/pipeline_diagnostics.ts --commit-count=3 --include-workspace --reset-db --full-report`

## Supported Languages

- PHP
- TypeScript/JavaScript
- JavaScript (additional languages can be added)

## Development

### Building

```bash
npm run compile
npm run watch  # for development
```

### Testing

```bash
npm run test
```

### Adding Language Support

1. Add language to the supported list in `src/analysis/tree-sitter.ts`
2. Ensure the WASM file is available at `https://unpkg.com/tree-sitter-wasms/out/tree-sitter-<language>.wasm`
3. Run `npm run compile` to download the new WASM file

## API

### CLI Commands

- `ct analyze [count]` - Analyze last N commits
- `ct index [--reindex] [--modules <list>]` - Index commits (re-run analysis pipeline)
  - `--reindex` - Force reindex all commits
  - `--modules <list>` - Reindex specific modules (e.g., `--modules edges,symbols`)
- `ct staged` - Analyze staged changes
- `ct show <sha>` - Show commit analysis
- `ct symbol <name>` - Search symbol history
- `ct last [count]` - Show recent analyzed commits
- `ct install-hooks` - Install git hooks

**Note**: If you have a legacy database (pre-v2.0), run `ct index --reindex` to migrate edge data and fix the `edge_type` column.

### VS Code Commands

- `git-context.analyzeLastCommits`
- `git-context.analyzeStagedChanges`
- `git-context.compareFilesToCommit`
- `git-context.explainSymbolChange`

## Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `git-context.openRouterApiKey` | OpenRouter API key (not needed for Ollama) | - |
| `git-context.openRouterModel` | LLM model to use | `anthropic/claude-3-haiku:beta` |
| `git-context.apiEndpoint` | API endpoint URL (OpenRouter or Ollama) | `https://openrouter.ai/api/v1` |
| `git-context.difftasticPath` | Path to difftastic binary | auto-detect |
| `git-context.defaultCommitCount` | Default commits to analyze | 5 |

## Troubleshooting

### Common Issues

1. **"Difftastic binary not found"**
   - Install difftastic: `cargo install difftastic`
   - Or set path in settings: `git-context.difftasticPath`

2. **"OpenRouter API key not configured"**
   - Set `OPENROUTER_API_KEY` environment variable
   - Or configure in VS Code settings

3. **No commits showing in UI**
   - Run `ct analyze` to analyze commits first
   - Check that you're in a git repository

### Logs

Check VS Code developer console for extension logs and errors.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Credits

- [Tree-sitter](https://tree-sitter.github.io/) for code parsing
- [Difftastic](https://github.com/Wilfred/difftastic) for structural diffs
- [OpenRouter](https://openrouter.ai/) for LLM API
- [sql.js](https://github.com/sql-js/sql.js) for database
- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web) for WASM parsing
