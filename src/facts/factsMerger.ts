import { RefactorBundleFacts } from '../facts/types';

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
      for (const edge of newEdges) {
        existingEdges.add(edge);
      }
      merged.evidence['working.edges'] = Array.from(existingEdges);
    }

    // Merge hotspots (deduplicate by path)
    if (newFacts.evidence.hotspots) {
      const existingHotspots = merged.evidence.hotspots || [];
      const newHotspots = newFacts.evidence.hotspots || [];
      const hotspotMap = new Map(existingHotspots.map((h: any) => [h.path, h]));

      for (const h of newHotspots) {
        hotspotMap.set(h.path, h);
      }
      merged.evidence.hotspots = Array.from(hotspotMap.values());
    }

    // Merge file scopes (union)
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
