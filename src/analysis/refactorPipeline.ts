import * as vscode from 'vscode';
import {
  buildIntendedMap,
  IntendedState,
  reconstructIntendedFromEvidence,
} from '../facts/intendedMap';
import { RefactorBundleFacts } from '../facts/types';
import { logDebug } from '../utils/logger';
import { BundleStoryEngine } from './bundleStoryEngine';
import { CommitIndexer } from './commitIndexer';
import { EmbeddingIndexer } from './embeddingIndexer';
import { GitOperations } from './git';
import { buildPipelineSteps } from './runner/pipelineManifest';
import { runPipeline } from './runner/pipelineRunner';
import { PipelineConfig, PipelineEvent, PipelineState } from './runner/pipelineTypes';
import { WorkspaceIndexer } from './workspaceIndexer';

function buildExplicitTimeline(options: {
  includeUnstaged: boolean;
  includeStaged: boolean;
  selectedCommitShas: string[];
}): string[] {
  const timeline: string[] = [];

  if (options.includeUnstaged) {
    timeline.push('workspace-unstaged');
  }
  if (options.includeStaged) {
    timeline.push('workspace-staged');
  }

  if (options.selectedCommitShas.length > 0) {
    timeline.push('HEAD');
  }

  timeline.push(...options.selectedCommitShas);

  return timeline;
}

export class RefactorPipeline {
  private config: PipelineConfig = {
    concurrency: 8,
    skipEmbedding: false,
    skipLLM: true,
    maxRetries: 3,
    enableCacheStats: true,
    cacheTTL: 3600,
  };

  constructor(
    public readonly commitIndexer: CommitIndexer,
    public readonly workspaceIndexer: WorkspaceIndexer,
    public readonly embeddingIndexer: EmbeddingIndexer,
    public readonly storyEngine: BundleStoryEngine,
    private readonly git: GitOperations,
    config?: Partial<PipelineConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async analyzeBundle(
    commitShas: string[],
    includeWorkspace: boolean = false,
    workspaceParts?: Set<'staged' | 'unstaged'>,
    onEvent?: (event: PipelineEvent) => void,
    token?: vscode.CancellationToken
  ): Promise<PipelineState> {
    logDebug(
      `🎯 [RefactorPipeline] analyzeBundle called with ${commitShas.length} commits, workspace: ${includeWorkspace}`
    );

    const explicitTimeline = buildExplicitTimeline({
      includeUnstaged: includeWorkspace && (workspaceParts?.has('unstaged') ?? true),
      includeStaged: includeWorkspace && (workspaceParts?.has('staged') ?? true),
      selectedCommitShas: commitShas,
    });

    logDebug(`🎯 [RefactorPipeline] Built timeline with ${explicitTimeline.length} entries`);

    const steps = buildPipelineSteps({
      commitIndexer: this.commitIndexer,
      workspaceIndexer: this.workspaceIndexer,
      embeddingIndexer: this.embeddingIndexer,
      storyEngine: this.storyEngine,
      concurrency: this.config.concurrency,
      git: this.git,
      skipEmbedding: this.config.skipEmbedding,
      skipLLM: this.config.skipLLM,
    });

    logDebug(`🎯 [RefactorPipeline] Built steps: ${steps.map(s => s.id).join(', ')}`);

    const initialState: PipelineState = {
      selectedCommitShas: commitShas,
      includeWorkspace,
      workspaceParts,
      explicitTimeline,
      completedSteps: new Set(),
      errors: [],
    };

    logDebug(`🎯 [RefactorPipeline] About to call runPipeline with ${steps.length} steps`);
    const finalState = await runPipeline(steps, initialState, token, onEvent);
    logDebug('🎯 [RefactorPipeline] runPipeline returned');

    const workspaceIndexerAny = this.workspaceIndexer as any;
    const commitIndexerAny = this.commitIndexer as any;
    workspaceIndexerAny.snapshotManager?.flushSnapshotQueue();
    workspaceIndexerAny.structuralDiffManager?.flushDiffQueue();
    commitIndexerAny.snapshotManager?.flushSnapshotQueue();
    commitIndexerAny.structuralDiffManager?.flushDiffQueue();

    return finalState;
  }

  async analyzeLive(
    liveOverrides: Map<string, string>,
    previousBundleFacts: RefactorBundleFacts
  ): Promise<PipelineState> {
    let intended: Map<string, IntendedState>;
    const shas = previousBundleFacts?.bundle?.shas || [];

    if (shas.length > 0) {
      try {
        intended = await buildIntendedMap(shas);
      } catch (error) {
        intended = reconstructIntendedFromEvidence(previousBundleFacts?.evidence);
      }
    } else {
      intended = reconstructIntendedFromEvidence(previousBundleFacts?.evidence);
    }

    const steps = buildPipelineSteps({
      commitIndexer: this.commitIndexer,
      workspaceIndexer: this.workspaceIndexer,
      embeddingIndexer: this.embeddingIndexer,
      storyEngine: this.storyEngine,
      concurrency: this.config.concurrency,
      git: this.git,
      skipEmbedding: true,
      skipLLM: true,
    }).filter(
      step =>
        !['hotspots', 'moved_blocks', 'embedding_index', 'retrieve_history', 'llm_story'].includes(
          step.id
        )
    );

    const initialState: PipelineState = {
      selectedCommitShas: shas,
      includeWorkspace: true,
      workspaceParts: new Set(['staged', 'unstaged']),
      explicitTimeline: buildExplicitTimeline({
        includeUnstaged: true,
        includeStaged: true,
        selectedCommitShas: shas,
      }),
      liveOverrides,
      intended,
      bundleFacts: previousBundleFacts,
      mode: 'cheap_live',
      completedSteps: new Set(),
      errors: [],
    };

    return runPipeline(steps, initialState);
  }

  async indexCommits(commitShas: string[]): Promise<void> {
    await this.commitIndexer.ensureCommitsIndexed(commitShas);
  }
}
