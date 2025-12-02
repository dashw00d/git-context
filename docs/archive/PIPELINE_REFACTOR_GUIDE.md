# Complete Pipeline Refactor Guide

**Goal:** Transform the Git Context analysis pipeline from sequential, heavyweight analysis to a layered, cacheable, concurrent architecture with clean async orchestration.

**Two-Part Refactor:**
1. **Reorder & Enhance Pipeline Flow** - Layer-based architecture with content-addressed caching
2. **Async Runner Framework** - Clean sequential steps with internal concurrency

---

## Table of Contents
1. [Current State Analysis](#current-state-analysis)
2. [New Architecture Overview](#new-architecture-overview)
3. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure)
4. [Phase 2: Layer Implementation](#phase-2-layer-implementation)
5. [Phase 3: Runner Integration](#phase-3-runner-integration)
6. [Phase 4: Service & Command Updates](#phase-4-service--command-updates)
5. [Phase 5: State & UI Integration](#phase-5-state--ui-integration)
6. [Phase 6: Testing & Validation](#phase-6-testing--validation)
7. [Migration Checklist](#migration-checklist)

---

## Current State Analysis

### Bottlenecks Identified

**Problem 1: No Blob-Level Caching**
- Current: Tree-sitter runs per commit, per file (even if blob unchanged)
- Impact: 10 commits touching same file = 10× redundant parses
- Solution: Content-addressed snapshot cache keyed by blobSha

**Problem 2: Difftastic Redundancy**
- Current: Runs on every file pair in every commit
- Impact: Same diff computed multiple times across commits
- Solution: Cache structural diffs by (parentBlobSha, currentBlobSha)

**Problem 3: Sequential Commit Processing**
- Current: `for (const sha of shas) { await analyzeCommit(sha) }`
- Impact: No parallelization of independent commits
- Solution: Concurrent processing with `runWithConcurrency()`

**Problem 4: Heavyweight Analysis Always Runs**
- Current: No separation between metadata load and full analysis
- Impact: Can't quickly show commit list without analyzing
- Solution: `ensureCommitIndexed()` checks analysis status first

**Problem 5: LLM in Wrong Layer**
- Current: LLM runs per commit (expensive, duplicates context)
- Impact: Token waste, slow, no cross-commit narrative
- Solution: Move LLM to bundle layer only, use cheap model for micro-summaries

**Problem 6: No Embedding-Based History Retrieval**
- Current: No way to find related refactors across time
- Impact: LLM lacks historical context for drift analysis
- Solution: Qdrant cross-time retrieval before LLM analysis

---

## New Architecture Overview

### Five-Layer Model

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 0: RAW SOURCES                                    │
│  Git history (immutable) + Workspace (mutable)          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: STRUCTURAL INDEX                               │
│  file_snapshots table (blobSha → symbols + edges)       │
│  structural_diffs table (blobPair → morph metrics)      │
│  Tools: Tree-sitter (cached), Difftastic (cached)       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: COMMIT FACTS                                   │
│  commits_analysis, symbols, edges, risks (per commit)   │
│  Tools: Risk detector, rename detector, metrics         │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 3: SEMANTIC MEMORY                                │
│  Qdrant vectors: commit shards, symbol shards           │
│  Tools: Embedding API, cross-time retrieval             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 4: BUNDLE STORY ENGINE                            │
│  Bundle facts + retrieved history → LLM narrative       │
│  Tools: LLM (premium model for story, cheap for shards) │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ LAYER 5: COCKPIT UI                                     │
│  React webview consuming DB + LLM outputs (read-only)   │
└─────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Content-Addressed Caching**: Snapshots and diffs keyed by git blob SHA
2. **Lazy Analysis**: Check `analysis_version` before running heavyweight steps
3. **Separation of Concerns**: Metadata → Structure → Facts → Memory → Story
4. **Internal Concurrency**: Sequential steps, but parallel work inside each step
5. **LLM at Bundle Layer**: Only run expensive LLM on aggregated facts

---

## Phase 1: Core Infrastructure

### Step 1.1: Create Database Schema for New Tables

**File:** `src/storage/schema.ts`

**Add to schema:**

```typescript
// Layer 1: Structural Index
CREATE TABLE IF NOT EXISTS file_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  language TEXT,
  symbols_json TEXT NOT NULL,  -- SymbolInfo[]
  edges_json TEXT NOT NULL,     -- EdgeInfo[]
  scope_path TEXT,
  shape_hash TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(blob_sha, file_path)
);
CREATE INDEX idx_snapshots_blob ON file_snapshots(blob_sha);

CREATE TABLE IF NOT EXISTS structural_diffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_blob_sha TEXT NOT NULL,
  current_blob_sha TEXT NOT NULL,
  file_path TEXT NOT NULL,
  structural_change_score REAL,
  control_flow_changed INTEGER,
  interface_changed INTEGER,
  moved_blocks INTEGER,
  lines_added INTEGER,
  lines_removed INTEGER,
  data_json TEXT,  -- Full difftastic output
  created_at TEXT NOT NULL,
  UNIQUE(parent_blob_sha, current_blob_sha, file_path)
);
CREATE INDEX idx_structural_diffs_pair ON structural_diffs(parent_blob_sha, current_blob_sha);

// Layer 2: Enhanced commit tracking
ALTER TABLE commits_analysis ADD COLUMN analysis_version TEXT DEFAULT '0.0';
ALTER TABLE commits_analysis ADD COLUMN status TEXT DEFAULT 'pending'; -- pending, complete, failed
```

**Migration function:**

```typescript
export function migrateToV2(db: Database): void {
  db.exec(`
    ${/* new table definitions */}

    -- Mark existing commits as analysis_version '1.0' (legacy)
    UPDATE commits_analysis
    SET analysis_version = '1.0', status = 'complete'
    WHERE analysis_version IS NULL;
  `);
}
```

**Add to schema.ts:**

```typescript
export const ANALYSIS_VERSION = '2.0'; // New pipeline version
```

---

### Step 1.2: Create Snapshot Manager

**New File:** `src/analysis/snapshotManager.ts`

```typescript
import { Database } from 'sql.js';
import { SymbolInfo, EdgeInfo } from '../types';
import { SymbolExtractor } from './symbols';
import { DependencyExtractor } from './dependencies';
import { logDebug } from '../utils/logger';

export interface FileSnapshot {
  blobSha: string;
  filePath: string;
  language: string;
  symbols: SymbolInfo[];
  edges: EdgeInfo[];
  shapeHash?: string;
}

export class SnapshotManager {
  constructor(
    private db: Database,
    private symbolExtractor: SymbolExtractor,
    private dependencyExtractor: DependencyExtractor
  ) {}

  /**
   * Get or create snapshot for a blob (content-addressed caching)
   */
  async getOrCreateSnapshot(
    filePath: string,
    blobSha: string,
    content: string
  ): Promise<FileSnapshot> {
    // Check cache
    const cached = this.getCachedSnapshot(blobSha, filePath);
    if (cached) {
      logDebug(`[Snapshot] Cache hit for ${filePath}@${blobSha.substring(0, 8)}`);
      return cached;
    }

    // Parse with Tree-sitter
    logDebug(`[Snapshot] Creating snapshot for ${filePath}@${blobSha.substring(0, 8)}`);
    const language = this.detectLanguage(filePath);
    const symbols = await this.symbolExtractor.extractSymbolsFromContent(
      content,
      filePath,
      language
    );

    const edges = await this.dependencyExtractor.extractEdgesFromContent(
      content,
      filePath,
      language,
      symbols
    );

    const shapeHash = this.computeShapeHash(symbols);

    const snapshot: FileSnapshot = {
      blobSha,
      filePath,
      language,
      symbols,
      edges,
      shapeHash
    };

    // Store to cache
    this.storeSnapshot(snapshot);

    return snapshot;
  }

  private getCachedSnapshot(blobSha: string, filePath: string): FileSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM file_snapshots
      WHERE blob_sha = ? AND file_path = ?
    `);
    const row = stmt.get(blobSha, filePath);
    if (!row) return null;

    return {
      blobSha: row.blob_sha,
      filePath: row.file_path,
      language: row.language,
      symbols: JSON.parse(row.symbols_json),
      edges: JSON.parse(row.edges_json),
      shapeHash: row.shape_hash
    };
  }

  private storeSnapshot(snapshot: FileSnapshot): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_snapshots
      (blob_sha, file_path, language, symbols_json, edges_json, shape_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.blobSha,
      snapshot.filePath,
      snapshot.language,
      JSON.stringify(snapshot.symbols),
      JSON.stringify(snapshot.edges),
      snapshot.shapeHash,
      new Date().toISOString()
    );
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'php':
        return 'php';
      default:
        return 'unknown';
    }
  }

  private computeShapeHash(symbols: SymbolInfo[]): string {
    // Simple shape hash: serialize kind + signature (ignore names)
    const shape = symbols
      .map(s => `${s.kind}:${s.signature}`)
      .sort()
      .join('|');
    return require('crypto').createHash('sha256').update(shape).digest('hex').substring(0, 16);
  }

  /**
   * Compare two snapshots to produce symbol deltas
   */
  compareSnapshots(
    parentSnapshot: FileSnapshot | null,
    currentSnapshot: FileSnapshot
  ): {
    added: SymbolInfo[];
    removed: SymbolInfo[];
    modified: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo }>;
  } {
    const parentSymbols = parentSnapshot?.symbols || [];
    const currentSymbols = currentSnapshot.symbols;

    const parentMap = new Map(parentSymbols.map(s => [s.id, s]));
    const currentMap = new Map(currentSymbols.map(s => [s.id, s]));

    const added: SymbolInfo[] = [];
    const removed: SymbolInfo[] = [];
    const modified: Array<{ symbol: SymbolInfo; previousSymbol: SymbolInfo }> = [];

    // Find added and modified
    for (const symbol of currentSymbols) {
      const prev = parentMap.get(symbol.id);
      if (!prev) {
        added.push(symbol);
      } else if (prev.signature !== symbol.signature) {
        modified.push({ symbol, previousSymbol: prev });
      }
    }

    // Find removed
    for (const symbol of parentSymbols) {
      if (!currentMap.has(symbol.id)) {
        removed.push(symbol);
      }
    }

    return { added, removed, modified };
  }
}
```

---

### Step 1.3: Create Structural Diff Manager

**New File:** `src/analysis/structuralDiffManager.ts`

```typescript
import { Database } from 'sql.js';
import { getDifftasticIntegration } from './difftastic';
import { logDebug } from '../utils/logger';

export interface StructuralDiffMetrics {
  structuralChangeScore: number; // 0-1
  controlFlowChanged: boolean;
  interfaceChanged: boolean;
  movedBlocks: number;
  linesAdded: number;
  linesRemoved: number;
  rawData?: any; // Full difftastic output
}

export class StructuralDiffManager {
  private difftastic = getDifftasticIntegration();

  constructor(private db: Database) {}

  /**
   * Get or create structural diff (content-addressed caching)
   */
  async getOrCreateStructuralDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string,
    parentContent: string,
    currentContent: string
  ): Promise<StructuralDiffMetrics> {
    // Check cache
    const cached = this.getCachedDiff(parentBlobSha, currentBlobSha, filePath);
    if (cached) {
      logDebug(`[StructDiff] Cache hit for ${filePath} ${parentBlobSha.substring(0, 8)}→${currentBlobSha.substring(0, 8)}`);
      return cached;
    }

    // Run difftastic
    logDebug(`[StructDiff] Computing diff for ${filePath}`);
    const difftasticOutput = await this.difftastic.compareContents(
      parentContent,
      currentContent,
      filePath
    );

    const metrics = this.extractMetrics(difftasticOutput);

    // Store to cache
    this.storeDiff(parentBlobSha, currentBlobSha, filePath, metrics);

    return metrics;
  }

  private getCachedDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string
  ): StructuralDiffMetrics | null {
    const stmt = this.db.prepare(`
      SELECT * FROM structural_diffs
      WHERE parent_blob_sha = ? AND current_blob_sha = ? AND file_path = ?
    `);
    const row = stmt.get(parentBlobSha, currentBlobSha, filePath);
    if (!row) return null;

    return {
      structuralChangeScore: row.structural_change_score,
      controlFlowChanged: row.control_flow_changed === 1,
      interfaceChanged: row.interface_changed === 1,
      movedBlocks: row.moved_blocks,
      linesAdded: row.lines_added,
      linesRemoved: row.lines_removed,
      rawData: row.data_json ? JSON.parse(row.data_json) : undefined
    };
  }

  private storeDiff(
    parentBlobSha: string,
    currentBlobSha: string,
    filePath: string,
    metrics: StructuralDiffMetrics
  ): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO structural_diffs
      (parent_blob_sha, current_blob_sha, file_path, structural_change_score,
       control_flow_changed, interface_changed, moved_blocks, lines_added,
       lines_removed, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      parentBlobSha,
      currentBlobSha,
      filePath,
      metrics.structuralChangeScore,
      metrics.controlFlowChanged ? 1 : 0,
      metrics.interfaceChanged ? 1 : 0,
      metrics.movedBlocks,
      metrics.linesAdded,
      metrics.linesRemoved,
      metrics.rawData ? JSON.stringify(metrics.rawData) : null,
      new Date().toISOString()
    );
  }

  private extractMetrics(difftasticOutput: any): StructuralDiffMetrics {
    // Parse difftastic JSON output to extract metrics
    // This is simplified - adapt to actual difftastic output format
    const highlights = difftasticOutput.highlights || [];

    const structuralChanges = highlights.filter((h: any) =>
      h.type === 'structural' || h.type === 'syntax'
    ).length;

    const totalChanges = highlights.length;
    const structuralChangeScore = totalChanges > 0
      ? structuralChanges / totalChanges
      : 0;

    const controlFlowChanged = highlights.some((h: any) =>
      h.tags?.includes('control-flow')
    );

    const interfaceChanged = highlights.some((h: any) =>
      h.tags?.includes('signature') || h.tags?.includes('params')
    );

    const movedBlocks = highlights.filter((h: any) =>
      h.type === 'moved'
    ).length;

    return {
      structuralChangeScore,
      controlFlowChanged,
      interfaceChanged,
      movedBlocks,
      linesAdded: difftasticOutput.linesAdded || 0,
      linesRemoved: difftasticOutput.linesRemoved || 0,
      rawData: difftasticOutput
    };
  }
}
```

---

### Step 1.4: Create Async Runner Framework

**New File:** `src/analysis/runner/pipelineTypes.ts`

```typescript
export interface PipelineState {
  // Inputs
  selectedCommitShas: string[];
  includeWorkspace: boolean;

