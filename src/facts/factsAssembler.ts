import * as fs from 'fs';
import * as path from 'path';
import { getGitRoot } from '../utils/config';
import { ScopeSet } from './scope';
import { IntendedState } from './intendedMap';
import { WorkingSnapshot } from './workingSnapshot';
import { DriftFindings } from './driftDetector';
import { LegacyAuditResult } from './legacyAudit';
import { RefactorBundleFacts } from './types';

// Re-export for backward compatibility
export type { RefactorBundleFacts } from './types';

import { CommitFacts } from '../analysis/commitIndexer';
import { WorkspaceFacts } from '../analysis/workspaceIndexer';

/**
 * Build RefactorBundleFacts from pipeline state (CommitFacts + WorkspaceFacts)
 * Enhanced version that uses full logic from assembleFacts when additional data is provided
 */
export async function buildRefactorBundleFacts(
  commitFacts: CommitFacts[],
  workspaceFacts: WorkspaceFacts | null,
  options?: {
    commitShas?: string[];
    scope?: ScopeSet;
    intended?: Map<string, IntendedState>;
    working?: WorkingSnapshot;
    drift?: DriftFindings;
    legacy?: LegacyAuditResult;
  }
): Promise<RefactorBundleFacts> {
  // If full pipeline data is provided, use the comprehensive assembleFacts logic
  if (options?.commitShas && options.scope && options.intended && options.working && options.drift && options.legacy) {
    return assembleFacts(
      options.commitShas,
      options.scope,
      options.intended,
      options.working,
      options.drift,
      options.legacy
    );
  }

  // Fallback to simplified logic for backward compatibility
  let totalSymbols = commitFacts.reduce((sum, c) => sum + c.symbolsAdded + c.symbolsModified + c.symbolsRemoved, 0);
  const totalEdges = commitFacts.reduce((sum, c) => sum + c.edgesAdded + c.edgesRemoved, 0);
  let totalFiles = commitFacts.reduce((sum, c) => sum + c.filesChanged, 0);
  const allRisks = Array.from(new Set(commitFacts.flatMap(c => c.risks)));
  const maxStructuralChange = Math.max(...commitFacts.map(c => c.structuralChangeScore), 0);

  // Add workspace facts if available
  if (workspaceFacts) {
    totalSymbols += workspaceFacts.symbolsAdded + workspaceFacts.symbolsModified + workspaceFacts.symbolsRemoved;
    totalFiles += workspaceFacts.filesChanged;
    allRisks.push(...workspaceFacts.risks);
  }

  const oldestSha = commitFacts.length > 0 ? commitFacts[0].sha : 'unknown';
  const newestSha = commitFacts.length > 0 ? commitFacts[commitFacts.length - 1].sha : 'unknown';

  return {
    version: '2.0',
    generated_at: new Date().toISOString(),
    bundle: {
      oldestSha,
      newestSha,
      shas: commitFacts.map(c => c.sha)
    },
    scope: {
      files: totalFiles,
      blastRadius: maxStructuralChange * 10 // Rough approximation
    },
    intended: {
      present: totalSymbols,
      absent: 0, // TODO: Implement intended state tracking
      renamed: 0
    },
    working: {
      symbols: totalSymbols,
      edges: totalEdges
    },
    findings: {
      incompleteness: {
        missing: 0, // TODO: Implement completeness checking
        zombies: 0,
        divergent: 0
      },
      patternDrift: {
        mixedTargets: 0,
        oldNamespaces: 0
      },
      legacyAudit: {
        dead: 0,
        legacyUsed: 0,
        replacedLeftovers: []
      }
    },
    evidence: {
      risks: allRisks,
      structuralChangeScore: maxStructuralChange
    }
  };
}

/**
 * Assemble all facts into v2 JSON schema
 */
