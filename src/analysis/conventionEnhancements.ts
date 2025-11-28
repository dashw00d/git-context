/**
 * Additional convention detection enhancements:
 * - Import path conventions
 * - File naming conventions
 * - Parameter order consistency
 * - Return type conventions
 */

import * as path from 'path';
import { getSupportedExtensions, isJSLanguage, isPHPLanguage } from '../utils/config';

export type ImportPathStyle = 
  | 'absolute'        // /src/components/Button
  | 'relative'        // ../components/Button
  | 'alias'           // @/components/Button
  | 'package'         // react, lodash
  | 'index'           // ./components/index
  | 'extension'       // ./Button.js
  | 'no-extension';   // ./Button

export interface ImportPathConvention {
  style: ImportPathStyle;
  path: string;
  line: number;
}

export interface FileNamingConvention {
  style: 'PascalCase' | 'camelCase' | 'kebab-case' | 'snake_case' | 'SCREAMING_SNAKE' | 'mixed';
  filename: string;
  path: string;
}

/**
 * Detect import path style from import statement
 */
export function detectImportPathStyle(importPath: string): ImportPathStyle {
  if (!importPath) return 'package';

  // Package imports (no path separators, or starts with package name)
  if (!importPath.includes('/') && !importPath.includes('\\')) {
    return 'package';
  }

  // Alias imports (@/something) - must be @/ specifically
  if (importPath.startsWith('@/')) {
    return 'alias';
  }

  // Scoped npm packages (@scope/package) - @ followed by non-slash
  if (importPath.startsWith('@') && importPath[1] !== '/') {
    return 'package';
  }

  // Absolute imports (starts with /)
  if (importPath.startsWith('/')) {
    return 'absolute';
  }

  // Relative imports (starts with .)
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    // Check for index file
    if (importPath.endsWith('/index') || importPath.endsWith('/index.js') || importPath.endsWith('/index.ts')) {
      return 'index';
    }
    
    // Check for extension
    const ext = path.extname(importPath);
    const supportedExts = getSupportedExtensions();
    if (ext && !supportedExts.includes(ext.slice(1))) { // Remove leading dot
      return 'extension';
    }
    if (!ext || supportedExts.includes(ext.slice(1))) {
      return 'no-extension';
    }
    
    return 'relative';
  }

  return 'relative'; // Default
}

/**
 * Extract import paths from code content
 */
export function extractImportPaths(content: string, language: string): ImportPathConvention[] {
  const imports: ImportPathConvention[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (isJSLanguage(language)) {
      // ES6 imports: import ... from 'path'
      const importMatch = line.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        imports.push({
          style: detectImportPathStyle(importMatch[1]),
          path: importMatch[1],
          line: i + 1
        });
      }

      // CommonJS: require('path')
      const requireMatch = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        imports.push({
          style: detectImportPathStyle(requireMatch[1]),
          path: requireMatch[1],
          line: i + 1
        });
      }
    }

    if (isPHPLanguage(language)) {
      // PHP use statements: use Namespace\Class;
      const useMatch = line.match(/^use\s+([^;]+);/);
      if (useMatch) {
        imports.push({
          style: 'package', // PHP namespaces are like packages
          path: useMatch[1],
          line: i + 1
        });
      }

      // PHP require/include: require('path')
      const requireMatch = line.match(/(require|include)(_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (requireMatch) {
        imports.push({
          style: detectImportPathStyle(requireMatch[3]),
          path: requireMatch[3],
          line: i + 1
        });
      }
    }
  }

  return imports;
}

/**
 * Analyze import path convention drift
 */
