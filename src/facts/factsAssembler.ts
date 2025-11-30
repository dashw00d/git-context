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
import { getCstTimelineManager } from '../analysis/cstTimeline';
import { getExtensionConfig, isCstOnlyLanguage, detectLanguage } from '../utils/config';
import type { HybridFact } from '../types/cstFacts';

/**
 * Build RefactorBundleFacts from pipeline state (CommitFacts + WorkspaceFacts)
 * Enhanced version that uses full logic from assembleFacts when additional data is provided
 */
export async function buildRefactorBundleFacts(
  commitFacts: CommitFacts[],
  workspaceFacts: WorkspaceFacts | { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null } | null,
  options?: {
    commitShas?: string[];
    scope?: ScopeSet;
    intended?: Map<string, IntendedState>;
    working?: WorkingSnapshot;
    drift?: DriftFindings;
    legacy?: LegacyAuditResult;
    hotspots?: any[];
    timeline?: string[];
    movedLineage?: Array<{
      symbolId: string;
      previousSymbolId: string;
      sourceVersion: string;
      destVersion: string;
      moveType: 'rename' | 'relocate' | 'refactor';
    }>;
  }
): Promise<RefactorBundleFacts> {
  // Log inputs for diagnostics
  const intendedSize = options?.intended?.size || 0;
  const hybridFactsCount = options?.scope ? await getHybridFactsCount(options.scope, options.commitShas?.[0] || 'HEAD') : 0;
  console.log(`[BundleFacts] Inputs: intended=${intendedSize}, hybridFacts=${hybridFactsCount} files, working.symbols=${options?.working?.symbolsById.size || 0}`);

  // Validation warning
  if (intendedSize === 0) {
    console.warn(`[BundleFacts] WARNING: intended.present === 0. Consider using --enable-cst to populate intended state.`);
  }
  // If full pipeline data is provided, use the comprehensive assembleFacts logic
  if (options?.commitShas && options.scope && options.intended && options.working && options.drift && options.legacy) {
    const facts = await assembleFacts(
      options.commitShas,
      options.scope,
      options.intended,
      options.working,
      options.drift,
      options.legacy,
      options.hotspots
    );
    // Add timeline and movedLineage if provided
    if (options.timeline) {
      facts.bundle.timeline = options.timeline;
    }
    if (options.movedLineage) {
      facts.bundle.movedLineage = options.movedLineage;
    }
    return facts;
  }

  // Fallback to simplified logic for backward compatibility
  let totalSymbols = commitFacts.reduce((sum, c) => sum + c.symbolsAdded + c.symbolsModified + c.symbolsRemoved, 0);
  const totalEdges = commitFacts.reduce((sum, c) => sum + c.edgesAdded + c.edgesRemoved, 0);
  let totalFiles = commitFacts.reduce((sum, c) => sum + c.filesChanged, 0);
  const allRisks = Array.from(new Set(commitFacts.flatMap(c => c.risks)));
  const maxStructuralChange = Math.max(...commitFacts.map(c => c.structuralChangeScore), 0);

  // Add workspace facts if available (handle both old and new structure)
  if (workspaceFacts) {
    // Check if it's the new structured format
    if ('staged' in workspaceFacts || 'unstaged' in workspaceFacts) {
      const structured = workspaceFacts as { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null };
      if (structured.staged) {
        totalSymbols += structured.staged.symbolsAdded + structured.staged.symbolsModified + structured.staged.symbolsRemoved;
        totalFiles += structured.staged.filesChanged;
        allRisks.push(...structured.staged.risks);
      }
      if (structured.unstaged) {
        totalSymbols += structured.unstaged.symbolsAdded + structured.unstaged.symbolsModified + structured.unstaged.symbolsRemoved;
        totalFiles += structured.unstaged.filesChanged;
        allRisks.push(...structured.unstaged.risks);
      }
    } else {
      // Old format: single WorkspaceFacts object
      const single = workspaceFacts as WorkspaceFacts;
      totalSymbols += single.symbolsAdded + single.symbolsModified + single.symbolsRemoved;
      totalFiles += single.filesChanged;
      allRisks.push(...single.risks);
    }
  }

  const newestSha = commitFacts.length > 0 ? commitFacts[0].sha : 'unknown';
  const oldestSha = commitFacts.length > 0 ? commitFacts[commitFacts.length - 1].sha : 'unknown';

  // Calculate confidence score based on available inputs (0.2 per input)
  const confidenceInputs = [
    options?.scope ? 1 : 0,
    options?.intended ? 1 : 0,
    options?.working ? 1 : 0,
    options?.drift ? 1 : 0,
    options?.legacy ? 1 : 0
  ];
  const confidence = confidenceInputs.reduce((sum, present) => sum + present * 0.2, 0);

  return {
    version: '2.0',
    generated_at: new Date().toISOString(),
    confidence,
    bundle: {
      oldestSha,
      newestSha,
      shas: commitFacts.map(c => c.sha),
      ...(options?.timeline && { timeline: options.timeline }),
      ...(options?.movedLineage && { movedLineage: options.movedLineage })
    },
    scope: {
      files: totalFiles,
      blastRadius: maxStructuralChange * 10 // Rough approximation
    },
    intended: options?.intended
      ? (() => {
        const counts = calculateIntendedCounts(options.intended);
        // Heuristics: use hotspots for renamed detection (stable DNA, name change)
        if (counts.renamed === 0 && options.working && options.intended.size > 0) {
          const renamedFromHotspots = detectRenamedFromHotspots(options.intended, options.working);
          if (renamedFromHotspots > 0) {
            console.log(`[BundleFacts] Detected ${renamedFromHotspots} renamed symbols from hotspots (stable DNA, name change)`);
            counts.renamed = renamedFromHotspots;
          }
        }
        return counts;
      })()
      : {
        present: totalSymbols,
        absent: 0,
        renamed: 0
      },
    working: {
      symbols: totalSymbols,
      edges: totalEdges
    },
    findings: {
      incompleteness: options?.drift ? {
        missing: options.drift.missing_symbols.length,
        zombies: options.drift.zombie_symbols.length,
        divergent: options.drift.divergent_symbols.length
      } : {
        missing: 0,
        zombies: 0,
        divergent: 0
      },
      patternDrift: options?.drift && options?.working && options?.intended ? {
        mixedTargets: detectMixedTargets(options.drift, options.working),
        oldNamespaces: detectOldNamespaces(options.working, options.intended),
        conventionDrift: options.drift.conventionDrift ? {
          dominantConvention: options.drift.conventionDrift.dominantConvention,
          driftPercent: options.drift.conventionDrift.driftPercent,
          driftSymbolCount: options.drift.conventionDrift.driftSymbols.length
        } : undefined,
        mixedConventionFiles: options.drift.mixedConventionFiles?.length || undefined
      } : options?.working && options?.intended ? {
        // Compute basic pattern drift even without full drift analysis
        mixedTargets: detectMixedTargets({
          missing_symbols: [],
          zombie_symbols: [],
          divergent_symbols: [],
          missing_edges: [],
          zombie_edges: [],
          hotspots: []
        }, options.working),
        oldNamespaces: detectOldNamespaces(options.working, options.intended)
      } : {
        mixedTargets: 0,
        oldNamespaces: 0
      },
      legacyAudit: options?.legacy ? {
        dead: options.legacy.dead.length,
        legacyUsed: options.legacy.legacyUsed.length,
        replacedLeftovers: options.legacy.replacedLeftovers.map(r => ({
          old: r.old.symbol_id,
          new: r.new.symbol_id,
          confidence: r.confidence
        }))
      } : options?.working && options?.intended ? {
        // Compute basic dead symbol detection from reachability analysis
        dead: computeBasicDeadSymbols(options.working, options.intended),
        legacyUsed: 0,
        replacedLeftovers: []
      } : {
        dead: 0,
        legacyUsed: 0,
        replacedLeftovers: []
      }
    },
    evidence: {
      risks: allRisks,
      structuralChangeScore: maxStructuralChange,
      ...(options?.intended && {
        "intended.present": Array.from(options.intended.values())
          .filter(state => state.expect === 'present')
          .map(state => Array.from(options.intended!.keys())[Array.from(options.intended!.values()).indexOf(state)]),
        "intended.absent": Array.from(options.intended.values())
          .filter(state => state.expect === 'absent')
          .map(state => Array.from(options.intended!.keys())[Array.from(options.intended!.values()).indexOf(state)]),
        "intended.renamed": Array.from(options.intended.values())
          .filter(state => state.expect === 'present' && state.isRenamed)
          .map(state => Array.from(options.intended!.keys())[Array.from(options.intended!.values()).indexOf(state)])
      })
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
  legacy: LegacyAuditResult,
  hotspots?: any[]
): Promise<RefactorBundleFacts> {

  // Calculate counts and lists
  const intendedCounts = calculateIntendedCounts(intended);
  const intendedLists = getIntendedLists(intended);
  const workingLists = getWorkingLists(working);
  const newestSha = commitShas.length > 0 ? commitShas[0] : 'unknown';
  const oldestSha = commitShas.length > 0 ? commitShas[commitShas.length - 1] : 'unknown';

  // Collect hybrid facts for bundle
  const hybridFactsMap: Record<string, HybridFact[]> = {};
  const config = getExtensionConfig();
  const enableCst = config.enableCstTracking ?? true;
  const enableAugment = config.enableCstAugmentation ?? false;

  if (enableCst || enableAugment) {
    const timelineManager = getCstTimelineManager();

    // Build version map for per-file version selection
    const versionMap = new Map<string, string>();
    for (const filePath of scope.allPaths) {
      const language = detectLanguage(filePath);
      if (!language) continue;

      const isCstOnly = isCstOnlyLanguage(language);
      if (!isCstOnly && !enableAugment) continue;

      const versionFromTimeline = scope.fileVersionMap?.get(filePath);
      let version: string;
      if (scope.unstagedFiles?.has(filePath)) {
        version = 'workspace-unstaged';
      } else if (scope.stagedFiles?.has(filePath)) {
        version = 'workspace-staged';
      } else if (versionFromTimeline) {
        version = versionFromTimeline;
      } else {
        version = newestSha !== 'unknown' ? newestSha : 'HEAD';
      }
      versionMap.set(filePath, version);
    }

    // Batch query with per-file versions
    const allFacts = await timelineManager.getPriorFactsBatchWithVersions(versionMap);
    for (const [filePath, facts] of allFacts) {
      if (facts.length > 0) {
        hybridFactsMap[filePath] = facts;
      }
    }
  }

  const facts: RefactorBundleFacts = {
    version: "2.0",
    generated_at: new Date().toISOString(),
    confidence: 1.0, // Full confidence when using complete pipeline data
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
      },
      unresolvedCallers: drift.unresolved_callers ? {
        total: drift.unresolved_callers.length
      } : undefined
    },
    evidence: {
      // Scope evidence
      "bundle.shas": commitShas,
      "scope.files": Array.from(scope.commitFiles),
      "scope.blastRadius": Array.from(scope.blastRadius),

      // Timeline chain evidence
      "timeline.chain": {
        unstaged: scope.unstagedFiles?.size || 0,
        staged: scope.stagedFiles?.size || 0,
        head: scope.commitFiles.size > 0 ? 'HEAD' : null,
        commits: commitShas.length
      },

      // Hybrid facts breakdown by version
      "hybrid.unstaged": {
        total: Object.entries(hybridFactsMap).filter(([path]) => scope.unstagedFiles?.has(path)).reduce((sum, [, facts]) => sum + facts.length, 0),
        files: Object.keys(hybridFactsMap).filter(path => scope.unstagedFiles?.has(path))
      },
      "hybrid.staged": {
        total: Object.entries(hybridFactsMap).filter(([path]) => scope.stagedFiles?.has(path)).reduce((sum, [, facts]) => sum + facts.length, 0),
        files: Object.keys(hybridFactsMap).filter(path => scope.stagedFiles?.has(path))
      },

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

      "findings.unresolvedCallers": drift.unresolved_callers || undefined,

      // Hotspots evidence
      hotspots: hotspots,

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
    },
    // Include hybrid facts if available
    hybridFacts: Object.keys(hybridFactsMap).length > 0 ? hybridFactsMap : undefined
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
export function calculateIntendedCounts(intended: Map<string, IntendedState>): { present: number; absent: number; renamed: number } {
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
export function detectMixedTargets(drift: DriftFindings, working: WorkingSnapshot): number {
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
export function detectOldNamespaces(working: WorkingSnapshot, intended: Map<string, IntendedState>): number {
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

/**
 * Compute basic dead symbol detection from reachability analysis
 * Identifies symbols that are not reachable from entry points
 */
function computeBasicDeadSymbols(working: WorkingSnapshot, intended: Map<string, IntendedState>): number {
  const reachable = new Set<string>();
  const queue: string[] = [];

  // Start with entry points: exported symbols and symbols marked as entry points
  for (const [symbolId, symbol] of working.symbolsById) {
    const intendedState = intended.get(symbolId);

    // Include symbols that are exported or explicitly intended present
    if (symbol.kind === 'export' ||
      (intendedState && intendedState.expect === 'present') ||
      symbol.name.startsWith('main') ||
      symbol.name.startsWith('index')) {
      reachable.add(symbolId);
      queue.push(symbolId);
    }
  }

  // BFS traversal following edges
  while (queue.length > 0) {
    const currentSymbolId = queue.shift()!;

    // Find all edges where current symbol is the source
    const outgoingEdges = working.edges.filter(edge =>
      edge.from_symbol_id === currentSymbolId
    );

    for (const edge of outgoingEdges) {
      const targetSymbolId = edge.to_symbol_id;

      if (!reachable.has(targetSymbolId)) {
        reachable.add(targetSymbolId);
        queue.push(targetSymbolId);
      }
    }
  }

  // Count symbols that are intended present but not reachable
  let deadCount = 0;
  for (const [symbolId, intendedState] of intended) {
    if (intendedState.expect === 'present' && !reachable.has(symbolId)) {
      deadCount++;
    }
  }

  return deadCount;
}

/**
 * Detect renamed symbols from hotspots (stable DNA, name change)
 */
function detectRenamedFromHotspots(
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot
): number {
  const { getDatabaseManager } = require('../storage/database');
  const db = getDatabaseManager().getDatabase();

  let renamedCount = 0;

  // Check DNA continuity - symbols with same DNA but different names (indicates rename)
  // Query symbol_versions for DNA matches with different names
  const dnaStmt = db.prepare(`
    SELECT DISTINCT sv1.symbol_id as id1, sv1.name as name1,
           sv2.symbol_id as id2, sv2.name as name2
    FROM symbol_versions sv1
    JOIN symbol_versions sv2 ON sv1.dna_id = sv2.dna_id
    WHERE sv1.name != sv2.name
    AND sv1.symbol_id != sv2.symbol_id
    AND sv1.dna_id IS NOT NULL
    AND sv2.dna_id IS NOT NULL
    LIMIT 50
  `);

  try {
    const dnaMatches = dnaStmt.all() as any[];
    const renamedSet = new Set<string>();

    for (const match of dnaMatches) {
      // Check if both symbols are in intended map
      const id1InIntended = intended.has(match.id1);
      const id2InIntended = intended.has(match.id2);

      if (id1InIntended && id2InIntended) {
        // Both are in intended - likely a rename
        renamedSet.add(match.id1);
        renamedSet.add(match.id2);
      }
    }

    renamedCount = renamedSet.size;
  } catch (error) {
    // Silently fail if query doesn't work
    console.debug(`[BundleFacts] Could not detect renamed from hotspots: ${error}`);
  }

  return renamedCount;
}

/**
 * Get hybrid facts count for logging
 */
async function getHybridFactsCount(scope: ScopeSet, defaultVersion: string): Promise<number> {
  const config = getExtensionConfig();
  const enableCst = config.enableCstTracking ?? true;
  const enableAugment = config.enableCstAugmentation ?? false;

  if (!enableCst && !enableAugment) {
    return 0;
  }

  const timelineManager = getCstTimelineManager();

  // Build version map for per-file version selection
  const versionMap = new Map<string, string>();
  for (const filePath of scope.allPaths) {
    const language = detectLanguage(filePath);
    if (!language) continue;

    const isCstOnly = isCstOnlyLanguage(language);
    if (!isCstOnly && !enableAugment) continue;

    const versionFromTimeline = scope.fileVersionMap?.get(filePath);
    let fileVersion: string;
    if (scope.unstagedFiles?.has(filePath)) {
      fileVersion = 'workspace-unstaged';
    } else if (scope.stagedFiles?.has(filePath)) {
      fileVersion = 'workspace-staged';
    } else if (versionFromTimeline) {
      fileVersion = versionFromTimeline;
    } else {
      fileVersion = defaultVersion || 'HEAD';
    }
    versionMap.set(filePath, fileVersion);
  }

  if (versionMap.size > 0) {
    const firstEntry = Array.from(versionMap.entries())[0];
  }

  // Batch query with per-file versions
  const allFacts = await timelineManager.getPriorFactsBatchWithVersions(versionMap);
  return allFacts.size;
}
