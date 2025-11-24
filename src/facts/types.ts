/**
 * Single source of truth for RefactorBundleFacts interface
 * This is the canonical schema for v2.0 facts JSON
 */

export interface RefactorBundleFacts {
  version: '2.0';
  generated_at: string;
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
  };
  evidence: Record<string, any>;
}

