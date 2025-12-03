import { LRUCache } from 'lru-cache';
import { getExtensionConfig, getPackageJsonDefault } from './config';
import { logWarn } from './logger';

function languageToConstantName(lang: string): string {
  return lang.toUpperCase().replace(/-/g, '_');
}

const LANGUAGE_CONFIG = {
  bash: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-bash.wasm',
    extensions: ['sh', 'bash'],
  },
  c: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-c.wasm',
    extensions: ['c', 'h'],
  },
  cpp: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-cpp.wasm',
    extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hxx'],
  },
  c_sharp: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@0.1.12/out/tree-sitter-c_sharp.wasm',
    extensions: ['cs'],
  },
  css: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-css.wasm',
    extensions: ['css'],
  },
  go: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-go.wasm',
    extensions: ['go'],
  },
  html: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-html.wasm',
    extensions: ['html', 'htm'],
  },
  java: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-java.wasm',
    extensions: ['java'],
  },
  javascript: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-javascript.wasm',
    extensions: ['js', 'jsx', 'mjs'],
    isJS: true,
  },
  json: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-json.wasm',
    extensions: ['json'],
  },
  php: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-php.wasm',
    extensions: ['php'],
  },
  python: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-python.wasm',
    extensions: ['py', 'pyw'],
  },
  ruby: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-ruby.wasm',
    extensions: ['rb'],
  },
  rust: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-rust.wasm',
    extensions: ['rs'],
  },
  scala: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-scala.wasm',
    extensions: ['scala', 'sc'],
  },
  tsx: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-tsx.wasm',
    extensions: ['tsx'],
    isJS: true,
  },
  typescript: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-typescript.wasm',
    extensions: ['ts'],
    isJS: true,
  },
  vue: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-vue.wasm',
    extensions: ['vue'],
    isJS: true,
  },
  svelte: {
    wasm: './binaries/tree-sitter-svelte.wasm',
    extensions: ['svelte'],
    isJS: true,
  },
  kotlin: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-kotlin.wasm',
    extensions: ['kt', 'kts'],
  },
  swift: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-swift.wasm',
    extensions: ['swift'],
  },
  yaml: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-yaml.wasm',
    extensions: ['yaml', 'yml'],
  },
  toml: {
    wasm: 'https://unpkg.com/tree-sitter-wasms@latest/out/tree-sitter-toml.wasm',
    extensions: ['toml'],
  },
  markdown: {
    wasm: 'https://github.com/tree-sitter-grammars/tree-sitter-markdown/releases/download/v0.5.1/tree-sitter-markdown.wasm',
    extensions: ['md', 'markdown'],
  },
  dockerfile: {
    wasm: 'https://unpkg.com/tree-sitter-wasms/out/tree-sitter-dockerfile.wasm',
    extensions: ['dockerfile', 'Dockerfile'],
  },
} as const;

type LanguageConfig = typeof LANGUAGE_CONFIG;
export type Language = keyof LanguageConfig;

export const WASM_URLS: Record<Language, string> = Object.fromEntries(
  Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => [lang, config.wasm])
) as Record<Language, string>;

type LangConstant = { [K in Uppercase<keyof LanguageConfig>]: Language };
export const LANGUAGES = Object.entries(LANGUAGE_CONFIG).reduce(
  (acc, [lang]) => {
    const constantName = languageToConstantName(lang);
    acc[constantName] = lang;
    return acc;
  },
  {} as Record<string, string>
) as LangConstant;

export const SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIG) as readonly Language[];

export const EXT_TO_LANG_MAP: Record<string, Language> = {};
for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
  for (const ext of config.extensions) {
    EXT_TO_LANG_MAP[ext] = lang as Language;
  }
}

const JSLANGUAGES = Object.entries(LANGUAGE_CONFIG)
  .filter(([, config]) => 'isJS' in config && config.isJS === true)
  .map(([lang]) => lang as Language);

const cache = new LRUCache<string, any>({
  max: 100,
  ttl: 300 * 1000,
});

export function getSupportedExtensions(): string[] {
  const cacheKey = 'supportedExtensions';
  const cached = cache.get(cacheKey) as string[] | undefined;
  if (cached) return cached;

  const config = getExtensionConfig();

  const defaultExts = getPackageJsonDefault('allowedExtensions') || [
    'php',
    'js',
    'ts',
    'tsx',
    'jsx',
    'json',
    'md',
    'css',
  ];
  const exts = config.allowedExtensions || defaultExts;

  const validExts = exts
    .filter((ext: any) => {
      if (typeof ext !== 'string' || !ext.trim()) return false;
      const lowerExt = ext.toLowerCase().trim();
      return EXT_TO_LANG_MAP[lowerExt] !== undefined;
    })
    .map((ext: string) => ext.toLowerCase().trim());

  if (validExts.length === 0) {
    logWarn('No valid extensions found, using defaults from package.json');
    cache.set(cacheKey, defaultExts);
    return defaultExts;
  }

  cache.set(cacheKey, validExts);
  return validExts;
}

export function getSupportedLanguages(): Language[] {
  const cacheKey = 'supportedLanguages';
  const cached = cache.get(cacheKey) as Language[] | undefined;
  if (cached) return cached;

  const exts = getSupportedExtensions();
  const languages = [...new Set(exts.map(ext => EXT_TO_LANG_MAP[ext]))] as Language[];

  cache.set(cacheKey, languages);
  return languages;
}

export function getTestFilePattern(): RegExp {
  const cacheKey = 'testFilePattern';
  const cached = cache.get(cacheKey) as RegExp | undefined;
  if (cached) return cached;

  const exts = getSupportedExtensions().join('|');

  const pattern = new RegExp(`(test|spec).*\\.(${exts})$|.*\\.(test|spec)\\.(${exts})$`, 'i');

  cache.set(cacheKey, pattern);
  return pattern;
}

export function detectLanguage(filePath: string): Language | null {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return null;

  return EXT_TO_LANG_MAP[ext] || null;
}

export function invalidateCache(): void {
  cache.clear();
}

export function isJSLanguage(language: string): boolean {
  return JSLANGUAGES.includes(language as Language);
}

export function isPHPLanguage(language: string): boolean {
  return language === 'php';
}

export function getJSLanguages(): Language[] {
  return [...JSLANGUAGES];
}

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

export function getMissingWasmFiles(extensions: string[]): Language[] {
  const requiredLanguages = getRequiredLanguagesForExtensions(extensions);

  return requiredLanguages;
}

export function getAugmentableLanguages(): Language[] {
  return [...SUPPORTED_LANGUAGES];
}

export function isCstOnlyLanguage(language: Language | string): boolean {
  const config = getExtensionConfig();
  const cstLangs = (config.cstLanguages || ['markdown', 'json', 'yaml', 'css']).map(l =>
    l.toLowerCase()
  );
  return cstLangs.includes(language.toLowerCase());
}
