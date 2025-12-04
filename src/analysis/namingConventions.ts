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

  const isSingleLowerWord = startsLower && !/[_A-Z-]/.test(name.slice(1));
  if (isSingleLowerWord) {
    return { convention: 'camelCase', confidence: 0.7, parts: [name] };
  }

  let parts: string[] = [];
  let convention: NamingConvention;
  let confidence = 0.9;

  if (allUpper) {
    convention = 'SCREAMING_SNAKE';
    parts = name.split('_').filter(Boolean);
  } else if (hasUnderscore && !hasUppercase) {
    convention = 'snake_case';
    parts = name.split('_').filter(Boolean);
  } else if (hasHyphen && !hasUppercase) {
    convention = 'kebab-case';
    parts = name.split('-').filter(Boolean);
  } else if (hasUnderscore && hasUppercase) {
    convention = 'mixed';
    confidence = 0.7;

    parts = name.split(/[_A-Z]/).filter(Boolean);

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
  } else if (startsUpper && hasUppercase) {
    convention = 'PascalCase';
    parts = name.split(/(?=[A-Z])/).filter(Boolean);
  } else if (startsLower && hasUppercase) {
    convention = 'camelCase';
    parts = name.split(/(?=[A-Z])/).filter(Boolean);
  } else if (/^[a-z]{1,3}[A-Z]/.test(name)) {
    convention = 'hungarian';
    confidence = 0.8;
    const match = name.match(/^([a-z]{1,3})(.+)$/);
    if (match) {
      parts = [match[1], ...match[2].split(/(?=[A-Z])/).filter(Boolean)];
    } else {
      parts = [name];
    }
  } else {
    convention = 'unknown';
    confidence = 0.5;
    parts = [name];
  }

  return { convention, confidence, parts };
}

export function suggestConventionName(name: string, targetConvention: NamingConvention): string {
  const profile = detectNamingConvention(name);
  const parts = profile.parts.length > 0 ? profile.parts : [name];

  const normalizedParts = parts.map(p => p.toLowerCase().trim()).filter(p => p.length > 0);

  if (normalizedParts.length === 0) {
    return name;
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

  for (const s of symbolConventions) {
    counts[s.profile.convention]++;
  }

  const conventionEntries = Object.entries(counts)
    .filter(([k]) => k !== 'unknown')
    .sort(([, a], [, b]) => b - a);

  const dominant = (conventionEntries[0]?.[0] as NamingConvention) || 'unknown';

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
