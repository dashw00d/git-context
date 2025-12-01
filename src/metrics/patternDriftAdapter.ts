/**
 * Pattern Drift Adapter
 *
 * Adapter for pattern drift detection functions from factsAssembler
 * Provides pattern drift metrics for tests
 */

import { DriftFindings } from '../facts/driftDetector';
import { IntendedState } from '../facts/intendedMap';
import { WorkingSnapshot } from '../facts/workingSnapshot';

export interface PatternDriftMetrics {
  mixedTargets: number;
  oldNamespaces: number;
  conventionDrift?: {
    dominantConvention: string;
    driftPercent: number;
    driftSymbolCount: number;
    importDrift?: {
      dominantStyle: string;
      driftPercent: number;
      driftImportCount: number;
    };
    fileNamingDrift?: {
      dominantStyle: string;
      driftPercent: number;
      driftFileCount: number;
    };
  };
  mixedConventionFiles?: number;
}

/**
 * Detect pattern drift using real factsAssembler functions
 */
export function detectPatternDriftFromFacts(
  working: WorkingSnapshot,
  intended: Map<string, IntendedState>,
  drift: DriftFindings
): PatternDriftMetrics {
  // Import the functions from factsAssembler
  const factsAssembler = require('../facts/factsAssembler');
  const detectMixedTargets = factsAssembler.detectMixedTargets;
  const detectOldNamespaces = factsAssembler.detectOldNamespaces;

  const mixedTargets = detectMixedTargets(drift, working);
  const oldNamespaces = detectOldNamespaces(working, intended);

  const result: PatternDriftMetrics = {
    mixedTargets,
    oldNamespaces,
  };

  // Include convention drift if available
  if (drift.conventionDrift) {
    result.conventionDrift = {
      dominantConvention: drift.conventionDrift.dominantConvention,
      driftPercent: drift.conventionDrift.driftPercent,
      driftSymbolCount: drift.conventionDrift.driftSymbols.length,
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
    };
  }

  if (drift.mixedConventionFiles && drift.mixedConventionFiles.length > 0) {
    result.mixedConventionFiles = drift.mixedConventionFiles.length;
  }

  return result;
}

/**
 * Simplified pattern drift detection for tests when full drift data is not available
 * NOTE: This is a fallback - prefer detectPatternDriftFromFacts which calls real functions
 */
export function detectPatternDriftSimple(
  workingSymbols: Array<{ id: string; name: string; kind: string }>,
  intendedSymbols: Array<{ id: string; expect?: 'present' | 'absent' }>
): PatternDriftMetrics {
  // Simple heuristics for pattern drift detection

  // Create a map of intended symbols for comparison
  const intendedMap = new Map(intendedSymbols.map(s => [s.id, s]));

  // Detect mixed targets (symbols with similar names but different patterns)
  const nameGroups = new Map<string, string[]>();
  for (const symbol of workingSymbols) {
    const baseName = symbol.name.toLowerCase().replace(/v\d+|version\d+|old|new/gi, '');
    if (!nameGroups.has(baseName)) {
      nameGroups.set(baseName, []);
    }
    nameGroups.get(baseName)!.push(symbol.name);
  }

  const mixedTargets = Array.from(nameGroups.values()).filter(
    names => names.length > 1 && new Set(names.map(n => n.toLowerCase())).size > 1
  ).length;

  // Detect old namespaces
  const oldNamespacePatterns = [
    /^(old|legacy|deprecated|v1|v2|old_|legacy_|deprecated_)/i,
    /(Old|Legacy|Deprecated)([A-Z]|$)/,
  ];

  const oldNamespaces = workingSymbols.filter(symbol =>
    oldNamespacePatterns.some(pattern => pattern.test(symbol.name))
  ).length;

  // Compare working symbols against intended state to detect drift
  // Symbols that exist in working but are marked as 'absent' in intended indicate drift
  let driftCount = 0;
  for (const symbol of workingSymbols) {
    const intended = intendedMap.get(symbol.id);
    if (intended && intended.expect === 'absent') {
      driftCount++;
    }
  }

  const driftPercent =
    intendedSymbols.length > 0
      ? driftCount / intendedSymbols.length
      : oldNamespaces / Math.max(workingSymbols.length, 1);

  return {
    mixedTargets,
    oldNamespaces,
    conventionDrift: {
      dominantConvention: 'camelCase', // Simplified
      driftPercent,
      driftSymbolCount: driftCount || oldNamespaces,
    },
  };
}
