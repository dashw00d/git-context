import { LRUCache } from 'lru-cache';
import { getExtensionConfig, getPackageJsonDefault } from './config';

/**
 * Convert language name to constant name (e.g., 'c_sharp' -> 'C_SHARP')
 */
function languageToConstantName(lang: string): string {
  return lang.toUpperCase().replace(/-/g, '_');
}

// Single source of truth for all supported languages
const LANGUAGE_CONFIG = {
  bash: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-bash.wasm',
    extensions: ['sh', 'bash']
  },
  c: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-c.wasm',
    extensions: ['c', 'h']
  },
  cpp: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-cpp.wasm',
    extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hxx']
  },
  c_sharp: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@0.1.12/out/tree-sitter-c_sharp.wasm',
    extensions: ['cs']
  },
  css: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-css.wasm',
    extensions: ['css']
  },
  go: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-go.wasm',
    extensions: ['go']
  },
  html: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-html.wasm',
    extensions: ['html', 'htm']
  },
  java: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-java.wasm',
    extensions: ['java']
  },
  javascript: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-javascript.wasm',
    extensions: ['js', 'jsx', 'mjs'],
    isJS: true
  },
  json: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-json.wasm',
    extensions: ['json']
  },
  php: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-php.wasm',
    extensions: ['php']
  },
  python: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-python.wasm',
    extensions: ['py', 'pyw']
  },
  ruby: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-ruby.wasm',
    extensions: ['rb']
  },
  rust: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-rust.wasm',
    extensions: ['rs']
  },
  scala: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-scala.wasm',
    extensions: ['scala', 'sc']
  },
  tsx: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-tsx.wasm',
    extensions: ['tsx'],
    isJS: true
  },
  typescript: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-typescript.wasm',
    extensions: ['ts'],
    isJS: true
  },
  vue: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-vue.wasm',
    extensions: ['vue'],
    isJS: true
  },
  svelte: {
    wasm: './binaries/tree-sitter-svelte.wasm',
    extensions: ['svelte'],
    isJS: true
  },
  kotlin: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-kotlin.wasm',
    extensions: ['kt', 'kts']
  },
  swift: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-swift.wasm',
    extensions: ['swift']
  },
  yaml: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-yaml.wasm',
    extensions: ['yaml', 'yml']
  },
  toml: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-toml.wasm',
    extensions: ['toml']
  },
  markdown: {
    wasm: 'https://github.com/tree-sitter-grammars/tree-sitter-markdown/releases/download/v0.5.1/tree-sitter-markdown.wasm',
    extensions: ['md', 'markdown']
  },
  dockerfile: {
    wasm: 'https://unpkg.com/tree-sitter-wasms/out/tree-sitter-dockerfile.wasm',
    extensions: ['dockerfile', 'Dockerfile']
  }
} as const;

type LanguageConfig = typeof LANGUAGE_CONFIG;
export type Language = keyof LanguageConfig;

// Generate WASM_URLS dynamically
export const WASM_URLS: Record<Language, string> = Object.fromEntries(
  Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => [lang, config.wasm])
) as Record<Language, string>;

// Dynamically generate language constants from LANGUAGE_CONFIG
// Type assertion ensures type safety with mapped uppercase keys
type LangConstant = { [K in Uppercase<keyof LanguageConfig>]: Language };
export const LANGUAGES = Object.entries(LANGUAGE_CONFIG).reduce((acc, [lang]) => {
  const constantName = languageToConstantName(lang);
  acc[constantName] = lang;
  return acc;
}, {} as Record<string, string>) as LangConstant;

// Supported languages array (for build scripts)
export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIG) as readonly Language[];

// Generate EXT_TO_LANG_MAP dynamically
export const EXT_TO_LANG_MAP: Record<string, Language> = {};
for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
  for (const ext of config.extensions) {
    EXT_TO_LANG_MAP[ext] = lang as Language;
  }
}

// JS-like languages (dynamic from config)
const JSLANGUAGES = Object.entries(LANGUAGE_CONFIG)
  .filter(([, config]) => 'isJS' in config && config.isJS === true)
  .map(([lang]) => lang as Language);

