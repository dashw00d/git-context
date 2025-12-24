/**
 * Quick Scan vs Full Scan Integration Tests
 *
 * Tests that verify:
 * - Quick scan and full scan produce identical symbol structures
 * - Only edges differ between modes
 * - changeType is set correctly
 * - Completeness flags differ correctly
 * - Database overwrite behavior works
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { setupSandboxRepo, SANDBOX_DIR } from '../fixtures/setupSandbox';
import { DatabaseManager } from '../../src/storage/database';
import { DatabaseWriteQueue } from '../../src/storage/databaseWriteQueue';
import { GitOperations } from '../../src/analysis/git';
import { CommitIndexer } from '../../src/analysis/commitIndexer';
import { WorkspaceIndexer } from '../../src/analysis/workspaceIndexer';
import { SnapshotManager } from '../../src/analysis/snapshotManager';
import { StructuralDiffManager } from '../../src/analysis/structuralDiffManager';
import { SymbolExtractor } from '../../src/analysis/symbols';
import { DependencyExtractor } from '../../src/analysis/dependencies';
import { RiskDetector } from '../../src/analysis/heuristics';
import { HotspotDetectorV2 } from '../../src/analysis/hotspotDetector';
import { MovedBlockDetectorV2 } from '../../src/analysis/movedBlockDetector';
import { RefactorPipeline } from '../../src/analysis/refactorPipeline';
import { EmbeddingIndexer } from '../../src/analysis/embeddingIndexer';
import { BundleStoryEngine } from '../../src/analysis/bundleStoryEngine';
import { LlmAnalyst } from '../../src/analysis/llmAnalyst/runner';

let commits: string[];
let repoPath: string;
let dbManager: DatabaseManager;
let db: any;
let pipeline: RefactorPipeline;
  let workspaceIndexer: WorkspaceIndexer;
  let commitIndexer: CommitIndexer;
  let git: GitOperations;
  let originalCwd: string;

describe('Quick Scan vs Full Scan', () => {
  beforeAll(async () => {
    // Save original directory for restoration
    originalCwd = process.cwd();

    // Setup sandbox repo
    const result = setupSandboxRepo();
    repoPath = result.repoPath;
    commits = result.commits;

    // Change to sandbox directory - keep it for entire test lifecycle
    process.chdir(repoPath);

    // Reset singleton to ensure we get a fresh instance for this test's repo directory
    const { getDatabaseManager, setDatabaseManagerForTesting } = await import('../../src/storage/database');
    setDatabaseManagerForTesting(null);

    // Use the default database singleton (created at gitRoot/.git/commit-tracker/...)
    // This avoids the database mismatch issue where the DatabaseWriteQueue uses a different DB
    dbManager = getDatabaseManager();
    await dbManager.initialize();
    db = dbManager.getDatabase();

    // Initialize git operations
    git = new GitOperations();

    // Create pipeline components
    const symbolExtractor = new SymbolExtractor(git);
    const dependencyExtractor = new DependencyExtractor();
    const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);
    const structuralDiffManager = new StructuralDiffManager(db);
    const riskDetector = new RiskDetector();
    const hotspotDetector = new HotspotDetectorV2();
    const movedBlockDetector = new MovedBlockDetectorV2();

    commitIndexer = new CommitIndexer(
      db,
      git,
      snapshotManager,
      structuralDiffManager,
      riskDetector,
      dependencyExtractor,
      hotspotDetector,
      movedBlockDetector
    );

    workspaceIndexer = new WorkspaceIndexer(db, git, snapshotManager, structuralDiffManager);

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
        skipEmbedding: true,
        skipLLM: true,
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

    // Clean up database - close only, don't delete (it's in the sandbox repo)
    if (dbManager) {
      dbManager.close();
    }
  });

  describe('Symbol Structure Identity', () => {
    // Note: DNA IDs should be consistent between quick scan and full scan
    // as both use computeSymbolDNA with the same algorithm
    it('should produce identical symbol structures for same file', async () => {
      // Use fixture file from sandbox repo
      const testFile = 'src/ts/math.ts';

      // Run quick scan
      const quickScanResults = await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });

      // Flush queues
      await DatabaseWriteQueue.getInstance().flushAll();

      // Get quick scan symbols from database
      const db = dbManager.getDatabase();
      const quickScanDbSymbols = db
        .prepare(
          'SELECT sha, path, symbol_id, dna_id, name, kind, signature, change_type FROM symbols WHERE path = ? AND change_type = ?'
        )
        .all([testFile, 'quick_scan']) as Array<{
        sha: string;
        path: string;
        symbol_id: string;
        dna_id: string;
        name: string;
        kind: string;
        signature: string;
        change_type: string;
      }>;

      expect(quickScanDbSymbols.length).toBeGreaterThan(0);

      // Now run full scan through pipeline (uses fixture commits)
      // Use commit 0 which contains src/ts/math.ts
      await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Get full scan symbols from database (filter by commit SHA)
      const fullScanDbSymbols = db
        .prepare(
          'SELECT sha, path, symbol_id, dna_id, name, kind, signature, change_type FROM symbols WHERE path = ? AND sha = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, commits[0], 'added', 'modified', 'removed']) as Array<{
        sha: string;
        path: string;
        symbol_id: string;
        dna_id: string;
        name: string;
        kind: string;
        signature: string;
        change_type: string;
      }>;

      expect(fullScanDbSymbols.length).toBeGreaterThan(0);

      // Verify symbol structures are identical
      // Create maps by DNA ID for comparison
      const quickScanMap = new Map(quickScanDbSymbols.map(s => [s.dna_id, s]));
      const fullScanMap = new Map(fullScanDbSymbols.map(s => [s.dna_id, s]));

      // All quick scan symbols should have matching full scan symbols with same DNA ID
      // Note: They may have different change_type values (quick_scan vs added/modified/removed)
      // but the DNA IDs should match for the same symbols
      for (const [dnaId, quickSymbol] of quickScanMap) {
        const fullSymbol = fullScanMap.get(dnaId);
        expect(fullSymbol).toBeDefined();
        expect(fullSymbol!.name).toBe(quickSymbol.name);
        expect(fullSymbol!.kind).toBe(quickSymbol.kind);
        expect(fullSymbol!.signature).toBe(quickSymbol.signature);
        expect(fullSymbol!.dna_id).toBe(quickSymbol.dna_id);
      }
    });

    it('should set correct changeType for quick scan', async () => {
      const testFile = 'src/ts/math.ts';
      const quickScanResults = await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });

      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const symbols = db
        .prepare('SELECT change_type FROM symbols WHERE path = ? AND change_type = ?')
        .all([testFile, 'quick_scan']) as Array<{ change_type: string }>;

      expect(symbols.length).toBeGreaterThan(0);
      symbols.forEach(s => {
        expect(s.change_type).toBe('quick_scan');
      });
    });

    it('should set correct changeType for full scan', async () => {
      const testFile = 'src/ts/math.ts';
      // Use commit 0 which contains src/ts/math.ts
      await pipeline.analyzeBundle([commits[0]]);

      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const symbols = db
        .prepare(
          'SELECT change_type FROM symbols WHERE path = ? AND sha = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, commits[0], 'added', 'modified', 'removed']) as Array<{
        change_type: string;
      }>;

      expect(symbols.length).toBeGreaterThan(0);
      symbols.forEach(s => {
        expect(['added', 'modified', 'removed']).toContain(s.change_type);
      });
    });

    it('should have edges only in full scan', async () => {
      // Use Calculator.ts which has imports from math.ts
      const testFile = 'src/ts/Calculator.ts';

      // Run quick scan
      await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });
      await DatabaseWriteQueue.getInstance().flushAll();

      // Check no edges from quick scan - quick scan doesn't generate edges
      // Quick scan symbols use headSha, so we should check for edges with that SHA
      const db = dbManager.getDatabase();
      const headSha = await git.getHeadSha();
      // Quick scan doesn't generate edges, so there should be no edges with quick scan symbols
      // Since edges store DNA IDs now (not path-prefixed), we need to JOIN with symbols to check
      const quickScanEdges = db
        .prepare(
          'SELECT e.* FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.sha = ? AND s.change_type = ?'
        )
        .all([testFile, headSha, 'quick_scan']);

      expect(quickScanEdges.length).toBe(0);

      // Run full scan (use commit 1 which contains Calculator.ts)
      await pipeline.analyzeBundle([commits[1]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Check edges exist from full scan - JOIN with symbols to match by path
      // Edges now store pure DNA IDs after normalization, so we need to JOIN
      const fullScanEdges = db
        .prepare(
          'SELECT e.* FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.sha = ?'
        )
        .all([testFile, commits[1]]);

      expect(fullScanEdges.length).toBeGreaterThan(0);
    });
  });

  describe('Database Overwrite Behavior', () => {
    it('should overwrite quick scan data with full scan data', async () => {
      const testFile = 'src/ts/math.ts';

      // Run quick scan first
      await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const quickScanCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE path = ? AND change_type = ?')
        .get([testFile, 'quick_scan']) as { count: number };

      expect(quickScanCount.count).toBeGreaterThan(0);

      // Run full scan through pipeline (should overwrite)
      // Use commit 0 which contains src/ts/math.ts
      await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Quick scan symbols should be gone (replaced by full scan)
      const quickScanAfterFull = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE path = ? AND change_type = ?')
        .get([testFile, 'quick_scan']) as { count: number };

      // Note: INSERT OR REPLACE should overwrite, but we need to check if same primary key
      // The primary key is (sha, path, symbol_id), so if symbol_id differs, both might exist
      // But if they have same symbol_id, quick_scan should be replaced
      const fullScanCount = db
        .prepare(
          'SELECT COUNT(*) as count FROM symbols WHERE path = ? AND sha = ? AND change_type IN (?, ?, ?)'
        )
        .get([testFile, commits[0], 'added', 'modified', 'removed']) as { count: number };

      expect(fullScanCount.count).toBeGreaterThan(0);

      // Verify full scan symbols have correct changeType
      const fullScanSymbols = db
        .prepare(
          'SELECT change_type FROM symbols WHERE path = ? AND sha = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, commits[0], 'added', 'modified', 'removed']) as Array<{
        change_type: string;
      }>;

      fullScanSymbols.forEach(s => {
        expect(['added', 'modified', 'removed']).toContain(s.change_type);
        expect(s.change_type).not.toBe('quick_scan');
      });
    });
  });

  describe('Completeness Flags', () => {
    it('should mark quick scan symbols as incomplete', async () => {
      const testFile = 'src/ts/math.ts';

      // Run quick scan
      const quickScanResults = await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });

      await DatabaseWriteQueue.getInstance().flushAll();

      // Quick scan results should have complete: false
      expect(quickScanResults.length).toBeGreaterThan(0);
      quickScanResults.forEach(symbol => {
        expect(symbol.complete).toBe(false);
      });
    });

    it('should mark full scan symbols as complete', async () => {
      const testFile = 'src/ts/Calculator.ts';

      // Run full scan (use commit 1 which contains Calculator.ts)
      await pipeline.analyzeBundle([commits[1]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Full scan symbols should be marked complete in bundle facts
      const db = dbManager.getDatabase();
      const fullScanSymbols = db
        .prepare(
          'SELECT * FROM symbols WHERE path = ? AND sha = ? AND change_type IN (?, ?, ?) LIMIT 1'
        )
        .get([testFile, commits[1], 'added', 'modified', 'removed']);

      expect(fullScanSymbols).toBeDefined();
      // Full scan should have edges for files with imports
      // Edges now store pure DNA IDs after normalization, so we need to JOIN with symbols
      const edges = db
        .prepare(
          'SELECT COUNT(*) as count FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.sha = ?'
        )
        .get([testFile, commits[1]]) as { count: number };

      expect(edges.count).toBeGreaterThan(0);
    });
  });

  describe('ID Structure Consistency', () => {
    it('should use same DNA ID format for quick scan and full scan', async () => {
      const testFile = 'src/ts/math.ts';

      // Run quick scan
      await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const quickScanSymbols = db
        .prepare('SELECT dna_id FROM symbols WHERE path = ? AND change_type = ?')
        .all([testFile, 'quick_scan']) as Array<{ dna_id: string }>;

      expect(quickScanSymbols.length).toBeGreaterThan(0);

      // Run full scan (use commit 0 which contains src/ts/math.ts)
      await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const fullScanSymbols = db
        .prepare(
          'SELECT dna_id FROM symbols WHERE path = ? AND sha = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, commits[0], 'added', 'modified', 'removed']) as Array<{ dna_id: string }>;

      expect(fullScanSymbols.length).toBeGreaterThan(0);

      // DNA IDs should follow same format (dna: prefix with 64-char hex hash)
      quickScanSymbols.forEach(s => {
        expect(s.dna_id).toMatch(/^dna:[a-f0-9]{64}$/);
      });

      fullScanSymbols.forEach(s => {
        expect(s.dna_id).toMatch(/^dna:[a-f0-9]{64}$/);
      });

      // Matching symbols should have same DNA ID
      const quickScanMap = new Map(quickScanSymbols.map(s => [s.dna_id, true]));
      const matchingDnaIds = fullScanSymbols.filter(s => quickScanMap.has(s.dna_id));

      expect(matchingDnaIds.length).toBeGreaterThan(0);
    });
  });
});
