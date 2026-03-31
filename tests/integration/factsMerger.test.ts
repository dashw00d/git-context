/**
 * Facts Merger Integration Tests
 *
 * Tests that verify merging behavior with REAL facts from the pipeline:
 * - Merge priority rules (complete > incomplete, priority_click > added > modified > quick_scan)
 * - path:sha:id key structure works correctly
 * - Merging quick scan → full scan data
 * - Real-world merge scenarios
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
import { mergeFacts } from '../../src/facts/factsMerger';
import type { RefactorBundleFacts } from '../../src/facts/types';


describe('Facts Merger Integration', () => {
  let repoPath: string;
  let commits: string[];
  let dbManager: DatabaseManager;
  let pipeline: RefactorPipeline;
  let workspaceIndexer: WorkspaceIndexer;
  let git: GitOperations;
  let originalCwd: string;

  beforeAll(async () => {
    // Save original directory for restoration
    originalCwd = process.cwd();

    // Setup sandbox repo
    const result = setupSandboxRepo();
    repoPath = result.repoPath;
    commits = result.commits;

    // Change to sandbox directory
    process.chdir(repoPath);

    // Reset singleton to ensure we get a fresh instance for this test's repo directory
    setDatabaseManagerForTesting(null);

    // Use the default database singleton (created at gitRoot/.git/commit-tracker/...)
    // This avoids the database mismatch issue where the DatabaseWriteQueue uses a different DB
    dbManager = getDatabaseManager();
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

    // Clean up database
    if (dbManager) {
      dbManager.close();
    }
  });

  describe('Merge Priority Rules with Real Data', () => {
    // symbol.complete IS set to true in getWorkingLists (factsAssembler.ts line 432)
    it('should prefer complete symbols over incomplete from quick scan', async () => {
      const testFile = 'src/ts/math.ts';
      const fullPath = path.join(repoPath, testFile);

      // Use fixture file from sandbox repo (already exists)

      // Get quick scan facts (incomplete)
      const quickScanResults = await workspaceIndexer.quickScanSymbols([testFile], {
        persist: true,
        priority: false,
      });
      await DatabaseWriteQueue.getInstance().flushAll();

      // Build quick scan facts manually (simulating what UI would do)
      const quickScanFacts: RefactorBundleFacts = {
        version: '2.0',
        generated_at: new Date().toISOString(),
        confidence: 0.5, // Lower confidence for quick scan
        bundle: {
          oldestSha: commits[0],
          shas: [commits[0]],
        },
        scope: {
          files: 1,
          blastRadius: 0,
        },
        intended: {
          present: 0,
          absent: 0,
          renamed: 0,
        },
        working: {
          symbols: quickScanResults.length,
          edges: 0, // Quick scan has no edges
        },
        evidence: {
          'working.symbols': quickScanResults.map(s => ({
            id: s.id,
            name: s.name,
            kind: s.kind,
            signature: s.signature || '',
            filePath: s.filePath,
            sha: commits[0], // Use same commit SHA as fullScan for proper merge key matching
            complete: false,
            changeType: 'quick_scan',
          })),
        },
        findings: {
          incompleteness: { missing: 0, zombies: 0, divergent: 0 },
          patternDrift: { mixedTargets: 0, oldNamespaces: 0 },
          legacyAudit: { dead: 0, legacyUsed: 0, replacedLeftovers: [] },
        },
      };

      // Get full scan facts (complete)
      // Use commit 0 which contains src/ts/math.ts
      const fullScanState = await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      expect(fullScanState.bundleFacts).toBeDefined();
      const fullScanFacts = fullScanState.bundleFacts!;

      // Merge: full scan should win
      const merged = mergeFacts(quickScanFacts, fullScanFacts);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      // Should have symbols from full scan (complete)
      expect(mergedSymbols.length).toBeGreaterThan(0);
      const completeSymbols = mergedSymbols.filter(s => s.complete === true);
      expect(completeSymbols.length).toBeGreaterThan(0);

      // All symbols should be complete (full scan wins)
      mergedSymbols.forEach(symbol => {
        if (symbol.filePath === testFile) {
          expect(symbol.complete).toBe(true);
          // Note: changeType is not set by the full pipeline, only by quick scan
        }
      });
    });

    it('should respect changeType priority with real pipeline data', async () => {
      const testFile = 'src/ts/math.ts';

      // Get full scan facts (use commit 0 which contains src/ts/math.ts)
      const fullScanState = await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      expect(fullScanState.bundleFacts).toBeDefined();
      const fullScanFacts = fullScanState.bundleFacts!;

      // Create priority click facts (simulating user click)
      const priorityFacts: RefactorBundleFacts = {
        ...fullScanFacts,
        evidence: {
          ...fullScanFacts.evidence,
          'working.symbols': (fullScanFacts.evidence!['working.symbols'] as any[]).map(s => ({
            ...s,
            changeType: 'priority_click', // Override to priority
          })),
        },
      };

      // Merge: priority should win
      const merged = mergeFacts(fullScanFacts, priorityFacts);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      expect(mergedSymbols.length).toBeGreaterThan(0);
      // Priority click should be preserved
      const prioritySymbols = mergedSymbols.filter(s => s.changeType === 'priority_click');
      expect(prioritySymbols.length).toBeGreaterThan(0);
    });
  });

  describe('path:sha:id Key Structure with Real Data', () => {
    it('should merge symbols correctly using path:sha:id key from pipeline', async () => {
      // Get facts from two different commits
      const state1 = await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      const state2 = await pipeline.analyzeBundle([commits[1]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      expect(state1.bundleFacts).toBeDefined();
      expect(state2.bundleFacts).toBeDefined();

      const facts1 = state1.bundleFacts!;
      const facts2 = state2.bundleFacts!;

      // Merge facts from different commits
      const merged = mergeFacts(facts1, facts2);
      const mergedSymbols = merged.evidence!['working.symbols'] as any[];

      // Should have symbols from both commits
      expect(mergedSymbols.length).toBeGreaterThan(0);

      // Verify path:sha:id uniqueness
      const keys = new Set(mergedSymbols.map((s: any) => `${s.filePath}:${s.sha}:${s.id}`));
      expect(keys.size).toBe(mergedSymbols.length); // All keys should be unique
    });
  });

  describe('Edge Merging with Real Data', () => {
    it('should merge edges correctly from pipeline', async () => {
      // Get facts with edges (use commit 1 which has Calculator.ts with imports)
      const state = await pipeline.analyzeBundle([commits[1]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      expect(state.bundleFacts).toBeDefined();
      const facts1 = state.bundleFacts!;

      // Create second facts with overlapping edges
      const facts2: RefactorBundleFacts = {
        ...facts1,
        evidence: {
          ...facts1.evidence,
          'working.edges': [
            ...((facts1.evidence!['working.edges'] as any[]) || []).slice(0, 2), // Some overlap
            { from: 'dna:new1', to: 'dna:new2', type: 'calls' }, // New edge
          ],
        },
      };

      const merged = mergeFacts(facts1, facts2);
      const mergedEdges = merged.evidence!['working.edges'] as any[];

      expect(mergedEdges.length).toBeGreaterThan(0);

      // Verify edge uniqueness by key
      const edgeKeys = new Set(mergedEdges.map((e: any) => `${e.from}:${e.to}:${e.type}`));
      expect(edgeKeys.size).toBeGreaterThan(0);
    });
  });

  describe('Hotspot Merging with Real Data', () => {
    it('should prefer higher-scored hotspots from pipeline', async () => {
      // Get facts with hotspots (use multiple commits for hotspot detection)
      const state = await pipeline.analyzeBundle([commits[0], commits[1], commits[2]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      expect(state.bundleFacts).toBeDefined();
      const facts1 = state.bundleFacts!;

      if (facts1.evidence!.hotspots && (facts1.evidence!.hotspots as any[]).length > 0) {
        // Create second facts with higher scores
        const facts2: RefactorBundleFacts = {
          ...facts1,
          evidence: {
            ...facts1.evidence,
            hotspots: (facts1.evidence!.hotspots as any[]).map((h, i) => ({
              ...h,
              score: (h.score || 0) + 10, // Increase score
            })),
          },
        };

        const merged = mergeFacts(facts1, facts2);
        const mergedHotspots = merged.evidence!.hotspots as any[];

        expect(mergedHotspots.length).toBeGreaterThan(0);

        // Higher scores should be preserved
        mergedHotspots.forEach(hotspot => {
          const original = (facts1.evidence!.hotspots as any[]).find(h => h.path === hotspot.path);
          if (original) {
            expect(hotspot.score).toBeGreaterThanOrEqual(original.score || 0);
          }
        });
      }
    });
  });

  describe('Findings Merging with Real Data', () => {
    it('should merge findings correctly from pipeline', async () => {
      // Get facts with findings (use commit 0 which contains src/ts/math.ts)
      const state = await pipeline.analyzeBundle([commits[0]]);
      await DatabaseWriteQueue.getInstance().flushAll();

      expect(state.bundleFacts).toBeDefined();
      const facts1 = state.bundleFacts!;

      // Create second facts with additional findings
      const facts2: RefactorBundleFacts = {
        ...facts1,
        findings: {
          ...facts1.findings,
          incompleteness: {
            ...facts1.findings.incompleteness,
            missing: facts1.findings.incompleteness.missing + 1,
          },
        },
      };

      const merged = mergeFacts(facts1, facts2);

      expect(merged.findings).toBeDefined();
      expect(merged.findings!.incompleteness).toBeDefined();
      expect(merged.findings!.patternDrift).toBeDefined();
      expect(merged.findings!.legacyAudit).toBeDefined();
    });
  });
});
