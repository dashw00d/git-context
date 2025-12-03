/* eslint-disable no-restricted-syntax */
import { withTimeout } from '../../utils/async';
import { logDebug, logInfo } from '../../utils/logger';
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
  onEvent?: PipelineEventHandler
): Promise<PipelineState> {
  const state: PipelineState = {
    ...initialState,
    completedSteps: new Set<string>(),
    errors: [],
    stepTimings: {},
    partialReasons: [],
    onEvent,
  };

  const pipelineStartTime = Date.now();
  const stepTimings: Record<string, { start: number; end?: number; duration?: number }> = {};

  const depGraph = buildDepGraph(steps);
  const levels = topologicalSort(depGraph);

  console.error(`🚀 [Pipeline] runPipeline called with ${steps.length} steps`);
  console.error(`🚀 [Pipeline] Step IDs: ${steps.map(s => s.id).join(', ')}`);
  console.error(`🚀 [Pipeline] Levels: ${levels.length}`, levels);

  logInfo(
    `[Pipeline] Starting pipeline execution with ${levels.length} levels and ${steps.length} steps`
  );

  for (const level of levels) {
    console.error(`🔵 [Pipeline] Processing level with ${level.length} steps: ${level.join(', ')}`);
    const promises = level.map(stepId => {
      const step = steps.find(s => s.id === stepId)!;
      const startTime = Date.now();
      stepTimings[stepId] = { start: startTime };
      state.stepTimings![stepId] = { start: startTime };

      return Promise.resolve()
        .then(() => {
          console.error(`⏩ [Pipeline] About to run step: ${step.id}`);
          state.currentStepId = step.id;
          const timestamp = new Date().toISOString();
          onEvent?.({ type: 'start', step, state, timestamp });
          logDebug(`[Pipeline] Started step: ${step.label}`);
          console.error(`▶️  [Pipeline] Calling step.run() for: ${step.id}`);
          const runPromise = step.run(state);
          console.error(`⏱️  [Pipeline] step.run() returned promise for: ${step.id}`);
          return withTimeout(
            Promise.resolve(runPromise),
            300000, // 5 minutes default timeout for pipeline steps
            `Pipeline step '${step.id}'`
          );
        })
        .then(() => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          stepTimings[stepId].end = endTime;
          stepTimings[stepId].duration = duration;
          state.stepTimings![stepId].end = endTime;
          state.stepTimings![stepId].duration = duration;
          state.completedSteps.add(step.id);

          let cacheHits: number | undefined;
          let cacheMisses: number | undefined;

          if (step.id === 'bundle_facts' && state.commitFacts) {
            // empty
          }

          const timestamp = new Date().toISOString();
          onEvent?.({
            type: 'complete',
            step,
            state,
            duration,
            cacheHits,
            cacheMisses,
            timestamp,
          });
          logDebug(`[Pipeline] Completed step: ${step.label} (${duration}ms)`);
        })
        .catch(error => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          stepTimings[stepId].end = endTime;
          stepTimings[stepId].duration = duration;
          state.stepTimings![stepId].end = endTime;
          state.stepTimings![stepId].duration = duration;

          state.errors.push({ stepId: step.id, error });

          const optionalSteps = ['drift', 'legacy', 'hotspots', 'moved_blocks'];
          if (optionalSteps.includes(step.id)) {
            state.partialReasons!.push(
              `${step.label} failed: ${error instanceof Error ? error.message : String(error)}`
            );
          }

          const stepError = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          };

          const timestamp = new Date().toISOString();
          onEvent?.({
            type: 'error',
            step,
            error,
            state,
            stepError,
            timestamp,
          });
          logDebug(`[Pipeline] Failed step: ${step.label} (${duration}ms): ${stepError.message}`);
        });
    });

    await Promise.allSettled(promises);
  }

  const pipelineEndTime = Date.now();
  const totalDuration = pipelineEndTime - pipelineStartTime;
  state.pipelineDuration = totalDuration;

  logInfo(`[Pipeline] Pipeline completed in ${totalDuration}ms`);
  logInfo(`[Pipeline] Steps completed: ${state.completedSteps.size}/${steps.length}`);
  if (state.errors.length > 0) {
    logInfo(`[Pipeline] Steps failed: ${state.errors.length}`);
  }

  const completedTimings = Object.entries(stepTimings)
    .filter(([, timing]) => timing.duration !== undefined)
    .sort(([, a], [, b]) => (b.duration || 0) - (a.duration || 0));

  if (completedTimings.length > 0) {
    logDebug('[Pipeline] Step timing summary:');
    completedTimings.slice(0, 5).forEach(([stepId, timing]) => {
      logDebug(`  ${stepId}: ${timing.duration}ms`);
    });
  }

  state.currentStepId = null;
  const timestamp = new Date().toISOString();
  onEvent?.({ type: 'finished', state, timestamp });
  return state;
}
