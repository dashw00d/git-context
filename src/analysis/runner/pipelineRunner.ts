/* eslint-disable no-restricted-syntax */
import * as vscode from 'vscode';
import { DatabaseWriteQueue } from '../../storage/databaseWriteQueue';
import { withTimeout } from '../../utils/async';
import { logDebug, logInfo, logError } from '../../utils/logger';
import { OPTIONAL_STEPS } from './pipelineConfigs';
import { PipelineEventHandler, PipelineState, PipelineStep } from './pipelineTypes';

/**
 * Build dependency graph from pipeline steps
 */
function buildDepGraph(steps: PipelineStep[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const stepIds = new Set(steps.map(s => s.id));

  for (const step of steps) {
    if (step.deps) {
      for (const dep of step.deps) {
        if (!stepIds.has(dep)) {
          throw new Error(`Step '${step.id}' depends on missing step '${dep}'`);
        }
      }
    }
    graph[step.id] = step.deps || [];
  }

  return graph;
}

/**
 * Perform topological sort using Kahn's algorithm
 * Returns array of levels, where each level contains steps that can run in parallel
 */
function topologicalSort(graph: Record<string, string[]>): string[][] {
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const levels: string[][] = [];

  for (const node in graph) {
    inDegree.set(node, graph[node].length);
    if (graph[node].length === 0) {
      queue.push(node);
    }
  }

  while (queue.length > 0) {
    const level: string[] = [];

    const queueSize = queue.length;
    for (let i = 0; i < queueSize; i++) {
      const node = queue.shift()!;
      level.push(node);

      for (const dependent in graph) {
        if (graph[dependent].includes(node)) {
          const currentDegree = inDegree.get(dependent)! - 1;
          inDegree.set(dependent, currentDegree);
          if (currentDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }

    if (level.length > 0) {
      levels.push(level);
    }
  }

  if (levels.flat().length !== Object.keys(graph).length) {
    throw new Error('Pipeline contains circular dependencies');
  }

  return levels;
}

export async function runPipeline(
  steps: PipelineStep[],
  initialState: Omit<PipelineState, 'completedSteps' | 'errors'>,
  token?: vscode.CancellationToken,
  onEvent?: PipelineEventHandler
): Promise<PipelineState> {
  const state: PipelineState = {
    ...initialState,
    completedSteps: new Set<string>(),
    errors: [],
    stepTimings: {},
    partialReasons: [],
    onEvent,
    status: 'pending',
  };

  const pipelineStartTime = Date.now();
  const stepTimings: Record<string, { start: number; end?: number; duration?: number }> = {};

  const depGraph = buildDepGraph(steps);
  const levels = topologicalSort(depGraph);

  logDebug(`🚀 [Pipeline] runPipeline called with ${steps.length} steps`);
  logDebug(`🚀 [Pipeline] Levels: ${levels.length}`);

  for (const level of levels) {
    // 1. Fail Fast: Check cancellation before starting a level
    if (token?.isCancellationRequested) {
      logInfo('[Pipeline] Cancellation requested. Aborting pipeline.');
      state.status = 'aborted';
      state.abortReason = 'Cancellation requested';
      onEvent?.({ type: 'aborted', state, timestamp: new Date().toISOString() });
      throw new vscode.CancellationError();
    }

    logInfo(`[Pipeline] Processing level: ${level.join(', ')}`);

    const stepPromises = level.map(async stepId => {
      const step = steps.find(s => s.id === stepId)!;
      const isOptional = OPTIONAL_STEPS.has(stepId);

      const startTime = Date.now();
      stepTimings[stepId] = { start: startTime };
      state.stepTimings![stepId] = { start: startTime };

      try {
        // 2. Fail Fast: Check cancellation before specific step
        if (token?.isCancellationRequested) {
          throw new vscode.CancellationError();
        }

        onEvent?.({ type: 'start', step, state, timestamp: new Date().toISOString() });

        // 3. Execution: Pass token to step
        // Wrap in Promise.resolve to handle both async and sync returns
        const runPromise = Promise.resolve(step.run(state, token!));

        // Use longer timeout for steps that can legitimately take a long time
        // index_commits and workspace_overlay can take 10+ minutes on large repos
        const timeoutMs =
          step.id === 'index_commits' || step.id === 'workspace_overlay' ? 600000 : 300000; // 10 min for slow steps, 5 min for others
        await withTimeout(runPromise, timeoutMs, `Pipeline step '${step.id}'`);

        // Success handling
        const endTime = Date.now();
        const duration = endTime - startTime;
        stepTimings[stepId].end = endTime;
        stepTimings[stepId].duration = duration;
        state.stepTimings![stepId].end = endTime;
        state.stepTimings![stepId].duration = duration;
        state.completedSteps.add(step.id);

        // Log cache hits if applicable (preserving original logic)
        let cacheHits: number | undefined;
        let cacheMisses: number | undefined;
        if (step.id === 'bundle_facts' && state.commitFacts) {
          cacheHits = state.commitFacts.length;
          cacheMisses = 0;
        }

        onEvent?.({
          type: 'complete',
          step,
          state,
          duration,
          cacheHits,
          cacheMisses,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        stepTimings[stepId].end = endTime;
        stepTimings[stepId].duration = duration;
        state.stepTimings![stepId].end = endTime;
        state.stepTimings![stepId].duration = duration;

        // Handle Cancellation explicitly
        if (error instanceof vscode.CancellationError) {
          throw error; // Re-throw to stop the entire pipeline
        }

        // Handle Standard Errors
        const errorMsg = error instanceof Error ? error.message : String(error);
        state.errors.push({ stepId: step.id, error });

        logError(`[Pipeline] Step ${step.id} failed: ${errorMsg}`);

        onEvent?.({
          type: 'error',
          step,
          error,
          state,
          stepError: { message: errorMsg, stack: error instanceof Error ? error.stack : undefined },
          timestamp: new Date().toISOString(),
        });

        // 4. Circuit Breaker / Wrapper Pattern
        if (isOptional) {
          // OPTIONAL: Swallow error, mark partial, continue pipeline
          state.partialReasons!.push(`${step.label} failed: ${errorMsg}`);
          logInfo(`[Pipeline] Optional step ${step.id} failed. Continuing.`);
        } else {
          // CRITICAL: Re-throw to trigger Promise.all failure
          state.partialReasons!.push(`CRITICAL: ${step.label} failed: ${errorMsg}`);
          throw error;
        }
      }
    });

    // 5. Execution Strategy: Wait for all steps in level
    // Promise.all will reject immediately if any CRITICAL step fails.
    // It will wait for optional steps even if they fail (caught above).
    try {
      await Promise.all(stepPromises);
    } catch (error) {
      if (error instanceof vscode.CancellationError) {
        state.status = 'aborted';
        state.abortReason = 'Cancellation requested';
        onEvent?.({ type: 'aborted', state, timestamp: new Date().toISOString() });
        throw error;
      }
      // Critical error
      state.status = 'aborted';
      state.abortReason = 'Critical step failed';
      onEvent?.({ type: 'aborted', state, timestamp: new Date().toISOString() });
      throw error;
    }
  }

  if (state.status === 'pending') {
    state.status = 'completed';
  }

  // Flush all queued database writes before completing pipeline
  try {
    await DatabaseWriteQueue.getInstance().flushAll();
    logDebug('[Pipeline] Flushed all queued database writes');
  } catch (error) {
    logError(`[Pipeline] Failed to flush database writes: ${error}`);
    // Don't fail the pipeline if flush fails - writes will be flushed by auto-flush
  }

  const pipelineEndTime = Date.now();
  const totalDuration = pipelineEndTime - pipelineStartTime;
  state.pipelineDuration = totalDuration;

  logInfo(`[Pipeline] Pipeline completed in ${totalDuration}ms`);
  onEvent?.({ type: 'finished', state, timestamp: new Date().toISOString() });

  return state;
}
