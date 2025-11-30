import type { HybridFact } from '../types/cstFacts';

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
    timeline?: string[];  // Explicit timeline chain: newest → oldest
    movedLineage?: Array<{
      symbolId: string;
      previousSymbolId: string;
      sourceVersion: string;
      destVersion: string;
      moveType: 'rename' | 'relocate' | 'refactor';
    }>;
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
  evidence: Record<string, any>;
  /**
   * Hybrid facts: semantic symbols + CST facts, keyed by file path
   * For CST-only languages (markdown, json, yaml, css) and hybrid augmentation
   * on supported languages (php, js/ts) to layer structural facts on top
   */
  hybridFacts?: Record<string, HybridFact[]>;

  /**
   * Summary of hybrid facts analysis
   */
  hybridSummary?: {
    totalFacts: number;
    fileCount: number;
    topFiles: Array<{ file: string; count: number }>;
    sampleFacts: Array<{ file: string; sample: string[] }>;
  };

  /**
   * Summarized evidence for LLM context
   */
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

  /**
   * Caps applied to evidence arrays during summarization
   */
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
  id: string; // Hash of name + examples
  name: string;
  description: string;
  examples: string[];
  count: number;
  pct: number;
  bundleShas: string[]; // Which commit bundles discovered this pattern
  refactorType?: string; // auth, api, migration, etc. (extracted from context)
}
