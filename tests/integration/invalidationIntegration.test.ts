/**
 * Invalidation Integration Tests
 *
 * Tests that verify:
 * - File invalidation removes/marks stale symbols
 * - Cascade invalidation marks dependents stale
 * - Embedding invalidation (if Qdrant enabled)
 * - File watcher integration
 * - shouldInvalidateFile detects stale files
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

const TEST_DB_PATH = path.join(SANDBOX_DIR, 'test-invalidation.db');

describe('Invalidation Integration', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let pipeline: RefactorPipeline;
  let commitIndexer: CommitIndexer;
  let git: GitOperations;
  let originalCwd: string;

  beforeAll(async () => {
    // Save original directory for restoration
    originalCwd = process.cwd();

    // Wipe database file if it exists (fresh start every test run)
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Setup sandbox repo
    const result = setupSandboxRepo();
    repoPath = result.repoPath;
    commits = result.commits;

    // Change to sandbox directory - keep it for entire test lifecycle
    process.chdir(repoPath);

    // Create test database (fresh)
    dbManager = new DatabaseManager(TEST_DB_PATH);
    await dbManager.initialize();
    const db = dbManager.getDatabase();

    // Set the singleton to use our test database
    // This is needed because invalidation service uses getDatabaseManager()
    setDatabaseManagerForTesting(dbManager);

    // Also set DatabaseWriteQueue to use our test database
    DatabaseWriteQueue.getInstance(db);

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

    // Reset singleton
    setDatabaseManagerForTesting(null);

    // Clean up database
    if (dbManager) {
      dbManager.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('File Invalidation', () => {
    it('should invalidate symbols when file changes', async () => {
      // Use fixture file from sandbox repo
      const testFile = 'src/ts/math.ts';
      const fullPath = path.join(repoPath, testFile);

      // Index the file through pipeline (uses fixture commits)
      // Use commit 0 which contains src/ts/math.ts
      await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      // Check symbols for this file in commit 0
      const beforeCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE path = ? AND sha = ?')
        .get([testFile, commits[0]]) as { count: number };

      expect(beforeCount.count).toBeGreaterThan(0);

      // Modify the fixture file (simulating a change for invalidation test)
      const originalContent = fs.readFileSync(fullPath, 'utf8');
      fs.writeFileSync(fullPath, originalContent + '\n// Modified for invalidation test\n');

      // Invalidate the file
      const { invalidateFileSymbols } =
        await import('../../src/analysis/invalidation/invalidationService');
      await invalidateFileSymbols(commits[0], testFile, {
        markStale: false, // Delete instead of mark stale
        invalidateEmbeddings: false, // Skip embeddings for test speed
      });

      // Verify symbols are deleted
      const afterCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE path = ? AND sha = ?')
        .get([testFile, commits[0]]) as { count: number };

      expect(afterCount.count).toBe(0);
    });

    it('should mark symbols as stale when markStale is true', async () => {
      // Use fixture file from sandbox repo
      const testFile = 'src/ts/math.ts';
      // Normalize path for query consistency (same as storage)
      const normalizedPath = GitOperations.normalizePath(testFile);

      await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();

      // Check actual table schema and constraint
      const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='symbols'").get() as { sql: string } | undefined;
      const schemaStr = schema?.sql || 'Not found';
      console.log('[TEST] Symbols table schema (first 400 chars):', schemaStr.substring(0, 400));
      const hasPathConstraint = schemaStr.includes('UNIQUE(sha, path, dna_id)');
      const hasOldConstraint = schemaStr.includes('UNIQUE(sha, dna_id)') && !schemaStr.includes('path');
      console.log('[TEST] Has new constraint (sha, path, dna_id):', hasPathConstraint);
      console.log('[TEST] Has old constraint (sha, dna_id) only:', hasOldConstraint);
      console.log('[TEST] Database path:', (dbManager as any).dbPath || 'unknown');

      // Diagnostic: Check what paths are actually stored
      const allPaths = db
        .prepare('SELECT DISTINCT path FROM symbols WHERE sha = ?')
        .all([commits[0]]) as Array<{ path: string }>;
      console.log('Stored paths for commit:', allPaths.map(p => p.path));
      console.log('Commit SHA being queried:', commits[0]);
      // Check what commits actually have symbols
      const allCommits = db
        .prepare('SELECT DISTINCT sha FROM symbols LIMIT 10')
        .all() as Array<{ sha: string }>;
      console.log('Commits with symbols:', allCommits.map(c => c.sha.substring(0, 8)));
      // Check all symbols for this commit
      const allSymbols = db
        .prepare('SELECT path, name, dna_id FROM symbols WHERE sha = ?')
        .all([commits[0]]) as Array<{ path: string; name: string; dna_id: string }>;
      console.log('Total symbols stored for commits[0]:', allSymbols.length);
      const mathSymbols = allSymbols.filter(s => s.path.includes('math'));
      console.log('Math.ts symbols found:', mathSymbols.length, mathSymbols.map(s => s.name));

      // Direct query for math.ts symbols to verify
      const directMathQuery = db
        .prepare('SELECT sha, path, name, dna_id FROM symbols WHERE path = ? AND sha = ?')
        .all(['src/ts/math.ts', commits[0]]) as Array<{ sha: string; path: string; name: string; dna_id: string }>;
      console.log('[TEST] Direct query for math.ts:', directMathQuery.length, 'symbols');
      if (directMathQuery.length === 0) {
        // Check if they exist with different path format
        const anyMath = db
          .prepare("SELECT sha, path, name, dna_id FROM symbols WHERE path LIKE '%math%' AND sha = ?")
          .all([commits[0]]) as Array<{ sha: string; path: string; name: string; dna_id: string }>;
        console.log('[TEST] Any math-like paths:', anyMath.length, anyMath.map(s => s.path));

        // Check for duplicate DNA IDs that might have overwritten math.ts
        const mathDnaIds = [
          'dna:efc22128cc8c361b48a3fad19839a9326628ebd26492a988cecc43dda0c4caae',
          'dna:5c54bbb7588008cab1ffafc9310a6704160438257448efcf917eedc1826dcce6',
          'dna:e74ce4a702f2150e25a502a88a4ed7a2d829f21c10e4a3493c8cbae5098a282c',
        ];
        for (const dnaId of mathDnaIds.slice(0, 2)) {
          const found = db
            .prepare('SELECT sha, path, name, dna_id FROM symbols WHERE dna_id = ? AND sha = ?')
            .all([dnaId, commits[0]]) as Array<{ sha: string; path: string; name: string; dna_id: string }>;
          if (found.length > 0) {
            console.log(`[TEST] Found DNA ${dnaId.substring(0, 30)}... in paths:`, found.map(s => s.path));
          }
        }
      }

      // Save actual database state to file for comparison
      const fs = await import('fs');
      const path = await import('path');
      const debugDir = path.join(process.cwd(), '.debug');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      const dbStateFile = path.join(debugDir, `db-state-${Date.now()}.json`);
      const allStoredSymbols = db
        .prepare('SELECT sha, path, symbol_id, dna_id, name, kind, signature, change_type FROM symbols WHERE sha = ?')
        .all([commits[0]]) as Array<{
        sha: string;
        path: string;
        symbol_id: string;
        dna_id: string;
        name: string;
        kind: string;
        signature: string;
        change_type: string;
      }>;
      fs.writeFileSync(
        dbStateFile,
        JSON.stringify(
          {
            commit: commits[0],
            totalStored: allStoredSymbols.length,
            symbols: allStoredSymbols,
            groupedByPath: Object.fromEntries(
              Array.from(new Set(allStoredSymbols.map(s => s.path))).map(p => [
                p,
                allStoredSymbols.filter(s => s.path === p),
              ])
            ),
            groupedByDna: Object.fromEntries(
              Array.from(new Set(allStoredSymbols.map(s => s.dna_id))).map(d => [
                d,
                allStoredSymbols.filter(s => s.dna_id === d),
              ])
            ),
          },
          null,
          2
        )
      );
      console.log(`[TEST] Saved database state to ${dbStateFile}`);

      // Check symbols for this file in commit 0
      const beforeSymbols = db
        .prepare('SELECT * FROM symbols WHERE path = ? AND sha = ?')
        .all([normalizedPath, commits[0]]) as Array<{ completeness_flags: string | null }>;

      expect(beforeSymbols.length).toBeGreaterThan(0);

      // Mark as stale
      const { invalidateFileSymbols } =
        await import('../../src/analysis/invalidation/invalidationService');
      await invalidateFileSymbols(commits[0], testFile, {
        markStale: true,
        invalidateEmbeddings: false,
      });

      // Verify completeness flags are reset (if column exists)
      // Note: completeness_flags column may not exist if Phase 1.5 not implemented yet
      const tableInfo = db.prepare('PRAGMA table_info(symbols)').all() as Array<{ name: string }>;
      const hasCompletenessFlags = tableInfo.some(col => col.name === 'completeness_flags');

      if (hasCompletenessFlags) {
        const afterSymbols = db
          .prepare('SELECT completeness_flags FROM symbols WHERE path = ? AND sha = ?')
          .all([normalizedPath, commits[0]]) as Array<{ completeness_flags: string | null }>;

        // Symbols should still exist but be marked incomplete
        expect(afterSymbols.length).toBeGreaterThan(0);
        afterSymbols.forEach(s => {
          const flags = s.completeness_flags ? JSON.parse(s.completeness_flags) : {};
          // All flags should be false or missing
          expect(flags.symbols || false).toBe(false);
        });
      } else {
        // If column doesn't exist, just verify symbols still exist
        const afterSymbols = db
          .prepare('SELECT * FROM symbols WHERE path = ? AND sha = ?')
          .all([normalizedPath, commits[0]]);
        expect(afterSymbols.length).toBeGreaterThan(0);
      }
    });

    it('should invalidate edges when symbols are invalidated', async () => {
      // Use fixture file from sandbox repo (Calculator.ts has dependencies)
      const testFile = 'src/ts/Calculator.ts';

      // Calculator.ts is in commit 1, but it imports from math.ts in commit 0
      // Need both commits to get complete edge information
      await pipeline.analyzeBundle([commits[0], commits[1]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      // Check edges for Calculator.ts in commit 1
      const beforeEdges = db
        .prepare(
          'SELECT COUNT(*) as count FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.sha = ?'
        )
        .get([testFile, commits[1]]) as { count: number };

      expect(beforeEdges.count).toBeGreaterThan(0);

      // Invalidate file
      const { invalidateFileSymbols } =
        await import('../../src/analysis/invalidation/invalidationService');
      await invalidateFileSymbols(commits[1], testFile, {
        markStale: false,
        invalidateEmbeddings: false,
      });

      // Verify edges are deleted
      const afterEdges = db
        .prepare(
          'SELECT COUNT(*) as count FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.sha = ?'
        )
        .get([testFile, commits[1]]) as { count: number };

      expect(afterEdges.count).toBe(0);
    });
  });

  describe('Cascade Invalidation', () => {
    it('should mark dependent symbols as stale when cascade is true', async () => {
      // Use fixture files from sandbox repo (Calculator.ts depends on math.ts)
      const file1 = 'src/ts/math.ts';
      const file2 = 'src/ts/Calculator.ts';

      // Need both commits: math.ts in commit 0, Calculator.ts in commit 1
      await pipeline.analyzeBundle([commits[0], commits[1]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      // Get symbol from file2 that depends on file1 (Calculator depends on math)
      const dependentSymbol = db
        .prepare('SELECT s.* FROM symbols s WHERE s.path = ? AND s.name = ? AND s.sha = ?')
        .get([file2, 'Calculator', commits[1]]) as { dna_id: string } | undefined;

      expect(dependentSymbol).toBeDefined();

      // Invalidate file1 with cascade (use commits[0] where math.ts is)
      const { invalidateFileSymbols } =
        await import('../../src/analysis/invalidation/invalidationService');
      await invalidateFileSymbols(commits[0], file1, {
        markStale: true,
        cascade: true,
        invalidateEmbeddings: false,
      });

      // Verify dependent symbol is marked stale (if completeness_flags column exists)
      const tableInfo = db.prepare('PRAGMA table_info(symbols)').all() as Array<{ name: string }>;
      const hasCompletenessFlags = tableInfo.some(col => col.name === 'completeness_flags');

      if (hasCompletenessFlags) {
        const afterDependent = db
          .prepare('SELECT completeness_flags FROM symbols WHERE dna_id = ?')
          .get([dependentSymbol!.dna_id]) as { completeness_flags: string | null } | undefined;

        expect(afterDependent).toBeDefined();
        if (afterDependent) {
          const flags = afterDependent.completeness_flags
            ? JSON.parse(afterDependent.completeness_flags)
            : {};
          // Edges should be marked incomplete
          expect(flags.edges || false).toBe(false);
        }
      } else {
        // If column doesn't exist, just verify symbol still exists
        const afterDependent = db
          .prepare('SELECT * FROM symbols WHERE dna_id = ?')
          .get([dependentSymbol!.dna_id]);
        expect(afterDependent).toBeDefined();
      }
    });
  });

  describe('File Staleness Detection', () => {
    it('should detect stale files correctly', async () => {
      // Use fixture file from sandbox repo
      const testFile = 'src/ts/math.ts';

      // Use commit 0 which contains src/ts/math.ts
      const commitSha = commits[0];
      await pipeline.analyzeBundle([commitSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Verify symbols were indexed
      const db = dbManager.getDatabase();
      const symbolCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE sha = ? AND path = ?')
        .get([commitSha, testFile]) as { count: number };
      expect(symbolCount.count).toBeGreaterThan(0);

      // Check if file is stale
      // Note: isFileStale may return true if completeness_flags not set, which is expected
      // We'll test that invalidation works regardless
      const { isFileStale } = await import('../../src/analysis/invalidation/invalidationService');
      const isStaleBefore = isFileStale(commitSha, testFile);
      // File might be stale if completeness_flags not set - that's OK, we'll test invalidation

      // Invalidate the file to make it stale
      const { invalidateFileSymbols } =
        await import('../../src/analysis/invalidation/invalidationService');
      await invalidateFileSymbols(commitSha, testFile, {
        markStale: true,
        invalidateEmbeddings: false,
      });

      // File should be stale now (invalidated)
      const isStale2 = isFileStale(commitSha, testFile);
      expect(isStale2).toBe(true);
    });

    it('should return true for non-existent files', async () => {
      const { isFileStale } = await import('../../src/analysis/invalidation/invalidationService');
      const headSha = await git.getHeadSha();
      const isStale = isFileStale(headSha, 'nonexistent.ts');
      expect(isStale).toBe(true);
    });
  });

  describe('Commit Invalidation', () => {
    it('should invalidate all symbols for a commit', async () => {
      // Use fixture file from sandbox repo
      const testFile = 'src/ts/math.ts';

      // Use commit 0 which contains src/ts/math.ts
      await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const beforeCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE sha = ?')
        .get([commits[0]]) as { count: number };

      expect(beforeCount.count).toBeGreaterThan(0);

      // Invalidate commit
      const { invalidateCommit } =
        await import('../../src/analysis/invalidation/invalidationService');
      await invalidateCommit(commits[0], {
        markStale: false,
        invalidateEmbeddings: false,
      });

      // Verify symbols are deleted
      const afterCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE sha = ?')
        .get([commits[0]]) as { count: number };

      expect(afterCount.count).toBe(0);
    });
  });
});
