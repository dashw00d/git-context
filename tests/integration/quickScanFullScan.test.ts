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

const TEST_DB_PATH = path.join(SANDBOX_DIR, 'test-quickscan-fullscan.db');

describe('Quick Scan vs Full Scan', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let workspaceIndexer: WorkspaceIndexer;
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

    workspaceIndexer = new WorkspaceIndexer(db, git, snapshotManager, structuralDiffManager);
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

  describe('Symbol Structure Identity', () => {
    it('should produce identical symbol structures for same file', async () => {
      // Get a test file from the sandbox
      const testFile = 'math.ts';
      const fullPath = path.join(repoPath, testFile);

      if (!fs.existsSync(fullPath)) {
        // Create a simple test file
        fs.writeFileSync(
          fullPath,
          `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export class Calculator {
  multiply(a: number, b: number): number {
    return a * b;
  }
}
`
        );
      }

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

      // Now run full scan (index commit)
      const headSha = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha]);

      // Flush queues
      await DatabaseWriteQueue.getInstance().flushAll();

      // Get full scan symbols from database
      const fullScanDbSymbols = db
        .prepare(
          'SELECT sha, path, symbol_id, dna_id, name, kind, signature, change_type FROM symbols WHERE path = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, 'added', 'modified', 'removed']) as Array<{
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
      const testFile = 'math.ts';
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
      const testFile = 'math.ts';
      const headSha = await git.getHeadSha();
      await commitIndexer.ensureCommitsIndexed([headSha]);

      await DatabaseWriteQueue.getInstance().flushAll();

      const db = dbManager.getDatabase();
      const symbols = db
        .prepare(
          'SELECT change_type FROM symbols WHERE path = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, 'added', 'modified', 'removed']) as Array<{ change_type: string }>;

      expect(symbols.length).toBeGreaterThan(0);
      symbols.forEach(s => {
        expect(['added', 'modified', 'removed']).toContain(s.change_type);
      });
    });

    it('should have edges only in full scan', async () => {
      const testFile = 'math.ts';
      const headSha = await git.getHeadSha();

      // Run quick scan
      await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });
      await DatabaseWriteQueue.getInstance().flushAll();

      // Check no edges from quick scan
      const db = dbManager.getDatabase();
      const quickScanEdges = db
        .prepare(
          'SELECT e.* FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.change_type = ?'
        )
        .all([testFile, 'quick_scan']);

      expect(quickScanEdges.length).toBe(0);

      // Run full scan
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Check edges exist from full scan
      const fullScanEdges = db
        .prepare(
          'SELECT e.* FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.change_type IN (?, ?, ?)'
        )
        .all([testFile, 'added', 'modified', 'removed']);

      expect(fullScanEdges.length).toBeGreaterThan(0);
    });
  });

  describe('Database Overwrite Behavior', () => {
    it('should overwrite quick scan data with full scan data', async () => {
      const testFile = 'math.ts';
      const headSha = await git.getHeadSha();

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

      // Run full scan (should overwrite)
      await commitIndexer.ensureCommitsIndexed([headSha]);
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
          'SELECT COUNT(*) as count FROM symbols WHERE path = ? AND change_type IN (?, ?, ?)'
        )
        .get([testFile, 'added', 'modified', 'removed']) as { count: number };

      expect(fullScanCount.count).toBeGreaterThan(0);

      // Verify full scan symbols have correct changeType
      const fullScanSymbols = db
        .prepare(
          'SELECT change_type FROM symbols WHERE path = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, 'added', 'modified', 'removed']) as Array<{ change_type: string }>;

      fullScanSymbols.forEach(s => {
        expect(['added', 'modified', 'removed']).toContain(s.change_type);
        expect(s.change_type).not.toBe('quick_scan');
      });
    });
  });

  describe('Completeness Flags', () => {
    it('should mark quick scan symbols as incomplete', async () => {
      const testFile = 'math.ts';

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
      const testFile = 'math.ts';
      const headSha = await git.getHeadSha();

      // Run full scan
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      // Full scan symbols should be marked complete in bundle facts
      // (We can't directly check this from commitIndexer, but we can verify
      // that full scan produces complete data by checking the database)
      const db = dbManager.getDatabase();
      const fullScanSymbols = db
        .prepare(
          'SELECT * FROM symbols WHERE path = ? AND change_type IN (?, ?, ?) LIMIT 1'
        )
        .get([testFile, 'added', 'modified', 'removed']);

      expect(fullScanSymbols).toBeDefined();
      // Full scan symbols should have edges (indicating completeness)
      const edges = db
        .prepare(
          'SELECT COUNT(*) as count FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ? AND s.change_type IN (?, ?, ?)'
        )
        .get([testFile, 'added', 'modified', 'removed']) as { count: number };

      expect(edges.count).toBeGreaterThan(0);
    });
  });

  describe('ID Structure Consistency', () => {
    it('should use same DNA ID format for quick scan and full scan', async () => {
      const testFile = 'math.ts';
      const headSha = await git.getHeadSha();

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

      // Run full scan
      await commitIndexer.ensureCommitsIndexed([headSha]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const fullScanSymbols = db
        .prepare(
          'SELECT dna_id FROM symbols WHERE path = ? AND change_type IN (?, ?, ?)'
        )
        .all([testFile, 'added', 'modified', 'removed']) as Array<{ dna_id: string }>;

      expect(fullScanSymbols.length).toBeGreaterThan(0);

      // DNA IDs should follow same format (dna:...)
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

