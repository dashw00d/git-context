import {
  buildIntendedMap,
  IntendedState,
  reconstructIntendedFromEvidence,
} from '../facts/intendedMap';
import { RefactorBundleFacts } from '../facts/types';
import { BundleStoryEngine } from './bundleStoryEngine';
import { CommitIndexer } from './commitIndexer';
import { EmbeddingIndexer } from './embeddingIndexer';
import { buildPipelineSteps } from './runner/pipelineManifest';
import { runPipeline } from './runner/pipelineRunner';
import { PipelineConfig, PipelineEvent, PipelineState } from './runner/pipelineTypes';
import { WorkspaceIndexer } from './workspaceIndexer';

/**
 * Build explicit timeline chain from UI selections
 * Returns array sorted newest → oldest for optimal cache warming
 */
function buildExplicitTimeline(options: {
  includeUnstaged: boolean;
  includeStaged: boolean;
  selectedCommitShas: string[]; // Already sorted newest → oldest by caller
}): string[] {
  const timeline: string[] = [];

  // Add workspace versions (newest first)
  if (options.includeUnstaged) {
    timeline.push('workspace-unstaged');
  }
  if (options.includeStaged) {
    timeline.push('workspace-staged');
  }

  // Add HEAD if we have commits (bridge between workspace and commits)
  if (options.selectedCommitShas.length > 0) {
    timeline.push('HEAD');
  }

  // Add selected commits (already sorted newest → oldest)
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
    config?: Partial<PipelineConfig>
  ) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Run complete refactor bundle analysis pipeline
   */
  async analyzeBundle(
    commitShas: string[],
    includeWorkspace: boolean = false,
    workspaceParts?: Set<'staged' | 'unstaged'>,
    onEvent?: (event: PipelineEvent) => void
  ): Promise<PipelineState> {
    // Build explicit timeline from UI selections
    const explicitTimeline = buildExplicitTimeline({
      includeUnstaged: includeWorkspace && (workspaceParts?.has('unstaged') ?? true),
      includeStaged: includeWorkspace && (workspaceParts?.has('staged') ?? true),
      selectedCommitShas: commitShas,
    });

    const steps = buildPipelineSteps({
      commitIndexer: this.commitIndexer,
      workspaceIndexer: this.workspaceIndexer,
      embeddingIndexer: this.embeddingIndexer,
      storyEngine: this.storyEngine,
      concurrency: this.config.concurrency,
      skipEmbedding: this.config.skipEmbedding,
      skipLLM: this.config.skipLLM,
    });

    const initialState: PipelineState = {
      selectedCommitShas: commitShas,
      includeWorkspace,
      workspaceParts,
      explicitTimeline, // Pass to all steps
      completedSteps: new Set(),
      errors: [],
    };

    const finalState = await runPipeline(steps, initialState, onEvent);

    // Flush any pending snapshot and diff writes at end of pipeline
    // Access managers through workspaceIndexer and commitIndexer (they're private, use type assertion)
    const workspaceIndexerAny = this.workspaceIndexer as any;
    const commitIndexerAny = this.commitIndexer as any;
    workspaceIndexerAny.snapshotManager?.flushSnapshotQueue();
    workspaceIndexerAny.structuralDiffManager?.flushDiffQueue();
    commitIndexerAny.snapshotManager?.flushSnapshotQueue();
    commitIndexerAny.structuralDiffManager?.flushDiffQueue();

    return finalState;
  }

  /**
   * Run lightweight live analysis on unsaved/unstaged changes
   * Skips heavy steps (commit indexing, embedding, LLM)
   */
  async analyzeLive(
    liveOverrides: Map<string, string>,
    previousBundleFacts: RefactorBundleFacts
  ): Promise<PipelineState> {
    // 1. Reconstruct Intended State
    let intended: Map<string, IntendedState>;
    const shas = previousBundleFacts?.bundle?.shas || [];

    if (shas.length > 0) {
      try {
        intended = await buildIntendedMap(shas);
      } catch (error) {
        // Fallback if database unavailable or incomplete
        intended = reconstructIntendedFromEvidence(previousBundleFacts?.evidence);
      }
    } else {
      intended = reconstructIntendedFromEvidence(previousBundleFacts?.evidence);
    }

    // 2. Configure Lightweight Steps
    // Note: We skip index_commits because we rely on previous bundle or workspace state
    const steps = buildPipelineSteps({
      commitIndexer: this.commitIndexer,
      workspaceIndexer: this.workspaceIndexer,
      embeddingIndexer: this.embeddingIndexer,
      storyEngine: this.storyEngine,
      concurrency: this.config.concurrency,
      skipEmbedding: true,
      skipLLM: true,
    }).filter(
      step =>
        !['hotspots', 'moved_blocks', 'embedding_index', 'retrieve_history', 'llm_story'].includes(
          step.id
        )
    );

    // 3. Run Pipeline
    // We set workspaceParts to both staged/unstaged to ensure full scope coverage
    // liveOverrides are passed to createWorkingStep via state
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
      bundleFacts: previousBundleFacts, // Inject for context
      mode: 'cheap_live',
      completedSteps: new Set(),
      errors: [],
    };

    return runPipeline(steps, initialState);
  }

  /**
   * Quick commit indexing only (no LLM/embeddings)
   */
  async indexCommits(commitShas: string[]): Promise<void> {
    await this.commitIndexer.ensureCommitsIndexed(commitShas);
  }
}
