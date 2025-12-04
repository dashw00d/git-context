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

    // Extract findings counts
    const findings = {
      missing: bundleFacts.findings?.incompleteness?.missing || 0,
      zombies: bundleFacts.findings?.incompleteness?.zombies || 0,
      dead: deadSymbols.size || bundleFacts.findings?.legacyAudit?.dead || 0,
      legacyUsed: legacySymbols.size || bundleFacts.findings?.legacyAudit?.legacyUsed || 0,
      unresolved: unresolvedCallers.length || bundleFacts.findings?.unresolvedCallers?.total || 0,
    };

    return {
      deadSymbols,
      legacySymbols,
      movedBlocks,
      driftIssues,
      unresolvedCallers,
      hotspots,
      findings,
    };
  }, [fileId, bundleFacts, commitIdx]);
};