  // Intermediates
  commitFacts?: any[];
  workspaceFacts?: any;
  bundleFacts?: any;
  history?: any;
  llmOutputs?: any;

  // Progress tracking
  currentStepId?: string | null;
  completedSteps: Set<string>;
  errors: Array<{ stepId: string; error: unknown }>;
}

export interface PipelineStep {
  id: string;
  label: string;
  run: (state: PipelineState) => Promise<void> | void;
}

export type PipelineEvent =
  | { type: 'start'; step: PipelineStep; state: PipelineState }
  | { type: 'complete'; step: PipelineStep; state: PipelineState }
  | { type: 'error'; step: PipelineStep; error: unknown; state: PipelineState }
  | { type: 'finished'; state: PipelineState };

export type PipelineEventHandler = (event: PipelineEvent) => void;
```

**New File:** `src/analysis/runner/pipelineRunner.ts`

```typescript
import { PipelineStep, PipelineState, PipelineEventHandler } from './pipelineTypes';

export async function runPipeline(
  steps: PipelineStep[],
  initialState: Omit<PipelineState, 'completedSteps' | 'errors'>,
  onEvent?: PipelineEventHandler
): Promise<PipelineState> {
  const state: PipelineState = {
    ...initialState,
    completedSteps: new Set<string>(),
    errors: []
  };

  for (const step of steps) {
    state.currentStepId = step.id;
    onEvent?.({ type: 'start', step, state });

    try {
      await Promise.resolve(step.run(state));
      state.completedSteps.add(step.id);
      onEvent?.({ type: 'complete', step, state });
    } catch (error) {
      state.errors.push({ stepId: step.id, error });
      onEvent?.({ type: 'error', step, error, state });
      break; // Stop on first error (or continue for best-effort mode)
    }
  }

  state.currentStepId = null;
  onEvent?.({ type: 'finished', state });
  return state;
}
```

**New File:** `src/analysis/runner/concurrency.ts`

```typescript
/**
 * Run multiple async tasks with concurrency limit
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  const queue = items.map((item, index) => ({ item, index }));
  const workers: Promise<void>[] = [];

  async function runWorker() {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      await worker(next.item, next.index);
    }
  }

  const workerCount = Math.min(limit, queue.length);

  for (let i = 0; i < workerCount; i++) {
    workers.push(runWorker());
  }

  await Promise.all(workers);
}
```

---

## Phase 2: Layer Implementation

### Step 2.1: Layer 1 - Structural Index (Commit Pipeline)

**File:** `src/analysis/commitIndexer.ts` (NEW)

```typescript
import { GitOperations } from './git';
import { SnapshotManager, FileSnapshot } from './snapshotManager';
import { StructuralDiffManager, StructuralDiffMetrics } from './structuralDiffManager';
import { RiskDetector } from './heuristics';
import { Database } from 'sql.js';
import { ANALYSIS_VERSION } from '../storage/schema';
import { logDebug, logInfo } from '../utils/logger';
import { runWithConcurrency } from './runner/concurrency';

export interface CommitFacts {
  sha: string;
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  edgesAdded: number;
  edgesRemoved: number;
  risks: string[];
  structuralChangeScore: number;
  filesChanged: number;
  hotspots: string[];
}

export class CommitIndexer {
  constructor(
    private db: Database,
    private git: GitOperations,
    private snapshotManager: SnapshotManager,
    private structuralDiffManager: StructuralDiffManager,
    private riskDetector: RiskDetector
  ) {}

  /**
   * Ensure commit is indexed (idempotent, cacheable)
   */
  async ensureCommitIndexed(sha: string): Promise<CommitFacts> {
    // Check if already indexed with current analysis version
    if (this.isIndexed(sha)) {
      logDebug(`[CommitIndexer] ${sha} already indexed`);
      return this.loadCommitFacts(sha);
    }

    // Mark as pending
    this.markPending(sha);

    try {
      // Run indexing pipeline
      const facts = await this.indexCommit(sha);

      // Mark as complete
      this.markComplete(sha, facts);

      return facts;
    } catch (error) {
      this.markFailed(sha, error);
      throw error;
    }
  }

  /**
   * Index multiple commits with concurrency
   */
  async ensureCommitsIndexed(
    shas: string[],
    concurrency: number = 4
  ): Promise<CommitFacts[]> {
    const results: CommitFacts[] = [];

    await runWithConcurrency(shas, concurrency, async (sha) => {
      const facts = await this.ensureCommitIndexed(sha);
      results.push(facts);
    });

    return results;
  }

  private async indexCommit(sha: string): Promise<CommitFacts> {
    logInfo(`[CommitIndexer] Indexing commit ${sha}`);

    const commitInfo = this.git.getCommitInfo(sha);
    const files = this.git.getFileChanges(sha);
    const parentSha = commitInfo.parent;

    let totalSymbolsAdded = 0;
    let totalSymbolsModified = 0;
    let totalSymbolsRemoved = 0;
    let totalEdgesAdded = 0;
    let totalEdgesRemoved = 0;
    let maxStructuralChange = 0;
    const allRisks: string[] = [];

    // Process each changed file
    for (const file of files) {
      const { path, status } = file;

      if (status === 'D') {
        // File deleted - get parent snapshot only
        if (parentSha) {
          const parentBlobSha = this.git.getBlobSha(parentSha, path);
          const parentContent = this.git.safeGetFileContent(parentSha, path);
          const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
            path,
            parentBlobSha,
            parentContent
          );
          totalSymbolsRemoved += parentSnapshot.symbols.length;
          totalEdgesRemoved += parentSnapshot.edges.length;
        }
        continue;
      }

      // Get current blob
      const currentBlobSha = this.git.getBlobSha(sha, path);
      const currentContent = this.git.safeGetFileContent(sha, path);
      const currentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
        path,
        currentBlobSha,
        currentContent
      );

      if (status === 'A') {
        // File added
        totalSymbolsAdded += currentSnapshot.symbols.length;
        totalEdgesAdded += currentSnapshot.edges.length;
      } else if (status === 'M' && parentSha) {
        // File modified - compare snapshots
        const parentBlobSha = this.git.getBlobSha(parentSha, path);
        const parentContent = this.git.safeGetFileContent(parentSha, path);
        const parentSnapshot = await this.snapshotManager.getOrCreateSnapshot(
          path,
          parentBlobSha,
          parentContent
        );

        const symbolDiff = this.snapshotManager.compareSnapshots(
          parentSnapshot,
          currentSnapshot
        );

        totalSymbolsAdded += symbolDiff.added.length;
        totalSymbolsModified += symbolDiff.modified.length;
        totalSymbolsRemoved += symbolDiff.removed.length;

        // Edge diff (simplified)
        const parentEdgeIds = new Set(parentSnapshot.edges.map(e => `${e.from}-${e.to}`));
        const currentEdgeIds = new Set(currentSnapshot.edges.map(e => `${e.from}-${e.to}`));
        totalEdgesAdded += currentSnapshot.edges.filter(e => !parentEdgeIds.has(`${e.from}-${e.to}`)).length;
        totalEdgesRemoved += parentSnapshot.edges.filter(e => !currentEdgeIds.has(`${e.from}-${e.to}`)).length;

        // Get structural diff metrics
        const structDiff = await this.structuralDiffManager.getOrCreateStructuralDiff(
          parentBlobSha,
          currentBlobSha,
          path,
          parentContent,
          currentContent
        );

        maxStructuralChange = Math.max(maxStructuralChange, structDiff.structuralChangeScore);

        // Detect risks based on structural changes
        if (structDiff.interfaceChanged) {
          allRisks.push('breaking-api');
        }
        if (structDiff.controlFlowChanged) {
          allRisks.push('refactor');
        }
      }
    }

    // Aggregate facts
    const facts: CommitFacts = {
      sha,
      symbolsAdded: totalSymbolsAdded,
      symbolsModified: totalSymbolsModified,
      symbolsRemoved: totalSymbolsRemoved,
      edgesAdded: totalEdgesAdded,
      edgesRemoved: totalEdgesRemoved,
      risks: [...new Set(allRisks)],
      structuralChangeScore: maxStructuralChange,
      filesChanged: files.length,
      hotspots: [] // TODO: Implement hotspot detection
    };

    return facts;
  }

  private isIndexed(sha: string): boolean {
    const stmt = this.db.prepare(`
      SELECT status FROM commits_analysis
      WHERE sha = ? AND analysis_version = ? AND status = 'complete'
    `);
    const row = stmt.get(sha, ANALYSIS_VERSION);
    return !!row;
  }

  private loadCommitFacts(sha: string): CommitFacts {
    const stmt = this.db.prepare(`
      SELECT * FROM commits_analysis WHERE sha = ?
    `);
    const row = stmt.get(sha);

    return {
      sha: row.sha,
      symbolsAdded: row.symbols_added,
      symbolsModified: row.symbols_modified,
      symbolsRemoved: row.symbols_removed,
      edgesAdded: row.edges_added,
      edgesRemoved: row.edges_removed,
      risks: row.risks ? JSON.parse(row.risks) : [],
      structuralChangeScore: row.blast_radius || 0,
      filesChanged: row.files_changed || 0,
      hotspots: []
    };
  }

  private markPending(sha: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, status, analysis_version, analyzed_at)
      VALUES (?, 'pending', ?, ?)
    `);
    stmt.run(sha, ANALYSIS_VERSION, new Date().toISOString());
  }

  private markComplete(sha: string, facts: CommitFacts): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, status, analysis_version, symbols_added, symbols_modified, symbols_removed,
       edges_added, edges_removed, risks, blast_radius, analyzed_at)
      VALUES (?, 'complete', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      sha,
      ANALYSIS_VERSION,
      facts.symbolsAdded,
      facts.symbolsModified,
      facts.symbolsRemoved,
      facts.edgesAdded,
      facts.edgesRemoved,
      JSON.stringify(facts.risks),
      facts.structuralChangeScore,
      new Date().toISOString()
    );
  }

  private markFailed(sha: string, error: unknown): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO commits_analysis
      (sha, status, analysis_version, analyzed_at)
      VALUES (?, 'failed', ?, ?)
    `);
    stmt.run(sha, ANALYSIS_VERSION, new Date().toISOString());
    logDebug(`[CommitIndexer] Failed to index ${sha}: ${error}`);
  }
}
```

---

### Step 2.2: Layer 2 - Workspace Overlay

**File:** `src/analysis/workspaceIndexer.ts` (NEW)

```typescript
import { GitOperations } from './git';
import { SnapshotManager } from './snapshotManager';
import { StructuralDiffManager } from './structuralDiffManager';
import { Database } from 'sql.js';
import { logDebug } from '../utils/logger';
import * as crypto from 'crypto';
import * as fs from 'fs';

