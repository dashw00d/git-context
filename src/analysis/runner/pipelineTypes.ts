import type { DriftFindings } from '../../facts/driftDetector';
import type { IntendedState } from '../../facts/intendedMap';
import type { LegacyAuditResult } from '../../facts/legacyAudit';
import type { ScopeSet } from '../../facts/scope';
import type { WorkingSnapshot } from '../../facts/workingSnapshot';

import type { CrossVersionSymbolLineage, MovedBlock } from '../movedBlockDetector';
import type { WorkspaceFacts } from '../workspaceIndexer';
import type { EmbeddingMetrics, HistoryMetrics, LlmMetrics } from './pipelineMetrics';

export interface PipelineState {
  selectedCommitShas: string[];
  includeWorkspace: boolean;
  workspaceParts?: Set<'staged' | 'unstaged'>;
  explicitTimeline?: string[];
  liveOverrides?: Map<string, string>;

  commitFacts?: any[];
  workspaceFacts?: {
    staged: WorkspaceFacts | null;
    unstaged: WorkspaceFacts | null;
  };
  mode?: 'full' | 'live' | 'cheap_live';
  bundleFacts?: any;
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
}

export interface PipelineStep {
  id: string;
  label: string;
  deps?: string[];
  run: (state: PipelineState) => Promise<void> | void;
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
  | { type: 'finished'; state: PipelineState; timestamp: string };

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
