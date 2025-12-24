import * as fs from 'fs';
import * as path from 'path';
import { CommitFacts } from '../analysis/commitIndexer';
import { getCstTimelineManager } from '../analysis/cstTimeline';
import { WorkspaceFacts } from '../analysis/workspaceIndexer';
import { BundleFactsSchema } from '../state/schemas';
import { detectLanguage, getExtensionConfig, getGitRoot, isCstOnlyLanguage } from '../utils/config';
import { logError, logInfo, logWarn } from '../utils/logger';
import { DriftFindings } from './driftDetector';
import { IntendedState } from './intendedMap';
import { LegacyAuditResult } from './legacyAudit';
import { ScopeSet } from './scope';
import { RefactorBundleFacts } from './types';
import { WorkingSnapshot } from './workingSnapshot';
import type { HybridFact } from '../types/cstFacts';
export type { RefactorBundleFacts } from './types';

export async function buildRefactorBundleFacts(
  commitFacts: CommitFacts[],
  workspaceFacts:
    | WorkspaceFacts
    | { staged: WorkspaceFacts | null; unstaged: WorkspaceFacts | null }
    | null,
  options: {
    commitShas: string[];
    scope: ScopeSet;
    intended: Map<string, IntendedState>;
    working: WorkingSnapshot;
    drift: DriftFindings;
    legacy: LegacyAuditResult;
    hotspots?: any[];
    timeline?: string[];
    movedLineage?: Array<{
      symbolId: string;
      previousSymbolId: string;
      sourceVersion: string;
      destVersion: string;
      moveType: 'rename' | 'relocate' | 'refactor';
    }>;
    totalCommits?: number;
  }
): Promise<RefactorBundleFacts> {
  const intendedSize = options.intended.size;
  const hybridFactsCount = await getHybridFactsCount(
    options.scope,
    options.commitShas?.[0] || 'HEAD'
  );
  logInfo(
    `Inputs: intended=${intendedSize}, hybridFacts=${hybridFactsCount} files, working.symbols=${
      options.working.symbolsById.size || 0
    }`
  );

  if (intendedSize === 0) {
    logWarn(
      `WARNING: intended.present === 0. Consider using --enable-cst to populate intended state.`
    );
  }

  const facts = await assembleFacts(
    options.commitShas,
    options.scope,
    options.intended,
    options.working,
    options.drift,
    options.legacy,
    options.hotspots,
    options.totalCommits
  );

  if (options.timeline) {
    facts.bundle.timeline = options.timeline;
  }
  if (options.movedLineage) {
    facts.bundle.movedLineage = options.movedLineage;
  }
  if (options.totalCommits !== undefined) {
    facts.bundle.totalCommits = options.totalCommits;
  }

  try {
    return BundleFactsSchema.parse(facts) as RefactorBundleFacts;
  } catch (error) {
    logError('BundleFactsSchema validation failed', error);

    return facts as unknown as RefactorBundleFacts;
  }
}