export interface WorkspaceFacts {
  workspaceHash: string;
  headSha: string;
  symbolsAdded: number;
  symbolsModified: number;
  symbolsRemoved: number;
  risks: string[];
  filesChanged: number;
}

export class WorkspaceIndexer {
  constructor(
    private db: Database,
    private git: GitOperations,
    private snapshotManager: SnapshotManager,
    private structuralDiffManager: StructuralDiffManager
  ) {}

  /**
   * Analyze workspace overlay (staged or unstaged changes)
   */
  async analyzeWorkspace(mode: 'staged' | 'unstaged'): Promise<WorkspaceFacts | null> {
    const headSha = this.git.getHeadSha();
    const changedFiles = mode === 'staged'
      ? await this.git.getStagedFiles()
      : await this.git.getUnstagedFiles();

    if (changedFiles.length === 0) {
      return null;
    }

    // Compute workspace hash
    const workspaceHash = this.computeWorkspaceHash(changedFiles);

    // Check cache
    const cached = this.getCachedWorkspace(headSha, workspaceHash);
    if (cached) {
      logDebug(`[WorkspaceIndexer] Cache hit for ${mode} workspace`);
      return cached;
    }

    // Analyze changes
    let totalAdded = 0;
    let totalModified = 0;
    let totalRemoved = 0;

    for (const file of changedFiles) {
      const { path, status } = file;

      // Get HEAD snapshot
      const headBlobSha = this.git.getBlobSha('HEAD', path);
      const headContent = this.git.safeGetFileContent('HEAD', path);
      const headSnapshot = await this.snapshotManager.getOrCreateSnapshot(
        path,
        headBlobSha,
        headContent
      );

      // Get workspace snapshot
      const workingContent = fs.readFileSync(path, 'utf8');
      const workspaceBlobSha = 'WORKSPACE:' + crypto.createHash('sha256').update(workingContent).digest('hex');
      const workspaceSnapshot = await this.snapshotManager.getOrCreateSnapshot(
        path,
        workspaceBlobSha,
        workingContent
      );

      // Compare
      const diff = this.snapshotManager.compareSnapshots(headSnapshot, workspaceSnapshot);
      totalAdded += diff.added.length;
      totalModified += diff.modified.length;
      totalRemoved += diff.removed.length;
    }

    const facts: WorkspaceFacts = {
      workspaceHash,
      headSha,
      symbolsAdded: totalAdded,
      symbolsModified: totalModified,
      symbolsRemoved: totalRemoved,
      risks: [],
      filesChanged: changedFiles.length
    };

    // Cache result
    this.cacheWorkspace(facts);

    return facts;
  }

