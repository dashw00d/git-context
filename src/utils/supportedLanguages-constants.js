// Constants for supported languages - shared between main app and download-wasm.js
// This file should be kept in sync with EXT_TO_LANG_MAP in supportedLanguages.ts

const SUPPORTED_LANGUAGES = ['typescript', 'javascript', 'php'];

const WASM_URLS = {
  'typescript': 'https://unpkg.com/tree-sitter-wasms/out/tree-sitter-typescript.wasm',
  'javascript': 'https://unpkg.com/tree-sitter-wasms/out/tree-sitter-javascript.wasm',
  'php': 'https://unpkg.com/tree-sitter-wasms/out/tree-sitter-php.wasm'
};

module.exports = {
  SUPPORTED_LANGUAGES,
  WASM_URLS
};
