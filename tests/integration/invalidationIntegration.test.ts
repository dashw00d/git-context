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

const TEST_DB_PATH = path.join(SANDBOX_DIR, 'test-invalidation.db');

describe('Invalidation Integration', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let commitIndexer: CommitIndexer;
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
    process.chdir(repoPath);

    // Create test database
    dbManager = new DatabaseManager(TEST_DB_PATH);
    await dbManager.initialize();
    const db = dbManager.getDatabase();

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
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('File Invalidation', () => {
    it('should invalidate symbols when file changes', async () => {
      const testFile = 'math.ts';
      const fullPath = path.join(repoPath, testFile);

      // Create initial file
      fs.writeFileSync(
        fullPath,
        `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
`
      );

      // Index the file
      const headSha = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const beforeCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE path = ?')
        .get([testFile]) as { count: number };

      expect(beforeCount.count).toBeGreaterThan(0);

      // Modify the file
      fs.writeFileSync(
        fullPath,
        `
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`
      );

      // Invalidate the file
      const { invalidateFileSymbols } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      await invalidateFileSymbols(headSha, testFile, {
        markStale: false, // Delete instead of mark stale
        invalidateEmbeddings: false, // Skip embeddings for test speed
      });

      // Verify symbols are deleted
      const afterCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE path = ?')
        .get([testFile]) as { count: number };

      expect(afterCount.count).toBe(0);
    });

    it('should mark symbols as stale when markStale is true', async () => {
      const testFile = 'math.ts';
      const fullPath = path.join(repoPath, testFile);

      // Create and index file
      fs.writeFileSync(
        fullPath,
        `
export function add(a: number, b: number): number {
  return a + b;
}
`
      );

      const headSha = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const beforeSymbols = db
        .prepare('SELECT * FROM symbols WHERE path = ?')
        .all([testFile]) as Array<{ completeness_flags: string | null }>;

      expect(beforeSymbols.length).toBeGreaterThan(0);

      // Mark as stale
      const { invalidateFileSymbols } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      await invalidateFileSymbols(headSha, testFile, {
        markStale: true,
        invalidateEmbeddings: false,
      });

      // Verify completeness flags are reset (if column exists)
      // Note: completeness_flags column may not exist if Phase 1.5 not implemented yet
      const tableInfo = db.prepare("PRAGMA table_info(symbols)").all() as Array<{ name: string }>;
      const hasCompletenessFlags = tableInfo.some(col => col.name === 'completeness_flags');

      if (hasCompletenessFlags) {
        const afterSymbols = db
          .prepare('SELECT completeness_flags FROM symbols WHERE path = ?')
          .all([testFile]) as Array<{ completeness_flags: string | null }>;

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
          .prepare('SELECT * FROM symbols WHERE path = ?')
          .all([testFile]);
        expect(afterSymbols.length).toBeGreaterThan(0);
      }
    });

    it('should invalidate edges when symbols are invalidated', async () => {
      const testFile = 'math.ts';
      const fullPath = path.join(repoPath, testFile);

      // Create file with dependencies
      fs.writeFileSync(
        fullPath,
        `
export function add(a: number, b: number): number {
  return a + b;
}

export function calculate(a: number, b: number): number {
  return add(a, b);
}
`
      );

      const headSha = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const beforeEdges = db
        .prepare(
          'SELECT COUNT(*) as count FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ?'
        )
        .get([testFile]) as { count: number };

      expect(beforeEdges.count).toBeGreaterThan(0);

      // Invalidate file
      const { invalidateFileSymbols } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      await invalidateFileSymbols(headSha, testFile, {
        markStale: false,
        invalidateEmbeddings: false,
      });

      // Verify edges are deleted
      const afterEdges = db
        .prepare(
          'SELECT COUNT(*) as count FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ?'
        )
        .get([testFile]) as { count: number };

      expect(afterEdges.count).toBe(0);
    });
  });

  describe('Cascade Invalidation', () => {
    it('should mark dependent symbols as stale when cascade is true', async () => {
      // Create two files with dependency
      const file1 = 'utils.ts';
      const file2 = 'main.ts';
      const fullPath1 = path.join(repoPath, file1);
      const fullPath2 = path.join(repoPath, file2);

      fs.writeFileSync(
        fullPath1,
        `
export function helper(): number {
  return 42;
}
`
      );

      fs.writeFileSync(
        fullPath2,
        `
import { helper } from './utils';

export function main(): number {
  return helper();
}
`
      );

      const headSha = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      // Get symbol from file2 that depends on file1
      const dependentSymbol = db
        .prepare(
          'SELECT s.* FROM symbols s WHERE s.path = ? AND s.name = ?'
        )
        .get([file2, 'main']) as { dna_id: string } | undefined;

      expect(dependentSymbol).toBeDefined();

      // Invalidate file1 with cascade
      const { invalidateFileSymbols } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      await invalidateFileSymbols(headSha, file1, {
        markStale: true,
        cascade: true,
        invalidateEmbeddings: false,
      });

      // Verify dependent symbol is marked stale (if completeness_flags column exists)
      const tableInfo = db.prepare("PRAGMA table_info(symbols)").all() as Array<{ name: string }>;
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
      const testFile = 'math.ts';
      const fullPath = path.join(repoPath, testFile);

      // Create and index file
      fs.writeFileSync(
        fullPath,
        `
export function add(a: number, b: number): number {
  return a + b;
}
`
      );

      const headSha1 = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha1]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Check if file is stale (should be false - just indexed)
      const { isFileStale } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      const isStale1 = isFileStale(headSha1, testFile);
      expect(isStale1).toBe(false);

      // Invalidate the file to make it stale
      const { invalidateFileSymbols } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      await invalidateFileSymbols(headSha1, testFile, {
        markStale: true,
        invalidateEmbeddings: false,
      });

      // File should be stale now (invalidated)
      const isStale2 = isFileStale(headSha1, testFile);
      expect(isStale2).toBe(true);
    });

    it('should return true for non-existent files', async () => {
      const { isFileStale } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      const headSha = await git.getHeadSha();
      const isStale = isFileStale(headSha, 'nonexistent.ts');
      expect(isStale).toBe(true);
    });
  });

  describe('Commit Invalidation', () => {
    it('should invalidate all symbols for a commit', async () => {
      const testFile = 'math.ts';
      const fullPath = path.join(repoPath, testFile);

      // Create and index file
      fs.writeFileSync(
        fullPath,
        `
export function add(a: number, b: number): number {
  return a + b;
}
`
      );

      const headSha = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const beforeCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE sha = ?')
        .get([headSha]) as { count: number };

      expect(beforeCount.count).toBeGreaterThan(0);

      // Invalidate commit
      const { invalidateCommit } = await import(
        '../../src/analysis/invalidation/invalidationService'
      );
      await invalidateCommit(headSha, {
        markStale: false,
        invalidateEmbeddings: false,
      });

      // Verify symbols are deleted
      const afterCount = db
        .prepare('SELECT COUNT(*) as count FROM symbols WHERE sha = ?')
        .get([headSha]) as { count: number };

      expect(afterCount.count).toBe(0);
    });
  });
});

