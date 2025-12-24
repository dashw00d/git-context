/**
 * Full Pipeline Integration Tests
 *
 * Tests the complete RefactorPipeline end-to-end:
 * - Database initialization and persistence
 * - Commit indexing
 * - All pipeline steps execution
 * - BundleFacts generation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { setupSandboxRepo, SANDBOX_DIR } from '../fixtures/setupSandbox';
import { getDatabaseManager, setDatabaseManagerForTesting } from '../../src/storage/database';
import { DatabaseWriteQueue } from '../../src/storage/databaseWriteQueue';
import { GitOperations } from '../../src/analysis/git';
import { CommitIndexer } from '../../src/analysis/commitIndexer';
import { WorkspaceIndexer } from '../../src/analysis/workspaceIndexer';
import { EmbeddingIndexer } from '../../src/analysis/embeddingIndexer';
import { BundleStoryEngine } from '../../src/analysis/bundleStoryEngine';
import { RefactorPipeline } from '../../src/analysis/refactorPipeline';
import { SnapshotManager } from '../../src/analysis/snapshotManager';
import { StructuralDiffManager } from '../../src/analysis/structuralDiffManager';
import { SymbolExtractor } from '../../src/analysis/symbols';
import { DependencyExtractor } from '../../src/analysis/dependencies';
import { RiskDetector } from '../../src/analysis/heuristics';
import { HotspotDetectorV2 } from '../../src/analysis/hotspotDetector';
import { MovedBlockDetectorV2 } from '../../src/analysis/movedBlockDetector';
import { LlmAnalyst } from '../../src/analysis/llmAnalyst/runner';


describe('Full Pipeline Integration', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let pipeline: RefactorPipeline;
  let git: GitOperations;
  let originalCwd: string;

  beforeAll(async () => {
    // Save original directory for restoration
    originalCwd = process.cwd();

    // Setup sandbox repo
    const result = setupSandboxRepo();
    repoPath = result.repoPath;
    commits = result.commits;

    // Change to sandbox directory - keep it for entire test lifecycle
    // This ensures getGitRoot() works correctly throughout the test
    process.chdir(repoPath);

    // Reset singleton to ensure we get a fresh instance for this test's repo directory
    setDatabaseManagerForTesting(null);

    // Use the default database singleton (created at gitRoot/.git/commit-tracker/...)
    // This avoids the database mismatch issue where the DatabaseWriteQueue uses a different DB
    dbManager = getDatabaseManager();
    await dbManager.initialize();
    const db = dbManager.getDatabase();

    // Initialize git operations for sandbox repo
    // GitOperations will use getGitRoot() which now points to repoPath
    git = new GitOperations();

    // Create pipeline components
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

    const workspaceIndexer = new WorkspaceIndexer(db, git, snapshotManager, structuralDiffManager);

    const embeddingIndexer = new EmbeddingIndexer();
    const llmAnalyst = new LlmAnalyst();
    const storyEngine = new BundleStoryEngine(llmAnalyst);

    pipeline = new RefactorPipeline(
      commitIndexer,
      workspaceIndexer,
      embeddingIndexer,
      storyEngine,
      git,
      {
        skipEmbedding: true, // Skip in tests for speed (production default: false)
        skipLLM: true, // Matches production default
      }
    );
  });

  afterAll(() => {
    // Restore original directory
    try {
      if (originalCwd && fs.existsSync(originalCwd)) {
        process.chdir(originalCwd);
      }
    } catch (error) {
      // Ignore errors restoring directory
    }

    // Clean up database
    if (dbManager) {
      dbManager.close();
    }
  });

  describe('Pipeline Execution', () => {
    it('should run complete pipeline and produce bundleFacts', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      // Flush queues (pipeline runner does this automatically, but ensure it's done)
      // Note: flushSnapshotQueue/flushDiffQueue are no-ops, actual flushing is via DatabaseWriteQueue
      await DatabaseWriteQueue.getInstance().flushAll();

      // Verify state structure
      expect(state.bundleFacts).toBeDefined();
      expect(state.commitFacts).toBeDefined();
      expect(state.commitFacts!.length).toBeGreaterThan(0);
      expect(state.scope).toBeDefined();
      expect(state.intended).toBeDefined();
      expect(state.working).toBeDefined();
    });

    it('should index commits and store in database', async () => {
      // Run pipeline to index commits
      await pipeline.analyzeBundle([commits[0]]);

      // Flush queues to ensure data is persisted (pipeline does this, but ensure it's complete)
      await DatabaseWriteQueue.getInstance().flushAll();

      // Verify database has commit metadata
      const db = dbManager.getDatabase();
      const commitMeta = db
        .prepare('SELECT * FROM commits_metadata WHERE sha = ?')
        .get([commits[0]]);
      expect(commitMeta).toBeDefined();

      // Verify commit analysis exists
      const commitAnalysis = db
        .prepare('SELECT * FROM commits_analysis WHERE sha = ?')
        .get([commits[0]]);
      expect(commitAnalysis).toBeDefined();
    });

    it('should detect symbols in database after indexing', async () => {
      await pipeline.analyzeBundle([commits[0]]);

      // Flush queues to ensure data is persisted (pipeline does this, but ensure it's complete)
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const symbols = db.prepare('SELECT * FROM symbols WHERE sha = ?').all([commits[0]]);

      expect(symbols.length).toBeGreaterThan(0);

      // Verify expected symbols exist
      const symbolNames = symbols.map((s: any) => s.name);
      expect(symbolNames).toContain('add');
      expect(symbolNames).toContain('subtract');
      expect(symbolNames).toContain('multiply');
      expect(symbolNames).toContain('divide');
    });

    it('should detect edges in database after indexing', async () => {
      // Index commit 2 which has Calculator with imports
      await pipeline.analyzeBundle([commits[1]]);

      // Flush queues to ensure data is persisted (pipeline does this, but ensure it's complete)
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const edges = db.prepare('SELECT * FROM edges WHERE sha = ?').all([commits[1]]);

      expect(edges.length).toBeGreaterThan(0);
    });

    it('should build intended map from database', async () => {
      // Index commits first
      await pipeline.analyzeBundle([commits[0], commits[1]]);

      // Run again to test intended step
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      expect(state.intended).toBeDefined();
      expect(state.intended!.size).toBeGreaterThan(0);
    });

    it('should compute scope correctly', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      expect(state.scope).toBeDefined();
      expect(state.scope!.allPaths.size).toBeGreaterThan(0);
      expect(state.scope!.commitFiles.size).toBeGreaterThan(0);
    });

    it('should build working snapshot', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      expect(state.working).toBeDefined();
      expect(state.working!.symbolsById.size).toBeGreaterThan(0);
    });

    it('should detect drift', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      expect(state.drift).toBeDefined();
      expect(state.drift!.missing_symbols).toBeDefined();
      expect(state.drift!.zombie_symbols).toBeDefined();
      expect(state.drift!.divergent_symbols).toBeDefined();
    });

    it('should detect legacy code', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      expect(state.legacy).toBeDefined();
      expect(state.legacy!.dead).toBeDefined();
      expect(state.legacy!.legacyUsed).toBeDefined();
      expect(state.legacy!.replacedLeftovers).toBeDefined();
    });

    it('should detect hotspots', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      expect(state.hotspots).toBeDefined();
      expect(Array.isArray(state.hotspots)).toBe(true);
    });

    it('should detect moved blocks', async () => {
      // Index commits that have renames/moves
      const state = await pipeline.analyzeBundle([commits[0], commits[1], commits[2]]);

      expect(state.movedLineage).toBeDefined();
      expect(Array.isArray(state.movedLineage)).toBe(true);
    });

    it('should assemble bundleFacts with correct structure', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      const facts = state.bundleFacts;
      expect(facts).toBeDefined();

      // Verify bundle structure
      expect(facts.bundle).toBeDefined();
      expect(facts.bundle.totalCommits).toBeGreaterThan(0);

      // Verify evidence structure
      expect(facts.evidence).toBeDefined();
      expect(facts.evidence['scope.files']).toBeDefined();
      expect(facts.evidence['working.symbols']).toBeDefined();

      // Verify findings structure
      expect(facts.findings).toBeDefined();
      expect(facts.findings.patternDrift).toBeDefined();
      expect(facts.findings.legacyAudit).toBeDefined(); // legacyAudit, not legacySummary
    });

    it('should handle multiple commits correctly', async () => {
      const state = await pipeline.analyzeBundle(commits.slice(0, 3));

      expect(state.commitFacts!.length).toBe(3);
      expect(state.bundleFacts).toBeDefined();
      expect(state.bundleFacts!.bundle.totalCommits).toBe(3);
    });

    it('should respect step dependencies', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      // Verify that steps that depend on index_commits have data
      expect(state.intended).toBeDefined(); // depends on index_commits
      expect(state.hotspots).toBeDefined(); // depends on index_commits

      // Verify that steps that depend on intended/working have data
      expect(state.drift).toBeDefined(); // depends on intended, working
      expect(state.legacy).toBeDefined(); // depends on intended, working

      // Verify bundleFacts depends on all previous steps
      expect(state.bundleFacts).toBeDefined();
    });

    it('should build explicitTimeline correctly', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      expect(state.explicitTimeline).toBeDefined();
      expect(Array.isArray(state.explicitTimeline)).toBe(true);
      // Timeline should include HEAD and commits
      expect(state.explicitTimeline!.length).toBeGreaterThan(0);
      // Should include HEAD if commits are provided
      if (state.selectedCommitShas.length > 0) {
        expect(state.explicitTimeline!).toContain('HEAD');
      }
    });

    it('should populate plan data from init step', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      // Plan data should be populated by init step
      expect(state.plan).toBeDefined();
      // Plan should have file changes for commits
      if (state.plan?.fileChanges) {
        expect(state.plan.fileChanges.size).toBeGreaterThan(0);
      }
    });

    it('should use plan data in scope step to avoid redundant git calls', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);

      // Scope step should use plan.stagedFiles and plan.unstagedFiles if available
      expect(state.plan).toBeDefined();
      // If plan has staged/unstaged files, scope should use them
      if (state.plan?.stagedFiles && state.plan?.unstagedFiles) {
        expect(state.scope).toBeDefined();
        // Scope should have computed correctly using plan data
        expect(state.scope!.allPaths.size).toBeGreaterThan(0);
      }
    });
  });
});
