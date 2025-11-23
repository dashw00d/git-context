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
exports.getTreeSitterParser = exports.TreeSitterParser = exports.detectLanguage = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Use require to avoid type issues with web-tree-sitter
const { Parser, Language } = require('web-tree-sitter');
// Language detection based on file extension
function detectLanguage(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'php':
            return 'php';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'js':
        case 'jsx':
            return 'javascript';
        default:
            return null;
    }
}
exports.detectLanguage = detectLanguage;
class TreeSitterParser {
    constructor() {
        this.parsers = new Map();
        this.initialized = false;
    }
    async initializeParsers() {
        if (this.initialized)
            return;
        try {
            await Parser.init();
            // Load languages
            const languages = ['typescript', 'javascript', 'php'];
            for (const lang of languages) {
                // Look for WASM in the out directory (where it's copied/downloaded to)
                const wasmPath = path.join(__dirname, '..', '..', 'out', `tree-sitter-${lang}.wasm`);
                if (fs.existsSync(wasmPath)) {
                    const language = await Language.load(wasmPath);
                    const parser = new Parser();
                    parser.setLanguage(language);
                    this.parsers.set(lang, parser);
                }
                else {
                    // Fallback to checking root if not in out yet (dev mode)
                    const rootWasmPath = path.join(__dirname, '..', '..', `tree-sitter-${lang}.wasm`);
                    if (fs.existsSync(rootWasmPath)) {
                        const language = await Language.load(rootWasmPath);
                        const parser = new Parser();
                        parser.setLanguage(language);
                        this.parsers.set(lang, parser);
                    }
                    else {
                        console.warn(`Language WASM not found: ${wasmPath}`);
                    }
                }
            }
            this.initialized = true;
        }
        catch (error) {
            console.error('Failed to initialize tree-sitter parsers:', error);
            // Don't throw, just log. This allows the extension to work without tree-sitter
        }
    }
    getParser(languageId) {
        // Map VS Code language IDs to tree-sitter languages
        const map = {
            'typescript': 'typescript',
            'typescriptreact': 'typescript',
            'javascript': 'javascript',
            'javascriptreact': 'javascript',
            'php': 'php'
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
    extractSymbolFromNode(node, filePath, language) {
        switch (language) {
            case 'php':
                return this.extractPHPSymbol(node, filePath);
            case 'typescript':
            case 'javascript':
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
//# sourceMappingURL=tree-sitter.js.map