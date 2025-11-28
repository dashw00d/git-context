import * as path from 'path';
import * as fs from 'fs';
import { SymbolInfo, HybridFact } from '../types';
import { detectLanguage, getSupportedLanguages, LANGUAGES, getExtensionConfig, isCstOnlyLanguage } from '../utils/config';
import { CstExtractor } from './cstExtractor';

// Use require to avoid type issues with web-tree-sitter
const { Parser, Language } = require('web-tree-sitter');

export class TreeSitterParser {
  private parsers: Map<string, any> = new Map();
  private initialized = false;
  private cstExtractor = new CstExtractor();

  async initializeParsers(): Promise<void> {
    if (this.initialized) return;

    try {
      await Parser.init();

      // Load configured languages
      const languages = getSupportedLanguages();
      const failed: string[] = [];

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
          } else {
            // Fallback to checking old location for migration
            const oldWasmPath = path.join(__dirname, '..', '..', 'out', `tree-sitter-${lang}.wasm`);
            if (fs.existsSync(oldWasmPath)) {
              const language = await Language.load(oldWasmPath);
              const parser = new Parser();
              parser.setLanguage(language);
              this.parsers.set(lang, parser);
              console.log(`✓ Loaded tree-sitter parser for ${lang} (from old location)`);
            } else {
              failed.push(lang);
              console.warn(`✗ Language WASM not found for ${lang}, skipping`);
            }
          }
        } catch (error) {
          failed.push(lang);
          console.error(`✗ Failed to load tree-sitter parser for ${lang}:`, error);
        }
      }

      this.initialized = true;
      console.log(`Tree-sitter initialized with ${this.parsers.size} parsers`);

      if (failed.length > 0) {
        console.warn(`[TreeSitter] Failed to load ${failed.length} language(s): ${failed.join(', ')}`);
      }
    } catch (error) {
      console.error('Failed to initialize tree-sitter parsers:', error);
      // Don't throw, just log. This allows the extension to work without tree-sitter
    }
  }

  getParser(languageId: string): any | undefined {
    // Map VS Code language IDs to tree-sitter languages
    const map: Record<string, string> = {
      'typescript': LANGUAGES.TYPESCRIPT,
      'typescriptreact': LANGUAGES.TYPESCRIPT,
      'javascript': LANGUAGES.JAVASCRIPT,
      'javascriptreact': LANGUAGES.JAVASCRIPT,
      'php': LANGUAGES.PHP
    };

    const lang = map[languageId] || languageId;
    return this.parsers.get(lang);
  }

  async parse(content: string, languageId: string): Promise<any | undefined> {
    if (!this.initialized) {
      await this.initializeParsers();
    }

    const parser = this.getParser(languageId);
    if (!parser) return undefined;

    return parser.parse(content);
  }

  // Compatibility method for symbols.ts
  async parseFile(content: string, languageId: string): Promise<any | null> {
    const tree = await this.parse(content, languageId);
    return tree || null;
  }

  extractSymbols(tree: any, filePath: string, language: string): SymbolInfo[] {
    const symbols: SymbolInfo[] = [];

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
  extractHybridFacts(tree: any, filePath: string, language: string): HybridFact[] {
    const config = getExtensionConfig();
    const isCstOnly = isCstOnlyLanguage(language);
    const enableAugment = config.enableCstAugmentation ?? false;
    const enableCst = config.enableCstTracking ?? true;

    // Extract semantic symbols first (if not CST-only)
    const symbols: SymbolInfo[] = isCstOnly ? [] : this.extractSymbols(tree, filePath, language);

    // Extract CST facts if enabled
    const cstFacts = (enableCst || enableAugment) 
      ? this.cstExtractor.extractCstFacts(tree, filePath, language, symbols)
      : [];

    // Merge: for CST-only, return only CST facts; for hybrid, return both
    return [...symbols, ...cstFacts] as HybridFact[];
  }

  private extractSymbolFromNode(node: any, filePath: string, language: string): SymbolInfo | null {
    switch (language) {
      case LANGUAGES.PHP:
        return this.extractPHPSymbol(node, filePath);
      case LANGUAGES.TYPESCRIPT:
      case LANGUAGES.JAVASCRIPT:
        return this.extractJSSymbol(node, filePath, language);
      default:
        return null;
    }
  }

  private extractPHPSymbol(node: any, filePath: string): SymbolInfo | null {
    // PHP symbol extraction - simplified version
    if (node.type === 'function_definition') {
      // Find name in child nodes
      for (const child of node.children) {
        if (child.type === 'name') {
          const name = child.text;
          const signature = this.extractPHPSignature(node);
          return {
            id: `function_${name}`,
            dnaId: `function_${name}`, // Temporary - will be replaced by DNA computation
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
            dnaId: `class_${name}`, // Temporary - will be replaced by DNA computation
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
            dnaId: `method_${name}`, // Temporary - will be replaced by DNA computation
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
            dnaId: `const_${name}`, // Temporary - will be replaced by DNA computation
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

  private extractJSSymbol(node: any, filePath: string, language: string): SymbolInfo | null {
    // JavaScript/TypeScript symbol extraction - simplified version
    if (node.type === 'function_declaration') {
      for (const child of node.children) {
        if (child.type === 'identifier') {
          const name = child.text;
          const signature = this.extractJSSignature(node, language);
          return {
            id: `function_${name}`,
            dnaId: `function_${name}`, // Temporary - will be replaced by DNA computation
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
            dnaId: `class_${name}`, // Temporary - will be replaced by DNA computation
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
            dnaId: `method_${name}`, // Temporary - will be replaced by DNA computation
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
                dnaId: `const_${name}`, // Temporary - will be replaced by DNA computation
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

  private extractPHPSignature(node: any): string {
    // Extract function/method signature from PHP node - simplified
    return node.text.split('{')[0].trim(); // Take everything before the body
  }

  private extractJSSignature(node: any, language: string): string {
    // Extract function/method signature from JS/TS node - simplified
    return node.text.split('{')[0].trim(); // Take everything before the body
  }

  dispose(): void {
    // Clean up parsers
    this.parsers.clear();
  }
}

// Singleton instance
let parserInstance: TreeSitterParser | null = null;

export function getTreeSitterParser(): TreeSitterParser {
  if (!parserInstance) {
    parserInstance = new TreeSitterParser();
  }
  return parserInstance;
}