export async function assembleFacts(
  commitShas: string[],
  scope: ScopeSet,
  intended: Map<string, IntendedState>,
  working: WorkingSnapshot,
  drift: DriftFindings,
  legacy: LegacyAuditResult,
  hotspots?: any[],
  totalCommits?: number
): Promise<RefactorBundleFacts> {
  const intendedCounts = calculateIntendedCounts(intended);
  const intendedLists = getIntendedLists(intended);
  const newestSha = commitShas.length > 0 ? commitShas[0] : 'unknown';
  const workingLists = getWorkingLists(working, newestSha);
  const oldestSha = commitShas.length > 0 ? commitShas[commitShas.length - 1] : 'unknown';

  const hybridFactsMap: Record<string, HybridFact[]> = {};
  const config = getExtensionConfig();
  const enableCst = config.enableCstTracking ?? true;
  const enableAugment = config.enableCstAugmentation ?? false;

  if (enableCst || enableAugment) {
    const timelineManager = getCstTimelineManager();

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

    const allFacts = await timelineManager.getPriorFactsBatchWithVersions(versionMap);
    for (const [filePath, facts] of allFacts) {
      if (facts.length > 0) {
        hybridFactsMap[filePath] = facts;
      }
    }
  }

  const facts = {
    version: '2.0',
    generated_at: new Date().toISOString(),
    confidence: 1.0,
    bundle: {
      oldestSha,
      newestSha,
      shas: commitShas,
      totalCommits,
    },
    scope: {
      files: scope.commitFiles.size,
      blastRadius: scope.blastRadius.size,
    },
    intended: intendedCounts,
    working: {
      symbols: working.symbolsById.size,
      edges: working.edges.length,
    },
    findings: {
      incompleteness: {
        missing: drift.missing_symbols.length,
        zombies: drift.zombie_symbols.length,
        divergent: drift.divergent_symbols.length,
      },
      patternDrift: {
        mixedTargets: detectMixedTargets(drift, working),
        oldNamespaces: detectOldNamespaces(working, intended),
        conventionDrift: drift.conventionDrift
          ? {
              dominantConvention: drift.conventionDrift.dominantConvention,
              driftPercent: drift.conventionDrift.driftPercent,
              driftSymbolCount: drift.conventionDrift.driftSymbols.length,
              driftSymbols: drift.conventionDrift.driftSymbols,
              importDrift: drift.conventionDrift.importDrift
                ? {
                    dominantStyle: drift.conventionDrift.importDrift.dominantStyle,
                    driftPercent: drift.conventionDrift.importDrift.driftPercent,
                    driftImportCount: drift.conventionDrift.importDrift.driftImports.length,
                  }
                : undefined,
              fileNamingDrift: drift.conventionDrift.fileNamingDrift
                ? {
                    dominantStyle: drift.conventionDrift.fileNamingDrift.dominantStyle,
                    driftPercent: drift.conventionDrift.fileNamingDrift.driftPercent,
                    driftFileCount: drift.conventionDrift.fileNamingDrift.driftFiles.length,
                  }
                : undefined,
            }
          : undefined,
        mixedConventionFiles: drift.mixedConventionFiles?.length || undefined,
      },
      legacyAudit: {
        dead: legacy.dead.length,
        legacyUsed: legacy.legacyUsed.length,
        replacedLeftovers: legacy.replacedLeftovers.map(item => ({
          old: item.old.symbol_id,
          new: item.new.symbol_id,
          confidence: item.confidence,
        })),
      },
      unresolvedCallers: drift.unresolved_callers
        ? {
            total: drift.unresolved_callers.length,
          }
        : undefined,
    },
    evidence: {
      'bundle.shas': commitShas,
      'scope.files': Array.from(scope.commitFiles),
      'scope.blastRadius': Array.from(scope.blastRadius),

      'timeline.chain': {
        unstaged: scope.unstagedFiles?.size || 0,
        staged: scope.stagedFiles?.size || 0,
        head: scope.commitFiles.size > 0 ? 'HEAD' : null,
        commits: commitShas.length,
      },

      'hybrid.unstaged': {
        total: Object.entries(hybridFactsMap)
          .filter(([path]) => scope.unstagedFiles?.has(path))
          .reduce((sum, [, facts]) => sum + facts.length, 0),
        files: Object.keys(hybridFactsMap).filter(path => scope.unstagedFiles?.has(path)),
      },
      'hybrid.staged': {
        total: Object.entries(hybridFactsMap)
          .filter(([path]) => scope.stagedFiles?.has(path))
          .reduce((sum, [, facts]) => sum + facts.length, 0),
        files: Object.keys(hybridFactsMap).filter(path => scope.stagedFiles?.has(path)),
      },

      'intended.present': intendedLists.present,
      'intended.absent': intendedLists.absent,
      'intended.renamed': intendedLists.renamed,

      'working.symbols': workingLists.symbols,
      'working.edges': workingLists.edges,

      'findings.incompleteness': {
        missing: drift.missing_symbols.map(m => ({
          symbol_id: m.symbol_id,
          expected: m.expected,
        })),
        zombies: drift.zombie_symbols.map(z => ({
          symbol_id: z.symbol_id,
          found: { name: z.found.name, kind: z.found.kind },
        })),
        divergent: drift.divergent_symbols,
        missing_edges: drift.missing_edges || [],
        zombie_edges: drift.zombie_edges || [],
      },
      'findings.incompleteness.missing': drift.missing_symbols.map(m => ({
        symbol_id: m.symbol_id,
        expected: m.expected,
      })),
      'findings.incompleteness.zombies': drift.zombie_symbols.map(z => ({
        symbol_id: z.symbol_id,
        found: { name: z.found.name, kind: z.found.kind },
      })),

      'findings.legacyAudit': {
        dead: legacy.dead.map(d => ({
          symbol_id: d.symbol_id,
          name: d.name,
          kind: d.kind,
        })),
        legacyUsed: legacy.legacyUsed.map(l => ({
          symbol_id: l.symbol_id,
          name: l.name,
          kind: l.kind,
        })),
        replacedLeftovers: legacy.replacedLeftovers.map(r => ({
          old: r.old.symbol_id,
          new: r.new.symbol_id,
          confidence: r.confidence,
        })),
      },

      'findings.patternDrift.conventionDrift': drift.conventionDrift
        ? {
            dominantConvention: drift.conventionDrift.dominantConvention,
            driftPercent: drift.conventionDrift.driftPercent,
            driftSymbols: drift.conventionDrift.driftSymbols.map(ds => ({
              symbolId: ds.symbolId,
              name: ds.name,
              convention: ds.convention,
              suggestedName: ds.suggestedName,
              path: ds.path,
            })),
            importDrift: drift.conventionDrift.importDrift
              ? {
                  dominantStyle: drift.conventionDrift.importDrift.dominantStyle,
                  driftPercent: drift.conventionDrift.importDrift.driftPercent,
                  driftImports: drift.conventionDrift.importDrift.driftImports,
                }
              : undefined,
            fileNamingDrift: drift.conventionDrift.fileNamingDrift
              ? {
                  dominantStyle: drift.conventionDrift.fileNamingDrift.dominantStyle,
                  driftPercent: drift.conventionDrift.fileNamingDrift.driftPercent,
                  driftFiles: drift.conventionDrift.fileNamingDrift.driftFiles,
                }
              : undefined,
          }
        : undefined,

      'findings.patternDrift.mixedConventionFiles': drift.mixedConventionFiles || undefined,

      'findings.unresolvedCallers': drift.unresolved_callers || undefined,

      hotspots: hotspots,

      missing: drift.missing_symbols.map(m => ({
        symbol_id: m.symbol_id,
        expected: m.expected,
      })),
      zombies: drift.zombie_symbols.map(z => ({
        symbol_id: z.symbol_id,
        found: { name: z.found.name, kind: z.found.kind },
      })),
      dead: legacy.dead.map(d => ({
        symbol_id: d.symbol_id,
        name: d.name,
        kind: d.kind,
      })),
      legacyUsed: legacy.legacyUsed.map(l => ({
        symbol_id: l.symbol_id,
        name: l.name,
        kind: l.kind,
      })),
      replacedLeftovers: legacy.replacedLeftovers.map(r => ({
        old: r.old.symbol_id,
        new: r.new.symbol_id,
        confidence: r.confidence,
      })),
    },

    hybridFacts: Object.keys(hybridFactsMap).length > 0 ? hybridFactsMap : undefined,
  };

  return facts as unknown as RefactorBundleFacts;
}

