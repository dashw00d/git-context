import type { HybridFact } from '../types/cstFacts';
import type { TypedEvidence } from '../types/EvidenceTypes';

export interface RefactorBundleFacts {
  version: '2.0';
  generated_at: string;
  confidence: number;
  partial?: boolean;
  partialReasons?: string[];
  bundle: {
    oldestSha: string;
    newestSha?: string;
    shas: string[];
    timeline?: string[];
    movedLineage?: Array<{
      symbolId: string;
      previousSymbolId: string;
      sourceVersion: string;
      destVersion: string;
      moveType: 'rename' | 'relocate' | 'refactor';
    }>;
    totalCommits?: number;
  };
  scope: {
    files: number;
    blastRadius: number;
  };
  intended: {
    present: number;
    absent: number;
    renamed: number;
  };
  working: {
    symbols: number;
    edges: number;
  };
  findings: {
    incompleteness: {
      missing: number;
      zombies: number;
      divergent: number;
    };
    patternDrift: {
      mixedTargets: number;
      oldNamespaces: number;
      conventionDrift?: {
        dominantConvention: string;
        driftPercent: number;
        driftSymbolCount: number;
        driftSymbols: Array<{
          symbolId: string;
          name: string;
          convention: string;
          suggestedName: string;
          path: string;
        }>;
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
    };
    legacyAudit: {
      dead: number;
      legacyUsed: number;
      replacedLeftovers: Array<{
        old: string;
        new: string;
        confidence: number;
      }>;
    };
    unresolvedCallers?: {
      total: number;
    };
  };
  evidence: TypedEvidence;

  hybridFacts?: Record<string, HybridFact[]>;

  hybridSummary?: {
    totalFacts: number;
    fileCount: number;
    topFiles: Array<{ file: string; count: number }>;
    sampleFacts: Array<{ file: string; sample: string[] }>;
  };

  evidenceSummary?: {
    missing?: any[];
    zombies?: any[];
    divergent?: any[];
    hybridDrifts?: any[];
    hotspots?: any[];
    movedLineage?: any[];
    counts?: {
      missing: number;
      zombies: number;
      divergent: number;
      hybridDrifts: number;
      hotspots: number;
      moved: number;
    };
  };

  llmCapsApplied?: {
    missing: number;
    zombies: number;
    divergent: number;
    hybridDrifts: number;
    hotspots: number;
    moved: number;
    hybridFiles: number;
    discoveryTotal: number;
  };
}

export interface RefactorPattern {
  id: string;
  name: string;
  description: string;
  examples: string[];
  count: number;
  pct: number;
  bundleShas: string[];
  refactorType?: string;
}