// Cache for expensive operations (TTL: 5 minutes)
const cache = new LRUCache<string, any>({
  max: 100,
  ttl: 300 * 1000 // 5 minutes in milliseconds
});

/**
 * Get validated extensions from config, with fallback to defaults
 */
export function getSupportedExtensions(): string[] {
  const cacheKey = 'supportedExtensions';
  const cached = cache.get(cacheKey) as string[] | undefined;
  if (cached) return cached;

  const config = getExtensionConfig();
  // Get defaults from package.json if not in config
  const defaultExts = getPackageJsonDefault('allowedExtensions') || ['php', 'js', 'ts', 'tsx', 'jsx', 'json', 'md', 'css'];
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
export function getSupportedLanguages(): Language[] {
  const cacheKey = 'supportedLanguages';
  const cached = cache.get(cacheKey) as Language[] | undefined;
  if (cached) return cached;

  const exts = getSupportedExtensions();
  const languages = [...new Set(exts.map(ext => EXT_TO_LANG_MAP[ext]))] as Language[];

  cache.set(cacheKey, languages);
  return languages;
}

/**
 * Get dynamic regex pattern for test files based on configured extensions
 */
export function getTestFilePattern(): RegExp {
  const cacheKey = 'testFilePattern';
  const cached = cache.get(cacheKey) as RegExp | undefined;
  if (cached) return cached;

  const exts = getSupportedExtensions().join('|');
  // Optimized pattern: matches test.*.ext, spec.*.ext, or *.test.ext, *.spec.ext
  // Uses 2 capture groups instead of 3 for better efficiency
  const pattern = new RegExp(`(test|spec).*\\.(${exts})$|.*\\.(test|spec)\\.(${exts})$`, 'i');

  cache.set(cacheKey, pattern);
  return pattern;
}

/**
 * Detect tree-sitter language from file path
 */
export function detectLanguage(filePath: string): Language | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  return EXT_TO_LANG_MAP[ext] || null;
}

/**
 * Clear internal cache (called on config changes)
 */
export function invalidateCache(): void {
  cache.clear();
}

/**
 * Check if language is a JavaScript-like language (javascript, typescript, or tsx)
 */
export function isJSLanguage(language: string): boolean {
  return JSLANGUAGES.includes(language as Language);
}

/**
 * Check if language is PHP
 */
export function isPHPLanguage(language: string): boolean {
  return language === 'php';
}

/**
 * Get all JS-like languages (javascript, typescript, tsx)
 */
export function getJSLanguages(): Language[] {
  return [...JSLANGUAGES];
}

/**
 * Get languages needed for configured extensions (for WASM download)
 * Returns array of language names that need WASM files
 */
export function getRequiredLanguagesForExtensions(extensions: string[]): Language[] {
  const requiredLanguages = new Set<Language>();
  
  for (const ext of extensions) {
    const lowerExt = ext.toLowerCase().trim();
    const lang = EXT_TO_LANG_MAP[lowerExt];
    if (lang) {
      requiredLanguages.add(lang);
    }
  }
  
  return Array.from(requiredLanguages);
}

/**
 * Get missing WASM files based on configured extensions
 * Returns array of language names that need to be downloaded
 */
export function getMissingWasmFiles(extensions: string[]): Language[] {
  const requiredLanguages = getRequiredLanguagesForExtensions(extensions);
  
  // Check which WASM files exist (this would need to be called from Node.js context)
  // For now, return all required languages - the download script will check file existence
  return requiredLanguages;
}

/**
 * Get languages that can be augmented with CST facts (hybrid mode)
 * Returns all SUPPORTED_LANGUAGES by default, optionally filtered by config
 */
export function getAugmentableLanguages(): Language[] {
  // All supported languages can be augmented with CST facts
  // This includes PHP, JS/TS, and others that have semantic symbols
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Check if a language is CST-only (no semantic symbols, only structural tracking)
 */
export function isCstOnlyLanguage(language: Language | string): boolean {
  const config = getExtensionConfig();
  const cstLangs = (config.cstLanguages || ['markdown', 'json', 'yaml', 'css']).map(l => l.toLowerCase());
  return cstLangs.includes(language.toLowerCase());
}
