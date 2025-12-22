import * as React from 'react';
import { RefactorBundleFacts } from '../../../facts/types';
import { BundleFactsSkeleton } from '../../../types/cockpit';
import type {
  ConventionDriftSymbol,
  DeadSymbolEvidence,
  DivergentSymbolEvidence,
  HotspotEvidence,
  ImportDriftIssue,
  LegacyUsedSymbolEvidence,
  MissingEdgeEvidence,
  UnresolvedCallerEvidence,
  ZombieEdgeEvidence,
} from '../../../types/EvidenceTypes';

export interface FileAnalysisData {
  deadSymbols: Set<string>;
  legacySymbols: Set<string>;
  movedBlocks: Array<{
    symbolId: string;
    previousSymbolId: string;
    sourceVersion: string;
    destVersion: string;
    moveType: 'rename' | 'relocate' | 'refactor';
    sourceFile?: string;
    destFile?: string;
    sourceStartLine?: number;
    sourceEndLine?: number;
    destStartLine?: number;
    destEndLine?: number;
  }>;
  driftIssues: ConventionDriftSymbol[];
  unresolvedCallers: UnresolvedCallerEvidence[];
  hotspots: Array<{
    path: string;
    score: number;
    symbolId?: string;
  }>;
  findings: {
    missing: number;
    zombies: number;
    dead: number;
    legacyUsed: number;
    unresolved: number;
    divergent: number;
    missingEdges: number;
    zombieEdges: number;
    importDrift: number;
  };
  // NEW fields
  importDriftIssues: ImportDriftIssue[];
  fileNamingDrift: {
    hasDrift: boolean;
    currentStyle: string;
    dominantStyle: string;
  } | null;
  divergentSymbols: Set<string>;
  edgeIssues: {
    missingEdges: number;
    zombieEdges: number;
  };
  mixedConventions: {
    conventions: string[];
    driftPercent: number;
  } | null;
  conventionInfo: {
    dominantNaming: string;
    dominantImportStyle: string;
    dominantFileNaming: string;
  } | null;
  analysisStatus: {
    partial: boolean;
    partialReasons: string[];
  };
}

