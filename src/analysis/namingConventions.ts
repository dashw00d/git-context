/**
 * Naming convention detection and analysis
 * Detects naming patterns and identifies drift/inconsistencies
 */

export type NamingConvention =
  | 'camelCase' // getUserData
  | 'PascalCase' // GetUserData
  | 'snake_case' // get_user_data
  | 'SCREAMING_SNAKE' // GET_USER_DATA
  | 'kebab-case' // get-user-data (rare for symbols)
  | 'hungarian' // strUserData
  | 'mixed' // get_userData
  | 'unknown';

export interface ConventionProfile {
  convention: NamingConvention;
  confidence: number;
  parts: string[]; // ['get', 'User', 'Data']
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

/**
 * Detect naming convention from a symbol name
 */
export function detectNamingConvention(name: string): ConventionProfile {
  if (!name || name.length === 0) {
    return { convention: 'unknown', confidence: 0, parts: [] };
  }

  const hasUnderscore = name.includes('_');
  const hasUppercase = /[A-Z]/.test(name);
  const hasHyphen = name.includes('-');
  const startsLower = /^[a-z]/.test(name);
  const startsUpper = /^[A-Z]/.test(name);
  const allUpper = name === name.toUpperCase() && hasUnderscore;

  // Single-word lowercase names (e.g., form, table, handle)
  // Default to camelCase since that's the standard for methods in most languages
  const isSingleLowerWord = startsLower && !/[_A-Z-]/.test(name.slice(1));
  if (isSingleLowerWord) {
    return { convention: 'camelCase', confidence: 0.7, parts: [name] };
  }

  let parts: string[] = [];
  let convention: NamingConvention;
  let confidence = 0.9;

  // SCREAMING_SNAKE_CASE: All uppercase with underscores
  if (allUpper) {
    convention = 'SCREAMING_SNAKE';
    parts = name.split('_').filter(Boolean);
  }
  // snake_case: lowercase with underscores, no uppercase
  else if (hasUnderscore && !hasUppercase) {
    convention = 'snake_case';
    parts = name.split('_').filter(Boolean);
  }
  // kebab-case: lowercase with hyphens
  else if (hasHyphen && !hasUppercase) {
    convention = 'kebab-case';
    parts = name.split('-').filter(Boolean);
  }
  // mixed: combination (e.g., get_userData)
  else if (hasUnderscore && hasUppercase) {
    convention = 'mixed';
    confidence = 0.7;
    // Split on both underscores and uppercase transitions
    parts = name.split(/[_A-Z]/).filter(Boolean);
    // Reconstruct parts more intelligently
    const reconstructed: string[] = [];
    let current = '';
    for (let i = 0; i < name.length; i++) {
      const char = name[i];
      if (char === '_') {
        if (current) {
          reconstructed.push(current.toLowerCase());
          current = '';
        }
      } else if (/[A-Z]/.test(char) && current && i > 0) {
        reconstructed.push(current.toLowerCase());
        current = char;
      } else {
        current += char;
      }
    }
    if (current) {
      reconstructed.push(current.toLowerCase());
    }
    parts = reconstructed.filter(Boolean);
  }
  // PascalCase: Starts with uppercase, has uppercase transitions
  else if (startsUpper && hasUppercase) {
    convention = 'PascalCase';
    parts = name.split(/(?=[A-Z])/).filter(Boolean);
  }
  // camelCase: Starts with lowercase, has uppercase transitions
  else if (startsLower && hasUppercase) {
    convention = 'camelCase';
    parts = name.split(/(?=[A-Z])/).filter(Boolean);
  }
  // Hungarian notation: starts with lowercase type prefix (str, int, etc.)
  else if (/^[a-z]{1,3}[A-Z]/.test(name)) {
    convention = 'hungarian';
    confidence = 0.8;
    const match = name.match(/^([a-z]{1,3})(.+)$/);
    if (match) {
      parts = [match[1], ...match[2].split(/(?=[A-Z])/).filter(Boolean)];
    } else {
      parts = [name];
    }
  }
  // Unknown: single word or no clear pattern
  else {
    convention = 'unknown';
    confidence = 0.5;
    parts = [name];
  }

  return { convention, confidence, parts };
}

/**
 * Suggest a name following a target convention
 */
export function suggestConventionName(name: string, targetConvention: NamingConvention): string {
  const profile = detectNamingConvention(name);
  const parts = profile.parts.length > 0 ? profile.parts : [name];

  // Normalize parts (lowercase, remove empty)
  const normalizedParts = parts.map(p => p.toLowerCase().trim()).filter(p => p.length > 0);

  if (normalizedParts.length === 0) {
    return name; // Can't convert
  }

  switch (targetConvention) {
    case 'camelCase':
      return (
        normalizedParts[0] +
        normalizedParts
          .slice(1)
          .map(p => p.charAt(0).toUpperCase() + p.slice(1))
          .join('')
      );

    case 'PascalCase':
      return normalizedParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');

    case 'snake_case':
      return normalizedParts.join('_');

    case 'SCREAMING_SNAKE':
      return normalizedParts.map(p => p.toUpperCase()).join('_');

    case 'kebab-case':
      return normalizedParts.join('-');

    case 'hungarian':
      // Keep first part as prefix, rest as PascalCase
      if (normalizedParts.length > 1) {
        return (
          normalizedParts[0] +
          normalizedParts
            .slice(1)
            .map(p => p.charAt(0).toUpperCase() + p.slice(1))
            .join('')
        );
      }
      return normalizedParts[0];

    case 'mixed':
      // Use camelCase with underscores (uncommon, but handle it)
      return (
        normalizedParts[0] +
        '_' +
        normalizedParts
          .slice(1)
          .map(p => p.charAt(0).toUpperCase() + p.slice(1))
          .join('')
      );

    default:
      return name;
  }
}

/**
 * Analyze convention drift across a set of symbols
 */
export function analyzeConventionDrift(
  symbols: Array<{
    name: string;
    kind: string;
    path: string;
  }>
): ConventionDriftResult {
  const counts: Record<NamingConvention, number> = {
    camelCase: 0,
    PascalCase: 0,
    snake_case: 0,
    SCREAMING_SNAKE: 0,
    'kebab-case': 0,
    hungarian: 0,
    mixed: 0,
    unknown: 0,
  };

  const symbolConventions = symbols.map(s => ({
    ...s,
    profile: detectNamingConvention(s.name),
  }));

  // Count conventions
  for (const s of symbolConventions) {
    counts[s.profile.convention]++;
  }

  // Find dominant convention (excluding unknown)
  const conventionEntries = Object.entries(counts)
    .filter(([k]) => k !== 'unknown')
    .sort(([, a], [, b]) => b - a);

  const dominant = (conventionEntries[0]?.[0] as NamingConvention) || 'unknown';

  // Find symbols that don't match dominant
  const driftSymbols = symbolConventions
    .filter(s => s.profile.convention !== dominant && s.profile.convention !== 'unknown')
    .map(s => ({
      name: s.name,
      convention: s.profile.convention,
      path: s.path,
      suggestedName: suggestConventionName(s.name, dominant),
    }));

  const totalRelevant = Object.values(counts).reduce((a, b) => a + b, 0) - counts['unknown'];
  const driftPercent = totalRelevant > 0 ? (driftSymbols.length / totalRelevant) * 100 : 0;

  return {
    dominantConvention: dominant,
    conventionCounts: counts,
    driftSymbols,
    driftPercent,
  };
}