export async function assembleFacts(
  commitShas: string[],
  scope: ScopeSet,
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  drift: DriftFindings,
  legacy: LegacyAuditResult
): Promise<RefactorBundleFacts> {

  // Calculate counts and lists
  const intendedCounts = calculateIntendedCounts(intended);
  const intendedLists = getIntendedLists(intended);
  const workingLists = getWorkingLists(working);
  const oldestSha = commitShas.length > 0 ? commitShas[0] : 'unknown';

  const newestSha = commitShas.length > 0 ? commitShas[commitShas.length - 1] : 'unknown';

  const facts: RefactorBundleFacts = {
    version: "2.0",
    generated_at: new Date().toISOString(),
    bundle: {
      oldestSha,
      newestSha,
      shas: commitShas
    },
    scope: {
      files: scope.commitFiles.size,
      blastRadius: scope.blastRadius.size
    },
    intended: intendedCounts,
    working: {
      symbols: working.symbolsById.size,
      edges: working.edges.length
    },
    findings: {
      incompleteness: {
        missing: drift.missing_symbols.length,
        zombies: drift.zombie_symbols.length,
        divergent: drift.divergent_symbols.length
      },
      patternDrift: {
        mixedTargets: detectMixedTargets(drift, working),
        oldNamespaces: detectOldNamespaces(working, intended),
        conventionDrift: drift.conventionDrift ? {
          dominantConvention: drift.conventionDrift.dominantConvention,
          driftPercent: drift.conventionDrift.driftPercent,
          driftSymbolCount: drift.conventionDrift.driftSymbols.length
        } : undefined,
        mixedConventionFiles: drift.mixedConventionFiles?.length || undefined
      },
      legacyAudit: {
        dead: legacy.dead.length,
        legacyUsed: legacy.legacyUsed.length,
        replacedLeftovers: legacy.replacedLeftovers.map(item => ({
          old: item.old.symbol_id,
          new: item.new.symbol_id,
          confidence: item.confidence
        }))
      }
    },
    evidence: {
      // Scope evidence
      "bundle.shas": commitShas,
      "scope.files": Array.from(scope.commitFiles),
      "scope.blastRadius": Array.from(scope.blastRadius),

      // Intended state evidence
      "intended.present": intendedLists.present,
      "intended.absent": intendedLists.absent,
      "intended.renamed": intendedLists.renamed,

      // Working state evidence
      "working.symbols": workingLists.symbols,
      "working.edges": workingLists.edges,

      // Findings evidence
      "findings.incompleteness": {
        missing: drift.missing_symbols.map(m => ({ symbol_id: m.symbol_id, expected: m.expected })),
        zombies: drift.zombie_symbols.map(z => ({ symbol_id: z.symbol_id, found: { name: z.found.name, kind: z.found.kind } })),
        divergent: drift.divergent_symbols
      },
      "findings.incompleteness.missing": drift.missing_symbols.map(m => ({ symbol_id: m.symbol_id, expected: m.expected })),
      "findings.incompleteness.zombies": drift.zombie_symbols.map(z => ({ symbol_id: z.symbol_id, found: { name: z.found.name, kind: z.found.kind } })),

      "findings.legacyAudit": {
        dead: legacy.dead.map(d => ({ symbol_id: d.symbol_id, name: d.name, kind: d.kind })),
        legacyUsed: legacy.legacyUsed.map(l => ({ symbol_id: l.symbol_id, name: l.name, kind: l.kind })),
        replacedLeftovers: legacy.replacedLeftovers.map(r => ({
          old: r.old.symbol_id,
          new: r.new.symbol_id,
          confidence: r.confidence
        }))
      },

      "findings.patternDrift.conventionDrift": drift.conventionDrift ? {
        dominantConvention: drift.conventionDrift.dominantConvention,
        driftPercent: drift.conventionDrift.driftPercent,
        driftSymbols: drift.conventionDrift.driftSymbols.map(ds => ({
          symbolId: ds.symbolId,
          name: ds.name,
          convention: ds.convention,
          suggestedName: ds.suggestedName,
          path: ds.path
        }))
      } : undefined,

      "findings.patternDrift.mixedConventionFiles": drift.mixedConventionFiles || undefined,

      // Legacy fields for backward compatibility
      missing: drift.missing_symbols.map(m => ({ symbol_id: m.symbol_id, expected: m.expected })),
      zombies: drift.zombie_symbols.map(z => ({ symbol_id: z.symbol_id, found: { name: z.found.name, kind: z.found.kind } })),
      dead: legacy.dead.map(d => ({ symbol_id: d.symbol_id, name: d.name, kind: d.kind })),
      legacyUsed: legacy.legacyUsed.map(l => ({ symbol_id: l.symbol_id, name: l.name, kind: l.kind })),
      replacedLeftovers: legacy.replacedLeftovers.map(r => ({
        old: r.old.symbol_id,
        new: r.new.symbol_id,
        confidence: r.confidence
      }))
    }
  };

  return facts;
}

/**
 * Save facts to .git/commit-tracker/last-bundle-facts.json
 */
export async function saveFacts(facts: RefactorBundleFacts): Promise<string> {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    throw new Error('Not in a git repository');
  }

  const factsDir = path.join(gitRoot, '.git', 'commit-tracker');
  const factsPath = path.join(factsDir, 'last-bundle-facts.json');

  // Ensure directory exists
  if (!fs.existsSync(factsDir)) {
    fs.mkdirSync(factsDir, { recursive: true });
  }

  // Write facts JSON
  fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2), 'utf8');

  return factsPath;
}

