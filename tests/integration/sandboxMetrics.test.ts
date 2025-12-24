/**
 * Sandbox Metrics and Drift Integration Tests
 *
 * Verifies high-level analysis metrics against the sandbox-repo:
 * - Hotspot scores for files and symbols
 * - Drift detection (missing, zombie, divergent symbols)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { setupSandboxRepo, SANDBOX_DIR } from '../fixtures/setupSandbox';
import { DatabaseManager, setDatabaseManagerForTesting } from '../../src/storage/database';
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

const TEST_DB_PATH = path.join(SANDBOX_DIR, 'test-metrics.db');

describe('Sandbox Metrics and Drift Tests', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let pipeline: RefactorPipeline;
  let originalCwd: string;

  beforeAll(async () => {
    originalCwd = process.cwd();
    const result = setupSandboxRepo();
    repoPath = result.repoPath;
    commits = result.commits;

    process.chdir(repoPath);

    dbManager = new DatabaseManager(TEST_DB_PATH);
    await dbManager.initialize();
    setDatabaseManagerForTesting(dbManager);
    const db = dbManager.getDatabase();

    // Initialize write queue with test database
    const writeQueue = DatabaseWriteQueue.getInstance();
    writeQueue.setDatabase(db);

    const git = new GitOperations();
    const symbolExtractor = new SymbolExtractor(git);
    const dependencyExtractor = new DependencyExtractor();
    const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);
    const structuralDiffManager = new StructuralDiffManager(db);
    const riskDetector = new RiskDetector();
    const hotspotDetector = new HotspotDetectorV2();
    const movedBlockDetector = new MovedBlockDetectorV2();

    const commitIndexer = new CommitIndexer(
      db, git, snapshotManager, structuralDiffManager,
      riskDetector, dependencyExtractor, hotspotDetector, movedBlockDetector
    );

    const workspaceIndexer = new WorkspaceIndexer(db, git, snapshotManager, structuralDiffManager);
    const embeddingIndexer = new EmbeddingIndexer();
    const llmAnalyst = new LlmAnalyst();
    const storyEngine = new BundleStoryEngine(llmAnalyst);

    pipeline = new RefactorPipeline(
      commitIndexer, workspaceIndexer, embeddingIndexer, storyEngine, git,
      { skipEmbedding: true, skipLLM: true, forceReanalyze: true }
    );
  });

  afterAll(() => {
    try {
      if (originalCwd && fs.existsSync(originalCwd)) {
        process.chdir(originalCwd);
      }
    } catch (error) {}

    if (dbManager) dbManager.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('should detect expected hotspots after indexing all commits', async () => {
    // Index all 6 commits
    await pipeline.analyzeBundle(commits);
    await DatabaseWriteQueue.getInstance().flushAll();

    const hotspots = await new HotspotDetectorV2().getTopFileHotspots(10);
    const mathHotspot = hotspots.find(h => h.filePath === 'src/ts/math.ts');
    const utilsHotspot = hotspots.find(h => h.filePath === 'src/js/utils.js');

    expect(mathHotspot).toBeDefined();
    // Expected > 50 based on activity in math.ts
    expect(mathHotspot!.hotspotScore).toBeGreaterThan(50);
    expect(mathHotspot!.riskLevel).toBeDefined();

    expect(utilsHotspot).toBeDefined();
    expect(utilsHotspot!.hotspotScore).toBeGreaterThan(45);
    expect(utilsHotspot!.riskLevel).toBeDefined();
  });

  it('should extract correct number of symbols from initial commit', async () => {
    // Check symbols after first commit
    // docs/SANDBOX_EXPECTATIONS.md: 25 symbols total
    // math.ts (5), types.ts (4), utils.js (4), User.php (9), helpers.php (3)
    const symbolCount = await dbManager.getDatabase().prepare('SELECT COUNT(*) as count FROM symbols WHERE sha = ?').get(commits[0]) as { count: number };
    expect(symbolCount.count).toBe(25);
  });

  it('should detect expected drift between early and late commits', async () => {
    // Analyze bundle of early commits (1-2) compared to HEAD
    const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
    
    expect(state.drift).toBeDefined();
    
    // Check missing symbols (expected present in 1-2, but absent in 6)
    const missingSymbols = state.drift!.missing_symbols;
    const missingNames = missingSymbols.map(s => s.expected.lastName || s.symbol_id);
    
    // 'divide' was removed in commit 5
    expect(missingNames.some(n => n.includes('divide'))).toBe(true);
    
    // 'formatNumber' was renamed to 'formatCurrency' in commit 4
    expect(missingNames.some(n => n.includes('formatNumber'))).toBe(true);

    const zombieNames = state.drift!.zombie_symbols.map(s => s.found.name || s.symbol_id);
    // These were added after commit 2, so they are 'zombie' relative to intended state 1-2
    expect(zombieNames.some(n => n.includes('modulo'))).toBe(true);
    expect(zombieNames.some(n => n.includes('safeDivide'))).toBe(true);
    expect(zombieNames.some(n => n.includes('formatCurrency'))).toBe(true);
  });
});
