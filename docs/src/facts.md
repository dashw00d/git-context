# Facts Module (`facts/`)

## Purpose

The `facts/` module is responsible for detecting and reconstructing the "ground truth" about code evolution. It analyzes commit history to determine what symbols should be present (intended state), what is actually present (working state), and identifies discrepancies (drift). This forms the foundation for understanding refactoring intent and detecting legacy code.

## Key Components

### Scope Calculation (`scope.ts`)

Determines which files should be analyzed based on direct changes and dependency relationships.

```typescript
export interface ScopeSet {
  allPaths: string[]; // All files in scope
  blastRadius: string[]; // Files with indirect dependencies
  directChanges: string[]; // Files directly changed in selected commits
}

export async function calculateScope(commitShas: string[]): Promise<ScopeSet> {
  // Analyze commit changes + dependency graph to determine scope
}
```

**Key Concepts:**

- **Direct Changes**: Files modified in selected commits
- **Blast Radius**: Files that depend on changed symbols (import/export relationships)
- **Dependency Analysis**: Import/export graph traversal to find affected files

### Intended State Reconstruction (`intendedMap.ts`)

Reconstructs what the codebase "should" look like based on refactoring patterns in history.

```typescript
export interface IntendedState {
  expect: 'present' | 'absent';
  lastName?: string;
  lastPath?: string;
  lastSig?: string;
  lastSha: string;
  isRenamed?: boolean;
}

export async function buildIntendedMap(commitShas: string[]): Promise<Map<string, IntendedState>> {
  // Process commits oldest→newest to build refactor intent
}
```

**Key Concepts:**

- **Temporal Folding**: Process commits chronologically to understand evolution
- **Rename Tracking**: Follow symbol identity across renames using stable DNA
- **Pattern Recognition**: Identify systematic refactoring patterns

#### Intended State Logic

```typescript
// Processing additions/modifications oldest→newest
for (const symbol of symbols) {
  if (symbol.change_type === 'added') {
    intended.set(symbolId, { expect: 'present', lastSha: sha });
  } else if (symbol.change_type === 'removed') {
    intended.set(symbolId, { expect: 'absent', lastSha: sha });
  }
}

// Handle renames with confidence scoring
for (const rename of renames) {
  if (rename.confidence > 0.8) {
    intended.set(rename.new_symbol_id, {
      expect: 'present',
      lastName: rename.new_name,
      isRenamed: true,
      lastSha: sha,
    });
  }
}
```

### Working Snapshot (`workingSnapshot.ts`)

Captures the current state of symbols in the workspace.

```typescript
export interface WorkingSnapshot {
  symbols: Map<string, SymbolInfo>;
  edges: Map<string, EdgeInfo[]>;
  files: Map<string, FileInfo>;
}

export async function buildWorkingSnapshot(
  scope: ScopeSet,
  liveOverrides?: Map<string, string>
): Promise<WorkingSnapshot> {
  // Extract symbols from current workspace files
}
```

**Key Concepts:**

- **Live Overrides**: Support for in-memory content changes during live analysis
- **Scoped Analysis**: Only analyze files within the calculated scope
- **Symbol Extraction**: Tree-sitter based parsing with language-specific grammars

### Drift Detection (`driftDetector.ts`)

Identifies discrepancies between intended and working states.

```typescript
export interface DriftFindings {
  missingSymbols: Array<{ symbolId: string; intended: IntendedState }>;
  zombieSymbols: Array<{ symbolId: string; working: SymbolInfo }>;
  divergentSymbols: Array<{ symbolId: string; intended: IntendedState; working: SymbolInfo }>;
  unresolvedCallers: Array<{
    callerId: string;
    targetName: string;
    guessCandidates: string[];
    severity: 'high' | 'medium' | 'low';
  }>;
  conventionDrift: ConventionDrift[];
  clusters: DriftCluster[];
}

export async function detectDrift(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  scope: ScopeSet
): Promise<DriftFindings> {
  // Compare intended vs working states
}
```

