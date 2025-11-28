// node-cache uses CommonJS export; use require style to avoid default import issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
import NodeCache = require('node-cache');
import { getExtensionConfig, getPackageJsonDefault } from './config';

// Language name constants
export const LANGUAGES = {
  PHP: 'php',
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript'
} as const;

// Direct mapping: extension -> tree-sitter language name
export const EXT_TO_LANG_MAP: Record<string, string> = {
  'php': LANGUAGES.PHP,
  'js': LANGUAGES.JAVASCRIPT,
  'jsx': LANGUAGES.JAVASCRIPT,
  'ts': LANGUAGES.TYPESCRIPT,
  'tsx': LANGUAGES.TYPESCRIPT
};

// Cache for expensive operations (TTL: 5 minutes)
const cache = new NodeCache({ stdTTL: 300 });

/**
 * Get validated extensions from config, with fallback to defaults
 */
export function getSupportedExtensions(): string[] {
  const cacheKey = 'supportedExtensions';
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  const config = getExtensionConfig();
  // Get defaults from package.json if not in config
  const defaultExts = getPackageJsonDefault('allowedExtensions') || ['php', 'js', 'ts', 'tsx', 'jsx'];
  const exts = config.allowedExtensions || defaultExts;

  // Validate: filter out invalid extensions
  const validExts = exts.filter((ext: any) => {
    if (typeof ext !== 'string' || !ext.trim()) return false;
    const lowerExt = ext.toLowerCase().trim();
    return EXT_TO_LANG_MAP[lowerExt] !== undefined;
  }).map((ext: string) => ext.toLowerCase().trim());

  if (validExts.length === 0) {
    console.warn('[Config] No valid extensions found, using defaults from package.json');
    cache.set(cacheKey, defaultExts);
    return defaultExts;
  }

  cache.set(cacheKey, validExts);
  return validExts;
}

/**
 * Get unique tree-sitter languages for configured extensions
 */
export function getSupportedLanguages(): string[] {
  const cacheKey = 'supportedLanguages';
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  const exts = getSupportedExtensions();
  const languages = [...new Set(exts.map(ext => EXT_TO_LANG_MAP[ext]))];

  cache.set(cacheKey, languages);
  return languages;
}

/**
 * Get dynamic regex pattern for test files based on configured extensions
 */
export function getTestFilePattern(): RegExp {
  const cacheKey = 'testFilePattern';
  const cached = cache.get<RegExp>(cacheKey);
  if (cached) return cached;

  const exts = getSupportedExtensions().join('|');
  const pattern = new RegExp(`test.*\\.(${exts})$|spec.*\\.(${exts})$|\\.\\.(test|spec)\\.(${exts})$`, 'i');

  cache.set(cacheKey, pattern);
  return pattern;
}

/**
 * Detect tree-sitter language from file path
 */
export function detectLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  return EXT_TO_LANG_MAP[ext] || null;
}

/**
 * Clear internal cache (called on config changes)
 */
export function invalidateCache(): void {
  cache.flushAll();
}

/**
 * Check if language is a JavaScript-like language (javascript or typescript)
 */
export function isJSLanguage(language: string): boolean {
  return language === LANGUAGES.JAVASCRIPT || language === LANGUAGES.TYPESCRIPT;
}

/**
 * Check if language is PHP
 */
export function isPHPLanguage(language: string): boolean {
  return language === LANGUAGES.PHP;
}

/**
 * Get all JS-like languages (javascript, typescript)
 */
export function getJSLanguages(): string[] {
  return [LANGUAGES.JAVASCRIPT, LANGUAGES.TYPESCRIPT];
}
