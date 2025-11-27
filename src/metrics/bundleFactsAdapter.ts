/**
 * Bundle Facts Adapter
 *
 * Adapter for enhanced buildRefactorBundleFacts() function
 * Tests the full bundle facts assembly logic
 */

import { buildRefactorBundleFacts } from '../facts/factsAssembler';
import { CommitFacts } from '../analysis/commitIndexer';
import { WorkspaceFacts } from '../analysis/workspaceIndexer';
import { ScopeSet } from '../facts/scope';
import { IntendedState } from '../facts/intendedMap';
import { WorkingSnapshot } from '../facts/workingSnapshot';
import { DriftFindings } from '../facts/driftDetector';
import { LegacyAuditResult } from '../facts/legacyAudit';

export interface BundleFactsMetrics {
  totalSymbols: number;
  totalEdges: number;
  totalFiles: number;
  intendedPresent: number;
  intendedAbsent: number;
  intendedRenamed: number;
  workingSymbols: number;
  workingEdges: number;
  incompletenessMissing: number;
  incompletenessZombies: number;
  incompletenessDivergent: number;
  patternDriftMixedTargets: number;
  patternDriftOldNamespaces: number;
  legacyAuditDead: number;
  legacyAuditLegacyUsed: number;
  legacyAuditReplacedLeftovers: number;
}

/**
 * Assemble bundle facts using the enhanced buildRefactorBundleFacts function
 * This tests the full pipeline assembly logic
 */
export async function assembleBundleFactsFromTestData(
  commitFacts: CommitFacts[],
  workspaceFacts: WorkspaceFacts | null,
  options: {
    commitShas?: string[];
    scope?: ScopeSet;
    intended?: Map<string, IntendedState>;
    working?: WorkingSnapshot;
    drift?: DriftFindings;
    legacy?: LegacyAuditResult;
  }
): Promise<BundleFactsMetrics> {
  const bundleFacts = await buildRefactorBundleFacts(commitFacts, workspaceFacts, options);

  return {
    totalSymbols: commitFacts.reduce((sum, c) => sum + c.symbolsAdded + c.symbolsModified + c.symbolsRemoved, 0) +
                  (workspaceFacts ? workspaceFacts.symbolsAdded + workspaceFacts.symbolsModified + workspaceFacts.symbolsRemoved : 0),
    totalEdges: commitFacts.reduce((sum, c) => sum + c.edgesAdded + c.edgesRemoved, 0) +
                (workspaceFacts ? workspaceFacts.edgesAdded + workspaceFacts.edgesRemoved : 0),
    totalFiles: commitFacts.reduce((sum, c) => sum + c.filesChanged, 0) +
                (workspaceFacts ? workspaceFacts.filesChanged : 0),
    intendedPresent: bundleFacts.intended.present,
    intendedAbsent: bundleFacts.intended.absent,
    intendedRenamed: bundleFacts.intended.renamed,
    workingSymbols: bundleFacts.working.symbols,
    workingEdges: bundleFacts.working.edges,
    incompletenessMissing: bundleFacts.findings.incompleteness.missing,
    incompletenessZombies: bundleFacts.findings.incompleteness.zombies,
    incompletenessDivergent: bundleFacts.findings.incompleteness.divergent,
    patternDriftMixedTargets: bundleFacts.findings.patternDrift.mixedTargets,
    patternDriftOldNamespaces: bundleFacts.findings.patternDrift.oldNamespaces,
    legacyAuditDead: bundleFacts.findings.legacyAudit.dead,
    legacyAuditLegacyUsed: bundleFacts.findings.legacyAudit.legacyUsed,
    legacyAuditReplacedLeftovers: bundleFacts.findings.legacyAudit.replacedLeftovers.length
  };
}

/**
 * Simplified bundle facts assembly for tests
 */
export function assembleBundleFactsSimple(
  commitFacts: CommitFacts[],
  workspaceFacts: WorkspaceFacts | null
): BundleFactsMetrics {
  const totalSymbols = commitFacts.reduce((sum, c) => sum + c.symbolsAdded + c.symbolsModified + c.symbolsRemoved, 0) +
                      (workspaceFacts ? workspaceFacts.symbolsAdded + workspaceFacts.symbolsModified + workspaceFacts.symbolsRemoved : 0);
  const totalEdges = commitFacts.reduce((sum, c) => sum + c.edgesAdded + c.edgesRemoved, 0) +
                    (workspaceFacts ? workspaceFacts.edgesAdded + workspaceFacts.edgesRemoved : 0);
  const totalFiles = commitFacts.reduce((sum, c) => sum + c.filesChanged, 0) +
                    (workspaceFacts ? workspaceFacts.filesChanged : 0);

  return {
    totalSymbols,
    totalEdges,
    totalFiles,
    intendedPresent: totalSymbols, // Simplified
    intendedAbsent: 0,
    intendedRenamed: 0,
    workingSymbols: totalSymbols,
    workingEdges: totalEdges,
    incompletenessMissing: 0,
    incompletenessZombies: 0,
    incompletenessDivergent: 0,
    patternDriftMixedTargets: 0,
    patternDriftOldNamespaces: 0,
    legacyAuditDead: 0,
    legacyAuditLegacyUsed: 0,
    legacyAuditReplacedLeftovers: 0
  };
}
