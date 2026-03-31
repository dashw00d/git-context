/**
 * Pipeline Verification Functions
 * Verify preconditions before and postconditions after step execution
 */

import { z } from 'zod';
import { logError, logWarn, logDebug } from '../../utils/logger';
import { getStepOutputSchema } from './pipelineSchemas';
import { getStepPreconditions } from './stepPreconditions';
import type { PipelineState } from './pipelineTypes';
import type { StepPreconditions } from './stepPreconditions';

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
    for (let i = 0; i < preconditions.typeGuards.length; i++) {
      const guard = preconditions.typeGuards[i];
      if (!guard(state)) {
        const guardName = guard.name || `guard_${i}`;
        errors.push(`Type guard '${guardName}' failed`);
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

  // Fail fast if any preconditions fail
  if (errors.length > 0) {
    const errorMessage = `[${stepId}] Precondition verification failed:\n${errors.map(e => `  - ${e}`).join('\n')}`;
    logError(errorMessage);
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(errorMessage);
  }

  logDebug(`[Verification] Preconditions passed for step: ${stepId}`);
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
      // eslint-disable-next-line no-restricted-syntax
      throw new Error(errorMessage);
    } else {
      logWarn(errorMessage);
    }
  } else {
    logDebug(
      `[Verification] Postconditions passed for step: ${stepId}, output: ${String(outputKey)}`
    );
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

/**
 * Verify postconditions for a step output (convenience wrapper)
 */
export function verifyStepPostconditions(
  stepId: string,
  outputKey: string,
  output: unknown,
  strict: boolean = false
): void {
  const schema = getStepOutputSchema(outputKey);
  if (schema && output !== undefined) {
    verifyPostconditions(stepId, outputKey as keyof PipelineState, output, schema, strict);
  }
}

/**
 * Map step IDs to their output state keys
 */
export function getStepOutputKey(stepId: string): keyof PipelineState | undefined {
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
