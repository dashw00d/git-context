# Analysis Module (`analysis/`)

## Purpose

The `analysis/` module is the core engine of Git Context, responsible for analyzing commits, workspace changes, and generating intelligence about code evolution. It implements a sophisticated pipeline architecture that processes commits through multiple stages to extract symbols, detect patterns, and generate LLM-powered insights.

## Key Components

### Pipeline System (`runner/`)

The analysis pipeline is built around a dependency-based execution model with parallel processing capabilities.

#### Pipeline Runner (`pipelineRunner.ts`)

```typescript
export async function runPipeline(
  steps: PipelineStep[],
  initialState: PipelineState,
  onEvent?: PipelineEventHandler,
  config?: PipelineConfig
): Promise<PipelineState>;
```

**Features:**

- **Dependency Resolution**: Topological sorting of steps based on dependencies
- **Parallel Execution**: Steps within the same dependency level run concurrently
- **Best-Effort Mode**: Pipeline continues on individual step failures
- **Event System**: Comprehensive event logging for monitoring and debugging
- **Caching**: Intelligent caching to avoid redundant computation

#### Pipeline Types (`pipelineTypes.ts`)

**Core Interfaces:**

```typescript
interface PipelineState {
  selectedCommitShas: string[];
  includeWorkspace: boolean;
  workspaceParts?: Set<'staged' | 'unstaged'>;
  explicitTimeline?: string[];
  liveOverrides?: Map<string, string>;

  // Intermediate results
  commitFacts?: any[];
  workspaceFacts?: { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null };
  bundleFacts?: any;
  history?: any;
  llmOutputs?: any;

  // Analysis results
  scope?: ScopeSet;
  intended?: Map<string, IntendedState>;
  working?: WorkingSnapshot;
  drift?: DriftFindings;
  legacy?: LegacyAuditResult;
  hotspots?: Hotspot[];
  movedBlocks?: MovedBlock[];

  // Performance tracking
  stepTimings?: Record<string, { start: number; end?: number; duration?: number }>;
  errors: Array<{ stepId: string; error: unknown }>;
  partialReasons?: string[];
}
```

### Pipeline Steps (`runner/steps/`)

The pipeline consists of 13 discrete steps, each handling a specific aspect of analysis:

#### 1. Index Commits Step (`indexCommitsStep.ts`)

```typescript
export function createIndexCommitsStep(
  commitIndexer: CommitIndexer,
  concurrency: number = 8
): PipelineStep;
```

- **Purpose**: Extract symbols and diffs from commits using Tree-sitter + Difftastic
- **Concurrency**: Configurable parallel processing (default: 8 commits)
- **Output**: `commitFacts[]` with symbol changes, diffs, and metadata

#### 2. Scope Step (`scopeStep.ts`)

```typescript
export function createScopeStep(): PipelineStep;
```

- **Purpose**: Calculate scope (files + blast radius neighbors)
- **Output**: `ScopeSet` defining which files to analyze

#### 3. Intended Step (`intendedStep.ts`)

```typescript
export function createIntendedStep(): PipelineStep;
```

- **Purpose**: Reconstruct intended state from commit history patterns
- **Output**: `Map<symbol, IntendedState>` of expected present/absent symbols

#### 4. Working Step (`workingStep.ts`)

```typescript
export function createWorkingStep(): PipelineStep;
```

- **Purpose**: Snapshot current workspace symbols
- **Output**: `WorkingSnapshot` with current symbol state

#### 5. Drift Step (`driftStep.ts`)

```typescript
export function createDriftStep(): PipelineStep;
```

- **Purpose**: Detect drift (missing/zombie/divergent symbols & edges)
- **Output**: `DriftFindings` with unresolved callers and convention drift

#### 6. Legacy Step (`legacyStep.ts`)

```typescript
export function createLegacyStep(): PipelineStep;
```

- **Purpose**: Audit legacy code (dead symbols, replaced leftovers)
- **Output**: `LegacyAuditResult` with legacy usage patterns

#### 7. Hotspot Step (`hotspotStep.ts`)

```typescript
export function createHotspotStep(): PipelineStep;
```

- **Purpose**: Calculate code hotspots from commit frequency
- **Output**: Top 25 file/symbol hotspots with scores

#### 8. Moved Block Step (`movedBlockStep.ts`)

```typescript
export function createMovedBlockStep(): PipelineStep;
```

- **Purpose**: Detect moved code blocks using DNA + location analysis
- **Output**: Top 50 moved blocks with similarity scores

#### 9. Bundle Facts Step (`bundleFactsStep.ts`)

