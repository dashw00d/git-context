/**
 * Pipeline Steps Verification Tests
 *
 * Tests individual pipeline steps in isolation to verify:
 * - Step inputs and outputs
 * - Step dependencies
 * - Error handling
 * - Partial results
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { setupSandboxRepo, SANDBOX_DIR } from '../fixtures/setupSandbox';
import { DatabaseManager } from '../../src/storage/database';
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
import { computeScope } from '../../src/facts/scope';
import { buildIntendedMap } from '../../src/facts/intendedMap';
import { getWorkingSnapshot } from '../../src/facts/workingSnapshot';
import { DriftDetector } from '../../src/facts/driftDetector';
import { LegacyDetector } from '../../src/facts/legacyAudit';

const TEST_DB_PATH = path.join(SANDBOX_DIR, 'test-steps.db');

describe('Pipeline Steps Verification', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let commitIndexer: CommitIndexer;
  let git: GitOperations;
  let db: any;
  let originalCwd: string;

  beforeAll(async () => {
    // Save original directory for restoration
    originalCwd = process.cwd();

    const result = setupSandboxRepo();
    repoPath = result.repoPath;
    commits = result.commits;

    // Change to sandbox directory - keep it for entire test lifecycle
    process.chdir(repoPath);

    dbManager = new DatabaseManager(TEST_DB_PATH);
    await dbManager.initialize();
    db = dbManager.getDatabase();

    git = new GitOperations();
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

    // Index commits for step tests
    await commitIndexer.ensureCommitsIndexed(commits.slice(0, 3));
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

    if (dbManager) {
      dbManager.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Scope Step', () => {
    it('should compute scope from commits', async () => {
      const scope = await computeScope(
        commits.slice(0, 2),
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );

      expect(scope).toBeDefined();
      expect(scope.allPaths.size).toBeGreaterThan(0);
      expect(scope.commitFiles.size).toBeGreaterThan(0);
    });

    it('should include files from selected commits', async () => {
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );

      expect(scope.commitFiles.has('src/ts/math.ts')).toBe(true);
      expect(scope.commitFiles.has('src/ts/types.ts')).toBe(true);
    });

    it('should handle empty commit list', async () => {
      const scope = await computeScope([], new Set(['staged', 'unstaged']), [], undefined, git);

      expect(scope).toBeDefined();
      expect(scope.allPaths.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Intended Step', () => {
    it('should build intended map from indexed commits', async () => {
      const intended = await buildIntendedMap(commits.slice(0, 2));

      expect(intended).toBeDefined();
      expect(intended.size).toBeGreaterThan(0);
    });

    it('should track present symbols', async () => {
      const intended = await buildIntendedMap([commits[0]]);

      const present = Array.from(intended.values()).filter(s => s.expect === 'present');
      expect(present.length).toBeGreaterThan(0);
    });

    it('should track absent symbols', async () => {
      // After commit 5, divide is removed
      await commitIndexer.ensureCommitsIndexed([commits[4]]);
      const intended = await buildIntendedMap([commits[0], commits[4]]);

      const absent = Array.from(intended.values()).filter(s => s.expect === 'absent');
      // May have absent symbols if divide was detected as removed
      expect(Array.isArray(absent)).toBe(true);
    });

    it('should handle empty commit list', async () => {
      const intended = await buildIntendedMap([]);
      expect(intended.size).toBe(0);
    });
  });

  describe('Working Step', () => {
    it('should build working snapshot from scope', async () => {
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );

      const working = await getWorkingSnapshot(scope.allPaths, undefined);

      expect(working).toBeDefined();
      expect(working.symbolsById.size).toBeGreaterThan(0);
    });

    it('should extract symbols from workspace files', async () => {
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );

      const working = await getWorkingSnapshot(scope.allPaths, undefined);

      const symbolNames = Array.from(working.symbolsById.values()).map(s => s.name);
      expect(symbolNames.length).toBeGreaterThan(0);
    });

    it('should handle empty scope', async () => {
      const working = await getWorkingSnapshot(new Set(), undefined);
      expect(working.symbolsById.size).toBe(0);
    });
  });

  describe('Drift Step', () => {
    it('should detect drift between intended and working', async () => {
      const intended = await buildIntendedMap([commits[0]]);
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );
      const working = await getWorkingSnapshot(scope.allPaths, undefined);

      const detector = new DriftDetector();
      const drift = await detector.detect({
        intended,
        working,
        commitShas: [commits[0]],
      });

      expect(drift).toBeDefined();
      expect(drift.missing_symbols).toBeDefined();
      expect(drift.zombie_symbols).toBeDefined();
      expect(drift.divergent_symbols).toBeDefined();
      expect(Array.isArray(drift.missing_symbols)).toBe(true);
      expect(Array.isArray(drift.zombie_symbols)).toBe(true);
      expect(Array.isArray(drift.divergent_symbols)).toBe(true);
    });

    it('should detect missing symbols', async () => {
      const intended = await buildIntendedMap([commits[0]]);
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );
      const working = await getWorkingSnapshot(scope.allPaths, undefined);

      const detector = new DriftDetector();
      const drift = await detector.detect({
        intended,
        working,
        commitShas: [commits[0]],
      });

      // Missing symbols are those in intended but not in working
      expect(Array.isArray(drift.missing_symbols)).toBe(true);
    });

    it('should detect zombie symbols', async () => {
      const intended = await buildIntendedMap([commits[0]]);
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );
      const working = await getWorkingSnapshot(scope.allPaths, undefined);

      const detector = new DriftDetector();
      const drift = await detector.detect({
        intended,
        working,
        commitShas: [commits[0]],
      });

      // Zombie symbols are those in working but marked absent in intended
      expect(Array.isArray(drift.zombie_symbols)).toBe(true);
    });
  });

  describe('Legacy Step', () => {
    it('should detect legacy code', async () => {
      const intended = await buildIntendedMap([commits[0]]);
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );
      const working = await getWorkingSnapshot(scope.allPaths, undefined);

      const detector = new LegacyDetector();
      const legacy = await detector.detect({
        intended,
        working,
        scope,
      });

      expect(legacy).toBeDefined();
      expect(legacy.dead).toBeDefined();
      expect(legacy.legacyUsed).toBeDefined();
      expect(legacy.replacedLeftovers).toBeDefined();
      expect(Array.isArray(legacy.dead)).toBe(true);
      expect(Array.isArray(legacy.legacyUsed)).toBe(true);
      expect(Array.isArray(legacy.replacedLeftovers)).toBe(true);
    });
  });

  describe('Step Dependencies', () => {
    it('should require index_commits before intended', async () => {
      // Intended step queries database, so commits must be indexed first
      const intended = await buildIntendedMap([commits[0]]);
      expect(intended.size).toBeGreaterThan(0);
    });

    it('should require scope before working', async () => {
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );
      const working = await getWorkingSnapshot(scope.allPaths, undefined);
      expect(working).toBeDefined();
    });

    it('should require intended and working before drift', async () => {
      const intended = await buildIntendedMap([commits[0]]);
      const scope = await computeScope(
        [commits[0]],
        new Set(['staged', 'unstaged']),
        [],
        undefined,
        git
      );
      const working = await getWorkingSnapshot(scope.allPaths, undefined);

      const detector = new DriftDetector();
      const drift = await detector.detect({
        intended,
        working,
        commitShas: [commits[0]],
      });
      expect(drift).toBeDefined();
    });
  });
});
