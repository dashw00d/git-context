import * as React from 'react';
import { RefactorBundleFacts } from '../../../facts/types';

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
  driftIssues: Array<{
    symbolId: string;
    name: string;
    convention: string;
    suggestedName: string;
    path: string;
  }>;
  unresolvedCallers: Array<{
    symbolId?: string;
    name?: string;
    callerCount?: number;
  }>;
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
  importDriftIssues: Array<{
    line: number;
    importPath: string;
    style: string;
  }>;
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
  commitIdx?: number
): FileAnalysisData => {
  return React.useMemo(() => {
    if (!bundleFacts || !fileId) {
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

    // Extract dead symbols
    const deadSymbols = new Set<string>();
    const deadEvidence =
      bundleFacts.evidence?.['findings.legacyAudit']?.dead || bundleFacts.evidence?.dead || [];
    deadEvidence.forEach((item: any) => {
      if (item.path === fileId && item.symbol_id) {
        deadSymbols.add(item.symbol_id);
      }
    });

    // Extract legacy-used symbols
    const legacySymbols = new Set<string>();
    const legacyEvidence =
      bundleFacts.evidence?.['findings.legacyAudit']?.legacyUsed ||
      bundleFacts.evidence?.legacyUsed ||
      [];
    legacyEvidence.forEach((item: any) => {
      if (item.path === fileId && item.symbol_id) {
        legacySymbols.add(item.symbol_id);
      }
    });

    // Extract moved blocks for this file
    // Note: movedLineage contains cross-version moves, we'll filter by file in the component
    const movedBlocks = bundleFacts.bundle?.movedLineage || [];

    // Extract convention drift issues for this file
    const driftIssues: Array<{
      symbolId: string;
      name: string;
      convention: string;
      suggestedName: string;
      path: string;
    }> = [];
    const conventionDrift = bundleFacts.findings?.patternDrift?.conventionDrift;
    if (conventionDrift?.driftSymbols) {
      conventionDrift.driftSymbols.forEach((ds: any) => {
        if (ds.path === fileId) {
          driftIssues.push({
            symbolId: ds.symbolId,
            name: ds.name,
            convention: ds.convention,
            suggestedName: ds.suggestedName,
            path: ds.path,
          });
        }
      });
    }

    // Extract unresolved callers
    const unresolvedCallers: Array<{
      symbolId?: string;
      name?: string;
      callerCount?: number;
    }> = [];
    const unresolvedEvidence =
      bundleFacts.evidence?.['findings.unresolvedCallers'] ||
      bundleFacts.findings?.unresolvedCallers ||
      [];
    if (Array.isArray(unresolvedEvidence)) {
      unresolvedEvidence.forEach((item: any) => {
        // UnresolvedCallerFact has caller_path, caller_name, callee_name, occurrence_count
        const itemPath = item.path || item.filePath || item.caller_path;
        if (itemPath === fileId) {
          unresolvedCallers.push({
            symbolId: item.symbolId || item.caller_symbol_id,
            name: item.name || item.caller_name,
            callerCount: item.callerCount || item.count || item.occurrence_count || 1,
          });
        }
      });
    }

    // Extract hotspots for this file
    const hotspots: Array<{ path: string; score: number; symbolId?: string }> = [];
    const hotspotEvidence = bundleFacts.evidence?.hotspots || [];
    hotspotEvidence.forEach((hotspot: any) => {
      if (hotspot.path === fileId || hotspot.file_path === fileId) {
        hotspots.push({
          path: hotspot.path || hotspot.file_path,
          score: hotspot.score || hotspot.hotspot_score || 0,
          symbolId: hotspot.symbol_id,
        });
      }
    });

    // Import drift for this file
    const importDriftIssues: FileAnalysisData['importDriftIssues'] = [];
    const importDriftEvidence =
      bundleFacts.evidence?.['findings.patternDrift.conventionDrift']?.importDrift;
    if (importDriftEvidence?.driftImports) {
      importDriftEvidence.driftImports.forEach((imp: any) => {
        if (imp.file === fileId) {
          importDriftIssues.push({
            line: imp.line,
            importPath: imp.importPath,
            style: imp.style,
          });
        }
      });
    }

    // File naming drift
    let fileNamingDrift: FileAnalysisData['fileNamingDrift'] = null;
    const fnDriftEvidence =
      bundleFacts.evidence?.['findings.patternDrift.conventionDrift']?.fileNamingDrift;
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
    const divergentEvidence = bundleFacts.evidence?.['findings.incompleteness']?.divergent || [];
    divergentEvidence.forEach((item: any) => {
      const itemPath = item.path || item.filePath;
      if (itemPath === fileId && (item.symbol_id || item.symbolId)) {
        divergentSymbols.add(item.symbol_id || item.symbolId);
      }
    });

    // Edge issues
    let missingEdgesCount = 0;
    let zombieEdgesCount = 0;
    const missingEdges = bundleFacts.evidence?.['findings.incompleteness']?.missing_edges || [];
    const zombieEdges = bundleFacts.evidence?.['findings.incompleteness']?.zombie_edges || [];
    missingEdges.forEach((e: any) => {
      const fromPath = e.from?.split(':')[0] || e.from;
      const toPath = e.to?.split(':')[0] || e.to;
      if (fromPath === fileId || toPath === fileId) {
        missingEdgesCount++;
      }
    });
    zombieEdges.forEach((e: any) => {
      const fromPath = e.from?.split(':')[0] || e.from;
      const toPath = e.to?.split(':')[0] || e.to;
      if (fromPath === fileId || toPath === fileId) {
        zombieEdgesCount++;
      }
    });

    // Mixed conventions for this file
    let mixedConventions: FileAnalysisData['mixedConventions'] = null;
    const mixedFiles = bundleFacts.evidence?.['findings.patternDrift.mixedConventionFiles'] || [];
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
    const cd = bundleFacts.findings?.patternDrift?.conventionDrift;
    const conventionInfo = cd
      ? {
          dominantNaming: cd.dominantConvention || 'unknown',
          dominantImportStyle: cd.importDrift?.dominantStyle || 'unknown',
          dominantFileNaming: cd.fileNamingDrift?.dominantStyle || 'unknown',
        }
      : null;

    // Partial analysis status
    const analysisStatus = {
      partial: bundleFacts.partial || false,
      partialReasons: bundleFacts.partialReasons || [],
    };

    // Extract findings counts
    const findings = {
      missing: bundleFacts.findings?.incompleteness?.missing || 0,
      zombies: bundleFacts.findings?.incompleteness?.zombies || 0,
      dead: deadSymbols.size || bundleFacts.findings?.legacyAudit?.dead || 0,
      legacyUsed: legacySymbols.size || bundleFacts.findings?.legacyAudit?.legacyUsed || 0,
      unresolved: unresolvedCallers.length || bundleFacts.findings?.unresolvedCallers?.total || 0,
      divergent: divergentSymbols.size,
      missingEdges: missingEdgesCount,
      zombieEdges: zombieEdgesCount,
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
  }, [fileId, bundleFacts, commitIdx]);
};
