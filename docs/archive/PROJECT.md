# Git Context Plugin - Project Documentation

## Overview

Git Context is a comprehensive VS Code extension that provides intelligent analysis of Git commits, refactoring patterns, and code evolution through a modern webview-based UI called the "Cockpit". It combines static analysis with LLM-powered insights to help developers understand refactor completeness, identify technical debt, track symbol evolution, and make data-driven decisions about code quality.

The extension features a rich Cockpit interface with live analysis capabilities, persistent report management, and a command-line interface for automation. It analyzes code using Tree-sitter for precise symbol extraction and Difftastic for structural diffs, then applies LLM analysis to generate actionable insights about refactoring progress and code health.

## Recent Changes

### Cockpit UI and State Management (Latest)

The extension has been completely redesigned with a modern webview-based "Cockpit" interface that provides a unified, real-time view of all Git context analysis. Key architectural improvements:

#### Cockpit Webview Interface
- **Unified UI**: Single webview panel replacing multiple tree views with accordion-style sections
- **Real-time Updates**: Live synchronization between VS Code and webview through message passing
- **Responsive Design**: Modern React-based UI with collapsible sections and contextual actions
- **State Orchestrator**: Centralized state management with debounced updates and single source of truth

#### Live Analysis Capabilities
- **Real-time Tracking**: Continuous analysis of workspace changes with live diff tracking
- **Incremental Updates**: Efficient analysis of only changed files/symbols
- **Live Diff Viewer**: Real-time visualization of pending changes and their impact
- **Status Monitoring**: Live status indicators for analysis progress and pending changes

#### Enhanced Report Management
- **Persistent Reports**: Saved analysis reports with metadata (branch, creation date, pins)
- **Report Browser**: Filter and search through historical reports
- **Export Capabilities**: JSON export for LLM context and external tools
- **Report Comparison**: Side-by-side comparison of different analysis reports

#### Command-Line Interface (CLI)
- **Analysis Automation**: CLI tools for automated analysis workflows
- **Batch Processing**: Process multiple commits or workspaces from command line
- **Integration Hooks**: Git hooks and CI/CD integration capabilities
- **Query Interface**: Programmatic access to analysis data and results

## Architecture

### Core Components

#### 1. Cockpit Webview (`src/webview/cockpit/`)

The main UI component providing a unified webview interface for all Git context analysis and management.

**Key Features:**
- **Accordion Sections**: Five main sections (Commits, Bundle, Symbols, Reports, Live Analysis)
- **Real-time Synchronization**: Bidirectional message passing between VS Code host and webview
- **Contextual Actions**: Dynamic action buttons based on current selections and state
- **Responsive Design**: Modern React-based UI with collapsible panels and status indicators
- **State Orchestrator Integration**: Centralized state management with debounced updates

**Sections:**
- **Commits**: Browse, filter, and select commits for analysis
- **Bundle**: View active refactor bundle with drilldown capabilities
- **Symbols**: Track symbol evolution and history across commits
- **Reports**: Browse, filter, and manage saved analysis reports
- **Live Analysis**: Monitor real-time workspace changes and analysis status

#### 2. State Orchestrator (`src/state/cockpitOrchestrator.ts`)

Centralized state management system that maintains the single source of truth for the Cockpit UI.

**Key Features:**
- **Singleton Pattern**: Single orchestrator instance shared across the extension
- **Debounced Updates**: Batches and debounces state changes to prevent UI thrashing
- **Event-driven Architecture**: Emits state change events for UI synchronization
- **Metrics Calculation**: Computes derived metrics like debt scores and symbol counts
- **Partial Updates**: Supports efficient partial state updates with change tracking

**State Structure:**
- **Global Context**: Repository name, branch, workspace scope
- **Analysis Status**: Current analysis progress, errors, and step tracking
- **Selections**: Commit SHAs, staged/unstaged paths, file selections
- **Bundle Data**: Active bundle facts and summary information
- **UI State**: Active sections, filters, and user preferences

#### 3. Data Providers (`src/providers/`)

Modular data providers that encapsulate data access and business logic.

**Provider Types:**
- **CommitsProvider**: Manages commit data, selection, and database operations
- **ActiveBundleProvider**: Handles refactor bundle facts and analysis results
- **SymbolHistoryProvider**: Tracks symbol evolution and change history

**Key Features:**
- **Database Integration**: SQLite-backed persistent storage for commits and analysis
- **Lazy Loading**: On-demand data loading with caching and batch operations
- **Change Notifications**: VS Code tree data provider interface for UI updates
- **Export DTOs**: Clean data transfer objects for cockpit state synchronization

#### 3. Facts Assembly (`src/facts/`)

Assembles structured JSON facts from analysis results.

**Key Components:**
- **Scope Computation** (`scope.ts`): Determines which files/symbols are in scope
  - Respects `workspaceParts` filter (staged/unstaged/full)
  - Includes commit files, working tree changes, blast radius neighbors