  private computeWorkspaceHash(files: any[]): string {
    const hashInput = files
      .map(f => `${f.path}:${f.status}`)
      .sort()
      .join('|');
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
  }

  private getCachedWorkspace(headSha: string, workspaceHash: string): WorkspaceFacts | null {
    const stmt = this.db.prepare(`
      SELECT * FROM workspace_analysis
      WHERE head_sha = ? AND workspace_hash = ?
    `);
    const row = stmt.get(headSha, workspaceHash);
    if (!row) return null;

    return {
      workspaceHash: row.workspace_hash,
      headSha: row.head_sha,
      symbolsAdded: row.symbols_added,
      symbolsModified: row.symbols_modified,
      symbolsRemoved: row.symbols_removed,
      risks: row.risks ? JSON.parse(row.risks) : [],
      filesChanged: row.files_changed
    };
  }

  private cacheWorkspace(facts: WorkspaceFacts): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO workspace_analysis
      (head_sha, workspace_hash, symbols_added, symbols_modified, symbols_removed,
       risks, files_changed, analyzed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      facts.headSha,
      facts.workspaceHash,
      facts.symbolsAdded,
      facts.symbolsModified,
      facts.symbolsRemoved,
      JSON.stringify(facts.risks),
      facts.filesChanged,
      new Date().toISOString()
    );
  }
}
```

**Add to schema:**
```sql
CREATE TABLE IF NOT EXISTS workspace_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  head_sha TEXT NOT NULL,
  workspace_hash TEXT NOT NULL,
  symbols_added INTEGER,
  symbols_modified INTEGER,
  symbols_removed INTEGER,
  risks TEXT,
  files_changed INTEGER,
  analyzed_at TEXT NOT NULL,
  UNIQUE(head_sha, workspace_hash)
);
```

---

### Step 2.3: Layer 3 - Embedding Index

**File:** `src/analysis/embeddingIndexer.ts` (NEW)

```typescript
import { CommitFacts } from './commitIndexer';
import { getQdrantClient } from '../storage/qdrantClient';
import { generateEmbedding } from '../storage/embeddings';
import { logDebug } from '../utils/logger';
import { runWithConcurrency } from './runner/concurrency';

