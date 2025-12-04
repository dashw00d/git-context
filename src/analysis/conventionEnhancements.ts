import * as path from 'path';
import { FileNamingConvention, ImportPathConvention, ImportPathStyle } from '../types/convention';
import { getSupportedExtensions, isJSLanguage, isPHPLanguage } from '../utils/config';

export { FileNamingConvention, ImportPathConvention, ImportPathStyle };

export function detectImportPathStyle(importPath: string): ImportPathStyle {
  if (!importPath) return 'package';

  if (!importPath.includes('/') && !importPath.includes('\\')) {
    return 'package';
  }

  if (importPath.startsWith('@/')) {
    return 'alias';
  }

  if (importPath.startsWith('@') && importPath[1] !== '/') {
    return 'package';
  }

  if (importPath.startsWith('/')) {
    return 'absolute';
  }

  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    if (
      importPath.endsWith('/index') ||
      importPath.endsWith('/index.js') ||
      importPath.endsWith('/index.ts')
    ) {
      return 'index';
    }

    const ext = path.extname(importPath);
    const supportedExts = getSupportedExtensions();
    if (ext && !supportedExts.includes(ext.slice(1))) {
      return 'extension';
    }
    if (!ext || supportedExts.includes(ext.slice(1))) {
      return 'no-extension';
    }

    return 'relative';
  }

  return 'relative';
}

export function extractImportPaths(content: string, language: string): ImportPathConvention[] {
  const imports: ImportPathConvention[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (isJSLanguage(language)) {
      const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        imports.push({
          style: detectImportPathStyle(importMatch[1]),
          path: importMatch[1],
          line: i + 1,
        });
      }

      const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        imports.push({
          style: detectImportPathStyle(requireMatch[1]),
          path: requireMatch[1],
          line: i + 1,
        });
      }
    }

    if (isPHPLanguage(language)) {
      const useMatch = line.match(/^use\s+([^;]+);/);
      if (useMatch) {
        imports.push({
          style: 'package',
          path: useMatch[1],
          line: i + 1,
        });
      }

      const requireMatch = line.match(/(require|include)(_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        imports.push({
          style: detectImportPathStyle(requireMatch[3]),
          path: requireMatch[3],
          line: i + 1,
        });
      }
    }
  }

  return imports;
}

export function analyzeImportPathDrift(imports: ImportPathConvention[]): {
  dominantStyle: ImportPathStyle;
  styleCounts: Record<ImportPathStyle, number>;
  driftImports: ImportPathConvention[];
  driftPercent: number;
} {
  const counts: Record<ImportPathStyle, number> = {
    absolute: 0,
    relative: 0,
    alias: 0,
    package: 0,
    index: 0,
    extension: 0,
    'no-extension': 0,
  };

  for (const imp of imports) {
    counts[imp.style]++;
  }

  const dominant =
    (Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] as ImportPathStyle) || 'relative';

  const driftImports = imports.filter(imp => imp.style !== dominant);
  const total = imports.length;
  const driftPercent = total > 0 ? (driftImports.length / total) * 100 : 0;

  return {
    dominantStyle: dominant,
    styleCounts: counts,
    driftImports,
    driftPercent,
  };
}

