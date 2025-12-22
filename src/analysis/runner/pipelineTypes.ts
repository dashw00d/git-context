import * as vscode from 'vscode';
import type { DriftFindings } from '../../facts/driftDetector';
import type { IntendedState } from '../../facts/intendedMap';
import type { LegacyAuditResult } from '../../facts/legacyAudit';
import type { ScopeSet } from '../../facts/scope';
import type { WorkingSnapshot } from '../../facts/workingSnapshot';
import type { FileChange } from '../../types';
import type { CrossVersionSymbolLineage, MovedBlock } from '../movedBlockDetector';
import type { WorkspaceFacts } from '../workspaceIndexer';
import type { EmbeddingMetrics, HistoryMetrics, LlmMetrics } from './pipelineMetrics';

/**
 * Tree entry from git ls-tree
 */
export interface TreeEntry {
  mode: string;
  type: string;
  sha: string;
  path: string;
}

/**
 * Pre-gathered data for the pipeline.
 * All data is gathered upfront by InitStep and passed to later steps.
 * Steps should NOT fetch data - they receive it here.
 */
export interface PlanData {
  /** File changes per commit (from git diff-tree) */
  fileChanges: Map<string, FileChange[]>;

  /** File content (key: "sha:path", value: content) */
  content: Map<string, string>;

  /** Tree entries for relevant commits (sha -> (path -> entry)) */
  trees: Map<string, Map<string, TreeEntry>>;

  /** File sizes (key: "sha:path", value: bytes) */
  sizes: Map<string, number>;

  /** Ignored paths */
  ignoredPaths: Set<string>;

  /** Staged files (from init step) */
  stagedFiles?: FileChange[];

  /** Unstaged files (from init step) */
  unstagedFiles?: FileChange[];
}

export interface PipelineState {
  selectedCommitShas: string[];
  includeWorkspace: boolean;
  workspaceParts?: Set<'staged' | 'unstaged'>;
  explicitTimeline?: string[];
  liveOverrides?: Map<string, string>;

  /** Pre-gathered plan data - steps read from here, don't fetch */
  plan?: PlanData;

  commitFacts?: any[];
  workspaceFacts?: {
    staged: WorkspaceFacts | null;
    unstaged: WorkspaceFacts | null;
  };
  mode?: 'full' | 'live' | 'cheap_live';
  bundleFacts?: any;
  bundleSummary?: any;
  history?: any;
  llmOutputs?: any;

  scope?: ScopeSet;
  intended?: Map<string, IntendedState>;
  working?: WorkingSnapshot;
  drift?: DriftFindings;
  legacy?: LegacyAuditResult;
  hotspots?: Array<{
    path: string;
    score: number;
    name?: string;
    added?: number;
    removed?: number;
    touchedInVersions?: string[];
    touchedInVersionsDescription?: string;
    [key: string]: any;
  }>;
  movedBlocks?: MovedBlock[];
  movedLineage?: CrossVersionSymbolLineage[];

  embeddingMetrics?: EmbeddingMetrics;
  historyMetrics?: HistoryMetrics;
  llmMetrics?: LlmMetrics;

  currentStepId?: string | null;
  completedSteps: Set<string>;
  errors: Array<{ stepId: string; error: unknown }>;

  stepTimings?: Record<string, { start: number; end?: number; duration?: number }>;
  pipelineDuration?: number;

  partialReasons?: string[];
  onEvent?: PipelineEventHandler;

  status?: 'pending' | 'completed' | 'aborted';
  abortReason?: string;
}

export interface PipelineStep {
  id: string;
  label: string;
  deps?: string[];
  run: (state: PipelineState, token: vscode.CancellationToken) => Promise<void> | void;
}

export type PipelineEvent =
  | { type: 'start'; step: PipelineStep; state: PipelineState; timestamp: string }
  | {
      type: 'complete';
      step: PipelineStep;
      state: PipelineState;
      duration?: number;
      cacheHits?: number;
      cacheMisses?: number;
      timestamp: string;
    }
  | {
      type: 'error';
      step: PipelineStep;
      error: unknown;
      state: PipelineState;
      stepError?: { message: string; stack?: string };
      timestamp: string;
    }
  | { type: 'finished'; state: PipelineState; timestamp: string }
  | { type: 'aborted'; state: PipelineState; timestamp: string }
  | {
      type: 'progress';
      step: PipelineStep;
      state: PipelineState;
      data: any;
      timestamp: string;
    };

export type PipelineEventHandler = (event: PipelineEvent) => void;

/**
 * Configuration options for pipeline execution
 */
export interface PipelineConfig {
  concurrency: number;
  skipEmbedding?: boolean;
  skipLLM?: boolean;
  maxRetries?: number;
  enableCacheStats?: boolean;
  cacheTTL?: number;
}