export class EmbeddingIndexer {
  /**
   * Index commit facts into Qdrant for semantic search
   */
  async indexCommits(commitFacts: CommitFacts[]): Promise<void> {
    const qdrant = getQdrantClient();
    if (!(await qdrant.isEnabled())) {
      logDebug('[EmbeddingIndexer] Qdrant not enabled, skipping');
      return;
    }

    await qdrant.ensureCollections();
    const client = await qdrant.getClient();
    if (!client) return;

    // Process commits in parallel
    await runWithConcurrency(commitFacts, 5, async (facts) => {
      const shard = this.buildCommitShard(facts);
      const embedding = await generateEmbedding(shard.text);

      await client.upsert('commits', {
        wait: true,
        points: [{
          id: this.stringToPointId(facts.sha),
          vector: embedding,
          payload: shard.metadata
        }]
      });

      logDebug(`[EmbeddingIndexer] Indexed commit ${facts.sha.substring(0, 8)}`);
    });
  }

  /**
   * Build commit story shard for embedding
   */
  private buildCommitShard(facts: CommitFacts): { text: string; metadata: any } {
    const tags = [
      ...facts.risks.map(r => `[${r}]`),
      facts.structuralChangeScore > 0.7 ? '[high-structural-change]' : '',
      facts.symbolsRemoved > 0 ? '[deletion]' : '',
      facts.symbolsAdded > 10 ? '[large-addition]' : ''
    ].filter(Boolean);

    const text = `${tags.join(' ')} Commit ${facts.sha}: ` +
      `Added ${facts.symbolsAdded} symbols, modified ${facts.symbolsModified}, removed ${facts.symbolsRemoved}. ` +
      `${facts.filesChanged} files changed. Structural change score: ${facts.structuralChangeScore.toFixed(2)}.`;

    return {
      text,
      metadata: {
        sha: facts.sha,
        symbols_added: facts.symbolsAdded,
        symbols_modified: facts.symbolsModified,
        symbols_removed: facts.symbolsRemoved,
        risks: facts.risks,
        structural_change_score: facts.structuralChangeScore
      }
    };
  }

  private stringToPointId(str: string): string {
    // Convert SHA to numeric ID for Qdrant
    return BigInt('0x' + str.substring(0, 16)).toString();
  }
}
```

---

### Step 2.4: Layer 4 - Bundle Story Engine

**File:** `src/analysis/bundleStoryEngine.ts` (NEW)

```typescript
import { CommitFacts } from './commitIndexer';
import { WorkspaceFacts } from './workspaceIndexer';
import { LlmAnalyst } from './llmAnalyst/runner';
import { getQdrantClient } from '../storage/qdrantClient';
import { generateEmbedding } from '../storage/embeddings';
import { RefactorBundleFacts } from '../facts/types';
import { logInfo } from '../utils/logger';

export class BundleStoryEngine {
  constructor(private llmAnalyst: LlmAnalyst) {}

  /**
   * Generate narrative story from bundle facts + historical context
   */
  async generateStory(
    bundleFacts: RefactorBundleFacts,
    commitFacts: CommitFacts[]
  ): Promise<any> {
    logInfo('[BundleStory] Retrieving historical context...');

    // Build bundle query shard
    const bundleShard = this.buildBundleShard(bundleFacts);
    const bundleEmbedding = await generateEmbedding(bundleShard);

    // Cross-time retrieval
    const history = await this.retrieveHistory(bundleEmbedding);

    logInfo('[BundleStory] Running LLM analysis...');

    // Pass to LLM analyst with historical context
    const llmAnalysis = await this.llmAnalyst.analyze(bundleFacts, history);

    return llmAnalysis;
  }

  private buildBundleShard(facts: RefactorBundleFacts): string {
    const subsystems = Object.keys(facts.scope?.subsystems || {});
    const totalSymbols = facts.working?.symbols || 0;
    const issues = facts.findings?.incompleteness?.missing || 0;

    return `Bundle analysis: ${facts.bundle.shas.length} commits, ` +
      `${totalSymbols} symbols affected, ${issues} issues found. ` +
      `Subsystems: ${subsystems.join(', ')}`;
  }

  private async retrieveHistory(queryEmbedding: number[]): Promise<any> {
    const qdrant = getQdrantClient();
    if (!(await qdrant.isEnabled())) {
      return null;
    }

    const client = await qdrant.getClient();
    if (!client) return null;

    // Search for similar commits
    const similarCommits = await client.search('commits', {
      vector: queryEmbedding,
      limit: 20,
      with_payload: true
    });

    // Search for similar symbols
    const similarSymbols = await client.search('symbols', {
      vector: queryEmbedding,
      limit: 30,
      with_payload: true
    });

    return {
      similarCommits: similarCommits.map(r => r.payload),
      similarSymbols: similarSymbols.map(r => r.payload)
    };
  }
}
```

---

## Phase 3: Runner Integration

### Step 3.1: Create Pipeline Steps

**File:** `src/analysis/runner/steps/indexCommitsStep.ts`

```typescript
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { CommitIndexer } from '../../commitIndexer';