export function detectFileNamingConvention(filePath: string): FileNamingConvention {
  const filename = path.basename(filePath, path.extname(filePath));

  const hasUnderscore = filename.includes('_');
  const hasHyphen = filename.includes('-');
  const hasUppercase = /[A-Z]/.test(filename);
  const startsUpper = /^[A-Z]/.test(filename);
  const allUpper = filename === filename.toUpperCase() && hasUnderscore;

  const dir = path.dirname(filePath);
  const dirParts = dir.split(path.sep).filter((part: string) => part.length > 0);
  const parentDir = dirParts.length > 0 ? dirParts[dirParts.length - 1] : '';
  const hasDirUnderscore = parentDir.includes('_');
  const hasDirHyphen = parentDir.includes('-');

  let style: FileNamingConvention['style'];

  if (allUpper) {
    style = 'SCREAMING_SNAKE';
  } else if (hasUnderscore && !hasUppercase) {
    style = 'snake_case';
  } else if (hasHyphen && !hasUppercase) {
    style = 'kebab-case';
  } else if (startsUpper && hasUppercase) {
    style = 'PascalCase';
  } else if (!startsUpper && hasUppercase) {
    style = 'camelCase';
  } else if ((hasUnderscore && hasUppercase) || (hasHyphen && hasUppercase)) {
    style = 'mixed';
  } else {
    if (hasDirUnderscore && !hasDirHyphen) {
      style = 'snake_case';
    } else if (hasDirHyphen && !hasDirUnderscore) {
      style = 'kebab-case';
    } else {
      style = 'camelCase';
    }
  }

  return {
    style,
    filename,
    path: filePath,
  };
}

export function extractParameterOrder(signature: string): string[] {
  const paramMatch = signature.match(/\(([^)]*)\)/);
  if (!paramMatch) return [];

  return paramMatch[1]
    .split(',')
    .map(p => {
      const name = p.trim().split(/[:=]/)[0].trim();
      return name;
    })
    .filter(p => p.length > 0);
}

export function compareParameterOrders(signatures: string[]): {
  consistent: boolean;
  commonOrder: string[];
  inconsistencies: Array<{
    signature: string;
    order: string[];
    deviation: number;
  }>;
} {
  if (signatures.length === 0) {
    return { consistent: true, commonOrder: [], inconsistencies: [] };
  }

  const orders = signatures.map(sig => extractParameterOrder(sig));

  const positionCounts = new Map<number, Map<string, number>>();

  for (const order of orders) {
    for (let i = 0; i < order.length; i++) {
      if (!positionCounts.has(i)) {
        positionCounts.set(i, new Map());
      }
      const counts = positionCounts.get(i)!;
      counts.set(order[i], (counts.get(order[i]) || 0) + 1);
    }
  }

  const commonOrder: string[] = [];
  for (let i = 0; i < Math.max(...orders.map(o => o.length)); i++) {
    const counts = positionCounts.get(i);
    if (counts) {
      const mostCommon = Array.from(counts.entries()).sort(([, a], [, b]) => b - a)[0]?.[0];
      if (mostCommon) {
        commonOrder.push(mostCommon);
      }
    }
  }

  const inconsistencies: Array<{
    signature: string;
    order: string[];
    deviation: number;
  }> = [];

  for (let i = 0; i < signatures.length; i++) {
    const order = orders[i];
    let deviation = 0;

    for (let j = 0; j < Math.min(order.length, commonOrder.length); j++) {
      if (order[j] !== commonOrder[j]) {
        deviation++;
      }
    }

    if (deviation > 0) {
      inconsistencies.push({
        signature: signatures[i],
        order,
        deviation,
      });
    }
  }

  return {
    consistent: inconsistencies.length === 0,
    commonOrder,
    inconsistencies,
  };
}

export function detectReturnTypeConvention(
  signature: string,
  _language: string
): {
  type: 'promise' | 'callback' | 'async' | 'sync' | 'unknown';
  returnType?: string;
} {
  if (signature.includes('Promise<') || signature.includes(': Promise')) {
    return { type: 'promise', returnType: 'Promise' };
  }

  if (signature.includes('async') || signature.startsWith('async')) {
    return { type: 'async', returnType: 'async' };
  }

  if (
    signature.includes('callback') ||
    signature.includes('cb') ||
    signature.match(/\(.*\)\s*=>/)
  ) {
    return { type: 'callback', returnType: 'callback' };
  }

  const returnTypeMatch = signature.match(/:\s*([A-Z][a-zA-Z0-9<>[\]]+)/);
  if (returnTypeMatch) {
    return { type: 'sync', returnType: returnTypeMatch[1] };
  }

  return { type: 'unknown' };
}
