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

export class RefactorPipeline {
  private config: PipelineConfig = {
    concurrency: 8,
    skipEmbedding: false,
    skipLLM: false,
    maxRetries: 3,
    enableCacheStats: true,
    cacheTTL: 3600
  };

  constructor(
    private commitIndexer: CommitIndexer,
    public readonly workspaceIndexer: WorkspaceIndexer,
    private embeddingIndexer: EmbeddingIndexer,
    private storyEngine: BundleStoryEngine,
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
    onEvent?: (event: PipelineEvent) => void
  ): Promise<PipelineState> {
    const steps = [
      createIndexCommitsStep(this.commitIndexer, this.config.concurrency),
      createScopeStep(),                                // Independent
      createIntendedStep(),                             // Independent
      createWorkingStep(),                              // Depends on scope
      createDriftStep(),                                // Depends on intended + working
      createLegacyStep(),                               // Depends on intended + working + scope
      createHotspotStep(),                              // Independent, queries DB
      createMovedBlockStep(),                           // Independent, queries DB
      createWorkspaceOverlayStep(this.workspaceIndexer),
      createBundleFactsStep(),                          // Reads all from state
    ];

    // Conditionally add embedding and LLM steps based on config
    if (!this.config.skipEmbedding) {
      steps.push(createEmbeddingStep(this.embeddingIndexer));
      steps.push(createHistoryRetrievalStep(this.storyEngine));
    }

    if (!this.config.skipLLM) {
      steps.push(createStoryStep(this.storyEngine));
    }

    const initialState = {
      selectedCommitShas: commitShas,
      includeWorkspace
    };

    return runPipeline(steps, initialState, onEvent);
  }

  /**
   * Quick commit indexing only (no LLM/embeddings)
   */
  async indexCommits(commitShas: string[]): Promise<void> {
    await this.commitIndexer.ensureCommitsIndexed(commitShas);
  }
}
