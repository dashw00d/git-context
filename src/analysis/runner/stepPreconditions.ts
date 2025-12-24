/**
 * Precondition requirements for each pipeline step
 * Maps step IDs to their required state properties and completed dependencies
 */

import {
  hasIntended,
  hasWorking,
  hasScope,
  hasDrift,
  hasLegacy,
  hasCommitFacts,
  hasPlan,
} from './pipelineTypeGuards';
import type { PipelineState } from './pipelineTypes';

/**
 * Precondition specification for a pipeline step
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

/**
 * Check if a step has registered preconditions
 */
export function hasStepPreconditions(stepId: string): boolean {
  return stepId in STEP_PRECONDITIONS;
}