- **Facts Assembler** (`factsAssembler.ts`): Combines all analysis results into `RefactorBundleFacts`
- **Types** (`types.ts`): TypeScript interfaces for facts structure

**Facts Structure:**
```typescript
{
  bundle: { shas, oldestSha, newestSha },
  intended: { present, absent },
  working: { symbols, edges },
  findings: {
    incompleteness: { missing, zombies, divergent },
    patternDrift: { mixedTargets, oldNamespaces },
    legacyAudit: { dead, replacedLeftovers }
  },
  evidence: { /* detailed evidence arrays */ }
}
```

#### 4. Analysis Pipeline (`src/analysis/`)

Comprehensive analysis system combining static analysis with LLM-powered insights.

**Core Analysis Components:**
- **AST Analysis** (`astSerializer.ts`): Tree-sitter powered AST extraction and serialization
- **Symbol Extraction** (`symbols.ts`): Precise symbol identification and metadata extraction
- **Semantic Analysis** (`semanticChanges.ts`): Understanding of code changes and their meaning
- **Dependency Analysis** (`dependencies.ts`): Import/export relationship mapping
- **Convention Analysis** (`namingConventions.ts`, `conventionEnhancements.ts`): Code style and pattern detection

**Specialized Analyses:**
- **Drift Detection** (`drift.ts`): Pattern inconsistency identification
- **Legacy Auditing** (`legacy.ts`): Dead code and deprecated pattern detection
- **Live Analysis** (`liveAnalysis.ts`): Real-time workspace change tracking
- **Heuristics** (`heuristics.ts`): Rule-based analysis for common patterns

**LLM Integration:**
- **LLM Analyst** (`llmAnalyst/`): Generates insights from analysis facts
- **Context Export** (`contextExporter.ts`): Prepares data for LLM consumption
- **Mermaid Generation** (`mermaidGenerator.ts`): Visual diagram creation for reports

#### 5. Services Layer (`src/services/`)

Business logic services that orchestrate complex operations.

**Key Services:**
- **Report Service**: Manages report generation, storage, and retrieval
- **Analysis Pipeline Service**: Coordinates multi-stage analysis workflows
- **Database Service**: Handles all SQLite database operations and migrations

**Features:**
- **Asynchronous Operations**: Non-blocking analysis with progress tracking
- **Error Handling**: Comprehensive error recovery and user feedback
- **Caching**: Intelligent caching of analysis results and metadata
- **Batch Processing**: Efficient handling of multiple commits/files

#### 6. CLI Interface (`src/cli/`)

Command-line interface for automated analysis and integration workflows.

**Key Components:**
- **Analysis CLI** (`analyze.ts`): Programmatic analysis execution
- **Query Interface** (`queries.ts`): Data querying and export capabilities
- **Git Hooks** (`hooks.ts`): Automated analysis triggers
- **Index** (`index.ts`): Main CLI entry point and command routing

**Features:**
- **Batch Processing**: Analyze multiple commits or workspaces
- **Export Formats**: JSON, CSV, and other data formats
- **Integration Hooks**: Git hooks and CI/CD pipeline integration
- **Scripting Support**: Programmatic access for automation scripts

### Data Flow

```
User interacts with Cockpit UI
    ↓
Cockpit sends message to VS Code host
    ↓
State Orchestrator updates state
    ↓
Providers fetch/update data from database
    ↓
Analysis triggered (manual or automatic)
    ↓
Analysis Pipeline:
  1. Scope computation (workspace/staged/unstaged)
  2. Static analysis (AST, symbols, dependencies)
  3. Semantic analysis (changes, patterns, drift)
  4. LLM analysis (insights, recommendations)
  5. Report generation (facts + LLM analysis)
    ↓
Report Service saves to database
    ↓
State Orchestrator notified of changes
    ↓
Cockpit UI updates in real-time
    ↓
Live Analysis tracks ongoing changes
```

### Key Concepts

#### Cockpit State Management

**Centralized State**: The Cockpit Orchestrator maintains the single source of truth for all UI state.

- **Singleton Pattern**: One orchestrator instance coordinates all state changes
- **Debounced Updates**: State changes are batched and debounced to prevent performance issues
- **Event-Driven**: State changes emit events for UI synchronization
- **Derived Metrics**: Automatic calculation of metrics like debt scores and symbol counts
- **Partial Updates**: Efficient partial state updates with change tracking

#### Workspace as Analysis Baseline

The workspace serves as the foundation for all analysis comparisons:

- **Workspace Scope**: Analysis can be limited to staged, unstaged, or full workspace
- **Real-time Tracking**: Live analysis monitors workspace changes continuously
- **Flexible Comparisons**: Any commit can be compared against workspace state
- **Incremental Analysis**: Only changed files/symbols are re-analyzed when possible

#### Live Analysis Architecture

**Continuous Monitoring**: Real-time analysis of workspace changes and their impact.

