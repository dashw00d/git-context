/**
 * Test Pipeline State
 *
 * Test-friendly version of PipelineState that allows tests to share state
 * between test suites, just like the real pipeline steps do.
 *
 * Mirrors the structure of PipelineState from src/analysis/runner/pipelineTypes.ts
 */

import type { ScopeSet } from '../../../src/facts/scope';
import type { IntendedState } from '../../../src/facts/intendedMap';
import type { WorkingSnapshot } from '../../../src/facts/workingSnapshot';
import type { DriftFindings } from '../../../src/facts/driftDetector';
import type { LegacyAuditResult } from '../../../src/facts/legacyAudit';
import type { FileHotspot, SymbolHotspot } from '../../../src/analysis/hotspotDetector';
import type { MovedBlock } from '../../../src/analysis/movedBlockDetector';

export class TestPipelineState {
  // Inputs (same as PipelineState)
  selectedCommitShas: string[] = [];
  includeWorkspace: boolean = false;

  // Intermediates (same as PipelineState)
  commitFacts?: any[];
  workspaceFacts?: any;
  bundleFacts?: any;
  history?: any;
  llmOutputs?: any;

  // New facts fields (populated by independent steps)
  scope?: ScopeSet;
  intended?: Map<string, IntendedState>;
  working?: WorkingSnapshot;
  drift?: DriftFindings;
  legacy?: LegacyAuditResult;
  hotspots?: Array<FileHotspot | SymbolHotspot>;
  movedBlocks?: MovedBlock[];

  // Test-specific tracking
  completedTestSuites: Set<string> = new Set();
  testErrors: Array<{ suiteName: string; error: unknown }> = [];

  /**
   * Create TestPipelineState from a test fixture
   */
  static fromFixture(fixture: any): TestPipelineState {
    const state = new TestPipelineState();
    state.selectedCommitShas = fixture.commits?.map((c: any) => c.sha) || ['test-sha'];
    state.includeWorkspace = !!fixture.workspace;

    // Pre-populate commit facts from fixture
    if (fixture.commits) {
      state.commitFacts = fixture.commits.map((commit: any) => ({
        sha: commit.sha,
        symbolsAdded: commit.symbols?.filter((s: any) => s.status === 'added').length || 0,
        symbolsModified: commit.symbols?.filter((s: any) => s.status === 'modified').length || 0,
        symbolsRemoved: commit.symbols?.filter((s: any) => s.status === 'removed').length || 0,
        edgesAdded: commit.edges?.length || 0,
        edgesRemoved: 0,
        filesChanged: commit.files?.length || commit.symbols?.length || 0
      }));
    }

    // Pre-populate workspace facts from fixture
    if (fixture.workspace) {
      state.workspaceFacts = {
        workspaceHash: 'test-workspace-hash',
        headSha: 'test-head-sha',
        symbolsAdded: fixture.workspace.symbols?.filter((s: any) => s.status === 'added').length || 0,
        symbolsModified: fixture.workspace.symbols?.filter((s: any) => s.status === 'modified').length || 0,
        symbolsRemoved: fixture.workspace.symbols?.filter((s: any) => s.status === 'removed').length || 0,
        edgesAdded: fixture.workspace.edges?.length || 0,
        edgesRemoved: 0,
        filesChanged: fixture.workspace.filesChanged || 1,
        structuralChangeScore: fixture.workspace.structuralChangeScore || 0.5,
        blastRadius: fixture.workspace.blastRadius || 5,
        risks: fixture.workspace.risks || []
      };
    }

    return state;
  }

  /**
   * Convert to partial PipelineState for use with real pipeline functions
   */
  toPipelineState(): Partial<import('../../../src/analysis/runner/pipelineTypes').PipelineState> {
    return {
      selectedCommitShas: this.selectedCommitShas,
      includeWorkspace: this.includeWorkspace,
      commitFacts: this.commitFacts,
      workspaceFacts: this.workspaceFacts,
      bundleFacts: this.bundleFacts,
      scope: this.scope,
      intended: this.intended,
      working: this.working,
      drift: this.drift,
      legacy: this.legacy,
      hotspots: this.hotspots,
      movedBlocks: this.movedBlocks
    };
  }

  /**
   * Mark a test suite as completed
   */
  markSuiteCompleted(suiteName: string): void {
    this.completedTestSuites.add(suiteName);
  }

  /**
   * Record an error from a test suite
   */
  recordError(suiteName: string, error: unknown): void {
    this.testErrors.push({ suiteName, error });
  }

  /**
   * Get a summary of the current state
   */
  getSummary(): string {
    const parts = [
      `Commits: ${this.selectedCommitShas.length}`,
      `CommitFacts: ${this.commitFacts?.length || 0}`,
      `Workspace: ${this.includeWorkspace ? 'yes' : 'no'}`,
      `Scope: ${this.scope ? '✓' : '✗'}`,
      `Intended: ${this.intended ? this.intended.size + ' symbols' : '✗'}`,
      `Working: ${this.working ? '✓' : '✗'}`,
      `Drift: ${this.drift ? '✓' : '✗'}`,
      `Legacy: ${this.legacy ? '✓' : '✗'}`,
      `Hotspots: ${this.hotspots?.length || 0}`,
      `MovedBlocks: ${this.movedBlocks?.length || 0}`,
      `CompletedSuites: ${this.completedTestSuites.size}`,
      `Errors: ${this.testErrors.length}`
    ];

    return `TestPipelineState: ${parts.join(', ')}`;
  }
}