export const useFileAnalysisData = (
  fileId: string,
  bundleFacts: RefactorBundleFacts | null | undefined,
  commitIdx?: number,
  bundleFactsSkeleton?: BundleFactsSkeleton | null,
  fileEvidenceCache?: Record<string, Record<string, any>>,
  onRequestFileDetails?: (filePath: string) => void
): FileAnalysisData => {
  // Make parameters optional for backward compatibility
  const skeleton = bundleFactsSkeleton || null;
  const cache = fileEvidenceCache || {};
  const requestFn = onRequestFileDetails;
  // Request file details if we have skeleton but no cached evidence
  React.useEffect(() => {
    if (fileId && skeleton && !bundleFacts && !cache[fileId] && requestFn) {
      requestFn(fileId);
    }
  }, [fileId, skeleton, bundleFacts, cache, requestFn]);

  return React.useMemo(() => {
    // Use full bundleFacts if available
    const facts = bundleFacts;
    // Otherwise, merge skeleton with cached evidence
    const fileEvidence = cache[fileId] || {};

    if (!fileId) {
      return {
        deadSymbols: new Set(),
        legacySymbols: new Set(),
        movedBlocks: [],
        driftIssues: [],
        unresolvedCallers: [],
        hotspots: [],
        findings: {
          missing: 0,
          zombies: 0,
          dead: 0,
          legacyUsed: 0,
          unresolved: 0,
          divergent: 0,
          missingEdges: 0,
          zombieEdges: 0,
          importDrift: 0,
        },
        importDriftIssues: [],
        fileNamingDrift: null,
        divergentSymbols: new Set(),
        edgeIssues: {
          missingEdges: 0,
          zombieEdges: 0,
        },
        mixedConventions: null,
        conventionInfo: null,
        analysisStatus: {
          partial: false,
          partialReasons: [],
        },
      };
    }

    // Use full facts if available, otherwise use skeleton + cached evidence
    const evidence = facts?.evidence || fileEvidence;

    // Extract dead symbols
    const deadSymbols = new Set<string>();
    const deadEvidence =
      (evidence?.['findings.legacyAudit']?.dead as DeadSymbolEvidence[] | undefined) ||
      (evidence?.dead as DeadSymbolEvidence[] | undefined) ||
      [];
    deadEvidence.forEach((item: DeadSymbolEvidence) => {
      const itemPath = item.path || item.filePath;
      if (itemPath === fileId && item.symbol_id) {
        deadSymbols.add(item.symbol_id);
      }
    });

    // Extract legacy-used symbols
    const legacySymbols = new Set<string>();
    const legacyEvidence =
      (evidence?.['findings.legacyAudit']?.legacyUsed as LegacyUsedSymbolEvidence[] | undefined) ||
      (evidence?.legacyUsed as LegacyUsedSymbolEvidence[] | undefined) ||
      [];
    legacyEvidence.forEach((item: LegacyUsedSymbolEvidence) => {
      const itemPath = item.path || item.filePath;
      if (itemPath === fileId && item.symbol_id) {
        legacySymbols.add(item.symbol_id);
      }
    });

    // Extract moved blocks for this file
    // Note: movedLineage contains cross-version moves, we'll filter by file in the component
    const movedBlocks = facts?.bundle?.movedLineage || (skeleton?.bundle?.shas ? [] : []);

    // Extract convention drift issues for this file
    const driftIssues: ConventionDriftSymbol[] = [];
    const conventionDrift =
      facts?.findings?.patternDrift?.conventionDrift ||
      (skeleton?.findings?.patternDrift?.conventionDrift &&
      fileEvidence?.['findings.patternDrift.conventionDrift']?.driftSymbols
        ? {
            driftSymbols:
              (fileEvidence['findings.patternDrift.conventionDrift']
                .driftSymbols as ConventionDriftSymbol[]) || [],
          }
        : undefined);
    if (conventionDrift?.driftSymbols) {
      conventionDrift.driftSymbols.forEach((ds: ConventionDriftSymbol) => {
        if (ds.path === fileId) {
          driftIssues.push(ds);
        }
      });
    }

    // Extract unresolved callers
    const unresolvedCallers: UnresolvedCallerEvidence[] = [];
    const unresolvedEvidence =
      (evidence?.['findings.unresolvedCallers'] as UnresolvedCallerEvidence[] | undefined) ||
      (facts?.findings?.unresolvedCallers ? [] : []);
    if (Array.isArray(unresolvedEvidence)) {
      unresolvedEvidence.forEach((item: UnresolvedCallerEvidence) => {
        // UnresolvedCallerFact has caller_path, caller_name, callee_name, occurrence_count
        const itemPath = item.path || item.filePath || item.caller_path;
        if (itemPath === fileId) {
          unresolvedCallers.push(item);
        }
      });
    }

    // Extract hotspots for this file
    const hotspots: Array<{ path: string; score: number; symbolId?: string }> = [];
    const hotspotEvidence = (evidence?.hotspots as HotspotEvidence[] | undefined) || [];
    hotspotEvidence.forEach((hotspot: HotspotEvidence) => {
      if (hotspot.path === fileId || hotspot.file_path === fileId) {
        hotspots.push({
          path: hotspot.path || hotspot.file_path || '',
          score: hotspot.score || hotspot.hotspot_score || 0,
          symbolId: hotspot.symbol_id,
        });
      }
    });

    // Import drift for this file
    const importDriftIssues: ImportDriftIssue[] = [];
    const importDriftEvidence = evidence?.['findings.patternDrift.conventionDrift']?.importDrift;
    if (importDriftEvidence?.driftImports) {
      importDriftEvidence.driftImports.forEach((imp: ImportDriftIssue) => {
        if (imp.file === fileId) {
          importDriftIssues.push(imp);
        }
      });
    }

    // File naming drift
    let fileNamingDrift: FileAnalysisData['fileNamingDrift'] = null;
    const fnDriftEvidence = evidence?.['findings.patternDrift.conventionDrift']?.fileNamingDrift;
    if (fnDriftEvidence?.driftFiles) {
      const thisFile = fnDriftEvidence.driftFiles.find((f: any) => f.path === fileId);
      if (thisFile) {
        fileNamingDrift = {
          hasDrift: true,
          currentStyle: thisFile.style,
          dominantStyle: fnDriftEvidence.dominantStyle,
        };
      }
    }

    // Divergent symbols
    const divergentSymbols = new Set<string>();
    const divergentEvidence =
      (evidence?.['findings.incompleteness']?.divergent as DivergentSymbolEvidence[] | undefined) ||
      [];
    divergentEvidence.forEach((item: DivergentSymbolEvidence) => {
      const itemPath = item.path || item.filePath;
      if (itemPath === fileId && (item.symbol_id || item.symbolId)) {
        divergentSymbols.add(item.symbol_id || item.symbolId || '');
      }
    });

    // Edge issues
    let missingEdgesCount = 0;
    let zombieEdgesCount = 0;
    const missingEdges =
      (evidence?.['findings.incompleteness']?.missing_edges as MissingEdgeEvidence[] | undefined) ||
      [];
    const zombieEdges =
      (evidence?.['findings.incompleteness']?.zombie_edges as ZombieEdgeEvidence[] | undefined) ||
      [];
    missingEdges.forEach((e: MissingEdgeEvidence) => {
      const fromPath = e.from?.split(':')[0] || e.from;
      const toPath = e.to?.split(':')[0] || e.to;
      if (fromPath === fileId || toPath === fileId) {
        missingEdgesCount++;
      }
    });
    zombieEdges.forEach((e: ZombieEdgeEvidence) => {
      const fromPath = e.from?.split(':')[0] || e.from;
      const toPath = e.to?.split(':')[0] || e.to;
      if (fromPath === fileId || toPath === fileId) {
        zombieEdgesCount++;
      }
    });

    // Mixed conventions for this file
    let mixedConventions: FileAnalysisData['mixedConventions'] = null;
    const mixedFiles = evidence?.['findings.patternDrift.mixedConventionFiles'] || [];
    if (Array.isArray(mixedFiles)) {
      const thisMixed = mixedFiles.find((f: any) => f.path === fileId);
      if (thisMixed) {
        mixedConventions = {
          conventions: thisMixed.conventions || [],
          driftPercent: thisMixed.driftPercent || 0,
        };
      }
    }

    // Convention info (workspace-level)
    const cd =
      facts?.findings?.patternDrift?.conventionDrift ||
      (skeleton?.findings?.patternDrift?.conventionDrift
        ? {
            dominantConvention: skeleton.findings.patternDrift.conventionDrift.dominantConvention,
            dominantImportStyle: 'unknown',
            dominantFileNaming: 'unknown',
          }
        : undefined);
    const conventionInfo = cd
      ? {
          dominantNaming: cd.dominantConvention || 'unknown',
          dominantImportStyle:
            'importDrift' in cd && cd.importDrift ? cd.importDrift.dominantStyle : 'unknown',
          dominantFileNaming:
            'fileNamingDrift' in cd && cd.fileNamingDrift
              ? cd.fileNamingDrift.dominantStyle
              : 'unknown',
        }
      : null;

    // Partial analysis status
    const analysisStatus = {
      partial: facts?.partial || skeleton?.partial || false,
      partialReasons: facts?.partialReasons || skeleton?.partialReasons || [],
    };

    // Extract findings counts (use skeleton if full facts not available)
    const findings = {
      missing:
        facts?.findings?.incompleteness?.missing ||
        skeleton?.findings?.incompleteness?.missing ||
        0,
      zombies:
        facts?.findings?.incompleteness?.zombies ||
        skeleton?.findings?.incompleteness?.zombies ||
        0,
      dead:
        deadSymbols.size ||
        facts?.findings?.legacyAudit?.dead ||
        skeleton?.findings?.legacyAudit?.dead ||
        0,
      legacyUsed:
        legacySymbols.size ||
        facts?.findings?.legacyAudit?.legacyUsed ||
        skeleton?.findings?.legacyAudit?.legacyUsed ||
        0,
      unresolved:
        unresolvedCallers.length ||
        facts?.findings?.unresolvedCallers?.total ||
        skeleton?.findings?.unresolvedCallers?.total ||
        0,
      divergent:
        divergentSymbols.size ||
        facts?.findings?.incompleteness?.divergent ||
        skeleton?.findings?.incompleteness?.divergent ||
        0,
      missingEdges: (() => {
        if (missingEdgesCount) return missingEdgesCount;
        if (facts?.findings?.incompleteness && 'missing_edges' in facts.findings.incompleteness) {
          return (facts.findings.incompleteness.missing_edges as number | undefined) || 0;
        }
        if (
          skeleton?.findings?.incompleteness &&
          'missing_edges' in skeleton.findings.incompleteness
        ) {
          return (skeleton.findings.incompleteness.missing_edges as number | undefined) || 0;
        }
        return 0;
      })(),
      zombieEdges: (() => {
        if (zombieEdgesCount) return zombieEdgesCount;
        if (facts?.findings?.incompleteness && 'zombie_edges' in facts.findings.incompleteness) {
          return (facts.findings.incompleteness.zombie_edges as number | undefined) || 0;
        }
        if (
          skeleton?.findings?.incompleteness &&
          'zombie_edges' in skeleton.findings.incompleteness
        ) {
          return (skeleton.findings.incompleteness.zombie_edges as number | undefined) || 0;
        }
        return 0;
      })(),
      importDrift: importDriftIssues.length,
    };

    return {
      deadSymbols,
      legacySymbols,
      movedBlocks,
      driftIssues,
      unresolvedCallers,
      hotspots,
      findings,
      importDriftIssues,
      fileNamingDrift,
      divergentSymbols,
      edgeIssues: {
        missingEdges: missingEdgesCount,
        zombieEdges: zombieEdgesCount,
      },
      mixedConventions,
      conventionInfo,
      analysisStatus,
    };
  }, [fileId, bundleFacts, skeleton, cache, commitIdx]);
};