#### Drift Types

1. **Missing Symbols**: Symbols that should be present but aren't
2. **Zombie Symbols**: Symbols that shouldn't be present but are
3. **Divergent Symbols**: Symbols with different signatures than expected
4. **Unresolved Callers**: References to symbols that can't be found
5. **Convention Drift**: Naming/import convention violations
6. **Clusters**: Groups of related drift issues

#### Unresolved Callers Algorithm

```typescript
// For each edge (call/import) in working snapshot
for (const [callerId, edges] of working.edges) {
  for (const edge of edges) {
    if (!working.symbols.has(edge.targetId)) {
      // Target symbol not found - create unresolved caller
      const candidates = findSimilarSymbols(edge.targetName, working.symbols);
      unresolvedCallers.push({
        callerId,
        targetName: edge.targetName,
        guessCandidates: candidates.slice(0, 5),
        severity: calculateSeverity(edge.type, candidates.length),
      });
    }
  }
}
```

### Legacy Audit (`legacyAudit.ts`)

Identifies dead code and replaced functionality.

```typescript
export interface LegacyAuditResult {
  deadSymbols: Array<{
    symbolId: string;
    lastUsed: string; // SHA where symbol was last referenced
    replacementCandidates?: string[];
  }>;
  legacyUsed: Array<{
    symbolId: string;
    usageCount: number;
    replacementPattern: string;
  }>;
  replacedLeftovers: Array<{
    symbolId: string;
    replacedBy: string[];
    replacementSha: string;
  }>;
}

export async function auditLegacy(
  working: WorkingSnapshot,
  intended: Map<string, IntendedState>,
  commitFacts: CommitFacts[]
): Promise<LegacyAuditResult> {
  // Find symbols that are no longer intended but still exist
}
```

**Key Concepts:**

- **Dead Symbols**: Symbols that should be absent but are still present
- **Legacy Usage**: Symbols that are used but marked as legacy
- **Replacement Tracking**: Follow symbol replacement patterns over time

### Facts Assembler (`factsAssembler.ts`)

Combines all fact detection into cohesive bundle facts.

```typescript
export interface RefactorBundleFacts {
  commitRange: { oldest: string; newest: string };
  filesChanged: number;
  symbolsChanged: number;

  // Fact summaries
  incompleteness: IncompletenessSummary;
  patternDrift: PatternDriftSummary;
  legacySummary: LegacySummary;

  // Raw facts
  drift?: DriftFindings;
  legacy?: LegacyAuditResult;
  hotspots?: Hotspot[];
  movedBlocks?: MovedBlock[];

  // Metadata
  analysisTimestamp: string;
  partialReasons?: string[];
}

export async function buildRefactorBundleFacts(
  commitFacts: CommitFacts[],
  workspaceFacts: WorkspaceFacts | null,
  options?: BundleOptions
): Promise<RefactorBundleFacts> {
  // Assemble all facts into coherent bundle
}
```

### Delta Converter (`deltaConverter.ts`)

Converts between different fact representations for compatibility.

```typescript
export function convertToHybridFacts(bundleFacts: RefactorBundleFacts): HybridFact[] {
  // Convert modern facts to legacy hybrid format
}

export function convertFromHybridFacts(hybridFacts: HybridFact[]): Partial<RefactorBundleFacts> {
  // Convert legacy format to modern facts
}
```

## Architecture

### Fact Detection Pipeline

```
Commit Selection → Scope Calculation → Intended State Reconstruction
                                                       ↓
Working Snapshot → Drift Detection ←→ Convention Analysis
                    ↓
Legacy Audit → Facts Assembly → Bundle Facts
```

### State Reconciliation

The facts system operates on three primary states:

1. **Intended State**: What the code "should" look like based on refactoring history
2. **Working State**: What the code actually looks like right now
3. **Drift**: The discrepancies between intended and working states

### Symbol Identity Management

Symbols are identified using stable DNA that survives renames and moves:

