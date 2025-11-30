import { RefactorPipeline } from '../analysis/refactorPipeline';
import { CommitIndexer } from '../analysis/commitIndexer';
import { WorkspaceIndexer } from '../analysis/workspaceIndexer';
import { EmbeddingIndexer } from '../analysis/embeddingIndexer';
import { BundleStoryEngine } from '../analysis/bundleStoryEngine';
import { SnapshotManager } from '../analysis/snapshotManager';
import { StructuralDiffManager } from '../analysis/structuralDiffManager';
import { SymbolExtractor } from '../analysis/symbols';
import { DependencyExtractor } from '../analysis/dependencies';
import { RiskDetector } from '../analysis/heuristics';
import { HotspotDetectorV2 } from '../analysis/hotspotDetector';
import { MovedBlockDetectorV2 } from '../analysis/movedBlockDetector';
import { LlmAnalyst } from '../analysis/llmAnalyst/runner';
import { GitOperations } from '../analysis/git';
import { getDatabaseManager } from '../storage/database';

export class PipelineFactory {
  private static instance: PipelineFactory;
  private pipeline: RefactorPipeline | null = null;

  private constructor() {
    // Singleton: use getInstance()
  }

  static getInstance(): PipelineFactory {
    if (!PipelineFactory.instance) {
      PipelineFactory.instance = new PipelineFactory();
    }
    return PipelineFactory.instance;
  }

  async getPipeline(): Promise<RefactorPipeline> {
    if (!this.pipeline) {
      const db = getDatabaseManager().getDatabase();
      const git = new GitOperations();

      const symbolExtractor = new SymbolExtractor(git);
      const dependencyExtractor = new DependencyExtractor();

      const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);
      const structuralDiffManager = new StructuralDiffManager(db);
      const riskDetector = new RiskDetector();
      const hotspotDetector = new HotspotDetectorV2();
      const movedBlockDetector = new MovedBlockDetectorV2();

      const commitIndexer = new CommitIndexer(
        db,
        git,
        snapshotManager,
        structuralDiffManager,
        riskDetector,
        dependencyExtractor,
        hotspotDetector,
        movedBlockDetector
      );

      const workspaceIndexer = new WorkspaceIndexer(
        db,
        git,
        snapshotManager,
        structuralDiffManager
      );

      const embeddingIndexer = new EmbeddingIndexer();

      const llmAnalyst = new LlmAnalyst();
      const storyEngine = new BundleStoryEngine(llmAnalyst);

      this.pipeline = new RefactorPipeline(
        commitIndexer,
        workspaceIndexer,
        embeddingIndexer,
        storyEngine
      );
    }

    return this.pipeline;
  }

  reset(): void {
    this.pipeline = null;
  }
}

export async function getRefactorPipeline(): Promise<RefactorPipeline> {
  return PipelineFactory.getInstance().getPipeline();
}
