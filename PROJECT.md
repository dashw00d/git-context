# Git Context Plugin - Project Documentation

## Overview

Git Context is a VS Code extension that provides intelligent analysis of Git commits, refactoring patterns, and code evolution. It helps developers understand refactor completeness, identify technical debt, and make data-driven decisions about code quality.

## Recent Changes

### Value-Focused LLM Analysis (Latest)

The LLM analysis system has been redesigned to prioritize high-value insights over generic information. Key improvements:

#### Value Scoring System
- **Block Value Calculation**: Each analysis block is scored based on:
  - Claim severity (critical=10, high=5, medium=2, low=1) weighted by confidence
  - Action priority/effort ratio (urgent + low effort = high value)
  - Risk factors (low-risk actions get 1.5x multiplier)
  - Actionability bonus (has evidence paths = 1.2x multiplier)
- **Health Score**: Calculates refactor health (0-100) based on issue rate and critical problems
- **Smart Sorting**: Blocks sorted by value score (descending), not just type

#### Enhanced Executive Summary
- Extracts top 3 critical claims and top 5 immediate actions
- Shows most critical finding prominently
- Displays refactor health score with visual indicator (✅/⚠️/🔴)
- Provides quick stats (commits, symbols, issues, high-priority actions)

#### Value-Focused Prompts
- **Intent & Story**: Asks for SINGLE most important insight first
- **Drift Verification**: Emphasizes real issues vs false positives, prioritizes high-severity findings
- **Cleanup Plan**: Orders by value (priority/effort ratio), groups high-value actions first

#### Filtering and Rendering
- Filters out low-value content:
  - Claims: Exclude low severity unless confidence >= 0.8
  - Actions: Exclude low priority unless (xs effort AND low risk)
- Value-based rendering:
  - Critical/high claims in "Critical Findings" section first
  - Urgent/high actions in "Immediate Actions" section first
  - High Value badge for blocks with score > 20
  - Evidence limited to top 5 per claim/action

#### Health Score Integration
- Calculated during analysis generation
- Stored in `LlmAnalysis.metadata.healthScore`
- Displayed in report header and footer
- Visual indicators: ✅ (>=80), ⚠️ (60-79), 🔴 (<60)

## Architecture

### Core Components

#### 1. Commit Tracker Sidebar (`src/ui/commitTracker.ts`)

The main UI component that displays commits, workspace state, and refactor bundles.

**Key Features:**
- **Workspace State Selector**: Filter analysis scope (Full/Staged/Unstaged)
- **Commit Selection**: Select commits for bundle analysis
- **Bundle Display**: Shows refactor bundle with 5 categories:
  - Net Effect vs Working Tree
  - Incompleteness (missing symbols, zombies)
  - Pattern Drift (hotspots, mixed targets)
  - Legacy Audit (dead code, replaced leftovers)
  - Timeline Rewind (commit evolution)
- **Deep Drilldowns**: Expand categories to see files → symbols → evidence
- **Action Buttons**: Contextual buttons on nodes (copy, diff, LLM context, scroll to MD)

**State Management:**
- `selectedCommits`: Set of commit SHAs selected for bundle
- `workspaceParts`: Set<'staged' | 'unstaged'> - controls workspace scope
- `lastBundleFacts`: Latest refactor bundle facts JSON
- Persisted to VS Code workspace state

**Performance Optimizations:**
- Caching: Commit summaries and info cached to avoid repeated DB queries
- Batch Loading: Multiple commits loaded in single query
- Lazy Loading: Children computed on expand, "Load more..." nodes for long lists

#### 2. LLM Analyst (`src/analysis/llmAnalyst/`)

Analyzes refactor bundle facts using LLM to generate insights.

**Analysis Pipeline:**
1. **Intent & Story**: Understands what refactor was attempting
2. **Drift Verification**: Validates incompleteness/drift flags (real issues vs false positives)
3. **Cleanup Plan**: Produces ordered checklist of deletions/migrations needed
4. **Pattern Discovery** (optional): Scans raw AST/diff/graph for emergent patterns

**Value Prioritization:**
- Blocks scored by value (severity × confidence + priority/effort ratio)
- High-value blocks appear first
- Low-value content filtered out
- Executive summary highlights top insights

**Output:**
- Structured `LlmAnalysis` with blocks, claims, actions
- Markdown report with clickable evidence links
- Health score (0-100) indicating refactor completeness

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

Runs various analyses on the codebase:

- **Drift Analysis** (`drift.ts`): Detects pattern inconsistencies
- **Legacy Audit** (`legacy.ts`): Finds dead code and replaced leftovers
- **Symbol Extraction** (`symbols.ts`): Extracts symbols from AST
- **Git Operations** (`git.ts`): Git commands wrapper
- **AST Serialization** (`astSerializer.ts`): Converts code to AST JSON

#### 5. Report Generation (`src/ui/report.ts`)

Generates the refactor bundle report.

**Process:**
1. Compute scope (respects workspaceParts filter)
2. Analyze intended state (from commits)
3. Analyze working state (from workspace)
4. Detect drift (incompleteness, pattern inconsistencies)
5. Audit legacy code (dead symbols, replaced leftovers)
6. Assemble facts JSON
7. Run LLM analysis on facts
8. Generate markdown report with stable anchors
9. Update debt meter
10. Open report in editor