export async function saveFacts(facts: RefactorBundleFacts): Promise<string> {
  const gitRoot = getGitRoot();
  if (!gitRoot) {
    logError('Not in a git repository');
    return '';
  }

  const factsDir = path.join(gitRoot, '.git', 'commit-tracker');
  const factsPath = path.join(factsDir, 'last-bundle-facts.json');

  if (!fs.existsSync(factsDir)) {
    fs.mkdirSync(factsDir, { recursive: true });
  }

  fs.writeFileSync(factsPath, JSON.stringify(facts, null, 2), 'utf8');

  return factsPath;
}

export function calculateIntendedCounts(intended: Map<string, IntendedState>): {
  present: number;
  absent: number;
  renamed: number;
} {
  let present = 0;
  let absent = 0;
  let renamed = 0;

  for (const [_symbolId, state] of intended) {
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

function getIntendedLists(intended: Map<string, IntendedState>): {
  present: string[];
  absent: string[];
  renamed: string[];
} {
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

function getWorkingLists(
  working: WorkingSnapshot,
  newestSha: string
): {
  symbols: any[]; // Full symbol objects for FrameAnalyzer compatibility
  edges: string[];
} {
  // Collect all symbols from all files to avoid DNA collisions in the UI
  const allSymbols: any[] = [];
  for (const [filePath, symbols] of working.symbolsByFile.entries()) {
    for (const s of symbols) {
      allSymbols.push({
        id: s.symbol_id,
        name: s.name,
        kind: s.kind,
        signature: s.signature || '',
        location: s.loc_post || s.loc_pre || null,
        filePath: s.filePath || filePath || '',
        sha: newestSha, // Add SHA (from commit context)
        complete: true, // Mark full pipeline as complete
        changeType: s.change_type || 'modified', // Use change_type from symbol data, default to 'modified'
      });
    }
  }

  return {
    symbols: allSymbols,
    edges: working.edges.map(e => `${e.from_symbol_id} -> ${e.to_symbol_id} (${e.edge_type})`),
  };
}

export function detectMixedTargets(drift: DriftFindings, working: WorkingSnapshot): number {
  if (drift.mixedConventionFiles && drift.mixedConventionFiles.length > 0) {
    return drift.mixedConventionFiles.length;
  }

  const fileConventions = new Map<string, Set<string>>();

  for (const [filePath, symbols] of working.symbolsByFile.entries()) {
    if (!fileConventions.has(filePath)) {
      fileConventions.set(filePath, new Set());
    }

    for (const symbol of symbols) {
      const name = symbol.name;
      if (/^[a-z]/.test(name)) {
        fileConventions.get(filePath)!.add('camelCase');
      } else if (/^[A-Z]/.test(name) && /[A-Z]/.test(name.slice(1))) {
        fileConventions.get(filePath)!.add('PascalCase');
      } else if (/_/.test(name)) {
        fileConventions.get(filePath)!.add('snake_case');
      }
    }
  }

  let mixedCount = 0;
  for (const conventions of fileConventions.values()) {
    if (conventions.size > 1) {
      mixedCount++;
    }
  }

  return mixedCount;
}

export function detectOldNamespaces(
  working: WorkingSnapshot,
  intended: Map<string, IntendedState>
): number {
  const oldNamespacePatterns = [
    /^(old|legacy|deprecated|v1|v2|old_|legacy_|deprecated_)/i,
    /(Old|Legacy|Deprecated)([A-Z]|$)/,
    /\\Old\\/,
    /\\Legacy\\/,
    /\\Deprecated\\/,
    /\/old\//,
    /\/legacy\//,
    /\/deprecated\//,
  ];

  let oldNamespaceCount = 0;

  for (const [filePath, symbols] of working.symbolsByFile.entries()) {
    for (const symbol of symbols) {
      const symbolName = symbol.name;
      const symbolId = symbol.symbol_id;

      const matchesOldPattern = oldNamespacePatterns.some(
        pattern => pattern.test(filePath) || pattern.test(symbolName)
      );

      if (matchesOldPattern) {
        const intendedState = intended.get(symbolId);
        if (intendedState || !intended.has(symbolId)) {
          if (intendedState?.expect === 'absent') {
            oldNamespaceCount++;
          } else if (!intended.has(symbolId)) {
            oldNamespaceCount++;
          }
        }
      }
    }
  }

  return oldNamespaceCount;
}

async function getHybridFactsCount(scope: ScopeSet, sha: string): Promise<number> {
  const config = getExtensionConfig();
  const enableCst = config.enableCstTracking ?? true;
  const enableAugment = config.enableCstAugmentation ?? false;

  if (!enableCst && !enableAugment) return 0;

  const timelineManager = getCstTimelineManager();
  const versionMap = new Map<string, string>();

  for (const filePath of scope.allPaths) {
    const language = detectLanguage(filePath);
    if (!language) continue;

    const isCstOnly = isCstOnlyLanguage(language);
    if (!isCstOnly && !enableAugment) continue;

    versionMap.set(filePath, sha);
  }

  const allFacts = await timelineManager.getPriorFactsBatchWithVersions(versionMap);
  let count = 0;
  for (const [, facts] of allFacts) {
    if (facts.length > 0) count++;
  }
  return count;
}
