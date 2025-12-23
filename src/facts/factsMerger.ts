import { RefactorBundleFacts } from '../facts/types';
import { logDebug } from '../utils/logger';

/**
 * Merge specific (on-demand) facts into the global (background) facts.
 * The new facts take precedence.
 */
export function mergeFacts(
  globalFacts: RefactorBundleFacts,
  newFacts: RefactorBundleFacts
): RefactorBundleFacts {
  // Deep clone global facts to avoid mutation
  const merged = JSON.parse(JSON.stringify(globalFacts)) as RefactorBundleFacts;

  // Update version and timestamp
  merged.version = newFacts.version;
  merged.generated_at = new Date().toISOString();

  // Merge Evidence
  if (newFacts.evidence) {
    if (!merged.evidence) merged.evidence = {};

    // Merge working.symbols (deduplicate by ID/path)
    if (newFacts.evidence['working.symbols']) {
      const existingSymbols = (merged.evidence['working.symbols'] as any[]) || [];
      const newSymbols = (newFacts.evidence['working.symbols'] as any[]) || [];
      const symbolMap = new Map(existingSymbols.map(s => [s.id || s.name, s])); // Use ID/name as key

      for (const sym of newSymbols) {
        symbolMap.set(sym.id || sym.name, sym);
      }
      merged.evidence['working.symbols'] = Array.from(symbolMap.values());
    }

    // Merge working.edges (deduplicate)
    if (newFacts.evidence['working.edges']) {
      const existingEdges = new Set(merged.evidence['working.edges'] || []);
      const newEdges = newFacts.evidence['working.edges'] || [];
      const beforeCount = existingEdges.size;
      for (const edge of newEdges) {
        existingEdges.add(edge);
      }
      merged.evidence['working.edges'] = Array.from(existingEdges);
      const afterCount = existingEdges.size;
      logDebug(
        `[factsMerger] Merged working.edges: ${beforeCount} existing + ${newEdges.length} new = ${afterCount} total (${afterCount - beforeCount} added)`
      );
    } else if (merged.evidence['working.edges'] && merged.evidence['working.edges'].length === 0) {
      logDebug(`[factsMerger] Warning: merged facts have empty working.edges array`);
    }

    // Merge hotspots (deduplicate by normalized path)
    if (newFacts.evidence.hotspots) {
      const existingHotspots = merged.evidence.hotspots || [];
      const newHotspots = newFacts.evidence.hotspots || [];

      // Normalize paths for consistent deduplication (forward slashes, no leading slash)
      const normalizePath = (p: string | undefined): string => {
        if (!p) return '';
        return p.replace(/\\/g, '/').replace(/^\/+/, '');
      };

      const hotspotMap = new Map(
        existingHotspots.map((h: any) => {
          const normalizedPath = normalizePath(h.path || h.file_path);
          return [normalizedPath, { ...h, path: normalizedPath }];
        })
      );

      for (const h of newHotspots) {
        const normalizedPath = normalizePath(h.path || h.file_path);
        // Use new hotspot if it has a higher score, or if we don't have this path yet
        const existing = hotspotMap.get(normalizedPath);
        // Handle both HotspotEvidence (score, hotspot_score, count) and drift hotspots (drift_count)
        const newScore = (h as any).drift_count || h.score || h.hotspot_score || h.count || 0;
        const existingScore =
          (existing as any)?.drift_count ||
          existing?.score ||
          existing?.hotspot_score ||
          existing?.count ||
          0;

        if (!existing || newScore > existingScore) {
          hotspotMap.set(normalizedPath, { ...h, path: normalizedPath });
        }
      }
      merged.evidence.hotspots = Array.from(hotspotMap.values());
    }

    // Merge file scopes (union with normalized paths)
    if (newFacts.evidence['scope.files']) {
      const normalizePath = (p: string): string => {
        if (!p) return '';
        return p.replace(/\\/g, '/').replace(/^\/+/, '');
      };

      const existingFiles = new Set((merged.evidence['scope.files'] || []).map(normalizePath));
      for (const f of newFacts.evidence['scope.files'] || []) {
        existingFiles.add(normalizePath(f));
      }
      merged.evidence['scope.files'] = Array.from(existingFiles);
    }
  }

  // Merge Findings (take new ones if they exist, as they are more recent)
  // This is a simplification; ideally we'd merge lists carefully.
  if (newFacts.findings) {
    if (!merged.findings) merged.findings = {} as any;

    if (newFacts.findings.incompleteness) {
      merged.findings.incompleteness = {
        ...merged.findings.incompleteness,
        ...newFacts.findings.incompleteness,
      };
    }

    if (newFacts.findings.legacyAudit) {
      merged.findings.legacyAudit = newFacts.findings.legacyAudit;
    }

    if (newFacts.findings.patternDrift) {
      merged.findings.patternDrift = newFacts.findings.patternDrift;
    }
  }

  return merged;
}
