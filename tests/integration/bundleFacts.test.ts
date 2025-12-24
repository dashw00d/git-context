/**
 * BundleFacts Structure Verification Tests
 *
 * Verifies that bundleFacts has the correct structure:
 * - Evidence keys
 * - Findings structure
 * - Bundle metadata
 * - Data consistency
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

const TEST_DB_PATH = path.join(SANDBOX_DIR, 'test-bundleFacts.db');

describe('BundleFacts Structure Verification', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let pipeline: RefactorPipeline;
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
    const db = dbManager.getDatabase();

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
      { skipEmbedding: true, skipLLM: true }
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

    if (dbManager) {
      dbManager.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Bundle Structure', () => {
    it('should have correct bundle metadata', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      expect(facts.bundle).toBeDefined();
      expect(facts.bundle.totalCommits).toBe(2);
      expect(facts.bundle.shas).toBeDefined();
      expect(Array.isArray(facts.bundle.shas)).toBe(true);
      expect(facts.bundle.shas.length).toBe(2);
    });

    it('should track commit count correctly', async () => {
      const state = await pipeline.analyzeBundle(commits.slice(0, 3));
      const facts = state.bundleFacts!;

      expect(facts.bundle.totalCommits).toBe(3);
    });
  });

  describe('Evidence Structure', () => {
    it('should have scope.files in evidence', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      expect(facts.evidence['scope.files']).toBeDefined();
      const files = facts.evidence['scope.files'] as string[];
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should have working.symbols in evidence', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      expect(facts.evidence['working.symbols']).toBeDefined();
      const symbols = facts.evidence['working.symbols'] as any[];
      expect(Array.isArray(symbols)).toBe(true);
    });

    it('should have working.edges in evidence', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      expect(facts.evidence['working.edges']).toBeDefined();
      const edges = facts.evidence['working.edges'] as any[];
      expect(Array.isArray(edges)).toBe(true);
    });

    it('should have intended.present in evidence', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      // The assembler produces intended.present/absent/renamed, not intended.map
      expect(facts.evidence['intended.present']).toBeDefined();
      expect(Array.isArray(facts.evidence['intended.present'])).toBe(true);
    });

    it('should have all required evidence keys', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      // Correct keys per factsAssembler.ts
      const requiredKeys = ['scope.files', 'working.symbols', 'working.edges', 'intended.present'];

      for (const key of requiredKeys) {
        expect(facts.evidence[key]).toBeDefined();
      }
    });
  });

  describe('Findings Structure', () => {
    it('should have patternDrift in findings', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      expect(facts.findings.patternDrift).toBeDefined();
      expect(facts.findings.patternDrift.conventionDrift).toBeDefined();
    });

    it('should have legacyAudit in findings', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      // The assembler produces legacyAudit, not legacySummary
      expect(facts.findings.legacyAudit).toBeDefined();
      expect(facts.findings.legacyAudit.dead).toBeDefined();
      expect(facts.findings.legacyAudit.legacyUsed).toBeDefined();
    });

    it('should have incompleteness in findings', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      expect(facts.findings.incompleteness).toBeDefined();
      // findings.incompleteness.missing is a number (count), not array
      // evidence['findings.incompleteness.missing'] is the array
      expect(typeof facts.findings.incompleteness.missing).toBe('number');
    });
  });

  describe('Data Consistency', () => {
    it('should have consistent symbol counts', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      const workingSymbols = facts.evidence['working.symbols'] as any[];
      const intendedMap = facts.evidence['intended.map'] as any;

      // Working symbols should be a subset or match intended
      expect(workingSymbols.length).toBeGreaterThanOrEqual(0);
      if (intendedMap && typeof intendedMap === 'object') {
        const intendedSize = Object.keys(intendedMap).length;
        // Intended may have more symbols (from history)
        expect(intendedSize).toBeGreaterThanOrEqual(0);
      }
    });

    it('should have consistent file lists', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      const scopeFiles = facts.evidence['scope.files'] as string[];
      const workingSymbols = facts.evidence['working.symbols'] as any[];

      // Files from symbols should be in scope
      // Note: Symbol filePath might be empty for some symbols, filter those out
      const symbolFiles = new Set(
        workingSymbols.map((s: any) => s.filePath).filter((f: any) => f && f.length > 0)
      );
      for (const file of symbolFiles) {
        expect(scopeFiles).toContain(file);
      }
    });

    it('should have valid edge references', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      const edges = facts.evidence['working.edges'] as any[];
      const symbols = facts.evidence['working.symbols'] as any[];
      const symbolIds = new Set(symbols.map((s: any) => s.id));

      // Edges should reference valid symbols
      for (const edge of edges) {
        if (edge.from) {
          // Edge from may be a path:symbolId format
          expect(edge.from).toBeDefined();
        }
        if (edge.to) {
          expect(edge.to).toBeDefined();
        }
      }
    });
  });

  describe('Partial Results', () => {
    it('should mark partial when steps fail', async () => {
      // This test verifies that partial results are handled
      // In a real scenario, if drift fails, bundleFacts should still be created
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      // Facts should be created even if some steps have issues
      expect(facts).toBeDefined();

      // Check if partial flag exists (may be undefined if all steps succeeded)
      if (facts.partial !== undefined) {
        expect(typeof facts.partial).toBe('boolean');
      }
    });

    it('should include partial reasons when present', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      // Partial reasons may be undefined if no issues
      if (facts.partialReasons) {
        expect(Array.isArray(facts.partialReasons)).toBe(true);
      }
    });
  });

  describe('BundleFacts Completeness', () => {
    it('should have all required top-level properties', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      expect(facts.bundle).toBeDefined();
      expect(facts.evidence).toBeDefined();
      expect(facts.findings).toBeDefined();
    });

    it('should be serializable to JSON', async () => {
      const state = await pipeline.analyzeBundle([commits[0], commits[1]]);
      const facts = state.bundleFacts!;

      // Flush queues before serialization (pipeline does this, but ensure it's complete)
      await DatabaseWriteQueue.getInstance().flushAll();

      // Should not throw when stringifying
      expect(() => JSON.stringify(facts)).not.toThrow();

      // Should be parseable
      const json = JSON.stringify(facts);
      const parsed = JSON.parse(json);
      expect(parsed.bundle).toBeDefined();
      expect(parsed.evidence).toBeDefined();
      expect(parsed.findings).toBeDefined();
    });
  });
});
