import { RefactorBundleFacts } from '../../../facts/types';
import { BundleFactsDTO, BundleFactsSkeleton, BundleView } from '../../../types/cockpit';
import { logDebug, logError } from '../../../utils/logger';

export type HotspotCache = Map<string, any[]>;

/**
 * Build hotspots array from bundle facts or fallback to git churn
 */
export async function buildHotspots(
  facts: BundleFactsDTO | null,
  cache: HotspotCache,
  cacheKey: string
): Promise<any[]> {
  if (facts) {
    if (cache.get(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    let hotspots =
      (facts as any)?.evidence?.hotspots ||
      (facts as any)?.findings?.hotspots ||
      (facts as any)?.hotspots ||
      [];

    hotspots = hotspots.map((h: any) => ({
      name: (h.path || h.filePath)?.split('/').slice(-1)[0] || h.path || h.filePath,
      path: h.path || h.filePath,
      score: h.drift_count || h.score || h.hotspotScore || h.count || 0,
      count: h.count || h.totalChanges,
      size: h.size,
      added: h.added,
      removed: h.removed,
    }));

    if (!hotspots.length) {
      try {
        // Fallback removed to prevent bundling backend code
        logDebug('[BundleView] Fallback hotspots not available in webview');
      } catch (err) {
        logDebug(`[BundleView] Fallback hotspots failed: ${err}`);
      }
    }

    if (cache.size >= 10) {
      const firstKey = cache.keys().next().value;
      if (firstKey) {
        (cache as Map<string, any[]>).delete(firstKey);
      }
    }
    cache.set(cacheKey, hotspots);
    return hotspots;
  } else {
    try {
      // Fallback removed to prevent bundling backend code
      logDebug('[BundleView] Fallback hotspots (no facts) not available in webview');
      return [];
    } catch (err) {
      logDebug(`[BundleView] Fallback hotspots (no facts) failed: ${err}`);
      return [];
    }
  }
}

/**
 * Build treemap from hotspots array
 */
export function buildTreemap(hotspots: any[]): any[] {
  try {
    const MAX_HOTSPOTS = 1000;
    const MAX_DEPTH = 10;
    const limitedHotspots = hotspots.slice(0, MAX_HOTSPOTS);

    const root: any = {};
    const scores: number[] = [];

    for (const h of limitedHotspots) {
      if (!h.path) continue;
      const parts = h.path.split('/').filter(Boolean);

      if (parts.length > MAX_DEPTH) {
        logDebug(`[Treemap] Skipping deep path (${parts.length} levels): ${h.path}`);
        continue;
      }

      let cursor = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        if (!cursor[part]) {
          cursor[part] = {
            id: parts.slice(0, i + 1).join('/'),
            name: part,
            score: 0,
            added: 0,
            removed: 0,
            children: {},
          };
        }
        if (isFile) {
          const sizeWeight = h.size ? Math.log10(h.size + 1) : 1;
          const churn = h.score || h.count || 0;
          const changeWeight = (h.added || 0) + (h.removed || 0);
          cursor[part].score += (churn + changeWeight / 50) * sizeWeight;
          cursor[part].added += h.added || 0;
          cursor[part].removed += h.removed || 0;
        }
        cursor = cursor[part].children;
      }
    }

    const flatten = (nodeMap: any, depth = 0): any[] => {
      if (depth > MAX_DEPTH) return [];

      return Object.values(nodeMap).map((node: any) => {
        const children = flatten(node.children, depth + 1);
        const childrenScore = children.reduce((sum: number, c: any) => sum + c.score, 0);
        const totalScore = Math.max(node.score, childrenScore);
        const totalAdded =
          (node.added || 0) + children.reduce((sum: number, c: any) => sum + (c.added || 0), 0);
        const totalRemoved =
          (node.removed || 0) + children.reduce((sum: number, c: any) => sum + (c.removed || 0), 0);
        scores.push(totalScore);
        return {
          id: node.id,
          name: node.name,
          value: totalScore,
          score: totalScore,
          added: totalAdded,
          removed: totalRemoved,
          children,
        };
      });
    };

    const tree = flatten(root);
    const max = scores.length ? Math.max(...scores) : 1;
    const normalize = (nodes: any[]): any[] =>
      nodes.map(n => ({
        ...n,
        weight: max > 0 ? Math.max(n.score / max, 0.05) : 0.05,
        children: n.children ? normalize(n.children) : [],
      }));

    return normalize(tree);
  } catch (error) {
    logError('[Treemap] Build failed', error);
    return [];
  }
}

/**
 * Build complete bundle view from facts
 */
export async function buildBundleView(
  facts: BundleFactsDTO | null,
  cache: HotspotCache
): Promise<BundleView> {
  try {
    const cacheKey = facts?.bundle?.shas ? facts.bundle.shas.join(',') : 'workspace';
    const hotspots = await buildHotspots(facts, cache, cacheKey);

    const driftSymbols =
      ((facts?.findings as any)?.patternDrift?.conventionDrift?.driftSymbols as any[]) || [];
    const topRisks = driftSymbols.slice(0, 5).map((d: any) => ({
      path: d.path,
      name: d.name,
      issue: 'Naming drift',
      detail: d.suggestedName ? `Suggested: ${d.suggestedName}` : '',
    }));

    const summary = facts
      ? {
          commits: facts.bundle?.shas?.length || 0,
          files: facts.scope?.files || 0,
          symbols: facts.working?.symbols || 0,
        }
      : { commits: 0, files: 0, symbols: 0 };

    const treemap = buildTreemap(hotspots);

    const tier: 'structure' | 'hybrid' | 'semantics' = facts ? 'semantics' : 'hybrid';
    return {
      hotspots,
      summary,
      risks: topRisks,
      treemap,
      tier,
    };
  } catch (error) {
    logError('[BundleView] Build failed', error);
    return { hotspots: [], error: String(error) };
  }
}

/**
 * Create a lightweight skeleton from full bundle facts.
 * Only includes counts and metadata, not full evidence arrays.
 */
export function createBundleFactsSkeleton(
  facts: RefactorBundleFacts | null
): BundleFactsSkeleton | null {
  if (!facts) {
    return null;
  }

  const evidenceCounts: BundleFactsSkeleton['evidenceCounts'] = {
    'scope.files': 0,
    'scope.blastRadius': 0,
    hotspots: 0,
    missing: 0,
    zombies: 0,
    divergent: 0,
    dead: 0,
    legacyUsed: 0,
  };

  // Count evidence arrays
  if (facts.evidence) {
    for (const [key, value] of Object.entries(facts.evidence)) {
      if (Array.isArray(value)) {
        const count = value.length;
        if (key in evidenceCounts) {
          evidenceCounts[key as keyof typeof evidenceCounts] = count;
        } else {
          evidenceCounts[key] = count;
        }
      } else if (typeof value === 'object' && value !== null) {
        // For nested objects, count top-level keys or use a default
        const count = Object.keys(value).length;
        if (key in evidenceCounts) {
          evidenceCounts[key as keyof typeof evidenceCounts] = count;
        } else {
          evidenceCounts[key] = count;
        }
      }
    }
  }

  // Defensive checks for findings structure
  const findings = facts.findings || {
    incompleteness: { missing: 0, zombies: 0, divergent: 0 },
    patternDrift: { mixedTargets: 0, oldNamespaces: 0 },
    legacyAudit: { dead: 0, legacyUsed: 0, replacedLeftovers: [] },
  };
  const incompleteness = findings.incompleteness || { missing: 0, zombies: 0, divergent: 0 };
  const patternDrift = findings.patternDrift || { mixedTargets: 0, oldNamespaces: 0 };
  const legacyAudit = findings.legacyAudit || { dead: 0, legacyUsed: 0, replacedLeftovers: [] };

  return {
    version: facts.version,
    generated_at: facts.generated_at,
    confidence: facts.confidence,
    partial: facts.partial,
    partialReasons: facts.partialReasons,
    bundle: {
      oldestSha: facts.bundle.oldestSha,
      newestSha: facts.bundle.newestSha,
      shas: facts.bundle.shas,
      totalCommits: facts.bundle.totalCommits,
    },
    scope: facts.scope,
    intended: facts.intended,
    working: facts.working,
    evidence: {
      'working.edges': (facts.evidence as any)?.['working.edges'] || [],
    },
    findings: {
      incompleteness: {
        missing: incompleteness.missing || 0,
        zombies: incompleteness.zombies || 0,
        divergent: incompleteness.divergent || 0,
        ...('missing_edges' in incompleteness
          ? { missing_edges: incompleteness.missing_edges as number | undefined }
          : {}),
        ...('zombie_edges' in incompleteness
          ? { zombie_edges: incompleteness.zombie_edges as number | undefined }
          : {}),
      },
      patternDrift: {
        mixedTargets: patternDrift.mixedTargets || 0,
        oldNamespaces: patternDrift.oldNamespaces || 0,
        conventionDrift: patternDrift.conventionDrift
          ? {
              dominantConvention: patternDrift.conventionDrift.dominantConvention,
              driftPercent: patternDrift.conventionDrift.driftPercent,
              driftSymbolCount: patternDrift.conventionDrift.driftSymbolCount,
            }
          : undefined,
        mixedConventionFiles: patternDrift.mixedConventionFiles,
      },
      legacyAudit: {
        dead: legacyAudit.dead || 0,
        legacyUsed: legacyAudit.legacyUsed || 0,
        replacedLeftovers: Array.isArray(legacyAudit.replacedLeftovers)
          ? legacyAudit.replacedLeftovers.length
          : 0,
      },
      unresolvedCallers: findings.unresolvedCallers,
    },
    evidenceCounts,
    hybridSummary: facts.hybridSummary,
  };
}

/**
 * Extract file-specific evidence from bundle facts
 */
export function extractFileEvidence(
  facts: RefactorBundleFacts | null,
  filePath: string
): Record<string, any> {
  if (!facts || !facts.evidence) {
    return {};
  }

  const fileEvidence: Record<string, any> = {};

  // Filter evidence arrays to only include items for this file
  for (const [key, value] of Object.entries(facts.evidence)) {
    if (Array.isArray(value)) {
      if (key === 'scope.files') {
        // Special case: scope.files is just an array of paths
        if (value.includes(filePath)) {
          fileEvidence[key] = [filePath];
        }
      } else {
        const filtered = value.filter((item: any) => {
          const itemPath = item.path || item.filePath || item.caller_path;
          return itemPath === filePath;
        });
        if (filtered.length > 0) {
          fileEvidence[key] = filtered;
        }
      }
    }
  }

  return fileEvidence;
}

/**
 * Extract symbol-specific evidence from bundle facts
 */
export function extractSymbolEvidence(
  facts: RefactorBundleFacts | null,
  symbolId: string
): Record<string, any> {
  if (!facts || !facts.evidence) {
    return {};
  }

  const symbolEvidence: Record<string, any> = {};

  // Filter evidence arrays to only include items for this symbol
  for (const [key, value] of Object.entries(facts.evidence)) {
    if (Array.isArray(value)) {
      const filtered = value.filter((item: any) => {
        const itemSymbolId = item.symbol_id || item.symbolId || item.caller_symbol_id;
        return itemSymbolId === symbolId;
      });
      if (filtered.length > 0) {
        symbolEvidence[key] = filtered;
      }
    }
  }

  return symbolEvidence;
}

/**
 * Extract a focused snippet around a symbol name if possible
 */
export function extractSnippet(
  content: string | undefined,
  symbolName: string
): string | undefined {
  if (!content) return undefined;
  if (!symbolName) return content.slice(0, 1800);
  const idx = content.indexOf(symbolName);
  if (idx === -1) return content.slice(0, 1800);
  const lines = content.split('\n');
  let running = 0;
  let lineIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    running += lines[i].length + 1;
    if (running >= idx) {
      lineIndex = i;
      break;
    }
  }
  const start = Math.max(0, lineIndex - 5);
  const end = Math.min(lines.length, lineIndex + 15);
  return lines.slice(start, end).join('\n');
}
