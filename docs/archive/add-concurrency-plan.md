Perfect, dropping real multithreading makes this *way* cleaner.

Let’s lock in a plan that’s:

* **Single-threaded** (no worker_threads).
* **Sequential at the top level** (steps in order).
* **Concurrent where it counts** inside steps (per-commit/file/HTTP), using async + a concurrency limiter.

I’ll give you:

1. Runner design (simple, clean).
2. Small concurrency helper.
3. Example steps wired around that pattern.

You can paste most of this and just swap in your real services.

---

## 1. The runner: ordered steps + events

Each step:

* Gets the shared `state`.
* Does its work (maybe with internal concurrency).
* Resolves when done.
* The runner:

  * Calls steps in order.
  * Emits events so your existing state/UI layer can react.

```ts
// pipelineTypes.ts

export interface PipelineState {
  // inputs
  selectedCommitShas: string[];
  includeWorkspace: boolean;

  // outputs / intermediates (adjust to your real types)
  commitFacts?: any[];
  workspaceFacts?: any;
  bundleFacts?: any;
  history?: any;
  llmOutputs?: any;

  // progress & errors
  currentStepId?: string | null;
  completedSteps: Set<string>;
  errors: { stepId: string; error: unknown }[];
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

### Runner implementation

```ts
// pipelineRunner.ts
import { PipelineStep, PipelineState, PipelineEventHandler } from './pipelineTypes';

export async function runPipeline(
  steps: PipelineStep[],
  initialState: Omit<PipelineState, 'completedSteps' | 'errors'>,
  onEvent?: PipelineEventHandler,
): Promise<PipelineState> {
  const state: PipelineState = {
    ...initialState,
    completedSteps: new Set<string>(),
    errors: [],
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
      break; // or continue if you want best-effort mode
    }
  }

  state.currentStepId = null;
  onEvent?.({ type: 'finished', state });
  return state;
}
```

That’s the entire orchestrator.

---

## 2. Controlled concurrency helper (no threads, just async)

This is your “multithreading where it counts”: many independent tasks in parallel, but capped.

```ts
// concurrency.ts

export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
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

Use this inside heavy steps (commit indexing, diffs, embeddings, etc.).

---

## 3. Example steps (generic but realistic)

Assume you’ve got some services:

```ts
// services.ts – signatures are generic placeholders
export interface Services {
  ensureCommitIndexed: (sha: string) => Promise<any>; // CommitFacts
  computeWorkspaceOverlay: () => Promise<{ workspaceFacts: any }>;
  aggregateBundleFacts: (commitFacts: any[], workspaceFacts: any | null) => any;
  indexEmbeddings: (commitFacts: any[]) => Promise<void>;
  retrieveHistory: (bundleFacts: any) => Promise<any>;
  generateBundleNarrative: (bundleFacts: any, history: any) => Promise<any>;
}
```

### Step 1: index commits (Tree-sitter + difftastic inside)

```ts
// steps/indexCommitsStep.ts
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { runWithConcurrency } from '../concurrency';
import { Services } from '../services';

export function createIndexCommitsStep(svcs: Services, concurrency = 4): PipelineStep {
  return {
    id: 'index_commits',
    label: 'Index commits (snapshots + diffs + metrics)',

    async run(state: PipelineState) {
      const shas = state.selectedCommitShas;
      const results: any[] = [];

      await runWithConcurrency(shas, concurrency, async (sha) => {
        const facts = await svcs.ensureCommitIndexed(sha);
        results.push(facts);
      });

      state.commitFacts = results;
    },
  };
}
```

Inside `ensureCommitIndexed` you do your real work:

* `getOrCreateSnapshot` (Tree-sitter, cached)
* `getOrCreateStructuralDiff` (difftastic subprocess, cached)
* DB writes, risk detection, etc.

---

### Step 2: workspace overlay (only if enabled)

```ts
// steps/workspaceOverlayStep.ts
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { Services } from '../services';

export function createWorkspaceOverlayStep(svcs: Services): PipelineStep {
  return {
    id: 'workspace_overlay',
    label: 'Analyze workspace overlay',

    async run(state: PipelineState) {
      if (!state.includeWorkspace) {
        state.workspaceFacts = null;
        return;
      }

      const { workspaceFacts } = await svcs.computeWorkspaceOverlay();
      state.workspaceFacts = workspaceFacts;
    },
  };
}
```

`computeWorkspaceOverlay` can itself use `runWithConcurrency` internally for changed files.

---

### Step 3: bundle facts aggregation

