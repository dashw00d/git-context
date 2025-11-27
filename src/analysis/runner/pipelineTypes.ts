import type { ScopeSet } from '../../facts/scope';
import type { IntendedState } from '../../facts/intendedMap';
import type { WorkingSnapshot } from '../../facts/workingSnapshot';
import type { DriftFindings } from '../../facts/driftDetector';
import type { LegacyAuditResult } from '../../facts/legacyAudit';
import type { FileHotspot, SymbolHotspot } from '../hotspotDetector';
import type { MovedBlock } from '../movedBlockDetector';

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

  // New facts fields (populated by independent steps)
  scope?: ScopeSet;
  intended?: Map<string, IntendedState>;
  working?: WorkingSnapshot;
  drift?: DriftFindings;
  legacy?: LegacyAuditResult;
  hotspots?: Array<FileHotspot | SymbolHotspot>;
  movedBlocks?: MovedBlock[];

  // Progress tracking
  currentStepId?: string | null;
  completedSteps: Set<string>;
  errors: Array<{ stepId: string; error: unknown }>;
}

export interface PipelineStep {
  id: string;
  label: string;
  deps?: string[];  // Array of step IDs this step depends on
  run: (state: PipelineState) => Promise<void> | void;
}

export type PipelineEvent =
  | { type: 'start'; step: PipelineStep; state: PipelineState; timestamp: string }
  | { type: 'complete'; step: PipelineStep; state: PipelineState; duration?: number; cacheHits?: number; cacheMisses?: number; timestamp: string }
  | { type: 'error'; step: PipelineStep; error: unknown; state: PipelineState; stepError?: { message: string; stack?: string }; timestamp: string }
  | { type: 'finished'; state: PipelineState; timestamp: string };

export type PipelineEventHandler = (event: PipelineEvent) => void;

/**
 * Configuration options for pipeline execution
 */
export interface PipelineConfig {
  concurrency: number;        // Commit indexing concurrency
  skipEmbedding?: boolean;    // Skip embedding generation for faster execution
  skipLLM?: boolean;          // Skip LLM story generation
  maxRetries?: number;        // Maximum retry attempts for transient failures
  enableCacheStats?: boolean; // Enable cache performance logging
  cacheTTL?: number;          // Cache TTL in seconds (default 3600)
}
