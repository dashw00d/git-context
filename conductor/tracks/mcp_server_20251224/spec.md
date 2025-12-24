# Track Spec: Implement MCP Server

## Overview
This track implements a Model Context Protocol (MCP) server for `git-context`. This allows external AI agents (like Claude or other LLMs) to query the project's semantic git history, symbols, and structural diffs without needing to read the entire database or codebase into their context window.

## User Stories
- As a developer using an AI agent, I want the agent to understand the history of a specific function so it can safely refactor it.
- As a tech lead, I want an agent to analyze recent commits for breaking changes using semantic data.
- As an AI agent, I want to query relevant commit context on-demand to provide accurate answers about code evolution.

## Proposed Tools
- `get_commit_details`: Returns full analysis results for a specific commit SHA.
- `search_symbols`: Searches for symbols by name or pattern across the history.
- `get_symbol_history`: Returns a list of all changes made to a specific symbol over time.
- `get_structural_diff`: Returns a structural (Tree-sitter based) diff between two points in time for a file or symbol.
- `get_hotspots`: Returns frequently changed files or symbols (complexity/churn analysis).

## Technical Details
- **Protocol:** Model Context Protocol (MCP) over Standard I/O (stdio).
- **Library:** `@modelcontextprotocol/sdk` (or equivalent).
- **Integration:** The server should be launchable as a standalone process (CLI) or as part of the VS Code extension.
- **Data Source:** Interacts with the existing SQLite database via `DatabaseService` and other service layers.
