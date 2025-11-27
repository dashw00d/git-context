/**
 * Single source of truth for RefactorBundleFacts interface
 * This is the canonical schema for v2.0 facts JSON
 */

export interface RefactorBundleFacts {
  version: '2.0';
  generated_at: string;
  confidence: number; // 0-1: completeness of available data
  bundle: {
    oldestSha: string;
    newestSha?: string;
    shas: string[];
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
  evidence: Record<string, any>;
}

export interface RefactorPattern {
  id: string; // Hash of name + examples
  name: string;
  description: string;
  examples: string[];
  count: number;
  pct: number;
  bundleShas: string[]; // Which commit bundles discovered this pattern
  refactorType?: string; // auth, api, migration, etc. (extracted from context)
}