export function createIndexCommitsStep(
  commitIndexer: CommitIndexer,
  concurrency: number = 4
): PipelineStep {
  return {
    id: 'index_commits',
    label: 'Index commits (snapshots + diffs)',

    async run(state: PipelineState) {
      const shas = state.selectedCommitShas;
      const facts = await commitIndexer.ensureCommitsIndexed(shas, concurrency);
      state.commitFacts = facts;
    }
  };
}
```

**File:** `src/analysis/runner/steps/workspaceStep.ts`

```typescript
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { WorkspaceIndexer } from '../../workspaceIndexer';

export function createWorkspaceOverlayStep(
  workspaceIndexer: WorkspaceIndexer
): PipelineStep {
  return {
    id: 'workspace_overlay',
    label: 'Analyze workspace changes',

    async run(state: PipelineState) {
      if (!state.includeWorkspace) {
        state.workspaceFacts = null;
        return;
      }

      const facts = await workspaceIndexer.analyzeWorkspace('staged');
      state.workspaceFacts = facts;
    }
  };
}
```

**File:** `src/analysis/runner/steps/bundleFactsStep.ts`

```typescript
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { buildRefactorBundleFacts } from '../../../facts/factsAssembler';

export function createBundleFactsStep(): PipelineStep {
  return {
    id: 'bundle_facts',
    label: 'Aggregate bundle facts',

    async run(state: PipelineState) {
      if (!state.commitFacts || state.commitFacts.length === 0) {
        throw new Error('No commit facts available');
      }

      // Build bundle facts from commit analyses
      const bundleFacts = buildRefactorBundleFacts(
        state.commitFacts,
        state.workspaceFacts
      );

      state.bundleFacts = bundleFacts;
    }
  };
}
```

**File:** `src/analysis/runner/steps/embeddingStep.ts`

```typescript
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { EmbeddingIndexer } from '../../embeddingIndexer';

export function createEmbeddingStep(
  embeddingIndexer: EmbeddingIndexer
): PipelineStep {
  return {
    id: 'embedding_index',
    label: 'Index embeddings',

    async run(state: PipelineState) {
      if (!state.commitFacts) return;

      await embeddingIndexer.indexCommits(state.commitFacts);
    }
  };
}
```

**File:** `src/analysis/runner/steps/storyStep.ts`

```typescript
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { BundleStoryEngine } from '../../bundleStoryEngine';

export function createStoryStep(
  storyEngine: BundleStoryEngine
): PipelineStep {
  return {
    id: 'llm_story',
    label: 'Generate story + drift + plan',

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        throw new Error('Bundle facts required');
      }

      const llmOutputs = await storyEngine.generateStory(
        state.bundleFacts,
        state.commitFacts || []
      );

      state.llmOutputs = llmOutputs;
    }
  };
}
```

---

### Step 3.2: Create Main Pipeline Orchestrator

**File:** `src/analysis/refactorPipeline.ts` (NEW - replaces old pipeline.ts methods)

```typescript
import { runPipeline } from './runner/pipelineRunner';
import { PipelineState, PipelineEvent } from './runner/pipelineTypes';
import { CommitIndexer } from './commitIndexer';
import { WorkspaceIndexer } from './workspaceIndexer';
import { EmbeddingIndexer } from './embeddingIndexer';
import { BundleStoryEngine } from './bundleStoryEngine';
import { createIndexCommitsStep } from './runner/steps/indexCommitsStep';
import { createWorkspaceOverlayStep } from './runner/steps/workspaceStep';
import { createBundleFactsStep } from './runner/steps/bundleFactsStep';
import { createEmbeddingStep } from './runner/steps/embeddingStep';
import { createStoryStep } from './runner/steps/storyStep';

export class RefactorPipeline {
  constructor(
    private commitIndexer: CommitIndexer,
    private workspaceIndexer: WorkspaceIndexer,
    private embeddingIndexer: EmbeddingIndexer,
    private storyEngine: BundleStoryEngine
  ) {}

  /**
   * Run complete refactor bundle analysis pipeline
   */
  async analyzeBundle(
    commitShas: string[],
    includeWorkspace: boolean = false,
    onEvent?: (event: PipelineEvent) => void
  ): Promise<PipelineState> {
    const steps = [
      createIndexCommitsStep(this.commitIndexer, 4),
      createWorkspaceOverlayStep(this.workspaceIndexer),
      createBundleFactsStep(),
      createEmbeddingStep(this.embeddingIndexer),
      createStoryStep(this.storyEngine)
    ];

    const initialState = {
      selectedCommitShas: commitShas,
      includeWorkspace
    };

    return runPipeline(steps, initialState, onEvent);
  }

  /**
   * Quick commit indexing only (no LLM/embeddings)
   */
  async indexCommits(commitShas: string[]): Promise<void> {
    await this.commitIndexer.ensureCommitsIndexed(commitShas);
  }
}
```

---

## Phase 4: Service & Command Updates

### Step 4.1: Update ReportService

**File:** `src/services/reportService.ts`

**Replace `generateReport()` method:**

```typescript
async generateReport(
  shas: string[],
  scope: WorkspaceScope,
  options?: { token?: vscode.CancellationToken }
): Promise<LlmAnalysis> {
  const orchestrator = getCockpitOrchestrator();

  orchestrator.merge({
    isAnalyzing: true,
    analysisStep: 'indexing',
    selectedCommitShas: shas,
  }, 'report:start');

  try {
    // Use new pipeline
    const refactorPipeline = await getRefactorPipeline();

    const result = await refactorPipeline.analyzeBundle(
      shas,
      scope !== 'history',
      (event) => {
        // Map pipeline events to orchestrator state
        switch (event.type) {
          case 'start':
            orchestrator.merge({
              analysisStep: event.step.label,
              analysisProgress: undefined
            }, `report:step:${event.step.id}`);
            break;

          case 'complete':
            orchestrator.merge({
              analysisStep: event.step.label,
              analysisProgress: 100
            }, `report:step:${event.step.id}:complete`);
            break;

          case 'error':
            orchestrator.merge({
              error: String(event.error),
              isAnalyzing: false
            }, `report:error`);
            break;

          case 'finished':
            if (event.state.errors.length === 0) {
              orchestrator.merge({
                bundleFacts: event.state.bundleFacts,
                isAnalyzing: false,
                analysisStep: undefined
              }, 'report:complete');
            }
            break;
        }
      }
    );

    if (result.errors.length > 0) {
      throw new Error(`Pipeline failed: ${result.errors[0].error}`);
    }

    return result.llmOutputs;

  } catch (error) {
    orchestrator.merge({
      error: String(error),
      isAnalyzing: false
    }, 'report:error');
    throw error;
  }
}
```

---

### Step 4.2: Update Commands

**File:** `src/commands/commands.ts`

**Replace `analyzeLastCommits` command:**

```typescript
vscode.commands.registerCommand('git-context.analyzeLastCommits', async () => {
  const count = vscode.workspace.getConfiguration('git-context').get<number>('defaultCommitCount', 5);

  try {
    const pipeline = await getRefactorPipeline();
    const git = new GitOperations();
    const recentCommits = git.getRecentCommits(count);
    const shas = recentCommits.map(c => c.sha);

    // Just index commits (quick metadata load)
    await pipeline.indexCommits(shas);

    // Refresh UI to show indexed commits
    await refreshCockpitState('command:analyzeLastCommits');

    vscode.window.showInformationMessage(`Indexed ${shas.length} commits`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to analyze commits: ${error}`);
  }
});
```

**Update `analyzeStagedChanges`:**

```typescript
vscode.commands.registerCommand('git-context.analyzeStagedChanges', async () => {
  try {
    const pipeline = await getRefactorPipeline();
    const workspaceIndexer = pipeline.workspaceIndexer; // Expose as property

    const facts = await workspaceIndexer.analyzeWorkspace('staged');

    if (!facts) {
      vscode.window.showInformationMessage('No staged changes to analyze');
      return;
    }

    getCockpitOrchestrator().merge({
      workspaceFacts: facts,
      activeSection: 'live'
    }, 'command:analyzeStagedChanges');

    vscode.window.showInformationMessage(`Analyzed ${facts.filesChanged} staged files`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to analyze staged changes: ${error}`);
  }
});
```

---

### Step 4.3: Update Extension Bootstrap

**File:** `src/extension.ts`

**Add pipeline factory:**

```typescript
let refactorPipeline: RefactorPipeline | null = null;

