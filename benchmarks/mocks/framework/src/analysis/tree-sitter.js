"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTreeSitterParser = exports.TreeSitterParser = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const config_1 = require("../utils/config");
const cstExtractor_1 = require("./cstExtractor");
// Use require to avoid type issues with web-tree-sitter
const { Parser, Language } = require('web-tree-sitter');
class TreeSitterParser {
    constructor() {
        this.parsers = new Map();
        this.initialized = false;
        this.cstExtractor = new cstExtractor_1.CstExtractor();
    }
    async initializeParsers() {
        if (this.initialized)
            return;
        try {
            await Parser.init();
            // Load configured languages
            const languages = (0, config_1.getSupportedLanguages)();
            const failed = [];
            for (const lang of languages) {
                try {
                    // Look for WASM in the out/wasm directory (where it's copied/downloaded to)
                    const wasmPath = path.join(__dirname, '..', '..', 'out', 'wasm', `tree-sitter-${lang}.wasm`);
                    if (fs.existsSync(wasmPath)) {
                        const language = await Language.load(wasmPath);
                        const parser = new Parser();
                        parser.setLanguage(language);
                        this.parsers.set(lang, parser);
                        console.log(`✓ Loaded tree-sitter parser for ${lang}`);
                    }
                    else {
                        // Fallback to checking old location for migration
                        const oldWasmPath = path.join(__dirname, '..', '..', 'out', `tree-sitter-${lang}.wasm`);
                        if (fs.existsSync(oldWasmPath)) {
                            const language = await Language.load(oldWasmPath);
                            const parser = new Parser();
                            parser.setLanguage(language);
                            this.parsers.set(lang, parser);
                            console.log(`✓ Loaded tree-sitter parser for ${lang} (from old location)`);
                        }
                        else {
                            failed.push(lang);
                            console.warn(`✗ Language WASM not found for ${lang}, skipping`);
                        }
                    }
                }
                catch (error) {
                    failed.push(lang);
                    console.error(`✗ Failed to load tree-sitter parser for ${lang}:`, error);
                }
            }
            this.initialized = true;
            console.log(`Tree-sitter initialized with ${this.parsers.size} parsers`);
            if (failed.length > 0) {
                console.warn(`[TreeSitter] Failed to load ${failed.length} language(s): ${failed.join(', ')}`);
            }
        }
        catch (error) {
            console.error('Failed to initialize tree-sitter parsers:', error);
            // Don't throw, just log. This allows the extension to work without tree-sitter
        }
    }
    getParser(languageId) {
        // Map VS Code language IDs to tree-sitter languages
        const map = {
            'typescript': config_1.LANGUAGES.TYPESCRIPT,
            'typescriptreact': config_1.LANGUAGES.TYPESCRIPT,
            'javascript': config_1.LANGUAGES.JAVASCRIPT,
            'javascriptreact': config_1.LANGUAGES.JAVASCRIPT,
            'php': config_1.LANGUAGES.PHP
        };
        const lang = map[languageId] || languageId;
        return this.parsers.get(lang);
    }
    async parse(content, languageId) {
        if (!this.initialized) {
            await this.initializeParsers();
        }
        const parser = this.getParser(languageId);
        if (!parser)
            return undefined;
        return parser.parse(content);
    }
    // Compatibility method for symbols.ts
    async parseFile(content, languageId) {
        const tree = await this.parse(content, languageId);
        return tree || null;
    }
    extractSymbols(tree, filePath, language) {
        const symbols = [];
        // Walk the tree and extract symbols
        const cursor = tree.walk();
        while (true) {
            const node = cursor.currentNode;
            // Extract symbols based on node type and language
            const symbol = this.extractSymbolFromNode(node, filePath, language);
            if (symbol) {
                symbols.push(symbol);
            }
            // Move to next node
            if (cursor.gotoFirstChild()) {
                continue;
            }
            while (!cursor.gotoNextSibling()) {
                if (!cursor.gotoParent()) {
                    return symbols; // Done walking
                }
            }
        }
    }
    /**
     * Extract hybrid facts (symbols + CST facts) for CST-only or hybrid augmentation
     */
    extractHybridFacts(tree, filePath, language) {
        const config = (0, config_1.getExtensionConfig)();
        const isCstOnly = (0, config_1.isCstOnlyLanguage)(language);
        const enableAugment = config.enableCstAugmentation ?? false;
        const enableCst = config.enableCstTracking ?? true;
        // Extract semantic symbols first (if not CST-only)
        const symbols = isCstOnly ? [] : this.extractSymbols(tree, filePath, language);
        // Extract CST facts if enabled
        const cstFacts = (enableCst || enableAugment)
            ? this.cstExtractor.extractCstFacts(tree, filePath, language, symbols)
            : [];
        // Merge: for CST-only, return only CST facts; for hybrid, return both
        return [...symbols, ...cstFacts];
    }
    extractSymbolFromNode(node, filePath, language) {
        switch (language) {
            case config_1.LANGUAGES.PHP:
                return this.extractPHPSymbol(node, filePath);
            case config_1.LANGUAGES.TYPESCRIPT:
            case config_1.LANGUAGES.JAVASCRIPT:
                return this.extractJSSymbol(node, filePath, language);
            default:
                return null;
        }
    }
    extractPHPSymbol(node, filePath) {
        // PHP symbol extraction - simplified version
        if (node.type === 'function_definition') {
            // Find name in child nodes
            for (const child of node.children) {
                if (child.type === 'name') {
                    const name = child.text;
                    const signature = this.extractPHPSignature(node);
                    return {
                        id: `function_${name}`,
                        dnaId: `function_${name}`,
                        name,
                        kind: 'function',
                        signature,
                        location: {
                            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                            end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                        }
                    };
                }
            }
        }
        if (node.type === 'class_declaration') {
            for (const child of node.children) {
                if (child.type === 'name') {
                    const name = child.text;
                    return {
                        id: `class_${name}`,
                        dnaId: `class_${name}`,
                        name,
                        kind: 'class',
                        signature: `class ${name}`,
                        location: {
                            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                            end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                        }
                    };
                }
            }
        }
        if (node.type === 'method_declaration') {
            for (const child of node.children) {
                if (child.type === 'name') {
                    const name = child.text;
                    const signature = this.extractPHPSignature(node);
                    return {
                        id: `method_${name}`,
                        dnaId: `method_${name}`,
                        name,
                        kind: 'method',
                        signature,
                        location: {
                            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                            end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                        }
                    };
                }
            }
        }
        if (node.type === 'const_declaration') {
            for (const child of node.children) {
                if (child.type === 'name') {
                    const name = child.text;
                    return {
                        id: `const_${name}`,
                        dnaId: `const_${name}`,
                        name,
                        kind: 'const',
                        signature: `const ${name}`,
                        location: {
                            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                            end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                        }
                    };
                }
            }
        }
        return null;
    }
    extractJSSymbol(node, filePath, language) {
        // JavaScript/TypeScript symbol extraction - simplified version
        if (node.type === 'function_declaration') {
            for (const child of node.children) {
                if (child.type === 'identifier') {
                    const name = child.text;
                    const signature = this.extractJSSignature(node, language);
                    return {
                        id: `function_${name}`,
                        dnaId: `function_${name}`,
                        name,
                        kind: 'function',
                        signature,
                        location: {
                            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                            end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                        }
                    };
                }
            }
        }
        if (node.type === 'class_declaration') {
            for (const child of node.children) {
                if (child.type === 'identifier') {
                    const name = child.text;
                    return {
                        id: `class_${name}`,
                        dnaId: `class_${name}`,
                        name,
                        kind: 'class',
                        signature: `class ${name}`,
                        location: {
                            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                            end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                        }
                    };
                }
            }
        }
        if (node.type === 'method_definition') {
            for (const child of node.children) {
                if (child.type === 'property_identifier') {
                    const name = child.text;
                    const signature = this.extractJSSignature(node, language);
                    return {
                        id: `method_${name}`,
                        dnaId: `method_${name}`,
                        name,
                        kind: 'method',
                        signature,
                        location: {
                            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                            end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                        }
                    };
                }
            }
        }
        if (node.type === 'variable_declaration' || node.type === 'lexical_declaration') {
            // Look for const declarations
            for (const child of node.children) {
                if (child.type === 'variable_declarator') {
                    for (const subChild of child.children) {
                        if (subChild.type === 'identifier' && node.text.startsWith('const')) {
                            const name = subChild.text;
                            return {
                                id: `const_${name}`,
                                dnaId: `const_${name}`,
                                name,
                                kind: 'const',
                                signature: `const ${name}`,
                                location: {
                                    start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                                    end: { line: node.endPosition.row + 1, column: node.endPosition.column }
                                }
                            };
                        }
                    }
                }
            }
        }
        return null;
    }
    extractPHPSignature(node) {
        // Extract function/method signature from PHP node - simplified
        return node.text.split('{')[0].trim(); // Take everything before the body
    }
    extractJSSignature(node, language) {
        // Extract function/method signature from JS/TS node - simplified
        return node.text.split('{')[0].trim(); // Take everything before the body
    }
    dispose() {
        // Clean up parsers
        this.parsers.clear();
    }
}
exports.TreeSitterParser = TreeSitterParser;
// Singleton instance
let parserInstance = null;
function getTreeSitterParser() {
    if (!parserInstance) {
        parserInstance = new TreeSitterParser();
    }
    return parserInstance;
}
exports.getTreeSitterParser = getTreeSitterParser;
