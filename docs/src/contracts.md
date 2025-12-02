# Contracts Module (`contracts/`)

## Purpose

The `contracts/` module defines interface contracts and data interchange formats used between different parts of the system. It establishes clear boundaries and ensures consistent data structures for LLM context and tree node representations.

## Key Components

### LLM Context Contract (`llmContext.ts`)

Defines the data contract for LLM analysis and context generation.

```typescript
export interface LLMContextContract {
  version: string;
  timestamp: string;
  repository: {
    name: string | null;
    branch: string | null;
  };
  analysis: {
    commitRange: {
      oldest: string;
      newest: string;
    };
    filesChanged: number;
    symbolsChanged: number;
  };
  facts: {
    drift?: DriftFindings;
    legacy?: LegacyAuditResult;
    incompleteness: IncompletenessSummary;
  };
  contextBudget: {
    maxTokens: number;
    usedTokens: number;
    sections: ContextSection[];
  };
}

export interface ContextSection {
  name: string;
  content: string;
  tokens: number;
  priority: 'critical' | 'important' | 'optional';
  truncated?: boolean;
}

export interface SymbolContext {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  signature?: string;
  loc_pre?: Location;
  loc_post?: Location;
  changeType?: string;
  confidence?: number;
}

export interface EdgeContext {
  sourceId: string;
  targetId: string;
  type: string;
  confidence: number;
  metadata?: Record<string, any>;
}
```

### Tree Nodes Contract (`treeNodes.ts`)

Defines the contract for tree view node representations.

```typescript
export interface TreeNodeContract {
  id: string; // Globally unique identifier
  label: string; // Display text
  type: NodeType; // Discriminated union type
  collapsibleState: vscode.TreeItemCollapsibleState;
  children?: TreeNode[]; // Pre-populated or undefined for dynamic loading
  metadata?: Record<string, any>;
}

export type NodeType =
  | 'commit'
  | 'symbol'
  | 'file'
  | 'bundle'
  | 'report'
  | 'workspace'
  | 'staged'
  | 'unstaged';

export interface CommitNode extends TreeNodeContract {
  type: 'commit';
  metadata: {
    sha: string;
    author: string;
    date: string;
    message: string;
    summary?: string;
  };
}

export interface SymbolNode extends TreeNodeContract {
  type: 'symbol';
  metadata: {
    symbolId: string;
    name: string;
    kind: string;
    filePath: string;
    changeType?: string;
  };
}

export interface BundleNode extends TreeNodeContract {
  type: 'bundle';
  metadata: {
    facts: RefactorBundleFacts;
    summary: BundleSummaryDTO;
    reportId?: string;
  };
}
```

## Architecture

### Contract Design Principles

Contracts follow strict design principles:

1. **Versioned**: All contracts include version information
2. **Backward Compatible**: Changes don't break existing consumers
3. **Self-Describing**: Contracts include metadata about their structure
4. **Validatable**: Contracts can be validated for correctness

### Data Flow Contracts

Contracts define data interchange between layers:

```
Analysis Layer → Contract → LLM Layer
UI Layer ← Contract ← State Layer
```

## Key Concepts

### Version Management

Contracts include version information for compatibility:

```typescript
interface VersionedContract {
  version: string; // Semantic version
  created: string; // ISO timestamp
  compatibleWith: string[]; // Compatible versions
}
```

### Metadata Enrichment

Contracts can include metadata for enhanced functionality:

```typescript
interface RichContract<T> {
  data: T;
  metadata: {
    source: string;
    timestamp: string;
    validationHash?: string;
    processingHints?: Record<string, any>;
  };
}
```

### Validation Contracts

Contracts can define their own validation rules:

```typescript
interface ValidatableContract {
  validate(): ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}
```

## Dependencies

- **types/** - Base type definitions
- **analysis/** - Analysis result types

## Usage Examples

### LLM Context Creation

```typescript
import { LLMContextContract } from './contracts/llmContext';

function createLLMContext(bundleFacts: RefactorBundleFacts): LLMContextContract {
  return {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    repository: {
      name: getRepoName(),
      branch: getCurrentBranch(),
    },
    analysis: {
      commitRange: bundleFacts.commitRange,
      filesChanged: bundleFacts.filesChanged,
      symbolsChanged: bundleFacts.symbolsChanged,
    },
    facts: {
      drift: bundleFacts.drift,
      legacy: bundleFacts.legacy,
      incompleteness: bundleFacts.incompleteness,
    },
    contextBudget: calculateTokenBudget(bundleFacts),
  };
}
```

### Tree Node Creation

```typescript
import { CommitNode } from './contracts/treeNodes';

function createCommitNode(commit: CommitMetadata): CommitNode {
  return {
    id: `commit:${commit.sha}`,
    label: `${commit.sha.substring(0, 8)} - ${commit.message.split('\n')[0]}`,
    type: 'commit',
    collapsibleState: vscode.TreeItemCollapsibleState.None,
    metadata: {
      sha: commit.sha,
      author: commit.author,
      date: commit.date,
      message: commit.message,
    },
  };
}
```

### Contract Validation

```typescript
function validateLLMContext(context: LLMContextContract): ValidationResult {
  const errors: ValidationError[] = [];

  if (!context.version) {
    errors.push({ field: 'version', message: 'Version is required' });
  }

  if (!context.analysis.commitRange) {
    errors.push({ field: 'commitRange', message: 'Commit range is required' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: [],
  };
}
```