```typescript
export function createBundleFactsStep(): PipelineStep;
```

- **Purpose**: Assemble all facts into cohesive bundle with incompleteness detection
- **Output**: `RefactorBundleFacts` with pattern drift and legacy summaries

#### 10. Embedding Step (`embeddingStep.ts`)

```typescript
export function createEmbeddingStep(): PipelineStep;
```

- **Purpose**: Generate vector embeddings for semantic search
- **Output**: Qdrant vector storage for similar commit retrieval

#### 11. History Step (`historyStep.ts`)

```typescript
export function createHistoryStep(): PipelineStep;
```

- **Purpose**: Retrieve similar past commits/symbols using embeddings
- **Output**: Historical context for LLM analysis

#### 12. Story Step (`storyStep.ts`)

```typescript
export function createStoryStep(): PipelineStep;
```

- **Purpose**: Generate LLM-powered intent, drift verification, and cleanup plans
- **Output**: Markdown reports with actionable insights

#### 13. Workspace Overlay Step (`workspaceStep.ts`)

```typescript
export function createWorkspaceOverlayStep(): PipelineStep;
```

- **Purpose**: Include workspace changes in analysis when `includeWorkspace=true`
- **Output**: `workspaceFacts` merged with commit analysis

### Core Analysis Components

#### Refactor Pipeline (`refactorPipeline.ts`)

Main orchestrator that assembles and executes the analysis pipeline:

```typescript
export class RefactorPipeline {
  async analyze(options: {
    selectedCommitShas: string[];
    includeWorkspace?: boolean;
    workspaceParts?: Set<'staged' | 'unstaged'>;
  }): Promise<RefactorBundleFacts> {
    // Build timeline, execute pipeline, return results
  }
}
```

#### Commit Indexer (`commitIndexer.ts`)

Handles the heavy lifting of commit analysis:

```typescript
export class CommitIndexer {
  async ensureCommitsIndexed(shas: string[], concurrency: number): Promise<CommitFact[]> {
    // Parallel commit processing with Tree-sitter + Difftastic
  }
}
```

#### Tree-sitter Integration (`tree-sitter.ts`)

Language-aware symbol extraction:

```typescript
export async function extractSymbols(content: string, languageId: string): Promise<SymbolInfo[]> {
  // Parse code with appropriate language grammar
}
```

#### Difftastic Integration (`difftastic.ts`)

Structural diff analysis:

```typescript
export function runDifftastic(
  oldContent: string,
  newContent: string,
  filename: string
): DiffResult {
  // Generate structural diffs beyond line-based comparison
}
```

#### Symbol DNA (`symbolDna.ts`)

Stable symbol identification:

```typescript
export function calculateSymbolDna(symbol: SymbolInfo): string {
  // Hash based on kind + signature + body shape (survives renames/moves)
}
```

### Detectors (`detectors/`)

#### Base Detector (`BaseDetector.ts`)

Abstract base class for all detection algorithms:

```typescript
export abstract class BaseDetector<TInput, TOutput> {
  abstract detect(input: TInput): Promise<TOutput>;

  protected logDetection(description: string, result: TOutput): void {
    // Consistent logging across detectors
  }
}
```

### Specialized Detectors

#### Hotspot Detector (`hotspotDetector.ts`)

Identifies frequently changing code:

```typescript
export class HotspotDetector {
  async detectHotspots(commitFacts: CommitFact[]): Promise<Hotspot[]> {
    // Score files/symbols by change frequency and recency
  }
}
```

#### Moved Block Detector (`movedBlockDetector.ts`)

Finds code that has been relocated:

```typescript
export class MovedBlockDetector {
  async detectMovedBlocks(facts: CommitFact[]): Promise<MovedBlock[]> {
    // Compare removed/added blocks via DNA + location proximity
  }
}
```

### LLM Integration (`llmAnalyst/`)

#### LLM Analyst Runner (`runner.ts`)

Multi-pass LLM analysis:

```typescript
export class LlmAnalystRunner {
  async generateAnalysis(context: LlmContext): Promise<LlmAnalysis> {
    // Intent detection → Drift verification → Cleanup planning
  }
}
```

#### Context Renderer (`renderer.ts`)

Formats code context for LLM consumption:

```typescript
export class ContextRenderer {
  renderBundleContext(bundleFacts: RefactorBundleFacts): string {
    // Convert facts to LLM-readable format with token budgeting
  }
}
```

### Live Analysis (`liveAnalysis.ts`)

Real-time incremental analysis for live coding:

