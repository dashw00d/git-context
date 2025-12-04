export type NamingConvention =
  | 'camelCase'
  | 'PascalCase'
  | 'snake_case'
  | 'SCREAMING_SNAKE'
  | 'kebab-case'
  | 'hungarian'
  | 'mixed'
  | 'unknown';

export interface ConventionProfile {
  convention: NamingConvention;
  confidence: number;
  parts: string[];
}

export interface ConventionDriftResult {
  dominantConvention: NamingConvention;
  conventionCounts: Record<NamingConvention, number>;
  driftSymbols: Array<{
    name: string;
    convention: NamingConvention;
    path: string;
    suggestedName: string;
  }>;
  driftPercent: number;
}
