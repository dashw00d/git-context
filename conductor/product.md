# Initial Concept

Git Context is a VS Code extension and CLI tool for deep commit intelligence, using Tree-sitter and Difftastic to analyze history and LLMs to provide insights.

## Vision
To provide developers and teams with deep, semantic intelligence into their git history, transforming raw diffs into actionable insights. Git Context bridges the gap between low-level code changes and high-level architectural understanding by leveraging structural parsing and LLMs.

## Target Audience
- **Individual Developers:** To better understand their own evolution and quickly recall context.
- **Tech Leads & Architects:** To monitor architectural drift, track migrations, and identify risky changes early.
- **Open-Source Maintainers:** To manage complex contributions and generate meaningful changelogs.

## Primary Goals
- **Risk & Drift Detection:** Automatically identify breaking changes, security vulnerabilities, and deviations from architectural intent.
- **Enhanced Code Review:** Provide deep context on the *how* and *why* of changes to improve review quality and speed.
- **Time-Travel Exploration:** Offer an intuitive UI for exploring the codebase's evolution, allowing users to ask scoped questions to an LLM.
- **Efficient Agent Integration:** Provide an MCP server that allows LLM agents to access historical context without overwhelming their context windows.

## Key Features
- **The Cockpit:** A centralized dashboard for visualizing recent activity, hotspots, and risk scores.
- **MCP Server:** A toolset for external AI agents to query symbol history, structural diffs, and dependency graphs.
- **Semantic Search & Chat:** Ask questions about the codebase at any scope, with context retrieved from a vector database (Qdrant).
- **Automated Risk Scoring:** Heuristics-based scoring for commits to highlight significant or potentially dangerous modifications.