export function analyzeImportPathDrift(imports: ImportPathConvention[]): {
  dominantStyle: ImportPathStyle;
  styleCounts: Record<ImportPathStyle, number>;
  driftImports: ImportPathConvention[];
  driftPercent: number;
} {
  const counts: Record<ImportPathStyle, number> = {
    'absolute': 0,
    'relative': 0,
    'alias': 0,
    'package': 0,
    'index': 0,
    'extension': 0,
    'no-extension': 0
  };

  for (const imp of imports) {
    counts[imp.style]++;
  }

  const dominant = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] as ImportPathStyle || 'relative';

  const driftImports = imports.filter(imp => imp.style !== dominant);
  const total = imports.length;
  const driftPercent = total > 0 ? (driftImports.length / total) * 100 : 0;

  return {
    dominantStyle: dominant,
    styleCounts: counts,
    driftImports,
    driftPercent
  };
}

/**
 * Detect file naming convention
 */
export function detectFileNamingConvention(filePath: string): FileNamingConvention {
  const filename = path.basename(filePath, path.extname(filePath));
  const dir = path.dirname(filePath);

  // Analyze filename
  const hasUnderscore = filename.includes('_');
  const hasHyphen = filename.includes('-');
  const hasUppercase = /[A-Z]/.test(filename);
  const startsUpper = /^[A-Z]/.test(filename);
  const allUpper = filename === filename.toUpperCase() && hasUnderscore;

  // Analyze directory structure for path-based conventions
  // Check if parent directory follows a naming pattern that might influence file naming
  const dirParts = dir.split(path.sep).filter(part => part.length > 0);
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
    // If filename doesn't have clear pattern, check if directory suggests a convention
    if (hasDirUnderscore && !hasDirHyphen) {
      style = 'snake_case'; // Directory uses snake_case, likely convention
    } else if (hasDirHyphen && !hasDirUnderscore) {
      style = 'kebab-case'; // Directory uses kebab-case, likely convention
    } else {
      style = 'camelCase'; // Default
    }
  }

  return {
    style,
    filename,
    path: filePath
  };
}

/**
 * Extract parameter order from function signature
 */
export function extractParameterOrder(signature: string): string[] {
  // Extract parameters from signature
  // Handles: function name(param1: type, param2: type)
  //          (param1, param2) =>
  //          name(param1, param2)
  const paramMatch = signature.match(/\(([^)]*)\)/);
  if (!paramMatch) return [];

  return paramMatch[1]
    .split(',')
    .map(p => {
      // Extract parameter name (before colon or equals)
      const name = p.trim().split(/[:=]/)[0].trim();
      return name;
    })
    .filter(p => p.length > 0);
}

/**
 * Compare parameter orders for consistency
 */
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
  
  // Find most common order (by parameter name frequency at each position)
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

  // Build common order
  const commonOrder: string[] = [];
  for (let i = 0; i < Math.max(...orders.map(o => o.length)); i++) {
    const counts = positionCounts.get(i);
    if (counts) {
      const mostCommon = Array.from(counts.entries())
        .sort(([, a], [, b]) => b - a)[0]?.[0];
      if (mostCommon) {
        commonOrder.push(mostCommon);
      }
    }
  }

  // Find inconsistencies
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
        deviation
      });
    }
  }

  return {
    consistent: inconsistencies.length === 0,
    commonOrder,
    inconsistencies
  };
}

/**
 * Detect return type convention from signature
 */
export function detectReturnTypeConvention(signature: string, language: string): {
  type: 'promise' | 'callback' | 'async' | 'sync' | 'unknown';
  returnType?: string;
} {
  // Check for Promise<T>
  if (signature.includes('Promise<') || signature.includes(': Promise')) {
    return { type: 'promise', returnType: 'Promise' };
  }

  // Check for async keyword
  if (signature.includes('async') || signature.startsWith('async')) {
    return { type: 'async', returnType: 'async' };
  }

  // Check for callback pattern (function with callback parameter)
  if (signature.includes('callback') || signature.includes('cb') || 
      signature.match(/\(.*\)\s*=>/)) {
    return { type: 'callback', returnType: 'callback' };
  }

  // Check for explicit return type
  const returnTypeMatch = signature.match(/:\s*([A-Z][a-zA-Z0-9<>[\]]+)/);
  if (returnTypeMatch) {
    return { type: 'sync', returnType: returnTypeMatch[1] };
  }

  return { type: 'unknown' };
}