- **Change Tracking**: Monitors file modifications, additions, and deletions
- **Symbol Impact**: Tracks how changes affect symbols and their relationships
- **Progressive Updates**: Analysis results update incrementally as changes occur
- **Status Indicators**: Live status showing analysis progress and pending changes
- **Non-blocking**: Analysis runs in background without blocking user interactions

#### Evidence-Based Insights

All analysis results are backed by specific, actionable evidence:

- **Structured Facts**: JSON-based facts structure with precise evidence paths
- **Interactive Navigation**: Clickable links to source code locations
- **Symbol Resolution**: Direct navigation to affected symbols and functions
- **Context Preservation**: Evidence maintains full context for understanding changes

### File Structure

```
src/
├── webview/                  # React-based webview UIs
│   ├── cockpit/              # Main cockpit interface
│   │   ├── CockpitProvider.ts # Webview provider
│   │   ├── components/       # React components
│   │   └── index.tsx         # Main cockpit app
│   ├── reports/              # Report viewing webviews
│   └── styles.css            # Shared styles
├── providers/                # Data providers
│   ├── activeBundleProvider.ts   # Bundle data management
│   ├── commitsProvider.ts        # Commit data management
│   └── symbolHistoryProvider.ts  # Symbol history tracking
├── state/                    # State management
│   └── cockpitOrchestrator.ts    # Centralized state orchestrator
├── services/                 # Business logic services
│   └── reportService.ts      # Report management
├── analysis/                 # Analysis pipeline
│   ├── llmAnalyst/           # LLM analysis system
│   ├── astSerializer.ts      # AST processing
│   ├── symbols.ts            # Symbol extraction
│   ├── semanticChanges.ts    # Change analysis
│   ├── dependencies.ts       # Dependency analysis
│   ├── liveAnalysis.ts       # Real-time analysis
│   └── pipeline.ts           # Analysis orchestration
├── cli/                      # Command-line interface
│   ├── analyze.ts            # Analysis commands
│   ├── queries.ts            # Query operations
│   ├── hooks.ts              # Git hooks integration
│   └── index.ts              # CLI entry point
├── commands/                 # VS Code commands
│   └── commands.ts           # Command registrations
├── facts/                    # Facts assembly
│   ├── scope.ts              # Scope computation
│   ├── factsAssembler.ts     # Facts assembly
│   └── types.ts              # Type definitions
├── types/                    # TypeScript type definitions
│   ├── cockpit.ts            # Cockpit-specific types
│   └── index.ts              # Shared types
├── storage/                  # Database and persistence
│   └── database.ts           # SQLite database management
├── utils/                    # Utility functions
│   ├── config.ts             # Configuration management
│   ├── logger.ts             # Logging utilities
│   └── workspace.ts          # Workspace utilities
├── contracts/                # Data contracts
│   ├── llmContext.ts         # LLM context definitions
│   └── treeNodes.ts          # Tree node contracts
└── extension.ts              # Main extension entry point
```

### Commands

Key VS Code commands available through the extension:

**Analysis Commands:**
- `git-context.analyzeLastCommits` - Analyze last N commits and generate report
- `git-context.analyzeStagedChanges` - Analyze staged changes
- `git-context.analyzeUnstagedChanges` - Analyze unstaged changes
- `git-context.generateReport` - Generate refactor bundle report

**Report Management:**
- `git-context.openReport` - Open a saved report
- `git-context.deleteReport` - Delete a saved report
- `git-context.togglePinReport` - Pin/unpin a report

**Selection & Navigation:**
- `git-context.toggleCommitSelection` - Toggle commit selection for bundle
- `git-context.clearSelection` - Clear current selection
- `git-context.toggleBranchFilter` - Toggle branch filter

**Bundle Operations:**
- `git-context.bundle.regenerate` - Regenerate active bundle
- `git-context.bundle.clear` - Clear active bundle
- `git-context.bundle.cancel` - Cancel analysis in progress

### Performance Considerations

- **State Orchestrator**: Centralized state management with debounced updates prevents UI thrashing
- **Database Caching**: SQLite-backed storage with efficient querying and indexing
- **Lazy Loading**: On-demand data loading with pagination for large datasets
- **Batch Processing**: Multi-commit analysis with progress tracking and cancellation
- **Incremental Updates**: Live analysis tracks only changed files/symbols
- **Webview Optimization**: React-based UI with efficient virtual scrolling and memoization

### Future Improvements

Potential areas for enhancement:

1. **Enhanced LLM Integration**: Support for multiple LLM providers and custom model configurations
2. **Advanced Pattern Recognition**: Machine learning-based pattern detection and suggestions
3. **Collaborative Features**: Shared analysis reports and team collaboration tools
4. **Custom Analysis Rules**: User-configurable analysis rules and heuristics
5. **Performance Profiling**: Built-in performance analysis and optimization suggestions
6. **Multi-repository Support**: Cross-repository analysis and dependency tracking

