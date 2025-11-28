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
  workspaceFacts: WorkspaceFacts | { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null } | null,
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

  // Calculate workspace totals (handle both old and new format)
  let workspaceSymbols = 0;
  let workspaceEdges = 0;
  let workspaceFiles = 0;
  
  if (workspaceFacts) {
    if ('staged' in workspaceFacts || 'unstaged' in workspaceFacts) {
      const structured = workspaceFacts as { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null };
      if (structured.staged) {
        workspaceSymbols += structured.staged.symbolsAdded + structured.staged.symbolsModified + structured.staged.symbolsRemoved;
        workspaceEdges += structured.staged.edgesAdded + structured.staged.edgesRemoved;
        workspaceFiles += structured.staged.filesChanged;
      }
      if (structured.unstaged) {
        workspaceSymbols += structured.unstaged.symbolsAdded + structured.unstaged.symbolsModified + structured.unstaged.symbolsRemoved;
        workspaceEdges += structured.unstaged.edgesAdded + structured.unstaged.edgesRemoved;
        workspaceFiles += structured.unstaged.filesChanged;
      }
    } else {
      const single = workspaceFacts as WorkspaceFacts;
      workspaceSymbols = single.symbolsAdded + single.symbolsModified + single.symbolsRemoved;
      workspaceEdges = single.edgesAdded + single.edgesRemoved;
      workspaceFiles = single.filesChanged;
    }
  }

  return {
    totalSymbols: commitFacts.reduce((sum, c) => sum + c.symbolsAdded + c.symbolsModified + c.symbolsRemoved, 0) + workspaceSymbols,
    totalEdges: commitFacts.reduce((sum, c) => sum + c.edgesAdded + c.edgesRemoved, 0) + workspaceEdges,
    totalFiles: commitFacts.reduce((sum, c) => sum + c.filesChanged, 0) + workspaceFiles,
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
  workspaceFacts: WorkspaceFacts | { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null } | null
): BundleFactsMetrics {
  // Calculate workspace totals (handle both old and new format)
  let workspaceSymbols = 0;
  let workspaceEdges = 0;
  let workspaceFiles = 0;
  
  if (workspaceFacts) {
    if ('staged' in workspaceFacts || 'unstaged' in workspaceFacts) {
      const structured = workspaceFacts as { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null };
      if (structured.staged) {
        workspaceSymbols += structured.staged.symbolsAdded + structured.staged.symbolsModified + structured.staged.symbolsRemoved;
        workspaceEdges += structured.staged.edgesAdded + structured.staged.edgesRemoved;
        workspaceFiles += structured.staged.filesChanged;
      }
      if (structured.unstaged) {
        workspaceSymbols += structured.unstaged.symbolsAdded + structured.unstaged.symbolsModified + structured.unstaged.symbolsRemoved;
        workspaceEdges += structured.unstaged.edgesAdded + structured.unstaged.edgesRemoved;
        workspaceFiles += structured.unstaged.filesChanged;
      }
    } else {
      const single = workspaceFacts as WorkspaceFacts;
      workspaceSymbols = single.symbolsAdded + single.symbolsModified + single.symbolsRemoved;
      workspaceEdges = single.edgesAdded + single.edgesRemoved;
      workspaceFiles = single.filesChanged;
    }
  }

  const totalSymbols = commitFacts.reduce((sum, c) => sum + c.symbolsAdded + c.symbolsModified + c.symbolsRemoved, 0) + workspaceSymbols;
  const totalEdges = commitFacts.reduce((sum, c) => sum + c.edgesAdded + c.edgesRemoved, 0) + workspaceEdges;
  const totalFiles = commitFacts.reduce((sum, c) => sum + c.filesChanged, 0) + workspaceFiles;

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
