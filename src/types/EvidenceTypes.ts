/**
 * Strict TypeScript interfaces for all evidence types used in bundle facts.
 * These types are shared between extension core and webview.
 */

export interface HotspotEvidence {
  path: string;
  file_path?: string;
  score: number;
  hotspot_score?: number;
  symbol_id?: string;
  count?: number;
  size?: number;
  added?: number;
  removed?: number;
}

export interface MissingSymbolEvidence {
  symbol_id: string;
  expected: string;
  path?: string;
  filePath?: string;
}

export interface ZombieSymbolEvidence {
  symbol_id: string;
  found: {
    name: string;
    kind: string;
  };
  path?: string;
  filePath?: string;
}

export interface DivergentSymbolEvidence {
  symbol_id?: string;
  symbolId?: string;
  path?: string;
  filePath?: string;
  [key: string]: any;
}

export interface DeadSymbolEvidence {
  symbol_id: string;
  name: string;
  kind: string;
  path?: string;
  filePath?: string;
}

export interface LegacyUsedSymbolEvidence {
  symbol_id: string;
  name: string;
  kind: string;
  path?: string;
  filePath?: string;
}

export interface ReplacedLeftoverEvidence {
  old: string;
  new: string;
  confidence: number;
}

export interface ConventionDriftSymbol {
  symbolId: string;
  name: string;
  convention: string;
  suggestedName: string;
  path: string;
}

export interface ImportDriftIssue {
  line: number;
  importPath: string;
  style: string;
  file?: string;
}

export interface FileNamingDriftFile {
  path: string;
  style: string;
}

export interface UnresolvedCallerEvidence {
  symbol_id?: string;
  symbolId?: string;
  caller_symbol_id?: string;
  name?: string;
  caller_name?: string;
  callee_name?: string;
  path?: string;
  filePath?: string;
  caller_path?: string;
  callerCount?: number;
  count?: number;
  occurrence_count?: number;
}

export interface MissingEdgeEvidence {
  from?: string;
  to?: string;
  [key: string]: any;
}

export interface ZombieEdgeEvidence {
  from?: string;
  to?: string;
  [key: string]: any;
}

export interface MovedLineageEvidence {
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
}

/**
 * Union type for all possible evidence items
 */
export type EvidenceItem =
  | HotspotEvidence
  | MissingSymbolEvidence
  | ZombieSymbolEvidence
  | DivergentSymbolEvidence
  | DeadSymbolEvidence
  | LegacyUsedSymbolEvidence
  | ReplacedLeftoverEvidence
  | ConventionDriftSymbol
  | ImportDriftIssue
  | FileNamingDriftFile
  | UnresolvedCallerEvidence
  | MissingEdgeEvidence
  | ZombieEdgeEvidence
  | MovedLineageEvidence;

/**
 * Typed evidence record structure
 */
export interface TypedEvidence {
  'scope.files'?: string[];
  'scope.blastRadius'?: string[];
  hotspots?: HotspotEvidence[];
  missing?: MissingSymbolEvidence[];
  zombies?: ZombieSymbolEvidence[];
  divergent?: DivergentSymbolEvidence[];
  dead?: DeadSymbolEvidence[];
  legacyUsed?: LegacyUsedSymbolEvidence[];
  replacedLeftovers?: ReplacedLeftoverEvidence[];
  'findings.incompleteness'?: {
    missing?: MissingSymbolEvidence[];
    zombies?: ZombieSymbolEvidence[];
    divergent?: DivergentSymbolEvidence[];
    missing_edges?: MissingEdgeEvidence[];
    zombie_edges?: ZombieEdgeEvidence[];
  };
  'findings.incompleteness.missing'?: MissingSymbolEvidence[];
  'findings.incompleteness.zombies'?: ZombieSymbolEvidence[];
  'findings.legacyAudit'?: {
    dead?: DeadSymbolEvidence[];
    legacyUsed?: LegacyUsedSymbolEvidence[];
    replacedLeftovers?: ReplacedLeftoverEvidence[];
  };
  'findings.patternDrift.conventionDrift'?: {
    dominantConvention?: string;
    driftPercent?: number;
    driftSymbols?: ConventionDriftSymbol[];
    importDrift?: {
      dominantStyle?: string;
      driftPercent?: number;
      driftImports?: ImportDriftIssue[];
    };
    fileNamingDrift?: {
      dominantStyle?: string;
      driftPercent?: number;
      driftFiles?: FileNamingDriftFile[];
    };
  };
  'findings.patternDrift.mixedConventionFiles'?: Array<{
    path: string;
    conventions: string[];
    driftPercent: number;
  }>;
  'findings.unresolvedCallers'?: UnresolvedCallerEvidence[];
  [key: string]: any; // Allow additional keys for flexibility
}
