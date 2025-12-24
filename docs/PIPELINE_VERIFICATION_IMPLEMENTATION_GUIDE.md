# Pipeline Formal Verification Implementation Guide

**Status**: Implementation Plan
**Last Updated**: 2025-01-XX
**Author**: Pipeline Verification Team

This document provides a comprehensive, step-by-step implementation guide for adding formal verification to the pipeline. Each phase is broken down with specific file paths, line numbers, and code changes required.

---

## Quick Reference: File Changes Summary

### New Files to Create

1. `src/analysis/runner/idAlignmentAudit.ts` - ID alignment audit tool (Phase 0.5)
2. `docs/ID_ALIGNMENT_RULES.md` - ID alignment rules document (Phase 0.5)
3. `src/analysis/runner/pipelineBrandedTypes.ts` - Branded types (Phase 0)
4. `src/analysis/runner/pipelineTypeGuards.ts` - Type guard functions (Phase 0)
5. `src/analysis/runner/pipelineSchemas.ts` - Zod schemas (Phase 1)
6. `src/storage/migrations/add_completeness_flags.ts` - Completeness migration (Phase 1.5)
7. `src/analysis/runner/completenessTracking.ts` - Completeness utilities (Phase 1.5)
8. `src/analysis/unifiedSymbolExtraction.ts` - Unified extraction (Phase 1.6)
9. `tests/integration/scanModeIdentity.test.ts` - Scan identity tests (Phase 1.6)
10. `src/analysis/runner/stepPreconditions.ts` - Precondition registry (Phase 2)
11. `src/analysis/runner/pipelineVerification.ts` - Verification functions (Phase 2)
12. `src/analysis/invalidation/invalidationService.ts` - Invalidation service (Phase 3.5)
13. `src/analysis/invalidation/fileWatcherIntegration.ts` - File watcher integration (Phase 3.5)
14. `src/analysis/runner/pipelineInvariants.ts` - Cross-step invariants (Phase 4)
15. `src/analysis/runner/pipelineAdvancedTypes.ts` - Advanced TypeScript types (Phase 5)

### Files to Modify

**Phase 0.5 (ID Alignment)**:

- `src/types/index.ts` (lines 19-33) - Remove semanticId
- `src/contracts/llmContext.ts` (lines 85-98) - Remove dnaId
- All files using `semanticId` or `.dnaId` (search and fix)

**Phase 0 (Branded Types)**:

- `src/types/drift.ts` (lines 6-120)
- `src/facts/intendedMap.ts` (lines 3, 11, 22)
- `src/analysis/runner/pipelineTypes.ts` (lines 50-51, 72)
- `src/analysis/runner/steps/driftStep.ts` (lines 1-9, 17-20)
- `src/analysis/runner/steps/legacyStep.ts` (lines 1-7, 16-19)
- `src/analysis/runner/steps/workingStep.ts` (lines 1-5, 14-21)
- `src/analysis/runner/steps/bundleFactsStep.ts` (lines 1-19, 34-66)

**Phase 1 (Schemas)**:

- `src/types/drift.ts` (add exports)
- `src/facts/intendedMap.ts` (update exports)
- `src/facts/legacyAudit.ts` (update exports)

**Phase 1.5 (Granular Completeness)**:

- `src/storage/schema.ts` (lines 585-604, 539-547) - Add completeness_flags columns
- `src/storage/databaseWriteQueue.ts` (lines 357-393) - Set completeness flags
- `src/analysis/runner/steps/hotspotStep.ts` - Update completeness after hotspots
- `src/analysis/runner/steps/driftStep.ts` - Update completeness after drift
- `src/analysis/runner/steps/legacyStep.ts` - Update completeness after legacy

**Phase 1.6 (Scan Mode Identity)**:

- `src/analysis/workspaceIndexer.ts` (around line 816) - Use unified extraction
- `src/analysis/commitIndexer.ts` (around line 476) - Use unified extraction

**Phase 2-3 (Preconditions/Postconditions)**:

- `src/analysis/runner/pipelineRunner.ts` (lines 1-7, 75, 122-155)
- `src/analysis/runner/pipelineTypes.ts` (lines 148-155)

**Phase 3.5 (Invalidation)**:

- `src/storage/databaseWriteQueue.ts` (around line 357) - Check invalidation before write
- `src/core/fileWatchers.ts` - Add file change invalidator
- `src/analysis/embeddingIndexer.ts` (around line 139) - Check completeness before indexing

**Phase 4 (Invariants)**:

- `src/analysis/runner/pipelineRunner.ts` (add import, line 147-155)

**Phase 5 (Advanced Types)**:

- Optional: Future migration only

---

## Overview

This implementation is divided into **11 phases**, each building on the previous:

1. **Phase 0.5**: ID Alignment Audit & Standardization (CRITICAL - prevents bugs)
2. **Phase 0**: Branded Types & Type Guards (Foundation)
3. **Phase 1**: Runtime Schema Validation (Zod Schemas)
4. **Phase 1.5**: Granular Completeness System (Database schema extension)
5. **Phase 1.6**: Scan Mode Identity Verification (Quick scan = Full scan structure)
6. **Phase 2**: Precondition Checking System
7. **Phase 3**: Postcondition Validation
8. **Phase 3.5**: Invalidation Infrastructure (Stale data cleanup)
9. **Phase 4**: Cross-Step Invariants
10. **Phase 5**: Advanced TypeScript Types (Conditional Types, Template Literals)
11. **Phase 6**: Integration into Pipeline Runner

Each phase must be completed comprehensively before moving to the next.

**Critical Path**: Phase 0.5 (ID Alignment) must be done FIRST to prevent bugs from misaligned variables.

---

## Phase 0.5: ID Alignment Audit & Standardization

**Goal**: Ensure all ID fields are consistently used across quick scan, full scan, and all code paths. This phase prevents bugs from misaligned variables.

**Why This Phase is Critical**: A single misaligned variable can cause impossible-to-hunt-down bugs. This phase standardizes ID usage before adding verification.

### Current State Audit

**Issues Found**:

- `SymbolInfo.id` = DNA hash (correct)
- `SymbolInfo.semanticId` = legacy field, sometimes used inconsistently
- `SymbolContext.id` = numeric ID (different from SymbolInfo!)
- `SymbolContext.symbol_id` = DNA hash (correct)
- `SymbolContext.dnaId` = legacy field, same as `symbol_id`
- Database: `symbols.symbol_id` = semantic ID, `symbols.dna_id` = DNA hash
- Some code uses `symbol_id` when they mean `dna_id`

### Files to Create

#### 1. `src/analysis/runner/idAlignmentAudit.ts` (NEW FILE)

**Lines**: Entire file (new, ~300-400 lines)

```typescript
/**
 * ID Alignment Audit Tool
 * Scans codebase for ID field usage and reports misalignments
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface IdUsage {
  file: string;
  line: number;
  context: string;
  field: string;
  pattern: string;
  issue?: string;
}

export interface AlignmentReport {
  symbolInfoUsage: IdUsage[];
  symbolContextUsage: IdUsage[];
  databaseUsage: IdUsage[];
  misalignments: Array<{
    file: string;
    line: number;
    issue: string;
    suggestion: string;
  }>;
}

/**
 * Audit ID field usage across codebase
 */
export async function auditIdAlignment(): Promise<AlignmentReport> {
  const srcFiles = await glob('src/**/*.ts', { ignore: ['**/*.test.ts', '**/node_modules/**'] });

  const report: AlignmentReport = {
    symbolInfoUsage: [],
    symbolContextUsage: [],
    databaseUsage: [],
    misalignments: [],
  };

  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for SymbolInfo.id usage
      if (line.includes('.id') && (line.includes('SymbolInfo') || line.includes('symbol.'))) {
        if (line.includes('symbol.id') && !line.includes('DNA') && !line.includes('dna')) {
          // Potential issue: using .id without clarifying it's DNA hash
          report.symbolInfoUsage.push({
            file,
            line: lineNum,
            context: line.trim(),
            field: 'id',
            pattern: 'symbol.id',
          });
        }
      }

      // Check for semanticId usage (legacy field)
      if (line.includes('semanticId')) {
        report.symbolInfoUsage.push({
          file,
          line: lineNum,
          context: line.trim(),
          field: 'semanticId',
          pattern: 'semanticId',
          issue: 'Legacy field - should verify if still needed',
        });
      }

      // Check for dnaId usage (legacy field in SymbolContext)
      if (line.includes('.dnaId') || line.includes('dnaId:')) {
        report.symbolContextUsage.push({
          file,
          line: lineNum,
          context: line.trim(),
          field: 'dnaId',
          pattern: 'dnaId',
          issue: 'Legacy field in SymbolContext - use symbol_id instead',
        });
      }

      // Check for database symbol_id vs dna_id confusion
      if (line.includes('symbol_id') && (line.includes('SELECT') || line.includes('INSERT'))) {
        // Check if it's used correctly
        if (
          line.includes('symbol_id') &&
          !line.includes('dna_id') &&
          line.includes('FROM symbols')
        ) {
          report.databaseUsage.push({
            file,
            line: lineNum,
            context: line.trim(),
            field: 'symbol_id',
            pattern: 'symbol_id',
            issue: 'Verify: should this be dna_id?',
          });
        }
      }

      // Common misalignments
      if (
        line.includes('symbol_id') &&
        (line.includes('DNA') || line.includes('dna')) &&
        !line.includes('symbol_id as') &&
        !line.includes('symbol_id ||')
      ) {
        report.misalignments.push({
          file,
          line: lineNum,
          issue: 'symbol_id used where dna_id might be intended',
          suggestion: 'Verify: if this is a DNA hash, use dna_id. If semantic ID, use symbol_id.',
        });
      }
    });
  }

  return report;
}

/**
 * Generate alignment fix suggestions
 */
export function generateAlignmentFixes(report: AlignmentReport): string[] {
  const fixes: string[] = [];

  // Standardize SymbolInfo: id = DNA hash (already correct)
  fixes.push('✅ SymbolInfo.id is DNA hash - CORRECT');

  // Remove or document semanticId usage
  if (report.symbolInfoUsage.some(u => u.field === 'semanticId')) {
    fixes.push('⚠️ SymbolInfo.semanticId is legacy - audit each usage and remove if not needed');
  }

  // Standardize SymbolContext
  fixes.push("SymbolContext.id should remain numeric (it's a different ID)");
  fixes.push('SymbolContext.symbol_id should be DNA hash - VERIFY all usages');
  fixes.push('SymbolContext.dnaId is legacy - replace with symbol_id');

  // Database standardization
  fixes.push('Database: symbols.symbol_id = semantic ID (path:kind:name or readable ID)');
  fixes.push('Database: symbols.dna_id = DNA hash - VERIFY all queries use correct field');

  return fixes;
}
```

### Files to Audit and Fix

#### Standard ID Usage Rules (to enforce):

1. **SymbolInfo**:
   - `id`: DNA hash (stable identifier) ✅ CORRECT
   - `semanticId`: Legacy field - REMOVE or document clearly

2. **SymbolContext**:
   - `id`: Numeric ID (different purpose) ✅ CORRECT
   - `symbol_id`: DNA hash (stable identifier) ✅ CORRECT
   - `dnaId`: Legacy field - REPLACE with `symbol_id`

3. **Database**:
   - `symbols.symbol_id`: Semantic ID (path:kind:name or readable format)
   - `symbols.dna_id`: DNA hash (stable identifier)
   - **Rule**: Always use `dna_id` for lookups and joins unless you specifically need semantic ID

4. **Edge IDs**:
   - `from_symbol_id`: DNA hash
   - `to_symbol_id`: DNA hash

### Files to Modify for Standardization

#### 2. `src/types/index.ts`

**Lines to modify**:

- **Line 19-33**: Update `SymbolInfo` interface:
  ```typescript
  export interface SymbolInfo {
    id: string; // DNA hash (stable identifier across renames/moves) - REQUIRED
    dnaVersion?: 2; // Always 2 when assigned via assignDNAIds
    // REMOVED: semanticId - legacy field, no longer used
    filePath: string; // File path where symbol is located
    name: string;
    kind: 'function' | 'class' | 'method' | 'const' | 'interface' | 'type' | 'variable';
    signature: string;
    bodyHash?: string;
    location: {
      start: { line: number; column: number };
      end: { line: number; column: number };
    };
    docstring?: string;
  }
  ```

#### 3. `src/contracts/llmContext.ts`

**Lines to modify**:

- **Line 85-98**: Update `SymbolContext` interface:
  ```typescript
  export interface SymbolContext {
    id: number; // Numeric ID (different from SymbolInfo.id)
    symbol_id: string; // DNA hash (stable identifier) - REQUIRED, use this instead of dnaId
    // REMOVED: dnaId - legacy field, use symbol_id instead
    name: string;
    kind: string;
    signature?: string;
    filePath?: string; // File path where symbol is located
    loc_pre?: Loc;
    loc_post?: Loc;
    mod_reason?: ModReason;
    diff_snippet_pre?: string;
    diff_snippet_post?: string;
  }
  ```

