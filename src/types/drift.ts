import { EdgeContext, SymbolContext } from '../contracts/llmContext';
import { FileNamingConvention } from './convention';
import { HybridFact } from './cstFacts';
import { NamingConvention } from './naming';

export interface IntendedState {
  expect: 'present' | 'absent';
  lastName?: string;
  lastPath?: string;
  lastSig?: string;
  lastSha: string;
  isRenamed?: boolean;
}

export interface DriftFindings {
  missing_symbols: Array<{
    symbol_id: string;
    expected: IntendedState;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  zombie_symbols: Array<{
    symbol_id: string;
    expected: IntendedState;
    found: SymbolContext;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  divergent_symbols: Array<{
    symbol_id: string;
    expected: IntendedState;
    found: SymbolContext;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  missing_edges: Array<{
    from: string;
    to: string;
    type: string;
    expected: IntendedState;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  zombie_edges: Array<{
    from: string;
    to: string;
    type: string;
    found: EdgeContext;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
    versionDescription?: string;
  }>;
  hotspots: Array<{ path: string; drift_count: number }>;
  conventionDrift?: {
    dominantConvention: NamingConvention;
    driftPercent: number;
    driftSymbols: Array<{
      symbolId: string;
      name: string;
      convention: NamingConvention;
      suggestedName: string;
      path: string;
    }>;
    importDrift?: {
      dominantStyle: string;
      driftPercent: number;
      driftImports: Array<{
        file: string;
        line: number;
        importPath: string;
        style: string;
      }>;
    };
    fileNamingDrift?: {
      dominantStyle: FileNamingConvention['style'];
      driftPercent: number;
      driftFiles: Array<{
        path: string;
        style: FileNamingConvention['style'];
        filename: string;
      }>;
    };
  };
  mixedConventionFiles?: Array<{
    path: string;
    conventions: NamingConvention[];
    symbolCount: number;
    driftPercent: number;
  }>;
  divergentClusters?: Array<Set<SymbolContext>>;
  suggestedConsolidations?: Array<{ symbols: string[]; similarity: number }>;
  unresolved_callers?: Array<UnresolvedCallerFact>;
  /**
   * Hybrid drifts: CST facts that have changed or are missing
   * For CST-only languages and hybrid augmentation
   */
  hybridDrifts?: Array<{
    fact: HybridFact;
    type: 'missing' | 'zombie' | 'divergent' | 'modified';
    expected?: IntendedState;
    timelineDelta?: Array<{ version: string; delta: any }>;
    introducedAtVersion?: string;
    resolvedAtVersion?: string;
  }>;
}

export interface UnresolvedCallerFact {
  caller_symbol_id?: string;
  caller_name?: string;
  caller_path?: string;
  caller_line?: number;
  callee_name: string;
  guessed_target_dna_id?: string | null;
  occurrence_count: number;
  severity: number;
}