```ts
// steps/finalizeBundleFactsStep.ts
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { Services } from '../services';

export function createFinalizeBundleFactsStep(svcs: Services): PipelineStep {
  return {
    id: 'finalize_bundle',
    label: 'Aggregate bundle facts',

    async run(state: PipelineState) {
      if (!state.commitFacts || state.commitFacts.length === 0) {
        throw new Error('No commitFacts available before finalize_bundle');
      }

      const bundleFacts = svcs.aggregateBundleFacts(
        state.commitFacts,
        state.workspaceFacts ?? null,
      );

      state.bundleFacts = bundleFacts;
    },
  };
}
```

---

### Step 4: embeddings (Quant) – parallel HTTP calls inside

```ts
// steps/embeddingStep.ts
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { Services } from '../services';

export function createEmbeddingStep(svcs: Services): PipelineStep {
  return {
    id: 'embedding_index',
    label: 'Index embeddings (Quant)',

    async run(state: PipelineState) {
      if (!state.commitFacts) return;
      await svcs.indexEmbeddings(state.commitFacts);
    },
  };
}
```

Inside `indexEmbeddings`, use `runWithConcurrency` to embed multiple shards at once with a limit.

---

### Step 5: cross-time retrieval via embeddings

```ts
// steps/retrieveHistoryStep.ts
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { Services } from '../services';

export function createRetrieveHistoryStep(svcs: Services): PipelineStep {
  return {
    id: 'retrieve_history',
    label: 'Retrieve cross-time history',

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        throw new Error('bundleFacts required before retrieve_history');
      }

      const history = await svcs.retrieveHistory(state.bundleFacts);
      state.history = history;
    },
  };
}
```

---

### Step 6: LLM story + drift + plan

```ts
// steps/llmStoryStep.ts
import { PipelineStep, PipelineState } from '../pipelineTypes';
import { Services } from '../services';

export function createLlmStoryStep(svcs: Services): PipelineStep {
  return {
    id: 'llm_story',
    label: 'Generate story + drift + plan (LLM)',

    async run(state: PipelineState) {
      if (!state.bundleFacts) {
        throw new Error('bundleFacts required before llm_story');
      }

      const outputs = await svcs.generateBundleNarrative(
        state.bundleFacts,
        state.history ?? null,
      );

      state.llmOutputs = outputs;
    },
  };
}
```

---

## 4. Putting it all together

```ts
// refactorBundlePipeline.ts
import { runPipeline } from './pipelineRunner';
import { PipelineState, PipelineEvent } from './pipelineTypes';
import { Services } from './services';

import { createIndexCommitsStep } from './steps/indexCommitsStep';
import { createWorkspaceOverlayStep } from './steps/workspaceOverlayStep';
import { createFinalizeBundleFactsStep } from './steps/finalizeBundleFactsStep';
import { createEmbeddingStep } from './steps/embeddingStep';
import { createRetrieveHistoryStep } from './steps/retrieveHistoryStep';
import { createLlmStoryStep } from './steps/llmStoryStep';

export async function runRefactorBundlePipeline(
  services: Services,
  initial: Omit<PipelineState, 'completedSteps' | 'errors'>,
  onEvent?: (event: PipelineEvent) => void,
) {
  const steps = [
    createIndexCommitsStep(services, 4),
    createWorkspaceOverlayStep(services),
    createFinalizeBundleFactsStep(services),
    createEmbeddingStep(services),
    createRetrieveHistoryStep(services),
    createLlmStoryStep(services),
  ];

  return runPipeline(steps, initial, onEvent);
}
```

Hook into your existing UI/state:

```ts
runRefactorBundlePipeline(services, {
  selectedCommitShas,
  includeWorkspace,
}, (event) => {
  switch (event.type) {
    case 'start':
      cockpitState.update({
        ...event.state,
        status: `Running: ${event.step.label}`,
      });
      break;
    case 'complete':
      cockpitState.update({
        ...event.state,
        status: `Completed: ${event.step.label}`,
      });
      break;
    case 'error':
      cockpitState.update({
        ...event.state,
        status: `Error in ${event.step.label}`,
        lastError: String(event.error),
      });
      break;
    case 'finished':
      cockpitState.update({
        ...event.state,
        status: event.state.errors.length ? 'Failed' : 'Done',
      });
      break;
  }
});
```

---

### Net effect

* **Runner** is dead simple: array → for-loop → events.
* **Concurrency** lives inside steps via `runWithConcurrency` (no workers).
* Heavy stuff:

  * Tree-sitter & difftastic happen once per blob/pair and can be parallelized per commit/file.
  * Quant embedding/index/search happens in parallel HTTP calls.
  * LLM calls run once per bundle (or a few times) with no extra complexity.

If you want, next we can zoom in on one of those generic services (e.g., `ensureCommitIndexed`) and sketch how it would internally use snapshots + difftastic + DB under this runner.
