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
  orderedCommits: string[] = [],
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

    const isItemFuture = (itemSha?: string): boolean => {
      if (commitIdx === undefined || !itemSha || orderedCommits.length === 0) return false;
      const itemIdx = orderedCommits.indexOf(itemSha);
      if (itemIdx === -1) return false; // Assume old if not in our current timeline
      return itemIdx > commitIdx;
    };

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
      // Filter by time if commit metadata is available
      if (isItemFuture((item as any).sha)) return;

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
      if (isItemFuture((item as any).sha)) return;

      const itemPath = item.path || item.filePath;
      if (itemPath === fileId && item.symbol_id) {
        legacySymbols.add(item.symbol_id);
      }
    });

    // Extract moved blocks for this file
    const movedBlocks = (facts?.bundle?.movedLineage || []).filter(block => {
      // For lineage, we generally show it all or filter by destination version
      return !isItemFuture((block as any).destVersion || (block as any).sha);
    });

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
        if (ds.path === fileId && !isItemFuture((ds as any).sha)) {
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
        if (isItemFuture((item as any).sha)) return;

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
      if (isItemFuture((hotspot as any).sha)) return;

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
        if (imp.file === fileId && !isItemFuture((imp as any).sha)) {
          importDriftIssues.push(imp);
        }
      });
    }

    // File naming drift
    let fileNamingDrift: FileAnalysisData['fileNamingDrift'] = null;
    const fnDriftEvidence = evidence?.['findings.patternDrift.conventionDrift']?.fileNamingDrift;
    if (fnDriftEvidence?.driftFiles) {
      const thisFile = fnDriftEvidence.driftFiles.find(
        (f: any) => f.path === fileId && !isItemFuture((f as any).sha)
      );
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
      if (isItemFuture((item as any).sha)) return;

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
      if (isItemFuture((e as any).sha)) return;

      const fromPath = e.from?.split(':')[0] || e.from;
      const toPath = e.to?.split(':')[0] || e.to;
      if (fromPath === fileId || toPath === fileId) {
        missingEdgesCount++;
      }
    });
    zombieEdges.forEach((e: ZombieEdgeEvidence) => {
      if (isItemFuture((e as any).sha)) return;

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
      const thisMixed = mixedFiles.find(
        (f: any) => f.path === fileId && !isItemFuture((f as any).sha)
      );
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

    // Extract findings counts (use filtered lists where possible)
    const findings = {
      missing: driftIssues.filter(d => (d as any).type === 'missing_symbols').length || 0, // Heuristic: filter from driftIssues
      zombies: driftIssues.filter(d => (d as any).type === 'zombie_symbols').length || 0,
      dead: deadSymbols.size || 0,
      legacyUsed: legacySymbols.size || 0,
      unresolved: unresolvedCallers.length || 0,
      divergent: divergentSymbols.size || 0,
      missingEdges: missingEdgesCount,
      zombieEdges: zombieEdgesCount,
      importDrift: importDriftIssues.length,
    };

    // Fallback counts from facts if we didn't extract everything (respecting time travel ideally)
    if (commitIdx === undefined || commitIdx === orderedCommits.length - 1) {
      if (findings.missing === 0) findings.missing = facts?.findings?.incompleteness?.missing || 0;
      if (findings.zombies === 0) findings.zombies = facts?.findings?.incompleteness?.zombies || 0;
    }

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
  }, [fileId, bundleFacts, skeleton, cache, commitIdx, orderedCommits]);
};
