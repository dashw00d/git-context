import { runPipeline } from './runner/pipelineRunner';
import { PipelineState, PipelineEvent } from './runner/pipelineTypes';
import { CommitIndexer } from './commitIndexer';
import { WorkspaceIndexer } from './workspaceIndexer';
import { EmbeddingIndexer } from './embeddingIndexer';
import { BundleStoryEngine } from './bundleStoryEngine';
import { createIndexCommitsStep } from './runner/steps/indexCommitsStep';
import { createScopeStep } from './runner/steps/scopeStep';
import { createIntendedStep } from './runner/steps/intendedStep';
import { createWorkingStep } from './runner/steps/workingStep';
import { createDriftStep } from './runner/steps/driftStep';
import { createLegacyStep } from './runner/steps/legacyStep';
import { createHotspotStep } from './runner/steps/hotspotStep';
import { createMovedBlockStep } from './runner/steps/movedBlockStep';
import { createWorkspaceOverlayStep } from './runner/steps/workspaceStep';
import { createBundleFactsStep } from './runner/steps/bundleFactsStep';
import { createEmbeddingStep } from './runner/steps/embeddingStep';
import { createHistoryRetrievalStep } from './runner/steps/historyStep';
import { createStoryStep } from './runner/steps/storyStep';
import { PipelineConfig } from './runner/pipelineTypes';
import { IntendedState, buildIntendedMap, reconstructIntendedFromEvidence } from '../facts/intendedMap';
import { RefactorBundleFacts } from '../facts/types';

/**
 * Build explicit timeline chain from UI selections
 * Returns array sorted newest → oldest for optimal cache warming
 */
function buildExplicitTimeline(options: {
  includeUnstaged: boolean;
  includeStaged: boolean;
  selectedCommitShas: string[];  // Already sorted newest → oldest by caller
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
    cacheTTL: 3600
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
      selectedCommitShas: commitShas
    });

    const steps = [
      // LEVEL 0: Workspace FIRST + independent queries
      // workspace_overlay runs first to warm cache from newest → oldest
      createWorkspaceOverlayStep(this.workspaceIndexer),
      createScopeStep(),

      // LEVEL 1: Parallel processing with scope
      // index_commits now benefits from workspace cache warming
      createIndexCommitsStep(this.commitIndexer, this.config.concurrency),
      createWorkingStep(),                              // Depends on scope

      // LEVEL 2: Dependent on Commits & Scope
      // These steps require the DB to be populated by index_commits
      createIntendedStep(),                             // Now has deps: ['index_commits']
      createHotspotStep(),                              // Now has deps: ['index_commits']
      createMovedBlockStep(),                           // Already has deps: ['index_commits']

      // LEVEL 3: Drift detection (needs hybrid facts from index_commits/workspace_overlay)
      createDriftStep(),                                // Now has deps: ['intended', 'working', 'scope', 'index_commits', 'workspace_overlay']
      createLegacyStep(),                               // Now has deps: ['intended', 'working', 'scope', 'drift', 'index_commits', 'workspace_overlay']

      // LEVEL 4: Bundle assembly
      createBundleFactsStep(),                          // Now has deps: ['scope', 'intended', 'working', 'drift', 'legacy', 'hotspots', 'index_commits', 'moved_blocks']
    ];

    // Conditionally add embedding and LLM steps based on config
    if (!this.config.skipEmbedding) {
      steps.push(createEmbeddingStep(this.embeddingIndexer));
      steps.push(createHistoryRetrievalStep(this.storyEngine));
    }

    if (!this.config.skipLLM) {
      steps.push(createStoryStep(this.storyEngine));
    }

    const initialState: PipelineState = {
      selectedCommitShas: commitShas,
      includeWorkspace,
      workspaceParts,
      explicitTimeline,  // Pass to all steps
      completedSteps: new Set(),
      errors: []
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
    const steps = [
      createWorkspaceOverlayStep(this.workspaceIndexer),
      createScopeStep(),
      createWorkingStep(), // Will use liveOverrides from state
      createDriftStep(),
      createLegacyStep()
    ];

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
        selectedCommitShas: shas
      }),
      liveOverrides,
      intended,
      bundleFacts: previousBundleFacts, // Inject for context
      completedSteps: new Set(),
      errors: []
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