/**
 * Calculate counts for intended state summary
 */
function calculateIntendedCounts(intended: Map<string, IntendedState>): { present: number; absent: number; renamed: number } {
  let present = 0;
  let absent = 0;
  let renamed = 0;

  for (const [symbolId, state] of intended) {
    if (state.expect === 'present') {
      present++;
      if (state.isRenamed) {
        renamed++;
      }
    } else if (state.expect === 'absent') {
      absent++;
    }
  }

  return { present, absent, renamed };
}

/**
 * Get detailed lists for intended state
 */
function getIntendedLists(intended: Map<string, IntendedState>): { present: string[]; absent: string[]; renamed: string[] } {
  const present: string[] = [];
  const absent: string[] = [];
  const renamed: string[] = [];

  for (const [symbolId, state] of intended) {
    if (state.expect === 'present') {
      present.push(symbolId);
      if (state.isRenamed) {
        renamed.push(symbolId);
      }
    } else if (state.expect === 'absent') {
      absent.push(symbolId);
    }
  }

  return { present, absent, renamed };
}

/**
 * Get detailed lists for working state
 */
function getWorkingLists(working: WorkingSnapshot): { symbols: string[]; edges: string[] } {
  return {
    symbols: Array.from(working.symbolsById.keys()),
    edges: working.edges.map(e => `${e.from_symbol_id} -> ${e.to_symbol_id} (${e.edge_type})`)
  };
}

/**
 * Detect files with mixed naming convention targets
 * Counts files that have multiple naming conventions in use
 */
function detectMixedTargets(drift: DriftFindings, working: WorkingSnapshot): number {
  // Use mixedConventionFiles from drift detector if available
  if (drift.mixedConventionFiles && drift.mixedConventionFiles.length > 0) {
    return drift.mixedConventionFiles.length;
  }

  // Fallback: detect by analyzing files with multiple conventions
  const fileConventions = new Map<string, Set<string>>();
  
  for (const [symbolId, symbol] of working.symbolsById) {
    const filePath = symbolId.split(':')[0];
    if (!fileConventions.has(filePath)) {
      fileConventions.set(filePath, new Set());
    }
    
    // Simple convention detection based on naming patterns
    const name = symbol.name;
    if (/^[a-z]/.test(name)) {
      fileConventions.get(filePath)!.add('camelCase');
    } else if (/^[A-Z]/.test(name) && /[A-Z]/.test(name.slice(1))) {
      fileConventions.get(filePath)!.add('PascalCase');
    } else if (/_/.test(name)) {
      fileConventions.get(filePath)!.add('snake_case');
    }
  }

  // Count files with multiple conventions
  let mixedCount = 0;
  for (const conventions of fileConventions.values()) {
    if (conventions.size > 1) {
      mixedCount++;
    }
  }

  return mixedCount;
}

/**
 * Detect old namespace usage patterns
 * Looks for symbols using deprecated/old namespace patterns
 */
function detectOldNamespaces(working: WorkingSnapshot, intended: Map<string, IntendedState>): number {
  const oldNamespacePatterns = [
    /^(old|legacy|deprecated|v1|v2|old_|legacy_|deprecated_)/i,
    /(Old|Legacy|Deprecated)([A-Z]|$)/,
    /\\Old\\/,
    /\\Legacy\\/,
    /\\Deprecated\\/,
    /\/old\//,
    /\/legacy\//,
    /\/deprecated\//
  ];

  let oldNamespaceCount = 0;

  // Check working symbols for old namespace patterns
  for (const [symbolId, symbol] of working.symbolsById) {
    const filePath = symbolId.split(':')[0];
    const symbolName = symbol.name;

    // Check if path or name matches old namespace patterns
    const matchesOldPattern = oldNamespacePatterns.some(pattern => 
      pattern.test(filePath) || pattern.test(symbolName)
    );

    if (matchesOldPattern) {
      // Only count if it's in scope (intended map) or if it's a zombie (should be removed)
      const intendedState = intended.get(symbolId);
      if (intendedState || !intended.has(symbolId)) {
        // Check if this is a zombie (should be removed but still exists)
        if (intendedState?.expect === 'absent') {
          oldNamespaceCount++;
        } else if (!intended.has(symbolId)) {
          // Symbol not in intended map but matches old pattern - potential old namespace
          oldNamespaceCount++;
        }
      }
    }
  }

  return oldNamespaceCount;
}