export async function getRefactorPipeline(): Promise<RefactorPipeline> {
  if (!refactorPipeline) {
    const db = getDatabaseManager().getDatabase();
    const git = new GitOperations();

    const symbolExtractor = new SymbolExtractor(git);
    const dependencyExtractor = new DependencyExtractor();

    const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);
    const structuralDiffManager = new StructuralDiffManager(db);
    const riskDetector = new RiskDetector();

    const commitIndexer = new CommitIndexer(
      db,
      git,
      snapshotManager,
      structuralDiffManager,
      riskDetector
    );

    const workspaceIndexer = new WorkspaceIndexer(
      db,
      git,
      snapshotManager,
      structuralDiffManager
    );

    const embeddingIndexer = new EmbeddingIndexer();

    const llmAnalyst = new LlmAnalyst();
    const storyEngine = new BundleStoryEngine(llmAnalyst);

    refactorPipeline = new RefactorPipeline(
      commitIndexer,
      workspaceIndexer,
      embeddingIndexer,
      storyEngine
    );
  }

  return refactorPipeline;
}
```

---

## Phase 5: State & UI Integration

### Step 5.1: Update CockpitOrchestrator Types

**File:** `src/types/cockpit.ts`

**Add to `CockpitState`:**

```typescript
export interface CockpitState {
  // ... existing fields ...

  // New pipeline state
  analysisStep?: string;  // Current step label
  analysisProgress?: number;  // 0-100 or undefined
  pipelineErrors?: Array<{ stepId: string; error: string }>;
}
```

---

### Step 5.2: Update LiveDiffTracker Integration

**File:** `src/liveTracker.ts`

**Update analysis trigger:**

```typescript
private async triggerAnalysis(staged: boolean): Promise<void> {
  try {
    const pipeline = await getRefactorPipeline();
    const workspaceIndexer = pipeline.workspaceIndexer;

    const facts = await workspaceIndexer.analyzeWorkspace(
      staged ? 'staged' : 'unstaged'
    );

    if (facts) {
      getCockpitOrchestrator().updateLiveState({
        isTracking: true,
        status: 'analyzed',
        summary: `${facts.symbolsAdded} added, ${facts.symbolsModified} modified, ${facts.symbolsRemoved} removed`
      });
    }
  } catch (error) {
    logError('[LiveTracker] Analysis failed', error);
  }
}
```

---

### Step 5.3: Update GitCommitWatcher

**File:** `src/watchers/gitCommitWatcher.ts`

**Update workspace migration:**

```typescript
private async handleCommit(newSha: string): Promise<void> {
  try {
    // No migration needed in new architecture - workspace SHA is separate
    // Just re-index the new commit
    const pipeline = await getRefactorPipeline();
    await pipeline.indexCommits([newSha]);

    getCockpitOrchestrator().updateState({
      selectedCommitShas: [],
      workspaceFacts: null
    }, 'git:commit');
  } catch (error) {
    logError('[GitCommitWatcher] Failed to handle commit', error);
  }
}
```

---

## Phase 6: Testing & Validation

### Step 6.1: Update Integration Tests

**File:** `test_pipeline_integration.ts`

```typescript
import { RefactorPipeline } from '../src/analysis/refactorPipeline';
import { CommitIndexer } from '../src/analysis/commitIndexer';
// ... imports

describe('Refactor Pipeline Integration', () => {
  let pipeline: RefactorPipeline;

  beforeEach(() => {
    // Setup in-memory DB
    // Initialize pipeline components
  });

  test('indexes commits with caching', async () => {
    const shas = ['abc123', 'def456'];

    // First run - should parse with Tree-sitter
    await pipeline.indexCommits(shas);

    // Second run - should use cached snapshots
    const start = Date.now();
    await pipeline.indexCommits(shas);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100); // Should be instant from cache
  });

  test('runs full bundle analysis pipeline', async () => {
    const result = await pipeline.analyzeBundle(
      ['sha1', 'sha2'],
      true, // include workspace
      (event) => {
        console.log(`Event: ${event.type} - ${event.step?.label}`);
      }
    );

    expect(result.errors).toHaveLength(0);
    expect(result.completedSteps.size).toBe(5);
    expect(result.bundleFacts).toBeDefined();
    expect(result.llmOutputs).toBeDefined();
  });

  test('handles concurrent commit indexing', async () => {
    const shas = Array.from({ length: 20 }, (_, i) => `commit-${i}`);

    const start = Date.now();
    await pipeline.indexCommits(shas);
    const duration = Date.now() - start;

    // Should complete faster than sequential (20 × avgTime)
    console.log(`Indexed 20 commits in ${duration}ms`);
  });
});
```

---

### Step 6.2: Performance Benchmarks

**Create:** `benchmarks/pipeline_benchmark.ts`

```typescript
import { RefactorPipeline } from '../src/analysis/refactorPipeline';

