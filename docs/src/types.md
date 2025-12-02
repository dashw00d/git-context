# Types Module (`types/`)

## Purpose

The `types/` module defines TypeScript type definitions and interfaces used throughout the Git Context extension. It provides strong typing for complex data structures and ensures type safety across the codebase.

## Key Components

### Cockpit Types (`cockpit.ts`)

Type definitions for the cockpit UI state and interactions.

```typescript
export interface CockpitState {
  // Repository context
  repoName: string | null;
  branchName: string | null;

  // Analysis state
  isAnalyzing: boolean;
  selectedCommitShas: string[];
  bundleFacts: BundleFactsDTO | null;

  // UI state
  activeSection: CockpitSectionKey;
  commitsFilterText: string;

  // Data collections
  commits: CommitDTO[];
  symbols: SymbolDTO[];
  reports: ReportDTO[];

  // Live analysis
  liveAnalysis: LiveAnalysisState;
}

export type CockpitSectionKey = 'commits' | 'symbols' | 'bundle' | 'reports' | 'live';

export interface ContextFrame {
  level: 'bundle' | 'file' | 'symbol';
  id: string;
  metadata?: Record<string, any>;
}
```

### CST Facts Types (`cstFacts.ts`)

Types for Concrete Syntax Tree analysis facts.

```typescript
export interface HybridFact {
  type: 'drift' | 'legacy' | 'incomplete';
  severity: 'high' | 'medium' | 'low';
  description: string;
  location?: {
    file: string;
    line?: number;
    symbol?: string;
  };
  evidence: string[];
  suggestion?: string;
}

export interface CSTFact {
  id: string;
  type: 'symbol' | 'edge' | 'pattern';
  confidence: number;
  metadata: Record<string, any>;
  timestamp: string;
}
```

### Main Types Index (`index.ts`)

Central export of all type definitions.

```typescript
// Re-export all types for convenience
export * from './cockpit';
export * from './cstFacts';

// Common utility types
export interface Point {
  line: number;
  column: number;
}

export interface Range {
  start: Point;
  end: Point;
}

export interface Location {
  file: string;
  range?: Range;
  line?: number;
}
```

## Architecture

### Type Organization

Types are organized by domain:

- **cockpit.ts**: UI state and interactions
- **cstFacts.ts**: Analysis facts and findings
- **index.ts**: Central exports and utilities

### Discriminated Unions

Complex types use discriminated unions for type safety:

```typescript
export type AnalysisResult =
  | { status: 'success'; data: BundleFactsDTO }
  | { status: 'error'; error: string }
  | { status: 'cancelled' };
```

### Generic Constraints

Generic types with proper constraints:

```typescript
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

export function createResult<T>(data: T): Result<T> {
  return { success: true, data };
}
```

## Key Concepts

### Interface Segregation

Types follow interface segregation principle:

```typescript
// Large interface broken into focused pieces
interface CommitMetadata {
  sha: string;
  author: string;
  date: string;
  message: string;
}

interface CommitAnalysis {
  summary: string;
  symbolsChanged: number;
  riskLevel: 'low' | 'medium' | 'high';
}

// Combined when needed
interface AnalyzedCommit extends CommitMetadata, CommitAnalysis {}
```

### Branded Types

Use branded types for type safety:

```typescript
// Branded string types prevent mixing similar strings
export type CommitSHA = string & { readonly __brand: 'CommitSHA' };
export type SymbolId = string & { readonly __brand: 'SymbolId' };

// Factory functions ensure proper creation
export function createCommitSHA(sha: string): CommitSHA {
  if (!isValidSHA(sha)) throw new Error('Invalid SHA');
  return sha as CommitSHA;
}
```

### Utility Types

Common utility types for transformations:

```typescript
// Make all properties optional
export type Partial<T> = {
  [P in keyof T]?: T[P];
};

// Make all properties required
export type Required<T> = {
  [P in keyof T]-?: T[P];
};

// Extract property types
export type ValueOf<T> = T[keyof T];

// Function parameter types
export type Parameters<T extends (...args: any) => any> = T extends (...args: infer P) => any
  ? P
  : never;
```

## Dependencies

- Minimal dependencies - types can be imported anywhere
- No runtime dependencies

## Usage Examples

### Type Definitions

```typescript
import { CockpitState, ContextFrame } from './types';

function updateCockpit(state: CockpitState, frame: ContextFrame): CockpitState {
  return {
    ...state,
    activeFrame: frame,
  };
}
```

### Generic Types

```typescript
import { Result } from './types';

function analyzeCommit(sha: string): Promise<Result<BundleFactsDTO>> {
  try {
    const facts = await performAnalysis(sha);
    return { success: true, data: facts };
  } catch (error) {
    return { success: false, error };
  }
}
```

### Discriminated Unions

```typescript
import { AnalysisResult } from './types';

function handleResult(result: AnalysisResult) {
  switch (result.status) {
    case 'success':
      // TypeScript knows result.data exists
      showResults(result.data);
      break;
    case 'error':
      // TypeScript knows result.error exists
      showError(result.error);
      break;
    case 'cancelled':
      // No additional data
      break;
  }
}
```