```typescript
export class LiveAnalysisEngine {
  constructor(liveTracker: LiveDiffTracker, orchestrator: CockpitOrchestrator) {}

  async analyzeLiveChanges(changes: LiveChange[]): Promise<LiveAnalysisResult> {
    // Incremental drift/legacy detection with workspace overrides
  }
}
```

## Architecture

### Pipeline Execution Flow

```
Input Selection → Timeline Building → Step Execution → Result Assembly

Timeline Building:
├── Build Explicit Timeline (workspace → commits)
├── Resolve Dependencies
└── Create Execution Levels

Step Execution:
├── Parallel Processing (same level)
├── Dependency Ordering (across levels)
├── Error Collection (best-effort)
└── Progress Tracking

Result Assembly:
├── Bundle Facts Creation
├── Incompleteness Detection
└── Graceful Partial Fallback
```

### Caching Strategy

Multiple levels of caching for performance:

1. **Content Caching**: Commit hash-based caching
2. **Structural Caching**: Blob pair diff caching (TTL: 3600s)
3. **Result Caching**: Pipeline step result caching
4. **Embedding Caching**: Vector storage with similarity search

### Error Handling Philosophy

- **Best-Effort Execution**: Continue pipeline on step failures
- **Error Collection**: Log errors in `state.errors[]` array
- **Partial Results**: Return available data even when some steps fail
- **Incompleteness Tracking**: Mark bundle facts as partial with reasons

## Key Concepts

### Timeline Construction

Analysis operates on a timeline of code states:

```typescript
// Example timeline: newest → oldest
['workspace-unstaged', 'workspace-staged', 'HEAD', 'abc123', 'def456'];
```

### Symbol DNA Stability

Symbols are identified by stable DNA that survives renames/moves:

```typescript
// DNA components
{
  kind: 'function',
  signature: 'parseCode(content:string):SymbolInfo[]',
  bodyShape: 'hash_of_function_body_structure'
}
```

### Blast Radius Analysis

Scope calculation includes related files through dependency analysis:

```typescript
interface ScopeSet {
  allPaths: string[]; // All files in scope
  blastRadius: string[]; // Files with indirect dependencies
  directChanges: string[]; // Files directly changed
}
```

### Multi-Pass LLM Analysis

LLM processing follows structured phases:

1. **Intent Detection**: What was the developer trying to accomplish?
2. **Drift Verification**: Validate detected drift patterns
3. **Cleanup Planning**: Generate actionable next steps

## Dependencies

- **facts/** - Fact detection and state reconstruction
- **metrics/** - Metric calculation adapters
- **llm/** - LLM client and prompt management
- **storage/** - Database access for caching and persistence
- **utils/** - Logging, configuration, error handling
- **types/** - TypeScript type definitions

## Usage Examples

### Basic Pipeline Execution

```typescript
import { RefactorPipeline } from './analysis/refactorPipeline';

const pipeline = await getRefactorPipeline();
const results = await pipeline.analyze({
  selectedCommitShas: ['abc123', 'def456'],
  includeWorkspace: true,
  workspaceParts: new Set(['staged']),
});

console.log('Analysis complete:', results.bundleFacts);
```

### Custom Pipeline Configuration

```typescript
import { runPipeline } from './analysis/runner/pipelineRunner';

const steps = [createScopeStep(), createIntendedStep(), createWorkingStep(), createDriftStep()];

const result = await runPipeline(steps, initialState, eventHandler, {
  concurrency: 4,
  skipEmbedding: true,
  skipLLM: true,
});
```

### Live Analysis Integration

```typescript
import { LiveAnalysisEngine } from './analysis/liveAnalysis';

const liveEngine = new LiveAnalysisEngine(liveTracker, orchestrator);

// Handle live changes
liveTracker.on('changesUpdated', async data => {
  const analysis = await liveEngine.analyzeLiveChanges(data.changes);
  orchestrator.updateLiveState(analysis);
});
```

## Performance Characteristics

- **Concurrent Processing**: Up to 8 commits analyzed simultaneously
- **Intelligent Caching**: 3-6x speedup on repeated analysis
- **Incremental Updates**: Live analysis processes only changed portions
- **Memory Efficient**: Streaming processing for large codebases
- **Token Budgeting**: LLM context limited to ~12k tokens

## Related Documentation

- [Facts Module](facts.md) - Fact detection systems
- [Metrics Module](metrics.md) - Metric calculation adapters
- [LLM Module](llm.md) - LLM integration
- [Storage Module](storage.md) - Database and caching
- [Live Tracker](liveTracker.md) - Real-time change tracking
- [Pipeline Diagnostics](../benchmarks/pipeline_diagnostics.ts) - Testing and benchmarking
