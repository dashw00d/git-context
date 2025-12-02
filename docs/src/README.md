# Git Context - Source Directory Documentation

## Overview

The `src/` directory contains the complete implementation of the Git Context VS Code extension. This documentation provides detailed explanations of each module's purpose, architecture, and key components.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Git Context Extension                      │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Extension     │───▶│      Core       │───▶│     Analysis     │
│   (Entry Point) │    │   (App Shell)   │    │   (Pipeline)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Providers    │    │     State       │    │      Facts      │
│ (VS Code Views) │    │  (Redux Store)  │    │ (Detection)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Webview      │    │    Services     │    │    Metrics      │
│ (React UI)      │    │ (Business Logic)│    │ (Calculators)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Storage      │    │      CLI        │    │     Utils       │
│  (Database)     │    │   (Commands)    │    │  (Utilities)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Module Categories

### Core Infrastructure

- **[extension.md](extension.md)** - Extension entry point and activation
- **[core.md](core.md)** - Application shell and feature registration
- **[state.md](state.md)** - State management system
- **[storage.md](storage.md)** - Database schema and operations

### Analysis Engine

- **[analysis.md](analysis.md)** - Core analysis pipeline
- **[facts.md](facts.md)** - Fact detection system

### User Interface

- **[webview.md](webview.md)** - React UI components
- **[providers.md](providers.md)** - VS Code tree views

### Business Logic

- **[services.md](services.md)** - Business logic services
- **[llm.md](llm.md)** - LLM integration

### Supporting Modules

- **[cli.md](cli.md)** - Command-line interface
- **[commands.md](commands.md)** - VS Code commands
- **[features.md](features.md)** - Feature registration
- **[utils.md](utils.md)** - Utility functions
- **[types.md](types.md)** - Type definitions
- **[contracts.md](contracts.md)** - Interface contracts
- **[watchers.md](watchers.md)** - Git watchers
- **[liveTracker.md](liveTracker.md)** - Live change tracking

## Key Architectural Patterns

This codebase follows several key architectural patterns:

- **Pipeline Pattern**: Complex operations broken into discrete steps with dependency management
- **Action/Reducer/Effects Pattern**: Redux-style state management with clear separation of concerns
- **Tiered Loading Pattern**: Progressive data loading with graceful degradation
- **Service Layer Pattern**: Business logic encapsulated in service classes
- **Statement Wrapper Pattern**: All database access goes through a wrapper for consistency

For detailed information about these patterns, see [architecture-patterns.md](architecture-patterns.md).

## Development Workflow

1. **Extension Activation** → `extension.ts`
2. **Feature Registration** → `core/appShell.ts`
3. **State Management** → `state/store.ts`
4. **Analysis Requests** → `webview/cockpit/services/AnalysisController.ts`
5. **Pipeline Execution** → `analysis/refactorPipeline.ts`
6. **Fact Detection** → `facts/` modules
7. **UI Updates** → `webview/cockpit/components/`

## Navigation

Use the links above to explore each module's documentation, or see the [Architecture Patterns](architecture-patterns.md) document for cross-cutting concerns and design principles.