```typescript
// Symbol ID format: "path/to/file:kind:name"
// Symbol DNA: hash(kind + signature + body_shape)
function calculateSymbolDna(symbol: SymbolInfo): string {
  return hash({
    kind: symbol.kind,
    signature: symbol.signature,
    bodyShape: structuralHash(symbol.body),
  });
}
```

## Key Concepts

### Temporal Reasoning

Facts are built through temporal analysis of commit history:

- **Chronological Processing**: Commits processed oldest→newest to understand evolution
- **State Accumulation**: Each commit modifies the intended state
- **Pattern Recognition**: Systematic changes indicate refactoring intent

### Blast Radius Calculation

Scope expansion through dependency analysis:

```typescript
function calculateBlastRadius(
  changedFiles: string[],
  dependencyGraph: Map<string, string[]>
): string[] {
  const affected = new Set(changedFiles);
  const queue = [...changedFiles];

  while (queue.length > 0) {
    const file = queue.shift()!;
    const dependents = dependencyGraph.get(file) || [];

    for (const dependent of dependents) {
      if (!affected.has(dependent)) {
        affected.add(dependent);
        queue.push(dependent);
      }
    }
  }

  return Array.from(affected);
}
```

### Convention Drift Detection

Identifies violations of established coding conventions:

```typescript
interface ConventionDrift {
  type: 'naming' | 'import' | 'structure';
  violations: Array<{
    file: string;
    symbol: string;
    expected: string;
    actual: string;
    confidence: number;
  }>;
}
```

### Drift Clustering

Groups related drift issues for better understanding:

```typescript
interface DriftCluster {
  id: string;
  type: 'missing_api' | 'incomplete_refactor' | 'naming_inconsistency';
  symbols: string[];
  severity: 'high' | 'medium' | 'low';
  suggestedAction: string;
}
```

## Dependencies

- **analysis/** - Commit facts, symbol extraction, Tree-sitter integration
- **storage/** - Database access for historical data
- **utils/** - Logging, configuration, path utilities
- **types/** - Type definitions for facts
- **contracts/** - Interface contracts

## Usage Examples

### Basic Drift Detection

```typescript
import { calculateScope } from './facts/scope';
import { buildIntendedMap } from './facts/intendedMap';
import { buildWorkingSnapshot } from './facts/workingSnapshot';
import { detectDrift } from './facts/driftDetector';

const scope = await calculateScope(['abc123', 'def456']);
const intended = await buildIntendedMap(['abc123', 'def456']);
const working = await buildWorkingSnapshot(scope);

const drift = await detectDrift(intended, working, scope);
console.log('Found drift:', drift.unresolvedCallers.length, 'unresolved callers');
```

### Legacy Code Audit

```typescript
import { auditLegacy } from './facts/legacyAudit';

const legacy = await auditLegacy(working, intended, commitFacts);
console.log('Dead symbols found:', legacy.deadSymbols.length);
```

### Bundle Facts Assembly

```typescript
import { buildRefactorBundleFacts } from './facts/factsAssembler';

const bundleFacts = await buildRefactorBundleFacts(commitFacts, workspaceFacts, {
  scope,
  intended,
  working,
  drift,
  legacy,
  hotspots,
});

console.log('Analysis complete:', bundleFacts.filesChanged, 'files changed');
```

## Performance Characteristics

- **Incremental Analysis**: Facts built incrementally from commit history
- **Scoped Processing**: Only analyzes files within calculated scope
- **Caching**: Results cached to avoid redundant computation
- **Memory Efficient**: Processes large codebases through streaming and pagination

## Error Handling

- **Graceful Degradation**: Continues analysis even when some facts can't be determined
- **Partial Results**: Returns available facts with incompleteness markers
- **Validation**: Validates fact consistency and reports conflicts

## Related Documentation

- [Analysis Module](analysis.md) - Pipeline integration and commit processing
- [Metrics Module](metrics.md) - Fact transformation into metrics
- [Storage Module](storage.md) - Historical data persistence
- [Types Module](types.md) - Fact type definitions
