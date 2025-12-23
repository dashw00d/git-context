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

    // Merge working.symbols (deduplicate by filePath + sha + ID to prevent cross-file collisions)
    if (newFacts.evidence['working.symbols']) {
      const existingSymbols = (merged.evidence['working.symbols'] as any[]) || [];
      const newSymbols = (newFacts.evidence['working.symbols'] as any[]) || [];
      // Use filePath:sha:id as the key for path+sha identity
      const getSymbolKey = (s: any) => {
        const id = s.id || s.name;
        const path = s.filePath || '';
        const sha = s.sha || ''; // Include sha in key for path+sha identity
        return `${path}:${sha}:${id}`;
      };
      const symbolMap = new Map(existingSymbols.map(s => [getSymbolKey(s), s]));

      for (const sym of newSymbols) {
        const key = getSymbolKey(sym);
        const existing = symbolMap.get(key);

        // Prefer complete symbols, or replace incomplete with complete
        if (!existing) {
          symbolMap.set(key, sym);
        } else {
          const existingComplete = existing.complete !== false; // undefined/null = complete
          const newComplete = sym.complete !== false;

          // Always prefer complete over incomplete
          if (newComplete && !existingComplete) {
            symbolMap.set(key, sym);
          } else if (newComplete === existingComplete) {
            // Same completeness - prefer newer (by changeType priority)
            const typePriority: Record<string, number> = {
              priority_click: 3,
              added: 2,
              modified: 1,
              quick_scan: 0,
            };
            const existingPriority = typePriority[existing.changeType] || 0;
            const newPriority = typePriority[sym.changeType] || 0;
            if (newPriority > existingPriority) {
              symbolMap.set(key, sym);
            }
          }
          // If existing is complete and new is incomplete, keep existing
        }
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

      const hotspotMap = new Map(existingHotspots.map((h: any) => [h.path || h.file_path, h]));

      for (const h of newHotspots) {
        const path = h.path || h.file_path;
        // Use new hotspot if it has a higher score, or if we don't have this path yet
        const existing = hotspotMap.get(path);
        // Handle both HotspotEvidence (score, hotspot_score, count) and drift hotspots (drift_count)
        const newScore = (h as any).drift_count || h.score || h.hotspot_score || h.count || 0;
        const existingScore =
          (existing as any)?.drift_count ||
          existing?.score ||
          existing?.hotspot_score ||
          existing?.count ||
          0;

        if (!existing || newScore > existingScore) {
          hotspotMap.set(path, h);
        }
      }
      merged.evidence.hotspots = Array.from(hotspotMap.values());
    }

    // Merge file scopes (union with normalized paths)
    if (newFacts.evidence['scope.files']) {
      const existingFiles = new Set(merged.evidence['scope.files'] || []);
      for (const f of newFacts.evidence['scope.files'] || []) {
        existingFiles.add(f);
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