#### 4. All Files Using `semanticId` or `dnaId`

**Files to search and fix**:

- Search for `semanticId` usage: `grep -r "semanticId" src/`
- Search for `.dnaId` usage: `grep -r "\.dnaId" src/`
- Replace based on context:
  - If accessing SymbolInfo: use `.id` (it's the DNA hash)
  - If accessing SymbolContext: use `.symbol_id` (it's the DNA hash)
  - If accessing database: use `dna_id` column

**Key Files** (from grep results):

- `src/analysis/symbols.ts` - Lines 351, 353
- `src/services/symbolService.ts` - Line 48
- `src/facts/driftDetector.ts` - Line 140
- All other files found in audit

### ID Alignment Rules Document

#### 5. `docs/ID_ALIGNMENT_RULES.md` (NEW FILE)

**Content**:

```markdown
# ID Alignment Rules

## Core Principles

1. **DNA Hash is the Source of Truth**: DNA hash (`dna_id`) is the stable identifier that survives renames/moves
2. **Consistent Naming**: Always use same field names for same concepts
3. **No Legacy Fields**: Remove or clearly document legacy fields

## Field Mapping

| Context            | DNA Hash Field                   | Semantic ID Field | Notes                         |
| ------------------ | -------------------------------- | ----------------- | ----------------------------- |
| `SymbolInfo`       | `id`                             | (removed)         | id IS the DNA hash            |
| `SymbolContext`    | `symbol_id`                      | (none)            | Use symbol_id, NOT dnaId      |
| Database `symbols` | `dna_id`                         | `symbol_id`       | Always use dna_id for lookups |
| Edges              | `from_symbol_id`, `to_symbol_id` | (none)            | Both are DNA hashes           |

## Migration Checklist

- [ ] Remove `SymbolInfo.semanticId` usage (replace with `.id` if DNA hash needed)
- [ ] Remove `SymbolContext.dnaId` usage (replace with `.symbol_id`)
- [ ] Verify all database queries use `dna_id` for DNA hash lookups
- [ ] Verify all database queries use `symbol_id` only when semantic ID is specifically needed
- [ ] Update all edge references to use DNA hashes
```

### Testing Requirements for Phase 0.5

- [ ] Run `auditIdAlignment()` and fix all reported misalignments
- [ ] Create unit tests that verify ID consistency:
  - Test that SymbolInfo.id is always DNA hash format
  - Test that SymbolContext.symbol_id is always DNA hash format
  - Test that database queries use correct fields
- [ ] Integration test: Quick scan and full scan produce identical ID structures
- [ ] Add linter rules to catch common ID misalignments (if possible)

---

## Phase 0: Branded Types & Type Guards

**Goal**: Create branded types for semantic safety and type guards for compile-time narrowing.

### Files to Create

#### 1. `src/analysis/runner/pipelineBrandedTypes.ts` (NEW FILE)

**Lines**: Entire file (new)

```typescript
/**
 * Branded types for semantic type safety
 * Prevents mixing up semantically different string types
 */

/**
 * Symbol ID: Can be DNA hash or readable ID format
 * Format: "dna:abc123..." or "symbol:123" or "path:kind:name"
 */
export type SymbolId = string & { readonly __brand: 'SymbolId' };

/**
 * DNA Hash: Stable hash for symbol identity across renames
 * Format: "dna:abc123..." (64 hex chars after "dna:")
 */
export type DnaHash = string & { readonly __brand: 'DnaHash' };

/**
 * Commit SHA: Git commit hash
 * Format: 40-char hex string
 */
export type CommitSha = string & { readonly __brand: 'CommitSha' };

/**
 * Type guards to create branded types from strings
 */

export function isValidSymbolId(id: string): id is SymbolId {
  // Accept DNA hash format, symbol ID format, or path:kind:name format
  return (
    /^dna:[a-f0-9]{64}$/.test(id) || /^symbol:\d+$/.test(id) || /.+:.+:.+/.test(id) // path:kind:name
  );
}

export function isValidDnaHash(hash: string): hash is DnaHash {
  return /^dna:[a-f0-9]{64}$/.test(hash);
}

export function isValidCommitSha(sha: string): sha is CommitSha {
  return /^[a-f0-9]{40}$/.test(sha);
}

/**
 * Helper functions to safely convert strings to branded types
 * Throws if validation fails (fail-fast principle)
 */
export function toSymbolId(id: string): SymbolId {
  if (!isValidSymbolId(id)) {
    throw new Error(`Invalid SymbolId format: ${id}`);
  }
  return id as SymbolId;
}

export function toDnaHash(hash: string): DnaHash {
  if (!isValidDnaHash(hash)) {
    throw new Error(`Invalid DnaHash format: ${hash}`);
  }
  return hash as DnaHash;
}

export function toCommitSha(sha: string): CommitSha {
  if (!isValidCommitSha(sha)) {
    throw new Error(`Invalid CommitSha format: ${sha}`);
  }
  return sha as CommitSha;
}
```

### Files to Modify

#### 2. `src/types/drift.ts`

**Lines to modify**:

- **Line 6-13**: Update `IntendedState` interface
  - Change `lastSha: string` → `lastSha: CommitSha`
  - Add import for `CommitSha` from `'../../analysis/runner/pipelineBrandedTypes'`

- **Line 16-109**: Update `DriftFindings` interface
  - Change `symbol_id: string` → `symbol_id: SymbolId` in all places:
    - Line 17: `missing_symbols` array
    - Line 24: `zombie_symbols` array
    - Line 32: `divergent_symbols` array
  - Change `from: string` → `from: SymbolId` in `missing_edges` (line 40)
  - Change `to: string` → `to: SymbolId` in `missing_edges` (line 41)
  - Change `from: string` → `from: SymbolId` in `zombie_edges` (line 49)
  - Change `to: string` → `to: SymbolId` in `zombie_edges` (line 50)
  - Add imports: `SymbolId, CommitSha` from `'../../analysis/runner/pipelineBrandedTypes'`

- **Line 62**: Change `symbolId: string` → `symbolId: SymbolId` in `conventionDrift.driftSymbols`

- **Line 111-120**: Update `UnresolvedCallerFact` interface
  - Change `caller_symbol_id?: string` → `caller_symbol_id?: SymbolId`
  - Change `guessed_target_dna_id?: string | null` → `guessed_target_dna_id?: DnaHash | null`
  - Add import: `DnaHash` from `'../../analysis/runner/pipelineBrandedTypes'`

#### 3. `src/facts/intendedMap.ts`

**Lines to modify**:

- **Line 3**: Add import for `CommitSha` from `'../analysis/runner/pipelineBrandedTypes'`

- **Line 11**: Update function signature:

  ```typescript
  export async function buildIntendedMap(
    commitShas: CommitSha[]
  ): Promise<Map<DnaHash, IntendedState>>;
  ```

  - Change parameter type: `commitShas: string[]` → `commitShas: CommitSha[]`
  - Change return type: `Map<string, IntendedState>` → `Map<DnaHash, IntendedState>`
  - Add import: `DnaHash` from `'../analysis/runner/pipelineBrandedTypes'`

- **Line 22**: Change `Map<string, IntendedState>` → `Map<DnaHash, IntendedState>`

- **Line 41-47**: Add `toDnaHash()` conversion when setting intended:

  ```typescript
  intended.set(toDnaHash(key), {
    expect: 'present',
    // ...
  });
  ```

- **Line 48-56**: Same conversion for modified symbols

- **Line 70-77, 79-86**: Same conversion for renamed symbols

- **Line 97-100**: Same conversion for removed symbols

#### 4. `src/analysis/runner/pipelineTypes.ts`

**Lines to modify**:

- **Line 50-51**: Update `PipelineState` interface
  - Change `selectedCommitShas: string[]` → `selectedCommitShas: CommitSha[]`
  - Add import: `CommitSha` from `'./pipelineBrandedTypes'`

- **Line 72**: Change `intended?: Map<string, IntendedState>` → `intended?: Map<DnaHash, IntendedState>`
  - Add import: `DnaHash` from `'./pipelineBrandedTypes'`
  - Note: Import `IntendedState` from `'../../facts/intendedMap'` (already exists)

### Files to Create for Type Guards

#### 5. `src/analysis/runner/pipelineTypeGuards.ts` (NEW FILE)

**Lines**: Entire file (new)

```typescript
import { PipelineState } from './pipelineTypes';
import { IntendedState } from '../../facts/intendedMap';
import { WorkingSnapshot } from '../../facts/workingSnapshot';
import { ScopeSet } from '../../facts/scope';
import { DriftFindings } from '../../types/drift';
import { LegacyAuditResult } from '../../facts/legacyAudit';
import { DnaHash } from './pipelineBrandedTypes';

/**
 * Type guards for pipeline state properties
 * These enable compile-time type narrowing for precondition checking
 */

export function hasIntended(
  state: PipelineState
): state is PipelineState & { intended: Map<DnaHash, IntendedState> } {
  return state.intended !== undefined && state.intended instanceof Map && state.intended.size >= 0;
}

export function hasWorking(
  state: PipelineState
): state is PipelineState & { working: WorkingSnapshot } {
  return (
    state.working !== undefined &&
    typeof state.working === 'object' &&
    state.working !== null &&
    'symbolsById' in state.working &&
    'edges' in state.working &&
    'analyzedPaths' in state.working
  );
}

export function hasScope(state: PipelineState): state is PipelineState & { scope: ScopeSet } {
  return (
    state.scope !== undefined &&
    typeof state.scope === 'object' &&
    state.scope !== null &&
    'allPaths' in state.scope &&
    state.scope.allPaths instanceof Set
  );
}

export function hasDrift(state: PipelineState): state is PipelineState & { drift: DriftFindings } {
  return (
    state.drift !== undefined &&
    typeof state.drift === 'object' &&
    state.drift !== null &&
    'missing_symbols' in state.drift &&
    'zombie_symbols' in state.drift
  );
}

export function hasLegacy(
  state: PipelineState
): state is PipelineState & { legacy: LegacyAuditResult } {
  return (
    state.legacy !== undefined &&
    typeof state.legacy === 'object' &&
    state.legacy !== null &&
    'dead' in state.legacy &&
    'legacyUsed' in state.legacy &&
    'replacedLeftovers' in state.legacy
  );
}

export function hasCommitFacts(
  state: PipelineState
): state is PipelineState & { commitFacts: any[] } {
  return state.commitFacts !== undefined && Array.isArray(state.commitFacts);
}

export function hasPlan(
  state: PipelineState
): state is PipelineState & { plan: NonNullable<PipelineState['plan']> } {
  return (
    state.plan !== undefined &&
    typeof state.plan === 'object' &&
    state.plan !== null &&
    'fileChanges' in state.plan &&
    'content' in state.plan
  );
}
```

### Files to Modify for Type Guard Usage

#### 6. `src/analysis/runner/steps/driftStep.ts`

**Lines to modify**:

- **Line 1-9**: Add imports:

  ```typescript
  import { hasIntended, hasWorking, hasScope } from '../pipelineTypeGuards';
  ```

- **Line 17-20**: Replace existing precondition check:

  ```typescript
  // BEFORE:
  if (!state.intended || !state.working) {
    throw new Error('Intended and working states required');
  }

  // AFTER:
  if (!hasIntended(state) || !hasWorking(state) || !hasScope(state)) {
    throw new Error('Intended, working, and scope states required');
  }
  ```

- **Line 23-27**: After type guard check, TypeScript knows types are defined:
  ```typescript
  // state.intended, state.working, state.scope are now properly typed
  const drift = await detector.detect({
    intended: state.intended, // Type-safe: Map<DnaHash, IntendedState>
    working: state.working, // Type-safe: WorkingSnapshot
    commitShas: state.selectedCommitShas,
  });
  ```

#### 7. `src/analysis/runner/steps/legacyStep.ts`

**Lines to modify**:

- **Line 1-7**: Add imports:

  ```typescript
  import { hasIntended, hasWorking, hasScope } from '../pipelineTypeGuards';
  ```

- **Line 16-19**: Replace existing precondition check:

  ```typescript
  // BEFORE:
  if (!state.intended || !state.working || !state.scope) {
    logDebug('[LegacyStep] Intended, working, and scope required. Skipping.');
    return;
  }

  // AFTER:
  if (!hasIntended(state) || !hasWorking(state) || !hasScope(state)) {
    logDebug('[LegacyStep] Intended, working, and scope required. Skipping.');
    return;
  }
  ```

#### 8. `src/analysis/runner/steps/workingStep.ts`

**Lines to modify**:

- **Line 1-5**: Add imports:

  ```typescript
  import { hasScope } from '../pipelineTypeGuards';
  ```

- **Line 14-21**: Replace existing precondition check:

  ```typescript
  // BEFORE:
  if (!state.scope?.allPaths) {
    const message = 'Scope required for working snapshot';
    logError(message);
    state.partialReasons = state.partialReasons ?? [];
    state.partialReasons.push(message);
    updateState(state, 'working', null as any);
    return;
  }

  // AFTER:
  if (!hasScope(state)) {
    const message = 'Scope required for working snapshot';
    logError(message);
    state.partialReasons = state.partialReasons ?? [];
    state.partialReasons.push(message);
    updateState(state, 'working', null as any);
    return;
  }

  // After guard, state.scope is properly typed
  ```

#### 9. `src/analysis/runner/steps/bundleFactsStep.ts`

**Lines to modify**:

- **Line 1-19**: Add imports:

  ```typescript
  import { hasScope, hasIntended, hasWorking, hasCommitFacts } from '../pipelineTypeGuards';
  ```

- **Line 34-66**: Replace existing precondition checks:

  ```typescript
  // BEFORE:
  if (!state.commitFacts) {
    const message = 'commitFacts is undefined (should be at least an empty array)';
    // ...
  }

  if (!state.scope || !state.intended || !state.working) {
    const message = 'Missing required pipeline data for bundle facts';
    // ...
  }

  // AFTER:
  if (!hasCommitFacts(state)) {
    const message = 'commitFacts is undefined (should be at least an empty array)';
    // ...
  }

  if (!hasScope(state) || !hasIntended(state) || !hasWorking(state)) {
    const message = 'Missing required pipeline data for bundle facts';
    // ...
  }
  ```

### Testing Requirements for Phase 0

- [ ] Create unit tests in `tests/unit/pipeline/brandedTypes.test.ts`
  - Test `isValidSymbolId()`, `isValidDnaHash()`, `isValidCommitSha()`
  - Test `toSymbolId()`, `toDnaHash()`, `toCommitSha()` throw on invalid input
  - Test type guards return correct boolean values

- [ ] Update existing tests to use branded types
  - Update `tests/integration/pipeline.test.ts` if needed

---

## Phase 1: Runtime Schema Validation (Zod Schemas)

**Goal**: Create Zod schemas for all pipeline state outputs to enable runtime validation.

### Prerequisites

Ensure `zod` is installed:

```bash
npm install zod
```

### Files to Create

#### 1. `src/analysis/runner/pipelineSchemas.ts` (NEW FILE)

**Lines**: Entire file (new, ~400-500 lines)

**Structure**:

```typescript
import { z } from 'zod';
import { SymbolId, DnaHash, CommitSha } from './pipelineBrandedTypes';

/**
 * Runtime schemas for pipeline state validation
 * These complement compile-time TypeScript types with runtime checks
 */

// ============================================================================
// Base Schemas
// ============================================================================

export const CommitShaSchema = z
  .string()
  .refine(val => /^[a-f0-9]{40}$/.test(val), { message: 'Invalid commit SHA format' });

export const DnaHashSchema = z
  .string()
  .refine(val => /^dna:[a-f0-9]{64}$/.test(val), { message: 'Invalid DNA hash format' });

export const SymbolIdSchema = z
  .string()
  .refine(
    val => /^dna:[a-f0-9]{64}$/.test(val) || /^symbol:\d+$/.test(val) || /.+:.+:.+/.test(val),
    { message: 'Invalid symbol ID format' }
  );

// ============================================================================
// IntendedState Schema
// ============================================================================

export const IntendedStateSchema = z.object({
  expect: z.enum(['present', 'absent']),
  lastName: z.string().optional(),
  lastPath: z.string().optional(),
  lastSig: z.string().optional(),
  lastSha: CommitShaSchema,
  isRenamed: z.boolean().optional(),
});

export type IntendedState = z.infer<typeof IntendedStateSchema>;

// Map validation: Custom schema for Map<DnaHash, IntendedState>
export function validateIntendedMap(map: unknown): map is Map<DnaHash, IntendedState> {
  if (!(map instanceof Map)) return false;
  for (const [key, value] of map.entries()) {
    if (!DnaHashSchema.safeParse(key).success) return false;
    if (!IntendedStateSchema.safeParse(value).success) return false;
  }
  return true;
}

// ============================================================================
// ScopeSet Schema
// ============================================================================

export const ScopeSetSchema = z.object({
  commitFiles: z.instanceof(Set<string>),
  workingChanged: z.instanceof(Set<string>),
  stagedFiles: z.instanceof(Set<string>),
  unstagedFiles: z.instanceof(Set<string>),
  blastRadius: z.instanceof(Set<string>),
  allPaths: z.instanceof(Set<string>),
  fileVersionMap: z.instanceof(Map<string, string>).optional(),
});

export type ScopeSet = z.infer<typeof ScopeSetSchema>;

// ============================================================================
// SymbolContext Schema (simplified - adjust based on actual structure)
// ============================================================================

// Note: This is a simplified schema. You'll need to match the actual SymbolContext structure
// from src/contracts/llmContext.ts
export const SymbolContextSchema = z.object({
  id: z.number(), // Note: id is numeric, not SymbolId
  symbol_id: SymbolIdSchema, // DNA hash (stable identifier)
  name: z.string(),
  kind: z.string(),
  signature: z.string().optional(),
  dnaId: z.string().optional(), // Legacy field, same as symbol_id
  filePath: z.string().optional(),
  loc_pre: z
    .object({
      start: z.object({ line: z.number(), column: z.number() }),
      end: z.object({ line: z.number(), column: z.number() }),
    })
    .optional(),
  loc_post: z
    .object({
      start: z.object({ line: z.number(), column: z.number() }),
      end: z.object({ line: z.number(), column: z.number() }),
    })
    .optional(),
  mod_reason: z
    .enum([
      'body_changed',
      'signature_changed',
      'doc_changed',
      'visibility_changed',
      'annotation_changed',
    ])
    .optional(),
  diff_snippet_pre: z.string().optional(),
  diff_snippet_post: z.string().optional(),
});

export type SymbolContext = z.infer<typeof SymbolContextSchema>;

// ============================================================================
// EdgeContext Schema (simplified - adjust based on actual structure)
// ============================================================================

export const EdgeContextSchema = z.object({
  from_symbol_id: SymbolIdSchema,
  to_symbol_id: SymbolIdSchema,
  edge_type: z.enum(['calls', 'imports', 'uses', 'extends', 'implements']),
  change_type: z.enum(['added', 'modified', 'signature_changed', 'removed', 'renamed', 'moved']),
  confidence: z.number(),
  is_resolved: z.boolean(),
});

export type EdgeContext = z.infer<typeof EdgeContextSchema>;

// ============================================================================
// WorkingSnapshot Schema
// ============================================================================

export const WorkingSnapshotSchema = z.object({
  symbolsById: z.custom<Map<string, SymbolContext>>(val => {
    if (!(val instanceof Map)) return false;
    // Validate map entries
    for (const [key, value] of val.entries()) {
      if (typeof key !== 'string') return false;
      if (!SymbolContextSchema.safeParse(value).success) return false;
    }
    return true;
  }),
  symbolsByFile: z.custom<Map<string, SymbolContext[]>>(val => {
    if (!(val instanceof Map)) return false;
    for (const [key, value] of val.entries()) {
      if (typeof key !== 'string') return false;
      if (!Array.isArray(value)) return false;
      if (!value.every(v => SymbolContextSchema.safeParse(v).success)) return false;
    }
    return true;
  }),
  edges: z.array(EdgeContextSchema),
  analyzedPaths: z.instanceof(Set<string>),
});

export type WorkingSnapshot = z.infer<typeof WorkingSnapshotSchema>;

// ============================================================================
// DriftFindings Schema
// ============================================================================

export const DriftFindingsSchema = z.object({
  missing_symbols: z.array(
    z.object({
      symbol_id: SymbolIdSchema,
      expected: IntendedStateSchema,
      introducedAtVersion: z.string().optional(),
      resolvedAtVersion: z.string().optional(),
      versionDescription: z.string().optional(),
    })
  ),
  zombie_symbols: z.array(
    z.object({
      symbol_id: SymbolIdSchema,
      expected: IntendedStateSchema,
      found: SymbolContextSchema,
      introducedAtVersion: z.string().optional(),
      resolvedAtVersion: z.string().optional(),
      versionDescription: z.string().optional(),
    })
  ),
  divergent_symbols: z.array(
    z.object({
      symbol_id: SymbolIdSchema,
      expected: IntendedStateSchema,
      found: SymbolContextSchema,
      introducedAtVersion: z.string().optional(),
      resolvedAtVersion: z.string().optional(),
      versionDescription: z.string().optional(),
    })
  ),
  missing_edges: z.array(
    z.object({
      from: SymbolIdSchema,
      to: SymbolIdSchema,
      type: z.string(),
      expected: IntendedStateSchema,
      introducedAtVersion: z.string().optional(),
      resolvedAtVersion: z.string().optional(),
      versionDescription: z.string().optional(),
    })
  ),
  zombie_edges: z.array(
    z.object({
      from: SymbolIdSchema,
      to: SymbolIdSchema,
      type: z.string(),
      found: EdgeContextSchema,
      introducedAtVersion: z.string().optional(),
      resolvedAtVersion: z.string().optional(),
      versionDescription: z.string().optional(),
    })
  ),
  hotspots: z.array(
    z.object({
      path: z.string(),
      drift_count: z.number(),
    })
  ),
  conventionDrift: z
    .object({
      dominantConvention: z.string(),
      driftPercent: z.number(),
      driftSymbols: z.array(
        z.object({
          symbolId: SymbolIdSchema,
          name: z.string(),
          convention: z.string(),
          suggestedName: z.string(),
          path: z.string(),
        })
      ),
      importDrift: z
        .object({
          dominantStyle: z.string(),
          driftPercent: z.number(),
          driftImports: z.array(
            z.object({
              file: z.string(),
              line: z.number(),
              importPath: z.string(),
              style: z.string(),
            })
          ),
        })
        .optional(),
      fileNamingDrift: z
        .object({
          dominantStyle: z.string(),
          driftPercent: z.number(),
          driftFiles: z.array(
            z.object({
              path: z.string(),
              style: z.string(),
              filename: z.string(),
            })
          ),
        })
        .optional(),
    })
    .optional(),
  mixedConventionFiles: z
    .array(
      z.object({
        path: z.string(),
        conventions: z.array(z.string()),
        symbolCount: z.number(),
        driftPercent: z.number(),
      })
    )
    .optional(),
  divergentClusters: z.array(z.instanceof(Set)).optional(),
  suggestedConsolidations: z
    .array(
      z.object({
        symbols: z.array(z.string()),
        similarity: z.number(),
      })
    )
    .optional(),
  unresolved_callers: z
    .array(
      z.object({
        caller_symbol_id: SymbolIdSchema.optional(),
        caller_name: z.string().optional(),
        caller_path: z.string().optional(),
        caller_line: z.number().optional(),
        callee_name: z.string(),
        guessed_target_dna_id: DnaHashSchema.nullable().optional(),
        occurrence_count: z.number(),
        severity: z.number(),
      })
    )
    .optional(),
  hybridDrifts: z
    .array(
      z.object({
        fact: z.any(), // HybridFact - define separately if needed
        type: z.enum(['missing', 'zombie', 'divergent', 'modified']),
        expected: IntendedStateSchema.optional(),
        timelineDelta: z
          .array(
            z.object({
              version: z.string(),
              delta: z.any(),
            })
          )
          .optional(),
        introducedAtVersion: z.string().optional(),
        resolvedAtVersion: z.string().optional(),
      })
    )
    .optional(),
});

export type DriftFindings = z.infer<typeof DriftFindingsSchema>;

// ============================================================================
// LegacyAuditResult Schema
// ============================================================================

export const LegacyAuditResultSchema = z.object({
  dead: z.array(SymbolContextSchema),
  legacyUsed: z.array(SymbolContextSchema),
  replacedLeftovers: z.array(
    z.object({
      old: SymbolContextSchema,
      new: SymbolContextSchema,
      confidence: z.number(),
    })
  ),
});

export type LegacyAuditResult = z.infer<typeof LegacyAuditResultSchema>;

// ============================================================================
// Schema Registry (maps step outputs to schemas)
// ============================================================================

export const STEP_OUTPUT_SCHEMAS: Record<string, z.ZodSchema> = {
  scope: ScopeSetSchema,
  intended: z.custom<Map<DnaHash, IntendedState>>(validateIntendedMap),
  working: WorkingSnapshotSchema,
  drift: DriftFindingsSchema,
  legacy: LegacyAuditResultSchema,
  // Add more as needed
};

export function getStepOutputSchema(stepId: string): z.ZodSchema | undefined {
  return STEP_OUTPUT_SCHEMAS[stepId];
}
```

**Note**: You'll need to adjust schemas based on actual interface definitions. Check:

- `src/contracts/llmContext.ts` for `SymbolContext` and `EdgeContext` full structure
- `src/types/drift.ts` for complete `DriftFindings` structure
- `src/facts/legacyAudit.ts` for complete `LegacyAuditResult` structure

### Files to Modify

#### 2. `src/types/drift.ts`

**Lines to modify**:

- **Line 1-5**: After Phase 0 changes, add export for schema:
  ```typescript
  // Re-export types from schemas (single source of truth)
  export type { IntendedState, DriftFindings } from '../analysis/runner/pipelineSchemas';
  ```

**Note**: You may want to keep interfaces here for backward compatibility, or fully migrate to schemas. Decision needed.

#### 3. `src/facts/intendedMap.ts`

**Lines to modify**:

- **Line 6**: Update export:
  ```typescript
  // Re-export from schemas
  export type { IntendedState } from '../analysis/runner/pipelineSchemas';
  ```

#### 4. `src/facts/legacyAudit.ts`

**Lines to modify**:

- **Line 9-17**: Add export:
  ```typescript
  // Re-export from schemas
  export type { LegacyAuditResult } from '../analysis/runner/pipelineSchemas';
  ```

### Testing Requirements for Phase 1

- [ ] Create unit tests in `tests/unit/pipeline/schemas.test.ts`
  - Test each schema with valid data
  - Test each schema with invalid data (should fail)
  - Test Map validation functions
  - Test schema registry lookups

---

## Phase 1.5: Granular Completeness System

**Goal**: Add granular completeness tracking to database schema and update all scan modes to use it.

**Why This Phase is Critical**: Currently completeness is only tracked in UI layer. We need database-level tracking to:

- Query incomplete symbols
- Detect what needs to be rescanned (symbols complete but hotspots aren't)
- Support incremental rescanning

### Database Schema Changes

#### 1. Create Migration File: `src/storage/migrations/add_completeness_flags.ts` (NEW FILE)

**Lines**: Entire file (new, ~100-150 lines)

```typescript
/**
 * Migration: Add completeness_flags to symbols table
 * Tracks granular completeness per analysis dimension
 */

import { getDatabaseManager } from '../database';
import { logInfo } from '../../utils/logger';

export interface CompletenessFlags {
  symbols: boolean; // Symbols extracted
  edges: boolean; // Edges extracted
  hotspots: boolean; // Hotspots calculated
  drift: boolean; // Drift analysis done
  legacy: boolean; // Legacy audit done
  embeddings: boolean; // Embeddings indexed
  llm: boolean; // LLM analysis done
}

/**
 * Migration function to add completeness_flags column
 */
export async function addCompletenessFlags(): Promise<void> {
  const db = getDatabaseManager().getDatabase();

  try {
    // Add completeness_flags column as JSON text
    db.exec(`
      ALTER TABLE symbols ADD COLUMN completeness_flags TEXT DEFAULT '{}';
    `);

    // Add completeness_flags to files table (file-level completeness)
    db.exec(`
      ALTER TABLE files ADD COLUMN completeness_flags TEXT DEFAULT '{}';
    `);

    logInfo('[Migration] Added completeness_flags columns to symbols and files tables');
  } catch (error: any) {
    // Column might already exist
    if (error.message && error.message.includes('duplicate column')) {
      logInfo('[Migration] completeness_flags column already exists, skipping');
    } else {
      throw error;
    }
  }
}

/**
 * Parse completeness flags from JSON string
 */
export function parseCompletenessFlags(flagsJson: string | null): CompletenessFlags {
  if (!flagsJson) {
    return {
      symbols: false,
      edges: false,
      hotspots: false,
      drift: false,
      legacy: false,
      embeddings: false,
      llm: false,
    };
  }

  try {
    const parsed = JSON.parse(flagsJson);
    return {
      symbols: parsed.symbols ?? false,
      edges: parsed.edges ?? false,
      hotspots: parsed.hotspots ?? false,
      drift: parsed.drift ?? false,
      legacy: parsed.legacy ?? false,
      embeddings: parsed.embeddings ?? false,
      llm: parsed.llm ?? false,
    };
  } catch {
    return {
      symbols: false,
      edges: false,
      hotspots: false,
      drift: false,
      legacy: false,
      embeddings: false,
      llm: false,
    };
  }
}

/**
 * Serialize completeness flags to JSON string
 */
export function serializeCompletenessFlags(flags: Partial<CompletenessFlags>): string {
  return JSON.stringify({
    symbols: flags.symbols ?? false,
    edges: flags.edges ?? false,
    hotspots: flags.hotspots ?? false,
    drift: flags.drift ?? false,
    legacy: flags.legacy ?? false,
    embeddings: flags.embeddings ?? false,
    llm: flags.llm ?? false,
  });
}
```

#### 2. Update Schema: `src/storage/schema.ts`

**Lines to modify**:

- **Line 585-604**: Update symbols table schema to include `completeness_flags TEXT DEFAULT '{}'`
- **Line 539-547**: Update files table schema to include `completeness_flags TEXT DEFAULT '{}'`

### Files to Create

#### 3. `src/analysis/runner/completenessTracking.ts` (NEW FILE)

**Lines**: Entire file (new, ~200-300 lines)

```typescript
/**
 * Completeness tracking utilities
 * Manages granular completeness flags for symbols and files
 */

import { getDatabaseManager } from '../../storage/database';
import { prepare } from '../../storage/statement-wrapper';
import {
  CompletenessFlags,
  parseCompletenessFlags,
  serializeCompletenessFlags,
} from '../../storage/migrations/add_completeness_flags';
import { logDebug } from '../../utils/logger';

/**
 * Get completeness flags for a symbol
 */
export function getSymbolCompleteness(sha: string, dnaId: string): CompletenessFlags {
  const db = getDatabaseManager().getDatabase();
  const stmt = prepare('SELECT completeness_flags FROM symbols WHERE sha = ? AND dna_id = ?');
  const row = stmt.get(sha, dnaId) as { completeness_flags: string } | undefined;
  stmt.free?.();

  if (!row) {
    return parseCompletenessFlags(null);
  }

  return parseCompletenessFlags(row.completeness_flags);
}

/**
 * Update completeness flags for a symbol
 */
export function updateSymbolCompleteness(
  sha: string,
  dnaId: string,
  flags: Partial<CompletenessFlags>
): void {
  const db = getDatabaseManager().getDatabase();
  const current = getSymbolCompleteness(sha, dnaId);
  const updated: CompletenessFlags = {
    ...current,
    ...flags,
  };

  const stmt = prepare('UPDATE symbols SET completeness_flags = ? WHERE sha = ? AND dna_id = ?');
  stmt.run(serializeCompletenessFlags(updated), sha, dnaId);
  stmt.free?.();

  logDebug(
    `[Completeness] Updated flags for ${dnaId}@${sha.substring(0, 8)}: ${JSON.stringify(flags)}`
  );
}

/**
 * Get symbols that need specific analysis dimension
 */
export function getIncompleteSymbols(
  dimension: keyof CompletenessFlags,
  sha?: string
): Array<{ sha: string; dna_id: string; path: string }> {
  const db = getDatabaseManager().getDatabase();

  let query = `
    SELECT sha, dna_id, path
    FROM symbols
    WHERE JSON_EXTRACT(completeness_flags, '$.${dimension}') IS NULL
       OR JSON_EXTRACT(completeness_flags, '$.${dimension}') = 0
  `;

  if (sha) {
    query += ' AND sha = ?';
  }

  const stmt = prepare(query);
  const results = sha ? stmt.all(sha) : stmt.all();
  stmt.free?.();

  return results as Array<{ sha: string; dna_id: string; path: string }>;
}

/**
 * Get file-level completeness
 */
export function getFileCompleteness(sha: string, path: string): CompletenessFlags {
  const db = getDatabaseManager().getDatabase();
  const stmt = prepare('SELECT completeness_flags FROM files WHERE sha = ? AND path = ?');
  const row = stmt.get(sha, path) as { completeness_flags: string } | undefined;
  stmt.free?.();

  if (!row) {
    return parseCompletenessFlags(null);
  }

  return parseCompletenessFlags(row.completeness_flags);
}

/**
 * Update file-level completeness
 */
export function updateFileCompleteness(
  sha: string,
  path: string,
  flags: Partial<CompletenessFlags>
): void {
  const db = getDatabaseManager().getDatabase();
  const current = getFileCompleteness(sha, path);
  const updated: CompletenessFlags = {
    ...current,
    ...flags,
  };

  const stmt = prepare('UPDATE files SET completeness_flags = ? WHERE sha = ? AND path = ?');
  stmt.run(serializeCompletenessFlags(updated), sha, path);
  stmt.free?.();
}
```

### Files to Modify

#### 4. `src/storage/databaseWriteQueue.ts`

**Lines to modify**:

- **Line 357-393**: Update `flushSymbols()` to set completeness flags based on `changeType`
  - `quick_scan`: `{symbols: true, edges: false, ...}`
  - `added`/`modified`/`priority_click`: `{symbols: true, edges: true, hotspots: false, ...}`

#### 5. `src/analysis/runner/steps/hotspotStep.ts`

**Lines to modify**:

- After hotspot calculation, update completeness flags using `updateSymbolCompleteness()`

#### 6. `src/analysis/runner/steps/driftStep.ts`

**Lines to modify**:

- After drift detection, update completeness flags

#### 7. `src/analysis/runner/steps/legacyStep.ts`

**Lines to modify**:

- After legacy audit, update completeness flags

### Testing Requirements for Phase 1.5

- [ ] Run migration and verify columns added
- [ ] Test completeness flag parsing/serialization
- [ ] Test querying incomplete symbols
- [ ] Verify quick scan sets correct flags
- [ ] Verify full scan sets correct flags
- [ ] Integration test: Detect symbols with complete symbols but incomplete hotspots

---

## Phase 1.6: Scan Mode Identity Verification

**Goal**: Ensure quick scan and full scan produce identical symbol structures (only completeness differs).

**Why This Phase is Critical**: Quick scan and full scan must use the same extraction code to ensure consistency. Only completeness flags should differ.

### Files to Create

#### 1. `src/analysis/unifiedSymbolExtraction.ts` (NEW FILE)

**Lines**: Entire file (new, ~100-200 lines)

```typescript
/**
 * Unified symbol extraction interface
 * Ensures quick scan and full scan use identical extraction logic
 */

import { SymbolExtractor } from './symbols';
import { SymbolInfo } from '../types';
import { assignDNAIds } from './symbolDna';
import { detectLanguage } from '../utils/config';

export interface ExtractionOptions {
  includeEdges: boolean; // Quick scan: false, Full scan: true
  priority: boolean; // Worker priority
}

export interface ExtractionResult {
  symbols: SymbolInfo[];
  edges?: any[]; // Only if includeEdges=true
}

/**
 * Unified symbol extraction - used by both quick scan and full scan
 */
export async function extractSymbolsUnified(
  content: string,
  filePath: string,
  options: ExtractionOptions,
  symbolExtractor: SymbolExtractor
): Promise<ExtractionResult> {
  const language = detectLanguage(filePath);

  // Use same extraction logic for both modes
  const symbols = await symbolExtractor.extractSymbolsFromContent(content, filePath);

  // Assign DNA IDs (same for both modes)
  const bodyTexts = new Map([[filePath, content]]);
  const symbolsWithDNA = await assignDNAIds(symbols, bodyTexts, language || undefined);

  const result: ExtractionResult = {
    symbols: symbolsWithDNA,
  };

  // Only extract edges for full scan
  if (options.includeEdges) {
    const { DependencyExtractor } = await import('./dependencies');
    const dependencyExtractor = new DependencyExtractor();
    result.edges = dependencyExtractor.extractEdges(symbolsWithDNA, content, filePath);
  }

  return result;
}
```

### Files to Modify

#### 2. `src/analysis/workspaceIndexer.ts`

**Lines to modify** (around line 816):

- Update `quickScanSymbols()` to use `extractSymbolsUnified()` with `includeEdges: false`

#### 3. `src/analysis/commitIndexer.ts`

**Lines to modify** (around line 476):

- Update `processFile()` to use `extractSymbolsUnified()` with `includeEdges: true`

### Files to Create for Verification

#### 4. `tests/integration/scanModeIdentity.test.ts` (NEW FILE)

**Lines**: Entire file (new, ~200-300 lines)

```typescript
import { describe, it, expect } from 'vitest';
import { extractSymbolsUnified } from '../../src/analysis/unifiedSymbolExtraction';
import { SymbolExtractor } from '../../src/analysis/symbols';
import { GitOperations } from '../../src/analysis/git';

describe('Scan Mode Identity', () => {
  it('should produce identical symbol structures for quick scan and full scan', async () => {
    const git = new GitOperations();
    const extractor = new SymbolExtractor(git);
    const content = `
      export function testFunction() {
        return 42;
      }

      export class TestClass {
        method() {}
      }
    `;

    const quickResult = await extractSymbolsUnified(
      content,
      'test.ts',
      { includeEdges: false, priority: false },
      extractor
    );

    const fullResult = await extractSymbolsUnified(
      content,
      'test.ts',
      { includeEdges: true, priority: false },
      extractor
    );

    // Symbols should be identical (same IDs, same structure)
    expect(quickResult.symbols.length).toBe(fullResult.symbols.length);

    for (let i = 0; i < quickResult.symbols.length; i++) {
      const quick = quickResult.symbols[i];
      const full = fullResult.symbols[i];

      // Same DNA hash
      expect(quick.id).toBe(full.id);
      // Same name
      expect(quick.name).toBe(full.name);
      // Same kind
      expect(quick.kind).toBe(full.kind);
      // Same signature
      expect(quick.signature).toBe(full.signature);
      // Same location
      expect(quick.location).toEqual(full.location);
    }

    // Only difference: edges present in full scan
    expect(quickResult.edges).toBeUndefined();
    expect(fullResult.edges).toBeDefined();
  });
});
```

### Testing Requirements for Phase 1.6

- [ ] Verify quick scan and full scan produce identical symbol structures
- [ ] Verify only edges differ between modes
- [ ] Verify DNA IDs are identical for same symbols
- [ ] Integration test: Compare quick scan output structure to full scan output structure

---

## Phase 2: Precondition Checking System

**Goal**: Create a systematic way to verify step preconditions before execution.

### Files to Create

#### 1. `src/analysis/runner/stepPreconditions.ts` (NEW FILE)

**Lines**: Entire file (new, ~150-200 lines)

```typescript
import { PipelineState } from './pipelineTypes';
import {
  hasIntended,
  hasWorking,
  hasScope,
  hasDrift,
  hasLegacy,
  hasCommitFacts,
  hasPlan,
} from './pipelineTypeGuards';

/**
 * Precondition requirements for each pipeline step
 */
export interface StepPreconditions {
  /** State properties that must be defined */
  requiredState?: Array<keyof PipelineState>;
  /** Type guard functions to verify state properties */
  typeGuards?: Array<(state: PipelineState) => boolean>;
  /** Steps that must complete before this step runs */
  requiredCompletedSteps?: string[];
  /** Optional: Database tables that must exist (future use) */
  requiredDatabaseTables?: string[];
}

/**
 * Precondition registry: Maps step IDs to their preconditions
 */
export const STEP_PRECONDITIONS: Record<string, StepPreconditions> = {
  init: {
    requiredState: [],
    requiredCompletedSteps: [],
  },

  workspace_overlay: {
    requiredState: ['plan'],
    typeGuards: [hasPlan],
    requiredCompletedSteps: ['init'],
  },

  scope: {
    requiredState: ['plan'],
    typeGuards: [hasPlan],
    requiredCompletedSteps: ['init'],
  },

  index_commits: {
    requiredState: ['plan'],
    typeGuards: [hasPlan],
    requiredCompletedSteps: ['init'],
  },

  size: {
    requiredState: ['scope'],
    typeGuards: [hasScope],
    requiredCompletedSteps: ['scope'],
  },

  working: {
    requiredState: ['scope'],
    typeGuards: [hasScope],
    requiredCompletedSteps: ['scope', 'size'],
  },

  intended: {
    requiredState: [],
    requiredCompletedSteps: ['index_commits'],
    // Note: intended reads from DB, so we check completedSteps, not state
  },

  hotspots: {
    requiredState: [],
    requiredCompletedSteps: ['index_commits'],
  },

  moved_blocks: {
    requiredState: [],
    requiredCompletedSteps: ['index_commits'],
  },

  drift: {
    requiredState: ['intended', 'working', 'scope'],
    typeGuards: [hasIntended, hasWorking, hasScope],
    requiredCompletedSteps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay'],
  },

  legacy: {
    requiredState: ['intended', 'working', 'scope'],
    typeGuards: [hasIntended, hasWorking, hasScope],
    requiredCompletedSteps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay'],
  },

  bundle_facts: {
    requiredState: ['scope', 'intended', 'working', 'commitFacts'],
    typeGuards: [hasScope, hasIntended, hasWorking, hasCommitFacts],
    requiredCompletedSteps: [
      'scope',
      'intended',
      'working',
      'drift',
      'legacy',
      'hotspots',
      'index_commits',
      'moved_blocks',
    ],
  },

  embedding_index: {
    requiredState: ['bundleFacts'],
    requiredCompletedSteps: ['bundle_facts'],
  },

  retrieve_history: {
    requiredState: ['bundleFacts'],
    requiredCompletedSteps: ['bundle_facts', 'embedding_index'],
  },

  llm_story: {
    requiredState: ['bundleFacts'],
    requiredCompletedSteps: ['bundle_facts', 'retrieve_history', 'embedding_index'],
  },
};

/**
 * Get preconditions for a step
 */
export function getStepPreconditions(stepId: string): StepPreconditions | undefined {
  return STEP_PRECONDITIONS[stepId];
}
```

#### 2. `src/analysis/runner/pipelineVerification.ts` (NEW FILE)

**Lines**: Entire file (new, ~200-250 lines)

```typescript
import { PipelineState } from './pipelineTypes';
import { StepPreconditions, getStepPreconditions } from './stepPreconditions';
import { logError, logWarn } from '../../utils/logger';
import { z } from 'zod';

/**
 * Verify step preconditions before execution
 * Throws error if preconditions fail (fail-fast principle)
 */
export function verifyPreconditions(
  stepId: string,
  state: PipelineState,
  preconditions: StepPreconditions
): void {
  const errors: string[] = [];

  // Check required state properties
  if (preconditions.requiredState) {
    for (const prop of preconditions.requiredState) {
      const value = state[prop];
      if (value === undefined || value === null) {
        errors.push(
          `state.${String(prop)} is required but is ${value === undefined ? 'undefined' : 'null'}`
        );
      }
    }
  }

  // Check type guards (more strict validation)
  if (preconditions.typeGuards) {
    for (const guard of preconditions.typeGuards) {
      if (!guard(state)) {
        // Find which property failed (if possible)
        const failedProperty = preconditions.requiredState?.find(
          prop => !state[prop] || state[prop] === undefined
        );
        errors.push(
          `Type guard failed for ${failedProperty ? `state.${String(failedProperty)}` : 'unknown property'}`
        );
      }
    }
  }

  // Check required completed steps
  if (preconditions.requiredCompletedSteps) {
    for (const step of preconditions.requiredCompletedSteps) {
      if (!state.completedSteps.has(step)) {
        errors.push(`Step '${step}' must complete before '${stepId}' runs`);
      }
    }
  }

  // Check database tables (future use)
  // if (preconditions.requiredDatabaseTables) {
  //   // Implementation for DB table checks
  // }

  // Fail fast if any preconditions fail
  if (errors.length > 0) {
    const errorMessage = `[${stepId}] Precondition verification failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    logError(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Verify step postconditions after execution
 * Validates that step output matches expected schema
 */
export function verifyPostconditions(
  stepId: string,
  outputKey: keyof PipelineState,
  output: unknown,
  schema: z.ZodSchema,
  strict: boolean = false
): void {
  const result = schema.safeParse(output);

  if (!result.success) {
    const errors = result.error.errors
      .map(e => {
        const path = e.path.length > 0 ? e.path.join('.') : 'root';
        return `${path}: ${e.message}`;
      })
      .join(', ');

    const errorMessage = `[${stepId}] Postcondition verification failed for ${String(outputKey)}: ${errors}`;

    if (strict) {
      logError(errorMessage);
      throw new Error(errorMessage);
    } else {
      logWarn(errorMessage);
    }
  }
}

/**
 * Verify preconditions for a step (convenience wrapper)
 */
export function verifyStepPreconditions(stepId: string, state: PipelineState): void {
  const preconditions = getStepPreconditions(stepId);
  if (preconditions) {
    verifyPreconditions(stepId, state, preconditions);
  }
}
```

### Files to Modify

#### 3. `src/analysis/runner/pipelineRunner.ts`

**Lines to modify**:

- **Line 1-7**: Add imports:

  ```typescript
  import { verifyStepPreconditions } from './pipelineVerification';
  import { getStepOutputSchema } from './pipelineSchemas';
  import { verifyPostconditions } from './pipelineVerification';
  ```

- **Line 122-128**: Add precondition verification before step execution:

  ```typescript
  try {
    // 2. Fail Fast: Check cancellation before specific step
    if (token?.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    // NEW: Verify preconditions before execution
    verifyStepPreconditions(step.id, state);

    onEvent?.({ type: 'start', step, state, timestamp: new Date().toISOString() });
    // ... rest of execution
  ```

- **Line 140-147**: Add postcondition verification after step execution (before marking complete):

  ```typescript
  // Success handling
  const endTime = Date.now();
  const duration = endTime - startTime;
  stepTimings[stepId].end = endTime;
  stepTimings[stepId].duration = duration;
  state.stepTimings![stepId].end = endTime;
  state.stepTimings![stepId].duration = duration;

  // NEW: Verify postconditions (output validation)
  const outputKey = getStepOutputKey(step.id); // Helper function needed
  const schema = getStepOutputSchema(outputKey);
  if (outputKey && schema && state[outputKey as keyof PipelineState] !== undefined) {
    verifyPostconditions(
      step.id,
      outputKey as keyof PipelineState,
      state[outputKey as keyof PipelineState],
      schema,
      false // Non-strict for now (warnings only)
    );
  }

  state.completedSteps.add(step.id);
  ```

- **Add helper function** after `topologicalSort` (around line 75):
  ```typescript
  /**
   * Map step IDs to their output state keys
   */
  function getStepOutputKey(stepId: string): keyof PipelineState | undefined {
    const stepOutputMap: Record<string, keyof PipelineState> = {
      scope: 'scope',
      intended: 'intended',
      working: 'working',
      drift: 'drift',
      legacy: 'legacy',
      bundle_facts: 'bundleFacts',
      embedding_index: 'embeddingMetrics',
      retrieve_history: 'history',
      llm_story: 'llmOutputs',
      index_commits: 'commitFacts',
      workspace_overlay: 'workspaceFacts',
    };
    return stepOutputMap[stepId];
  }
  ```

### Testing Requirements for Phase 2

- [ ] Create unit tests in `tests/unit/pipeline/preconditions.test.ts`
  - Test `verifyPreconditions()` with valid state
  - Test `verifyPreconditions()` with missing required state
  - Test `verifyPreconditions()` with missing completed steps
  - Test `verifyPostconditions()` with valid/invalid outputs

- [ ] Integration test: Run pipeline with missing preconditions (should fail early)

---

## Phase 3: Postcondition Validation

**Goal**: Validate step outputs match expected schemas after execution.

### Files Already Created (Phase 1)

- `src/analysis/runner/pipelineSchemas.ts` - Contains schemas
- `src/analysis/runner/pipelineVerification.ts` - Contains `verifyPostconditions()`

### Files Already Modified (Phase 2)

- `src/analysis/runner/pipelineRunner.ts` - Already has postcondition verification hooks

### Additional Files to Modify

#### 1. `src/analysis/runner/pipelineConfigs.ts` (CHECK IF EXISTS)

**If file exists**, add verification config:

```typescript
export interface PipelineVerificationConfig {
  enableVerification?: boolean; // Default: true in dev, false in prod
  strictVerification?: boolean; // Default: false - throw vs log warnings
  verifyInvariants?: boolean; // Default: true - check cross-step invariants
  verifyDatabase?: boolean; // Default: false - check DB table availability
}
```

**If file doesn't exist**, create it.

#### 2. `src/analysis/runner/pipelineTypes.ts`

**Lines to modify**:

- **Line 148-155**: Update `PipelineConfig` interface:
  ```typescript
  export interface PipelineConfig {
    concurrency: number;
    skipEmbedding?: boolean;
    skipLLM?: boolean;
    maxRetries?: number;
    enableCacheStats?: boolean;
    cacheTTL?: number;
    // NEW: Verification options
    enableVerification?: boolean;
    strictVerification?: boolean;
    verifyInvariants?: boolean;
  }
  ```

### Files to Modify for Conditional Postcondition Checks

#### 3. `src/analysis/runner/pipelineRunner.ts`

**Lines to modify**:

- **Line 77-82**: Update function signature to accept config:

  ```typescript
  export async function runPipeline(
    steps: PipelineStep[],
    initialState: Omit<PipelineState, 'completedSteps' | 'errors'>,
    token?: vscode.CancellationToken,
    onEvent?: PipelineEventHandler,
    config?: { enableVerification?: boolean; strictVerification?: boolean } // NEW
  ): Promise<PipelineState> {
  ```

- **Line 122-147**: Make verification conditional:

  ```typescript
  const enableVerification = config?.enableVerification !== false; // Default true
  const strictVerification = config?.strictVerification === true; // Default false

  try {
    if (token?.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    // Conditional precondition verification
    if (enableVerification) {
      verifyStepPreconditions(step.id, state);
    }

    onEvent?.({ type: 'start', step, state, timestamp: new Date().toISOString() });
    // ... execution ...

    // Conditional postcondition verification
    if (enableVerification) {
      const outputKey = getStepOutputKey(step.id);
      const schema = getStepOutputSchema(outputKey);
      if (outputKey && schema && state[outputKey as keyof PipelineState] !== undefined) {
        verifyPostconditions(
          step.id,
          outputKey as keyof PipelineState,
          state[outputKey as keyof PipelineState],
          schema,
          strictVerification
        );
      }
    }

    state.completedSteps.add(step.id);
    // ...
  ```

### Testing Requirements for Phase 3

- [ ] Test postcondition validation with valid outputs
- [ ] Test postcondition validation with invalid outputs (should warn/throw)
- [ ] Test conditional verification (enableVerification flag)
- [ ] Test strict vs non-strict mode

---

## Phase 3.5: Invalidation Infrastructure

**Goal**: Create system to invalidate stale data from database and embeddings when files change.

**Why This Phase is Critical**: Currently no invalidation system exists. When files change, stale symbols and embeddings can leak into results, causing incorrect analysis.

### Files to Create

#### 1. `src/analysis/invalidation/invalidationService.ts` (NEW FILE)

**Lines**: Entire file (new, ~400-500 lines)

```typescript
/**
 * Invalidation Service
 * Handles invalidation of stale data from database and embeddings
 */

import { getDatabaseManager } from '../../storage/database';
import { prepare } from '../../storage/statement-wrapper';
import { getQdrantClient } from '../../storage/qdrant';
import { logInfo, logDebug, logWarn } from '../../utils/logger';
import { DnaHash } from '../runner/pipelineBrandedTypes';

export interface InvalidationOptions {
  invalidateEmbeddings?: boolean; // Also invalidate Qdrant embeddings
  markStale?: boolean; // Mark as stale instead of deleting
  cascade?: boolean; // Cascade invalidation to dependent symbols
}

/**
 * Invalidate symbols for a specific file at a specific commit
 */
export async function invalidateFileSymbols(
  sha: string,
  filePath: string,
  options: InvalidationOptions = {}
): Promise<void> {
  const db = getDatabaseManager().getDatabase();

  logInfo(`[Invalidation] Invalidating symbols for ${filePath}@${sha.substring(0, 8)}`);

  if (options.markStale) {
    // Mark as stale instead of deleting
    const stmt = prepare(`
      UPDATE symbols
      SET completeness_flags = '{}'
      WHERE sha = ? AND path = ?
    `);
    stmt.run(sha, filePath);
    stmt.free?.();

    // Also mark file as stale
    const fileStmt = prepare(`
      UPDATE files
      SET completeness_flags = '{}'
      WHERE sha = ? AND path = ?
    `);
    fileStmt.run(sha, filePath);
    fileStmt.free?.();
  } else {
    // Delete symbols
    const stmt = prepare(`
      DELETE FROM symbols WHERE sha = ? AND path = ?
    `);
    stmt.run(sha, filePath);
    stmt.free?.();

    // Delete edges
    // Note: We need to get symbol IDs first, then delete edges
    const symbolStmt = prepare(`
      SELECT dna_id FROM symbols WHERE sha = ? AND path = ?
    `);
    const symbols = symbolStmt.all(sha, filePath) as Array<{ dna_id: string }>;
    symbolStmt.free?.();

    if (symbols.length > 0) {
      const dnaIds = symbols.map(s => s.dna_id);
      const placeholders = dnaIds.map(() => '?').join(',');

      // Delete edges that reference these symbols
      const edgeStmt = prepare(`
        DELETE FROM edges
        WHERE sha = ?
        AND (from_symbol_id IN (${placeholders}) OR to_symbol_id IN (${placeholders}))
      `);
      edgeStmt.run(sha, ...dnaIds, ...dnaIds);
      edgeStmt.free?.();
    }
  }

  // Invalidate embeddings if requested
  if (options.invalidateEmbeddings) {
    await invalidateEmbeddingsForFile(sha, filePath);
  }

  // Cascade invalidation if requested
  if (options.cascade) {
    await cascadeInvalidation(sha, filePath);
  }

  logDebug(`[Invalidation] Completed invalidation for ${filePath}@${sha.substring(0, 8)}`);
}

/**
 * Invalidate embeddings for a file
 */
async function invalidateEmbeddingsForFile(sha: string, filePath: string): Promise<void> {
  const qdrant = getQdrantClient();
  if (!(await qdrant.isEnabled())) {
    logDebug('[Invalidation] Qdrant not enabled, skipping embedding invalidation');
    return;
  }

  const client = await qdrant.getClient();
  if (!client) {
    logWarn('[Invalidation] Qdrant client unavailable, skipping embedding invalidation');
    return;
  }

  // Get symbol IDs for this file
  const db = getDatabaseManager().getDatabase();
  const stmt = prepare(`
    SELECT dna_id FROM symbols WHERE sha = ? AND path = ?
  `);
  const symbols = stmt.all(sha, filePath) as Array<{ dna_id: string }>;
  stmt.free?.();

  if (symbols.length === 0) {
    return;
  }

  // Delete embedding points for these symbols
  const projectId = await import('../../utils/config').then(m => m.getProjectId());
  if (!projectId) {
    logWarn('[Invalidation] No project ID, skipping embedding invalidation');
    return;
  }

  const collectionName = qdrant.getCollectionName('symbols', projectId);

  for (const symbol of symbols) {
    const pointId = symbolToPointId(symbol.dna_id, sha);
    try {
      await client.delete(collectionName, {
        wait: true,
        points: [pointId],
      });
      logDebug(
        `[Invalidation] Deleted embedding point for ${symbol.dna_id}@${sha.substring(0, 8)}`
      );
    } catch (error: any) {
      // Point might not exist, that's okay
      if (!error.message?.includes('not found')) {
        logWarn(`[Invalidation] Failed to delete embedding point: ${error.message}`);
      }
    }
  }
}

/**
 * Convert symbol DNA + SHA to Qdrant point ID
 * Must match EmbeddingIndexer.symbolToPointId()
 */
function symbolToPointId(dnaId: DnaHash, sha: string): number {
  const combined = `${dnaId}:${sha}`;
  // Simple hash to number (must match EmbeddingIndexer implementation)
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Cascade invalidation to dependent symbols
 * When a symbol is invalidated, invalidate symbols that depend on it
 */
async function cascadeInvalidation(sha: string, filePath: string): Promise<void> {
  const db = getDatabaseManager().getDatabase();

  // Get symbols from this file
  const symbolStmt = prepare(`
    SELECT dna_id FROM symbols WHERE sha = ? AND path = ?
  `);
  const symbols = symbolStmt.all(sha, filePath) as Array<{ dna_id: string }>;
  symbolStmt.free?.();

  if (symbols.length === 0) {
    return;
  }

  const dnaIds = symbols.map(s => s.dna_id);
  const placeholders = dnaIds.map(() => '?').join(',');

  // Find symbols that depend on these (via edges)
  const dependentStmt = prepare(`
    SELECT DISTINCT from_symbol_id as dna_id, path
    FROM edges
    WHERE sha = ?
    AND to_symbol_id IN (${placeholders})
  `);
  const dependents = dependentStmt.all(sha, ...dnaIds) as Array<{ dna_id: string; path: string }>;
  dependentStmt.free?.();

  // Mark dependents as stale (don't delete, just mark incomplete)
  for (const dependent of dependents) {
    const updateStmt = prepare(`
      UPDATE symbols
      SET completeness_flags = JSON_SET(
        completeness_flags,
        '$.edges', 0,
        '$.drift', 0,
        '$.legacy', 0
      )
      WHERE sha = ? AND dna_id = ?
    `);
    updateStmt.run(sha, dependent.dna_id);
    updateStmt.free?.();

    logDebug(`[Invalidation] Marked dependent symbol ${dependent.dna_id} as stale`);
  }
}

/**
 * Invalidate symbols by DNA hash (across all commits)
 */
export async function invalidateSymbolByDna(
  dnaId: DnaHash,
  options: InvalidationOptions = {}
): Promise<void> {
  const db = getDatabaseManager().getDatabase();

  logInfo(`[Invalidation] Invalidating symbol ${dnaId} across all commits`);

  if (options.markStale) {
    const stmt = prepare(`
      UPDATE symbols
      SET completeness_flags = '{}'
      WHERE dna_id = ?
    `);
    stmt.run(dnaId);
    stmt.free?.();
  } else {
    // Get all shas for this symbol
    const shaStmt = prepare(`
      SELECT DISTINCT sha FROM symbols WHERE dna_id = ?
    `);
    const shas = shaStmt.all(dnaId) as Array<{ sha: string }>;
    shaStmt.free?.();

    // Delete from each commit
    for (const { sha } of shas) {
      const deleteStmt = prepare(`
        DELETE FROM symbols WHERE sha = ? AND dna_id = ?
      `);
      deleteStmt.run(sha, dnaId);
      deleteStmt.free?.();

      // Delete edges
      const edgeStmt = prepare(`
        DELETE FROM edges
        WHERE sha = ?
        AND (from_symbol_id = ? OR to_symbol_id = ?)
      `);
      edgeStmt.run(sha, dnaId, dnaId);
      edgeStmt.free?.();

      // Invalidate embeddings
      if (options.invalidateEmbeddings) {
        await invalidateEmbeddingForSymbol(dnaId, sha);
      }
    }
  }
}

/**
 * Invalidate embedding for a specific symbol
 */
async function invalidateEmbeddingForSymbol(dnaId: DnaHash, sha: string): Promise<void> {
  const qdrant = getQdrantClient();
  if (!(await qdrant.isEnabled())) {
    return;
  }

  const client = await qdrant.getClient();
  if (!client) {
    return;
  }

  const projectId = await import('../../utils/config').then(m => m.getProjectId());
  if (!projectId) {
    return;
  }

  const collectionName = qdrant.getCollectionName('symbols', projectId);
  const pointId = symbolToPointId(dnaId, sha);

  try {
    await client.delete(collectionName, {
      wait: true,
      points: [pointId],
    });
    logDebug(`[Invalidation] Deleted embedding for ${dnaId}@${sha.substring(0, 8)}`);
  } catch (error: any) {
    if (!error.message?.includes('not found')) {
      logWarn(`[Invalidation] Failed to delete embedding: ${error.message}`);
    }
  }
}

/**
 * Check if file needs invalidation (file changed since last scan)
 */
export async function shouldInvalidateFile(filePath: string, currentSha: string): Promise<boolean> {
  const db = getDatabaseManager().getDatabase();

  // Get latest scan SHA for this file
  const stmt = prepare(`
    SELECT MAX(sha) as latest_sha
    FROM symbols
    WHERE path = ?
    AND JSON_EXTRACT(completeness_flags, '$.symbols') = 1
  `);
  const row = stmt.get(filePath) as { latest_sha: string } | undefined;
  stmt.free?.();

  if (!row || !row.latest_sha) {
    return true; // Never scanned, needs scanning (not invalidation)
  }

  // Compare SHAs (simplified - in practice might need commit graph traversal)
  return row.latest_sha !== currentSha;
}
```

### Files to Create

#### 2. `src/analysis/invalidation/fileWatcherIntegration.ts` (NEW FILE)

**Lines**: Entire file (new, ~150-200 lines)

```typescript
/**
 * File watcher integration for automatic invalidation
 * Watches for file changes and invalidates stale data
 */

import * as vscode from 'vscode';
import { invalidateFileSymbols } from './invalidationService';
import { GitOperations } from '../git';
import { logInfo, logDebug } from '../../utils/logger';

export class FileChangeInvalidator {
  private disposables: vscode.Disposable[] = [];
  private git: GitOperations;
  private invalidateTimeout: NodeJS.Timeout | null = null;
  private pendingInvalidations = new Set<string>();

  constructor() {
    this.git = new GitOperations();
  }

  /**
   * Start watching for file changes
   */
  startWatching(): void {
    const gitRoot = this.git.getRoot();
    if (!gitRoot) {
      logDebug('[FileInvalidator] Not in git repo, skipping file watcher');
      return;
    }

    const pattern = new vscode.RelativePattern(
      vscode.Uri.file(gitRoot),
      '**/*.{ts,js,tsx,jsx,py,go,rs,java,kt,swift,cpp,c,cc,h,hpp}'
    );

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    watcher.onDidChange(async uri => {
      await this.handleFileChange(uri);
    });

    watcher.onDidDelete(async uri => {
      await this.handleFileChange(uri);
    });

    this.disposables.push(watcher);
    logInfo('[FileInvalidator] Started watching for file changes');
  }

  /**
   * Handle file change event
   */
  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    const gitRoot = this.git.getRoot();
    if (!gitRoot) {
      return;
    }

    const filePath = vscode.workspace.asRelativePath(uri, false);

    // Debounce invalidation (multiple rapid changes)
    this.pendingInvalidations.add(filePath);

    if (this.invalidateTimeout) {
      clearTimeout(this.invalidateTimeout);
    }

    this.invalidateTimeout = setTimeout(async () => {
      await this.processPendingInvalidations();
      this.invalidateTimeout = null;
    }, 2000); // 2 second debounce
  }

  /**
   * Process all pending invalidations
   */
  private async processPendingInvalidations(): Promise<void> {
    if (this.pendingInvalidations.size === 0) {
      return;
    }

    const headSha = await this.git.getHeadSha();
    if (!headSha) {
      logDebug('[FileInvalidator] No HEAD SHA, skipping invalidation');
      this.pendingInvalidations.clear();
      return;
    }

    logInfo(`[FileInvalidator] Invalidating ${this.pendingInvalidations.size} changed files`);

    for (const filePath of this.pendingInvalidations) {
      try {
        await invalidateFileSymbols(headSha, filePath, {
          invalidateEmbeddings: true,
          markStale: true, // Mark as stale instead of deleting (safer)
          cascade: false, // Don't cascade to avoid performance issues
        });
      } catch (error: any) {
        logDebug(`[FileInvalidator] Failed to invalidate ${filePath}: ${error.message}`);
      }
    }

    this.pendingInvalidations.clear();
  }

  /**
   * Stop watching
   */
  dispose(): void {
    if (this.invalidateTimeout) {
      clearTimeout(this.invalidateTimeout);
    }
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
```

### Files to Modify

#### 3. `src/storage/databaseWriteQueue.ts`

**Lines to modify** (around line 357):

- Before writing symbols, check if file needs invalidation:

  ```typescript
  import { shouldInvalidateFile } from '../../analysis/invalidation/invalidationService';

  private flushSymbols(ops: Array<WriteOperation & { type: 'symbol' }>): void {
    // ... existing code ...

    // Before writing, invalidate stale data
    const filesToCheck = new Set(ops.map(op => op.data.path));
    for (const filePath of filesToCheck) {
      const op = ops.find(o => o.data.path === filePath);
      if (op) {
        const needsInvalidation = await shouldInvalidateFile(filePath, op.data.sha);
        if (needsInvalidation) {
          await invalidateFileSymbols(op.data.sha, filePath, {
            invalidateEmbeddings: true,
            markStale: false, // Delete old data before writing new
          });
        }
      }
    }

    // ... continue with existing write logic ...
  }
  ```

#### 4. `src/core/fileWatchers.ts`

**Lines to modify**:

- Add file change invalidator integration:

  ```typescript
  import { FileChangeInvalidator } from '../analysis/invalidation/fileWatcherIntegration';

  let fileInvalidator: FileChangeInvalidator | undefined;

  const setupWatchers = async () => {
    // ... existing code ...

    // Start file change invalidator
    if (!fileInvalidator) {
      fileInvalidator = new FileChangeInvalidator();
      fileInvalidator.startWatching();
    }

    // ... rest of setup ...
  };

  // Cleanup on dispose
  return {
    dispose: () => {
      // ... existing cleanup ...
      fileInvalidator?.dispose();
    },
  };
  ```

#### 5. `src/analysis/embeddingIndexer.ts`

**Lines to modify** (around line 139):

- Before indexing, check if embedding already exists and is valid:

  ```typescript
  import { getSymbolCompleteness } from '../runner/completenessTracking';

  // In indexSymbolShards(), before indexing:
  for (const { shard, symbol } of symbolShards) {
    const completeness = getSymbolCompleteness(facts.sha, symbol.symbol_dna_id);
    if (completeness.embeddings) {
      // Already indexed and complete, skip
      logDebug(`[EmbeddingIndexer] Skipping ${symbol.symbol_dna_id} - already indexed`);
      continue;
    }

    // ... proceed with indexing ...
  }
  ```

### Testing Requirements for Phase 3.5

- [ ] Test `invalidateFileSymbols()` deletes/marks stale symbols
- [ ] Test `invalidateEmbeddingsForFile()` deletes Qdrant points
- [ ] Test `cascadeInvalidation()` marks dependent symbols stale
- [ ] Test file watcher integration triggers invalidation
- [ ] Test `shouldInvalidateFile()` correctly detects stale files
- [ ] Integration test: Change file, verify stale data is invalidated
- [ ] Performance test: Invalidation doesn't block main pipeline

---

## Phase 4: Cross-Step Invariants

**Goal**: Verify consistency relationships between related step outputs.

### Files to Create

#### 1. `src/analysis/runner/pipelineInvariants.ts` (NEW FILE)

**Lines**: Entire file (new, ~300-400 lines)

```typescript
import { PipelineState } from './pipelineTypes';
import { IntendedState } from './pipelineSchemas';
import { DriftFindings } from './pipelineSchemas';
import { WorkingSnapshot } from './pipelineSchemas';
import { LegacyAuditResult } from './pipelineSchemas';
import { DnaHash } from './pipelineBrandedTypes';
import { SymbolId } from './pipelineBrandedTypes';
import { logError, logWarn } from '../../utils/logger';

/**
 * Verify invariants between drift findings and intended/working states
 */
export function verifyDriftInvariants(
  intended: Map<DnaHash, IntendedState>,
  working: WorkingSnapshot,
  drift: DriftFindings
): string[] {
  const errors: string[] = [];

  // Invariant: All missing_symbols must reference symbols in intended map
  for (const missing of drift.missing_symbols) {
    // Extract DNA hash from symbol_id if needed
    const dnaHash = extractDnaHash(missing.symbol_id);
    if (!intended.has(dnaHash)) {
      errors.push(
        `Drift invariant violation: missing_symbol '${missing.symbol_id}' references non-existent intended entry`
      );
    } else {
      const intendedState = intended.get(dnaHash)!;
      if (intendedState.expect !== 'present') {
        errors.push(
          `Drift invariant violation: missing_symbol '${missing.symbol_id}' expected 'present' but intended says '${intendedState.expect}'`
        );
      }
    }
  }

  // Invariant: All zombie_symbols must reference symbols in working snapshot
  for (const zombie of drift.zombie_symbols) {
    const dnaHash = extractDnaHash(zombie.symbol_id);
    if (!working.symbolsById.has(zombie.symbol_id as any)) {
      errors.push(
        `Drift invariant violation: zombie_symbol '${zombie.symbol_id}' references non-existent working entry`
      );
    }

    // Also check intended expects 'absent'
    if (intended.has(dnaHash)) {
      const intendedState = intended.get(dnaHash)!;
      if (intendedState.expect !== 'absent') {
        errors.push(
          `Drift invariant violation: zombie_symbol '${zombie.symbol_id}' expected 'absent' but intended says '${intendedState.expect}'`
        );
      }
    }
  }

  // Invariant: All divergent_symbols must exist in both intended and working
  for (const divergent of drift.divergent_symbols) {
    const dnaHash = extractDnaHash(divergent.symbol_id);
    if (!intended.has(dnaHash)) {
      errors.push(
        `Drift invariant violation: divergent_symbol '${divergent.symbol_id}' missing from intended map`
      );
    }
    if (!working.symbolsById.has(divergent.symbol_id as any)) {
      errors.push(
        `Drift invariant violation: divergent_symbol '${divergent.symbol_id}' missing from working snapshot`
      );
    }
  }

  // Invariant: Edge references must be valid
  for (const edge of drift.missing_edges || []) {
    const fromDna = extractDnaHash(edge.from);
    const toDna = extractDnaHash(edge.to);
    if (!intended.has(fromDna) && !intended.has(toDna)) {
      errors.push(
        `Drift invariant violation: missing_edge '${edge.from}' -> '${edge.to}' references symbols not in intended map`
      );
    }
  }

  for (const edge of drift.zombie_edges || []) {
    if (!working.symbolsById.has(edge.from as any) && !working.symbolsById.has(edge.to as any)) {
      errors.push(
        `Drift invariant violation: zombie_edge '${edge.from}' -> '${edge.to}' references symbols not in working snapshot`
      );
    }
  }

  return errors;
}

/**
 * Verify invariants between legacy audit and drift findings
 */
export function verifyLegacyInvariants(
  intended: Map<DnaHash, IntendedState>,
  working: WorkingSnapshot,
  drift: DriftFindings,
  legacy: LegacyAuditResult
): string[] {
  const errors: string[] = [];

  // Invariant: All dead symbols must exist in working snapshot
  for (const dead of legacy.dead) {
    if (!working.symbolsById.has(dead.symbol_id as any)) {
      errors.push(
        `Legacy invariant violation: dead symbol '${dead.symbol_id}' not found in working snapshot`
      );
    }
  }

  // Invariant: All legacyUsed symbols should be marked as 'absent' in intended
  for (const legacyUsed of legacy.legacyUsed) {
    const dnaHash = extractDnaHash(legacyUsed.symbol_id);
    if (intended.has(dnaHash)) {
      const intendedState = intended.get(dnaHash)!;
      if (intendedState.expect !== 'absent') {
        errors.push(
          `Legacy invariant violation: legacyUsed symbol '${legacyUsed.symbol_id}' expected 'absent' but intended says '${intendedState.expect}'`
        );
      }
    }
  }

  // Invariant: replacedLeftovers should have old symbol marked absent and new symbol present
  for (const replaced of legacy.replacedLeftovers) {
    const oldDna = extractDnaHash(replaced.old.symbol_id);
    const newDna = extractDnaHash(replaced.new.symbol_id);

    if (intended.has(oldDna)) {
      const oldIntended = intended.get(oldDna)!;
      if (oldIntended.expect !== 'absent') {
        errors.push(
          `Legacy invariant violation: replacedLeftover old symbol '${replaced.old.symbol_id}' expected 'absent'`
        );
      }
    }

    if (intended.has(newDna)) {
      const newIntended = intended.get(newDna)!;
      if (newIntended.expect !== 'present') {
        errors.push(
          `Legacy invariant violation: replacedLeftover new symbol '${replaced.new.symbol_id}' expected 'present'`
        );
      }
    }
  }

  return errors;
}

/**
 * Verify bundle facts invariants
 */
export function verifyBundleFactsInvariants(state: PipelineState): string[] {
  const errors: string[] = [];

  if (!state.bundleFacts) {
    return errors; // Bundle facts are optional
  }

  // Invariant: Bundle facts should reference existing drift findings
  if (state.drift && state.bundleFacts.incompleteness) {
    const bundleMissing = state.bundleFacts.incompleteness?.missing || [];
    const driftMissing = state.drift.missing_symbols || [];

    // Check that bundle facts missing symbols are a subset of drift missing symbols
    const driftMissingIds = new Set(driftMissing.map(m => m.symbol_id));
    for (const bundleMissingItem of bundleMissing) {
      if (!driftMissingIds.has(bundleMissingItem.symbol_id)) {
        errors.push(
          `Bundle facts invariant violation: missing symbol '${bundleMissingItem.symbol_id}' in bundle facts but not in drift findings`
        );
      }
    }
  }

  // Add more bundle facts invariants as needed

  return errors;
}

/**
 * Helper: Extract DNA hash from symbol ID
 */
function extractDnaHash(symbolId: SymbolId | string): DnaHash {
  if (typeof symbolId === 'string' && symbolId.startsWith('dna:')) {
    return symbolId as DnaHash;
  }
  // If it's not a DNA hash, we can't extract it - this might be an error
  // For now, return as-is (this is a limitation to address)
  return symbolId as unknown as DnaHash;
}

/**
 * Verify all relevant invariants after a step completes
 */
export function verifyStepInvariants(
  stepId: string,
  state: PipelineState,
  strict: boolean = false
): void {
  const allErrors: string[] = [];

  // Verify drift invariants (if drift step just completed)
  if (stepId === 'drift' && state.intended && state.working && state.drift) {
    const errors = verifyDriftInvariants(
      state.intended as Map<DnaHash, IntendedState>,
      state.working,
      state.drift
    );
    allErrors.push(...errors);
  }

  // Verify legacy invariants (if legacy step just completed)
  if (stepId === 'legacy' && state.intended && state.working && state.drift && state.legacy) {
    const errors = verifyLegacyInvariants(
      state.intended as Map<DnaHash, IntendedState>,
      state.working,
      state.drift,
      state.legacy
    );
    allErrors.push(...errors);
  }

  // Verify bundle facts invariants (if bundle_facts step just completed)
  if (stepId === 'bundle_facts') {
    const errors = verifyBundleFactsInvariants(state);
    allErrors.push(...errors);
  }

  // Report errors
  if (allErrors.length > 0) {
    const errorMessage = `[${stepId}] Invariant violations:\n${allErrors.map(e => `  - ${e}`).join('\n')}`;

    if (strict) {
      logError(errorMessage);
      throw new Error(errorMessage);
    } else {
      logWarn(errorMessage);
    }
  }
}
```

### Files to Modify

#### 2. `src/analysis/runner/pipelineRunner.ts`

**Lines to modify**:

- **Line 1-7**: Add import:

  ```typescript
  import { verifyStepInvariants } from './pipelineInvariants';
  ```

- **Line 147-155**: Add invariant verification after postconditions:

  ```typescript
  // Conditional postcondition verification
  if (enableVerification) {
    const outputKey = getStepOutputKey(step.id);
    const schema = getStepOutputSchema(outputKey);
    if (outputKey && schema && state[outputKey as keyof PipelineState] !== undefined) {
      verifyPostconditions(
        step.id,
        outputKey as keyof PipelineState,
        state[outputKey as keyof PipelineState],
        schema,
        strictVerification
      );
    }

    // NEW: Verify cross-step invariants
    const verifyInvariants = config?.verifyInvariants !== false; // Default true
    if (verifyInvariants) {
      verifyStepInvariants(step.id, state, strictVerification);
    }
  }

  state.completedSteps.add(step.id);
  ```

### Testing Requirements for Phase 4

- [ ] Create unit tests in `tests/unit/pipeline/invariants.test.ts`
  - Test `verifyDriftInvariants()` with valid data
  - Test `verifyDriftInvariants()` with invalid references
  - Test `verifyLegacyInvariants()` with valid/invalid data
  - Test `verifyBundleFactsInvariants()`

- [ ] Integration test: Run pipeline and verify invariants are checked

---

## Phase 5: Advanced TypeScript Types

**Goal**: Use conditional types and template literals to encode dependencies in the type system.

### Files to Create

#### 1. `src/analysis/runner/pipelineAdvancedTypes.ts` (NEW FILE)

**Lines**: Entire file (new, ~200-300 lines)

```typescript
import { PipelineState } from './pipelineTypes';
import { IntendedState } from './pipelineSchemas';
import { WorkingSnapshot } from './pipelineSchemas';
import { ScopeSet } from './pipelineSchemas';
import { DriftFindings } from './pipelineSchemas';
import { LegacyAuditResult } from './pipelineSchemas';
import { DnaHash } from './pipelineBrandedTypes';

/**
 * Step IDs - use template literal type for compile-time safety
 */
export type StepId =
  | 'init'
  | 'workspace_overlay'
  | 'scope'
  | 'index_commits'
  | 'size'
  | 'working'
  | 'intended'
  | 'hotspots'
  | 'moved_blocks'
  | 'drift'
  | 'legacy'
  | 'bundle_facts'
  | 'embedding_index'
  | 'retrieve_history'
  | 'llm_story';

/**
 * Step dependencies - maps step IDs to their output state keys
 */
export type StepOutputs = {
  init: 'plan';
  workspace_overlay: 'workspaceFacts';
  scope: 'scope';
  index_commits: 'commitFacts';
  size: never; // size step doesn't produce output
  working: 'working';
  intended: 'intended';
  hotspots: 'hotspots';
  moved_blocks: 'movedBlocks';
  drift: 'drift';
  legacy: 'legacy';
  bundle_facts: 'bundleFacts';
  embedding_index: 'embeddingMetrics';
  retrieve_history: 'history';
  llm_story: 'llmOutputs';
};

/**
 * Conditional type: State is complete if output key exists and is non-nullable
 */
type StepComplete<T extends StepId> = PipelineState &
  Record<StepOutputs[T], NonNullable<PipelineState[StepOutputs[T]]>>;

/**
 * Multiple step completion - union of completed steps
 */
type StepsComplete<T extends readonly StepId[]> = T extends readonly [infer First, ...infer Rest]
  ? First extends StepId
    ? Rest extends readonly StepId[]
      ? StepComplete<First> & StepsComplete<Rest>
      : StepComplete<First>
    : never
  : PipelineState;

/**
 * Example: Drift step requires 'intended', 'working', 'scope'
 */
export type DriftStepState = StepsComplete<['intended', 'working', 'scope']> & {
  intended: Map<DnaHash, IntendedState>;
  working: WorkingSnapshot;
  scope: ScopeSet;
};

/**
 * Example: Legacy step requires 'intended', 'working', 'scope'
 */
export type LegacyStepState = StepsComplete<['intended', 'working', 'scope']> & {
  intended: Map<DnaHash, IntendedState>;
  working: WorkingSnapshot;
  scope: ScopeSet;
};

/**
 * Example: Bundle facts step requires many dependencies
 */
export type BundleFactsStepState = StepsComplete<
  ['scope', 'intended', 'working', 'drift', 'legacy', 'hotspots', 'index_commits']
> & {
  scope: ScopeSet;
  intended: Map<DnaHash, IntendedState>;
  working: WorkingSnapshot;
  drift: DriftFindings;
  legacy: LegacyAuditResult;
  commitFacts: any[];
};

/**
 * Generic step runner type that enforces dependencies
 */
export type StepRunner<TStepId extends StepId, TDeps extends readonly StepId[]> = (
  state: StepsComplete<TDeps>,
  token: any // vscode.CancellationToken
) => Promise<void> | void;

/**
 * Type-safe step definition
 */
export interface TypedPipelineStep<TDeps extends readonly StepId[] = []> {
  id: StepId;
  label: string;
  deps: TDeps;
  run: StepRunner<this['id'], TDeps>;
}

// Example usage (for future migration):
// export function createDriftStep(): TypedPipelineStep<['intended', 'working', 'scope']> {
//   return {
//     id: 'drift',
//     label: 'Detect drift',
//     deps: ['intended', 'working', 'scope'] as const,
//     async run(state) {
//       // state.intended, state.working, state.scope are guaranteed to exist
//       const drift = await detector.detect({
//         intended: state.intended,
//         working: state.working,
//         commitShas: state.selectedCommitShas,
//       });
//       state.drift = drift;
//     },
//   };
// }
```

### Files to Modify (Future Migration)

**Note**: Phase 5 types are for future enhancement. Current steps can gradually migrate to use these types.

#### 2. `src/analysis/runner/pipelineTypes.ts`

**Lines to modify** (OPTIONAL - for future):

- Consider adding `TypedPipelineStep` as an alternative to `PipelineStep` for new steps

### Testing Requirements for Phase 5

- [ ] Type-level tests (compile-time checks)
  - Verify `DriftStepState` requires intended, working, scope
  - Verify `StepRunner` enforces dependencies
  - Test that invalid dependencies cause compile errors

---

## Phase 6: Integration into Pipeline Runner

**Goal**: Final integration with configuration and documentation.

### Files Already Modified

- `src/analysis/runner/pipelineRunner.ts` - Already has verification hooks (Phase 2-4)

### Files to Modify

#### 1. `src/analysis/refactorPipeline.ts`

**Lines to modify** (need to check file):

- Update `PipelineConfig` usage to pass verification config to `runPipeline`

#### 2. `src/analysis/runner/pipelineConfigs.ts` (if exists)

**Add verification defaults**:

```typescript
export const DEFAULT_VERIFICATION_CONFIG = {
  enableVerification: process.env.NODE_ENV !== 'production', // false in prod
  strictVerification: false, // warnings only
  verifyInvariants: true,
  verifyDatabase: false,
};
```

### Files to Create

#### 3. `docs/pipeline-verification.md` (NEW FILE)

Documentation for the verification system.

---

## Summary Checklist

### Phase 0.5: ID Alignment Audit & Standardization (CRITICAL - DO FIRST)

- [ ] Create `idAlignmentAudit.ts` audit tool
- [ ] Run audit and document all ID field usage
- [ ] Create `ID_ALIGNMENT_RULES.md` document
- [ ] Remove `SymbolInfo.semanticId` (legacy field)
- [ ] Remove `SymbolContext.dnaId` (legacy field)
- [ ] Fix all code using `semanticId` or `.dnaId`
- [ ] Verify database queries use correct fields (`dna_id` for DNA hash, `symbol_id` for semantic ID)
- [ ] Create ID alignment tests
- [ ] Integration test: Quick scan and full scan produce identical ID structures

### Phase 0: Branded Types & Type Guards

- [ ] Create `pipelineBrandedTypes.ts`
- [ ] Update `drift.ts` types
- [ ] Update `intendedMap.ts` return types
- [ ] Update `pipelineTypes.ts` state types
- [ ] Create `pipelineTypeGuards.ts`
- [ ] Update step files to use type guards
- [ ] Create tests

### Phase 1: Runtime Schema Validation

- [ ] Install `zod` package
- [ ] Create `pipelineSchemas.ts` with all schemas
- [ ] Update type exports to use schemas
- [ ] Create tests

### Phase 1.5: Granular Completeness System

- [ ] Create migration file `add_completeness_flags.ts`
- [ ] Update database schema to add `completeness_flags` columns
- [ ] Run migration
- [ ] Create `completenessTracking.ts` utilities
- [ ] Update `databaseWriteQueue.ts` to set completeness flags
- [ ] Update `hotspotStep.ts` to update completeness after calculation
- [ ] Update `driftStep.ts` to update completeness after detection
- [ ] Update `legacyStep.ts` to update completeness after audit
- [ ] Create tests for completeness tracking
- [ ] Integration test: Detect incomplete dimensions and rescan

### Phase 1.6: Scan Mode Identity Verification

- [ ] Create `unifiedSymbolExtraction.ts`
- [ ] Update `workspaceIndexer.ts` to use unified extraction
- [ ] Update `commitIndexer.ts` to use unified extraction
- [ ] Create `scanModeIdentity.test.ts`
- [ ] Verify quick scan and full scan produce identical symbol structures
- [ ] Verify only edges differ between modes

### Phase 2: Precondition Checking

- [ ] Create `stepPreconditions.ts`
- [ ] Create `pipelineVerification.ts`
- [ ] Update `pipelineRunner.ts` with precondition checks
- [ ] Create tests

### Phase 3: Postcondition Validation

- [ ] Update `pipelineRunner.ts` with postcondition checks
- [ ] Add config options for verification
- [ ] Create tests

### Phase 3.5: Invalidation Infrastructure

- [ ] Create `invalidationService.ts`
- [ ] Create `fileWatcherIntegration.ts`
- [ ] Update `databaseWriteQueue.ts` to check invalidation before write
- [ ] Update `fileWatchers.ts` to integrate invalidator
- [ ] Update `embeddingIndexer.ts` to check completeness before indexing
- [ ] Create tests for invalidation
- [ ] Integration test: Change file, verify stale data is invalidated
- [ ] Performance test: Invalidation doesn't block pipeline

### Phase 4: Cross-Step Invariants

- [ ] Create `pipelineInvariants.ts`
- [ ] Update `pipelineRunner.ts` with invariant checks
- [ ] Create tests

### Phase 5: Advanced TypeScript Types

- [ ] Create `pipelineAdvancedTypes.ts`
- [ ] (Optional) Migrate steps to use typed step definitions
- [ ] Create type-level tests

### Phase 6: Integration

- [ ] Update pipeline config usage
- [ ] Create documentation
- [ ] Final integration testing

---

## Notes

1. **Order Matters**: Complete each phase fully before moving to the next
2. **Testing**: Write tests as you implement each phase
3. **Backward Compatibility**: Keep existing interfaces working during migration
4. **Fail Fast**: Verification failures should throw errors (per project philosophy)
5. **Performance**: Consider making verification optional in production builds

## Compatibility with Quick Scan Architecture

The verification system is designed to be fully compatible with the Quick Scan Architecture (`docs/QUICK_SCAN_ARCHITECTURE.md`):

1. **ID Structure Preserved**: Branded types (`SymbolId`, `DnaHash`, `CommitSha`) are compile-time only and erase to `string` at runtime. The composite ID structure `${path}:${sha}:${id}` used in `factsMerger.ts` remains unchanged.

2. **Database Writes Unaffected**: Verification happens around step execution, not during database write operations. The `DatabaseWriteQueue` and `INSERT OR REPLACE` behavior is unchanged.

3. **Completeness Markers Enhanced**: Phase 1.5 adds granular completeness tracking in the database, enhancing (not replacing) the existing `complete: true/false` UI markers.

4. **ChangeType Tracking Preserved**: Verification does not interfere with `changeType` values (`'quick_scan'`, `'priority_click'`, `'added'`, etc.).

5. **Pipeline Dependencies Enhanced**: Verification enforces the existing dependency graph more strictly, preventing the bugs documented in `pipeline-dependency-audit.md`.

6. **Scan Mode Identity**: Phase 1.6 ensures quick scan and full scan produce identical symbol structures, with only completeness flags differing (aligning with Quick Scan Architecture principle that scans should be identical except for completeness).

7. **Invalidation System**: Phase 3.5 ensures stale data is properly invalidated when files change, preventing data leakage between quick scan and full scan modes.