async function benchmarkPipeline() {
  const pipeline = await setupPipeline();
  const shas = getTestCommits(50); // 50 test commits

  console.log('=== Pipeline Benchmark ===');

  // Benchmark 1: Cold cache (first run)
  console.log('\n1. Cold cache (Tree-sitter + Difftastic):');
  const cold1 = Date.now();
  await pipeline.indexCommits(shas);
  const coldTime = Date.now() - cold1;
  console.log(`   Time: ${coldTime}ms (${(coldTime / shas.length).toFixed(0)}ms per commit)`);

  // Benchmark 2: Warm cache (snapshots cached)
  console.log('\n2. Warm cache (cached snapshots):');
  const warm1 = Date.now();
  await pipeline.indexCommits(shas);
  const warmTime = Date.now() - warm1;
  console.log(`   Time: ${warmTime}ms (${(warmTime / shas.length).toFixed(0)}ms per commit)`);
  console.log(`   Speedup: ${(coldTime / warmTime).toFixed(1)}x`);

  // Benchmark 3: Full bundle pipeline
  console.log('\n3. Full bundle pipeline (with LLM):');
  const bundle1 = Date.now();
  await pipeline.analyzeBundle(shas.slice(0, 10), true);
  const bundleTime = Date.now() - bundle1;
  console.log(`   Time: ${bundleTime}ms`);
}
```

---

## Migration Checklist

### Pre-Migration

- [ ] Backup existing `.git/commit-tracker/` directory
- [ ] Run existing tests and record baseline performance
- [ ] Document current API usage patterns
- [ ] Create feature branch for refactor

### Database Migration

- [ ] Add new schema tables (file_snapshots, structural_diffs, workspace_analysis)
- [ ] Add analysis_version and status columns to commits_analysis
- [ ] Write migration script to mark existing data as v1.0
- [ ] Test migration on production-like dataset

### Core Infrastructure (Phase 1)

- [ ] Implement SnapshotManager with Tree-sitter caching
- [ ] Implement StructuralDiffManager with difftastic caching
- [ ] Create async runner framework (pipelineRunner, concurrency helper)
- [ ] Write unit tests for each component

### Layer Implementation (Phase 2)

- [ ] Implement CommitIndexer with blob-level caching
- [ ] Implement WorkspaceIndexer with workspace hashing
- [ ] Implement EmbeddingIndexer with Qdrant integration
- [ ] Implement BundleStoryEngine with LLM integration
- [ ] Test each layer in isolation

### Runner Integration (Phase 3)

- [ ] Create pipeline steps for each layer
- [ ] Implement RefactorPipeline orchestrator
- [ ] Wire up event emission to CockpitOrchestrator
- [ ] Test full pipeline end-to-end

### Service & Command Updates (Phase 4)

- [ ] Update ReportService.generateReport()
- [ ] Update all commands (analyzeLastCommits, analyzeStagedChanges, etc.)
- [ ] Update CLI entry points
- [ ] Test commands in extension environment

### State & UI Integration (Phase 5)

- [ ] Update CockpitOrchestrator state types
- [ ] Update LiveDiffTracker to use new pipeline
- [ ] Update GitCommitWatcher (remove migration logic)
- [ ] Update CockpitProvider event handlers
- [ ] Test UI state updates and webview rendering

### Testing & Validation (Phase 6)

- [ ] Update integration tests
- [ ] Add concurrency tests
- [ ] Add caching tests
- [ ] Run performance benchmarks
- [ ] Compare old vs new pipeline performance

### Cleanup

- [ ] Remove old AnalysisPipeline methods (keep metadata loading)
- [ ] Remove workspace migration logic
- [ ] Update CLAUDE.md with new architecture
- [ ] Add inline documentation to new files
- [ ] Run full linting pass

### Rollout

- [ ] Merge to development branch
- [ ] Test with real repository (dogfooding)
- [ ] Monitor performance metrics
- [ ] Address any edge cases
- [ ] Merge to main branch

---

## Expected Performance Improvements

### Before (Current Sequential Pipeline)

- **10 commits, cold cache**: ~45 seconds
  - Tree-sitter: 10 × 2s = 20s
  - Difftastic: 10 × 1.5s = 15s
  - LLM per commit: 10 × 1s = 10s

- **10 commits, warm cache**: Still ~45 seconds (no caching)

- **Re-analysis**: Full re-run (no version checking)

### After (New Layered Pipeline)

- **10 commits, cold cache**: ~15 seconds
  - Tree-sitter (concurrent, 4 workers): 20s / 4 = 5s
  - Difftastic (concurrent): 15s / 4 = 4s
  - LLM (bundle-level, 1 call): 6s

- **10 commits, warm cache**: ~7 seconds
  - Snapshot cache hits: instant
  - Difftastic cache hits: instant
  - LLM (bundle-level): 6s

- **Re-analysis with same version**: ~0.5 seconds
  - Status check: instant
  - Load from commits_analysis: instant

### Estimated Speedup

- **Cold cache**: 3× faster (45s → 15s)
- **Warm cache**: 6× faster (45s → 7s)
- **Re-analysis**: 90× faster (45s → 0.5s)

---

## Rollback Plan

If issues arise during rollout:

1. **Immediate**: Revert to old pipeline by toggling feature flag
2. **Database**: Old schema still works (analysis_version filter)
3. **Commands**: Wrap new pipeline calls in try/catch with fallback
4. **Data**: New tables are additive, won't break existing queries

**Feature flag approach:**

```typescript
const USE_NEW_PIPELINE = getExtensionConfig().experimentalPipeline ?? false;

if (USE_NEW_PIPELINE) {
  await refactorPipeline.analyzeBundle(shas);
} else {
  await oldPipeline.analyzeCommits(shas); // Existing code path
}
```

---

## Key Files to Update

**Critical (Must Change):**
1. `src/analysis/commitIndexer.ts` (NEW)
2. `src/analysis/snapshotManager.ts` (NEW)
3. `src/analysis/structuralDiffManager.ts` (NEW)
4. `src/analysis/refactorPipeline.ts` (NEW)
5. `src/analysis/runner/` (NEW directory)
6. `src/storage/schema.ts` (add tables)
7. `src/services/reportService.ts` (update generateReport)
8. `src/commands/commands.ts` (update all analyze commands)
9. `src/extension.ts` (add getRefactorPipeline factory)

**High Priority (Will Change):**
10. `src/liveTracker.ts` (use WorkspaceIndexer)
11. `src/watchers/gitCommitWatcher.ts` (remove migration)
12. `src/webview/cockpit/CockpitProvider.ts` (handle new events)
13. `src/types/cockpit.ts` (add pipeline state fields)
14. `src/cli/index.ts` (update CLI commands)

**Low Priority (Minor Changes):**
15. `src/analysis/symbols.ts` (expose extractSymbolsFromContent)
16. `src/analysis/dependencies.ts` (expose extractEdgesFromContent)
17. `src/analysis/difftastic.ts` (add compareContents method)
18. Test files (update to new API)

---

## Summary

This refactor transforms Git Context from a heavyweight, sequential analysis tool into a **layered, cacheable, concurrent pipeline** that:

1. **Eliminates redundant work** via content-addressed caching (blob SHA)
2. **Parallelizes independent operations** (commits, files, embeddings)
3. **Separates concerns** (structure → facts → memory → story)
4. **Provides clean async orchestration** with event-driven progress
5. **Enables cross-time semantic search** via Qdrant embeddings
6. **Moves LLM to bundle layer** for richer narratives with less token waste

Expected outcome: **3-90× performance improvement** depending on cache state, with a cleaner, more maintainable architecture.

---

**Ready to begin implementation. Start with Phase 1: Core Infrastructure.**
