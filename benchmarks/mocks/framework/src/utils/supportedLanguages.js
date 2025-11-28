"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCstOnlyLanguage = exports.getAugmentableLanguages = exports.getMissingWasmFiles = exports.getRequiredLanguagesForExtensions = exports.getJSLanguages = exports.isPHPLanguage = exports.isJSLanguage = exports.invalidateCache = exports.detectLanguage = exports.getTestFilePattern = exports.getSupportedLanguages = exports.getSupportedExtensions = exports.EXT_TO_LANG_MAP = exports.SUPPORTED_LANGUAGES = exports.LANGUAGES = exports.WASM_URLS = void 0;
const lru_cache_1 = require("lru-cache");
const config_1 = require("./config");
/**
 * Convert language name to constant name (e.g., 'c_sharp' -> 'C_SHARP')
 */
function languageToConstantName(lang) {
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
};
// Generate WASM_URLS dynamically
exports.WASM_URLS = Object.fromEntries(Object.entries(LANGUAGE_CONFIG).map(([lang, config]) => [lang, config.wasm]));
exports.LANGUAGES = Object.entries(LANGUAGE_CONFIG).reduce((acc, [lang]) => {
    const constantName = languageToConstantName(lang);
    acc[constantName] = lang;
    return acc;
}, {});
// Supported languages array (for build scripts)
exports.SUPPORTED_LANGUAGES = Object.keys(LANGUAGE_CONFIG);
// Generate EXT_TO_LANG_MAP dynamically
exports.EXT_TO_LANG_MAP = {};
for (const [lang, config] of Object.entries(LANGUAGE_CONFIG)) {
    for (const ext of config.extensions) {
        exports.EXT_TO_LANG_MAP[ext] = lang;
    }
}
// JS-like languages (dynamic from config)
const JSLANGUAGES = Object.entries(LANGUAGE_CONFIG)
    .filter(([, config]) => 'isJS' in config && config.isJS === true)
    .map(([lang]) => lang);
// Cache for expensive operations (TTL: 5 minutes)
const cache = new lru_cache_1.LRUCache({
    max: 100,
    ttl: 300 * 1000 // 5 minutes in milliseconds
});
/**
 * Get validated extensions from config, with fallback to defaults
 */
function getSupportedExtensions() {
    const cacheKey = 'supportedExtensions';
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const config = (0, config_1.getExtensionConfig)();
    // Get defaults from package.json if not in config
    const defaultExts = (0, config_1.getPackageJsonDefault)('allowedExtensions') || ['php', 'js', 'ts', 'tsx', 'jsx', 'json', 'md', 'css'];
    const exts = config.allowedExtensions || defaultExts;
    // Validate: filter out invalid extensions
    const validExts = exts.filter((ext) => {
        if (typeof ext !== 'string' || !ext.trim())
            return false;
        const lowerExt = ext.toLowerCase().trim();
        return exports.EXT_TO_LANG_MAP[lowerExt] !== undefined;
    }).map((ext) => ext.toLowerCase().trim());
    if (validExts.length === 0) {
        console.warn('[Config] No valid extensions found, using defaults from package.json');
        cache.set(cacheKey, defaultExts);
        return defaultExts;
    }
    cache.set(cacheKey, validExts);
    return validExts;
}
exports.getSupportedExtensions = getSupportedExtensions;
/**
 * Get unique tree-sitter languages for configured extensions
 */
function getSupportedLanguages() {
    const cacheKey = 'supportedLanguages';
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const exts = getSupportedExtensions();
    const languages = [...new Set(exts.map(ext => exports.EXT_TO_LANG_MAP[ext]))];
    cache.set(cacheKey, languages);
    return languages;
}
exports.getSupportedLanguages = getSupportedLanguages;
/**
 * Get dynamic regex pattern for test files based on configured extensions
 */
function getTestFilePattern() {
    const cacheKey = 'testFilePattern';
    const cached = cache.get(cacheKey);
    if (cached)
        return cached;
    const exts = getSupportedExtensions().join('|');
    // Optimized pattern: matches test.*.ext, spec.*.ext, or *.test.ext, *.spec.ext
    // Uses 2 capture groups instead of 3 for better efficiency
    const pattern = new RegExp(`(test|spec).*\\.(${exts})$|.*\\.(test|spec)\\.(${exts})$`, 'i');
    cache.set(cacheKey, pattern);
    return pattern;
}
exports.getTestFilePattern = getTestFilePattern;
/**
 * Detect tree-sitter language from file path
 */
function detectLanguage(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (!ext)
        return null;
    return exports.EXT_TO_LANG_MAP[ext] || null;
}
exports.detectLanguage = detectLanguage;
/**
 * Clear internal cache (called on config changes)
 */
function invalidateCache() {
    cache.clear();
}
exports.invalidateCache = invalidateCache;
/**
 * Check if language is a JavaScript-like language (javascript, typescript, or tsx)
 */
function isJSLanguage(language) {
    return JSLANGUAGES.includes(language);
}
exports.isJSLanguage = isJSLanguage;
/**
 * Check if language is PHP
 */
function isPHPLanguage(language) {
    return language === 'php';
}
exports.isPHPLanguage = isPHPLanguage;
/**
 * Get all JS-like languages (javascript, typescript, tsx)
 */
function getJSLanguages() {
    return [...JSLANGUAGES];
}
exports.getJSLanguages = getJSLanguages;
/**
 * Get languages needed for configured extensions (for WASM download)
 * Returns array of language names that need WASM files
 */
function getRequiredLanguagesForExtensions(extensions) {
    const requiredLanguages = new Set();
    for (const ext of extensions) {
        const lowerExt = ext.toLowerCase().trim();
        const lang = exports.EXT_TO_LANG_MAP[lowerExt];
        if (lang) {
            requiredLanguages.add(lang);
        }
    }
    return Array.from(requiredLanguages);
}
exports.getRequiredLanguagesForExtensions = getRequiredLanguagesForExtensions;
/**
 * Get missing WASM files based on configured extensions
 * Returns array of language names that need to be downloaded
 */
function getMissingWasmFiles(extensions) {
    const requiredLanguages = getRequiredLanguagesForExtensions(extensions);
    // Check which WASM files exist (this would need to be called from Node.js context)
    // For now, return all required languages - the download script will check file existence
    return requiredLanguages;
}
exports.getMissingWasmFiles = getMissingWasmFiles;
/**
 * Get languages that can be augmented with CST facts (hybrid mode)
 * Returns all SUPPORTED_LANGUAGES by default, optionally filtered by config
 */
function getAugmentableLanguages() {
    // All supported languages can be augmented with CST facts
    // This includes PHP, JS/TS, and others that have semantic symbols
    return [...exports.SUPPORTED_LANGUAGES];
}
exports.getAugmentableLanguages = getAugmentableLanguages;
/**
 * Check if a language is CST-only (no semantic symbols, only structural tracking)
 */
function isCstOnlyLanguage(language) {
    const config = (0, config_1.getExtensionConfig)();
    const cstLangs = (config.cstLanguages || ['markdown', 'json', 'yaml', 'css']).map(l => l.toLowerCase());
    return cstLangs.includes(language.toLowerCase());
}
exports.isCstOnlyLanguage = isCstOnlyLanguage;
