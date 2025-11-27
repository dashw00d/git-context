import { PipelineStep, PipelineState, PipelineEventHandler } from './pipelineTypes';
import { logInfo, logDebug } from '../../utils/logger';

/**
 * Build dependency graph from pipeline steps
 */
function buildDepGraph(steps: PipelineStep[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const step of steps) {
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

  // Initialize in-degrees (number of dependencies each node has)
  for (const node in graph) {
    inDegree.set(node, graph[node].length);
    if (graph[node].length === 0) {
      queue.push(node);
    }
  }

  // Process queue
  while (queue.length > 0) {
    const level: string[] = [];

    // Process all nodes at current level
    const queueSize = queue.length;
    for (let i = 0; i < queueSize; i++) {
      const node = queue.shift()!;
      level.push(node);

      // Reduce in-degree of all nodes that depend on this node
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

  // Check for cycles (if not all nodes were processed)
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
    errors: []
  };

  const pipelineStartTime = Date.now();
  const stepTimings: Record<string, { start: number; end?: number; duration?: number }> = {};

  // Build dependency graph and topological levels
  const depGraph = buildDepGraph(steps);
  const levels = topologicalSort(depGraph);

  logInfo(`[Pipeline] Starting pipeline execution with ${levels.length} levels and ${steps.length} steps`);

  // Execute steps level by level (parallel within levels)
  for (const level of levels) {
    const promises = level.map(stepId => {
      const step = steps.find(s => s.id === stepId)!;
      const startTime = Date.now();
      stepTimings[stepId] = { start: startTime };

      return Promise.resolve()
        .then(() => {
          state.currentStepId = step.id;
          const timestamp = new Date().toISOString();
          onEvent?.({ type: 'start', step, state, timestamp });
          logDebug(`[Pipeline] Started step: ${step.label}`);
          return step.run(state);
        })
        .then(() => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          stepTimings[stepId].end = endTime;
          stepTimings[stepId].duration = duration;
          state.completedSteps.add(step.id);

          // Collect cache statistics if available
          let cacheHits: number | undefined;
          let cacheMisses: number | undefined;

          // Try to get cache stats from commit indexer (stored in state or accessible)
          // This is a simplified approach - in practice, you'd pass config to enable this
          if (step.id === 'bundle_facts' && state.commitFacts) {
            // Estimate cache performance from commit facts processing
            // This is a placeholder - actual implementation would track per-step
          }

          const timestamp = new Date().toISOString();
          onEvent?.({ type: 'complete', step, state, duration, cacheHits, cacheMisses, timestamp });
          logDebug(`[Pipeline] Completed step: ${step.label} (${duration}ms)`);
        })
        .catch(error => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          stepTimings[stepId].end = endTime;
          stepTimings[stepId].duration = duration;

          state.errors.push({ stepId: step.id, error });

          // Extract detailed error information
          const stepError = {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          };

          const timestamp = new Date().toISOString();
          onEvent?.({ type: 'error', step, error, state, stepError, timestamp });
          logDebug(`[Pipeline] Failed step: ${step.label} (${duration}ms): ${stepError.message}`);
          // Continue with other steps in level (best-effort mode)
        });
    });

    // Wait for all steps in this level to complete
    await Promise.allSettled(promises);
  }

  // Log performance summary
  const pipelineEndTime = Date.now();
  const totalDuration = pipelineEndTime - pipelineStartTime;

  logInfo(`[Pipeline] Pipeline completed in ${totalDuration}ms`);
  logInfo(`[Pipeline] Steps completed: ${state.completedSteps.size}/${steps.length}`);
  if (state.errors.length > 0) {
    logInfo(`[Pipeline] Steps failed: ${state.errors.length}`);
  }

  // Log individual step timings
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
