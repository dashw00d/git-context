import { BundleStoryEngine } from '../bundleStoryEngine';
import { CommitIndexer } from '../commitIndexer';
import { EmbeddingIndexer } from '../embeddingIndexer';
import { GitOperations } from '../git';
import { WorkspaceIndexer } from '../workspaceIndexer';
import { createBundleFactsStep } from './steps/bundleFactsStep';
import { createDriftStep } from './steps/driftStep';
import { createEmbeddingStep } from './steps/embeddingStep';
import { createHistoryRetrievalStep } from './steps/historyStep';
import { createHotspotStep } from './steps/hotspotStep';
import { createIndexCommitsStep } from './steps/indexCommitsStep';
import { createIntendedStep } from './steps/intendedStep';
import { createLegacyStep } from './steps/legacyStep';
import { createMovedBlockStep } from './steps/movedBlockStep';
import { createScopeStep } from './steps/scopeStep';
import { createStoryStep } from './steps/storyStep';
import { createWorkingStep } from './steps/workingStep';
import { createWorkspaceOverlayStep } from './steps/workspaceStep';
import type { PipelineStep } from './pipelineTypes';

export interface PipelineFactoryContext {
  commitIndexer: CommitIndexer;
  workspaceIndexer: WorkspaceIndexer;
  embeddingIndexer: EmbeddingIndexer;
  storyEngine: BundleStoryEngine;
  concurrency: number;
  git: GitOperations;
  skipEmbedding?: boolean;
  skipLLM?: boolean;
}

type StepDescriptor = {
  id: string;
  label: string;
  deps?: string[];
  when?: (ctx: PipelineFactoryContext) => boolean;
  factory: (ctx: PipelineFactoryContext) => PipelineStep;
};

const manifest: StepDescriptor[] = [
  {
    id: 'workspace_overlay',
    label: 'Analyze workspace changes',
    factory: ctx => createWorkspaceOverlayStep(ctx.workspaceIndexer),
  },
  {
    id: 'scope',
    label: 'Calculate analysis scope',
    factory: ctx => createScopeStep(ctx.git),
  },
  {
    id: 'index_commits',
    label: 'Index commits',
    factory: ctx => createIndexCommitsStep(ctx.commitIndexer, ctx.concurrency),
  },
  {
    id: 'working',
    label: 'Compute working snapshot',
    deps: ['scope'],
    factory: () => createWorkingStep(),
  },
  {
    id: 'intended',
    label: 'Build intended map',
    deps: ['index_commits'],
    factory: () => createIntendedStep(),
  },
  {
    id: 'hotspots',
    label: 'Detect hotspots',
    deps: ['index_commits'],
    factory: () => createHotspotStep(),
  },
  {
    id: 'moved_blocks',
    label: 'Detect moved blocks',
    deps: ['index_commits'],
    factory: () => createMovedBlockStep(),
  },
  {
    id: 'drift',
    label: 'Detect drift',
    deps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay'],
    factory: () => createDriftStep(),
  },
  {
    id: 'legacy',
    label: 'Detect legacy',
    deps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay'],
    factory: () => createLegacyStep(),
  },
  {
    id: 'bundle_facts',
    label: 'Assemble bundle facts',
    deps: [
      'scope',
      'intended',
      'working',
      'drift',
      'legacy',
      'hotspots',
      'index_commits',
      'moved_blocks',
    ],
    factory: () => createBundleFactsStep(),
  },
  {
    id: 'embedding_index',
    label: 'Index embeddings',
    deps: ['bundle_facts'],
    when: ctx => !ctx.skipEmbedding,
    factory: ctx => createEmbeddingStep(ctx.embeddingIndexer),
  },
  {
    id: 'retrieve_history',
    label: 'Retrieve history',
    deps: ['bundle_facts', 'embedding_index'],
    when: ctx => !ctx.skipEmbedding,
    factory: ctx => createHistoryRetrievalStep(ctx.storyEngine),
  },
  {
    id: 'llm_story',
    label: 'Generate story',
    deps: ['bundle_facts', 'retrieve_history', 'embedding_index'],
    when: ctx => !ctx.skipLLM,
    factory: ctx => createStoryStep(ctx.storyEngine),
  },
];

export function buildPipelineSteps(ctx: PipelineFactoryContext): PipelineStep[] {
  return manifest
    .filter(step => (step.when ? step.when(ctx) : true))
    .map(step => {
      const instance = step.factory(ctx);

      return {
        ...instance,
        deps: step.deps ?? instance.deps,
        label: step.label || instance.label,
        id: step.id || instance.id,
      };
    });
}