**Markdown Features:**
- Stable anchors for navigation (`{#anchor-id}`)
- Findings sections with top items
- LLM analysis blocks sorted by value
- Clickable evidence links

#### 6. Debt Meter (`src/ui/refactorDebtMeter.ts`)

Status bar item showing refactor debt metrics.

**Features:**
- Displays debt percentage and breakdown (zombies, drift, dead code)
- Color-coded by debt level
- Click refreshes tree and reveals bundle
- Auto-refreshes when facts file changes

**Integration:**
- Wired to commit tracker for tree refresh
- File watcher monitors facts file for updates
- Shows coverage metrics from LLM analysis

### Data Flow

```
User selects commits
    ↓
Commit Tracker updates selectedCommits
    ↓
User clicks "Generate Report"
    ↓
Report Generation:
  1. Compute scope (with workspaceParts filter)
  2. Analyze intended state (from commits)
  3. Analyze working state (from workspace)
  4. Detect drift & legacy issues
  5. Assemble facts JSON
  6. Run LLM analysis (value-focused)
  7. Generate markdown report
    ↓
Facts saved to .git/commit-tracker/last-bundle-facts.json
    ↓
Debt meter updates
    ↓
Commit tracker refreshes with latest facts
    ↓
Tree view shows bundle with drilldowns
```

### Key Concepts

#### Workspace as Root/Base

**IMPORTANT**: The workspace (current working directory state) is the ROOT/BASE for all comparisons, NOT HEAD.

- **Workspace** = Current state of files (staged and/or unstaged) - this is the baseline
- **HEAD** = Just another commit in the history - no special status
- Workspace is always available for comparison
- Any commit can be compared against workspace or other commits
- Comparisons respect `workspaceParts` filter (staged/unstaged/full)

#### Value-Based Prioritization

The system prioritizes information by value:

1. **High-Value Blocks**: Critical/high severity claims, urgent/high priority actions with low effort
2. **Health Score**: Overall refactor completeness (0-100)
3. **Filtering**: Low-value content (low severity/priority) filtered out unless high confidence
4. **Sorting**: Blocks sorted by value score, not just type

#### Evidence Linking

All claims and actions link to specific evidence:
- JSON paths in facts (e.g., `findings.incompleteness.missing[0]`)
- Clickable links that open evidence viewer
- File paths and line numbers when available
- Symbol IDs for navigation

### File Structure

```
src/
├── ui/
│   ├── commitTracker.ts      # Main sidebar tree view
│   ├── commands.ts           # VS Code command handlers
│   ├── report.ts             # Report generation pipeline
│   ├── refactorDebtMeter.ts  # Status bar debt meter
│   └── evidenceProvider.ts   # Evidence viewer provider
├── analysis/
│   ├── llmAnalyst/           # LLM analysis system
│   │   ├── runner.ts         # Analysis pipeline
│   │   ├── renderer.ts       # Markdown rendering
│   │   ├── prompts.ts        # LLM prompts
│   │   └── blocks.ts         # Data structures
│   ├── drift.ts              # Pattern drift detection
│   ├── legacy.ts             # Legacy code audit
│   ├── symbols.ts            # Symbol extraction
│   ├── git.ts                # Git operations
│   └── astSerializer.ts      # AST serialization
├── facts/
│   ├── scope.ts              # Scope computation
│   ├── factsAssembler.ts     # Facts assembly
│   └── types.ts              # Type definitions
├── storage/
│   └── database.ts           # SQLite database for commits
└── utils/
    └── config.ts             # Configuration utilities
```

### Commands

Key VS Code commands:

- `git-context.toggleCommitSelection` - Toggle commit selection for bundle
- `git-context.generateReport` - Generate refactor bundle report
- `git-context.toggleWorkspaceFull` - Toggle full workspace state
- `git-context.toggleWorkspacePart` - Toggle staged/unstaged parts
- `git-context.compareCommits` - Compare two commits
- `git-context.compareWorkspaceVsCommit` - Compare workspace vs commit
- `git-context.scrollToMDSection` - Navigate to markdown section
- `git-context.refreshDebtMeterAndReveal` - Refresh tree and reveal bundle

### Performance Considerations

- **Caching**: Commit summaries and info cached to avoid repeated DB queries
- **Batch Loading**: Multiple commits loaded in single query
- **Lazy Loading**: Children computed on expand, "Load more..." nodes for long lists
- **Filtering**: Low-value content filtered out before rendering
- **Debouncing**: File watchers debounced to avoid excessive refreshes

### Future Improvements

Potential areas for enhancement:

1. **Incremental Analysis**: Only re-analyze changed files
2. **Pattern Learning**: Learn from user corrections to improve prompts
3. **Custom Value Weights**: Allow users to customize value scoring
4. **Export Formats**: Export reports to other formats (JSON, HTML)
5. **Integration**: Integrate with other VS Code extensions
6. **Real-time Updates**: Update analysis as code changes

