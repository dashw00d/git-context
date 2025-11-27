import { runPipeline } from './runner/pipelineRunner';
import { PipelineState, PipelineEvent } from './runner/pipelineTypes';
import { CommitIndexer } from './commitIndexer';
import { WorkspaceIndexer } from './workspaceIndexer';
import { EmbeddingIndexer } from './embeddingIndexer';
import { BundleStoryEngine } from './bundleStoryEngine';
import { createIndexCommitsStep } from './runner/steps/indexCommitsStep';
import { createWorkspaceOverlayStep } from './runner/steps/workspaceStep';
import { createBundleFactsStep } from './runner/steps/bundleFactsStep';
import { createEmbeddingStep } from './runner/steps/embeddingStep';
import { createHistoryRetrievalStep } from './runner/steps/historyStep';
import { createStoryStep } from './runner/steps/storyStep';

export class RefactorPipeline {
  constructor(
    private commitIndexer: CommitIndexer,
    public readonly workspaceIndexer: WorkspaceIndexer,
    private embeddingIndexer: EmbeddingIndexer,
    private storyEngine: BundleStoryEngine
  ) {}

  /**
   * Run complete refactor bundle analysis pipeline
   */
  async analyzeBundle(
    commitShas: string[],
    includeWorkspace: boolean = false,
    onEvent?: (event: PipelineEvent) => void
  ): Promise<PipelineState> {
    const steps = [
      createIndexCommitsStep(this.commitIndexer, 4),
      createWorkspaceOverlayStep(this.workspaceIndexer),
      createBundleFactsStep(),
      createEmbeddingStep(this.embeddingIndexer),
      createHistoryRetrievalStep(this.storyEngine),  // NEW
      createStoryStep(this.storyEngine)
    ];

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
