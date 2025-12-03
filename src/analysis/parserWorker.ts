import * as fs from 'fs';
import * as path from 'path';
import { parentPort } from 'worker_threads';
import { SymbolInfo } from '../types';
import { isCstOnlyLanguage, LANGUAGES } from '../utils/config';
import { logWarn } from '../utils/logger';
import { CstExtractor } from './cstExtractor';
const { Parser, Language } = require('web-tree-sitter');

let isInitialized = false;
const parsers = new Map<string, any>();
const cstExtractor = new CstExtractor();

type WorkerMessage =
  | { type: 'init'; wasmDir: string; languages: string[] }
  | {
      type: 'parse';
      id: number;
      content: string;
      languageId: string;
      filePath: string;
      extractHybrid?: boolean;
      existingSymbols?: SymbolInfo[];
    }
  | { type: 'serialize'; id: number; content: string; languageId: string; maxDepth?: number };

function serializeNode(node: any, depth: number): any {
  const serialized: any = {
    type: node.type,
    range: [node.startPosition.row + 1, node.endPosition.row + 1],
  };

  if (node.childCount === 0 || isInterestingNode(node.type)) {
    const text = node.text;
    if (text.length > 200) {
      serialized.text = text.substring(0, 200) + '...';
    } else {
      serialized.text = text;
    }
  }

  if (depth > 0 && node.childCount > 0) {
    const children = [];
    for (const child of node.children) {
      if (child.isNamed) {
        children.push(serializeNode(child, depth - 1));
      }
    }
    if (children.length > 0) {
      serialized.children = children;
    }
  }

  return serialized;
}

function isInterestingNode(type: string): boolean {
  return [
    'identifier',
    'string',
    'string_literal',
    'number',
    'integer',
    'property_identifier',
    'type_identifier',
    'variable_name',
    'method_name',
    'class_name',
  ].includes(type);
}

function extractSymbolFromNode(node: any, filePath: string, language: string): SymbolInfo | null {
  if (language === LANGUAGES.PHP) {
    if (node.type === 'function_definition' || node.type === 'method_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        return {
          id: `${node.type === 'method_declaration' ? 'method' : 'function'}_${name}`, // Temporary ID, will be replaced by DNA
          filePath,
          name,
          kind: node.type === 'method_declaration' ? 'method' : 'function',
          signature: node.text.split('{')[0].trim(),
          location: {
            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
            end: { line: node.endPosition.row + 1, column: node.endPosition.column },
          },
        };
      }
    }
    if (node.type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        return {
          id: `class_${name}`, // Temporary ID, will be replaced by DNA
          filePath,
          name,
          kind: 'class',
          signature: `class ${name}`,
          location: {
            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
            end: { line: node.endPosition.row + 1, column: node.endPosition.column },
          },
        };
      }
    }
  } else if (language === LANGUAGES.TYPESCRIPT || language === LANGUAGES.JAVASCRIPT) {
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        return {
          id: `${node.type === 'method_definition' ? 'method' : 'function'}_${name}`, // Temporary ID, will be replaced by DNA
          filePath,
          name,
          kind: node.type === 'method_definition' ? 'method' : 'function',
          signature: node.text.split('{')[0].trim(),
          location: {
            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
            end: { line: node.endPosition.row + 1, column: node.endPosition.column },
          },
        };
      }
    }
    if (node.type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        return {
          id: `class_${name}`, // Temporary ID, will be replaced by DNA
          filePath,
          name,
          kind: 'class',
          signature: `class ${name}`,
          location: {
            start: { line: node.startPosition.row + 1, column: node.startPosition.column },
            end: { line: node.endPosition.row + 1, column: node.endPosition.column },
          },
        };
      }
    }
  }
  return null;
}

function extractSymbols(tree: any, filePath: string, language: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const cursor = tree.walk();

  while (true) {
    const node = cursor.currentNode;
    const symbol = extractSymbolFromNode(node, filePath, language);
    if (symbol) {
      symbols.push(symbol);
    }

    if (cursor.gotoFirstChild()) continue;
    while (!cursor.gotoNextSibling()) {
      if (!cursor.gotoParent()) return symbols;
    }
  }
}

async function initialize(wasmDir: string, languages: string[]) {
  if (isInitialized) return;

  try {
    await Parser.init();

    for (const lang of languages) {
      try {
        const wasmPath = path.join(wasmDir, `tree-sitter-${lang}.wasm`);
        if (fs.existsSync(wasmPath)) {
          const language = await Language.load(wasmPath);
          const parser = new Parser();
          parser.setLanguage(language);
          parsers.set(lang, parser);
        }
      } catch (error) {
        logWarn(`Failed to load ${lang}: ${error}`);
      }
    }

    isInitialized = true;
    parentPort?.postMessage({ type: 'initialized', success: true });
  } catch (error) {
    parentPort?.postMessage({ type: 'initialized', success: false, error: String(error) });
  }
}

parentPort?.on('message', async (msg: WorkerMessage) => {
  if (msg.type === 'init') {
    await initialize(msg.wasmDir, msg.languages);
  } else if (msg.type === 'parse') {
    if (!isInitialized) {
      parentPort?.postMessage({ type: 'result', id: msg.id, error: 'Worker not initialized' });
      return;
    }

    const parser = parsers.get(msg.languageId);
    if (!parser) {
      parentPort?.postMessage({
        type: 'result',
        id: msg.id,
        error: `No parser for ${msg.languageId}`,
      });
      return;
    }

    try {
      const tree = parser.parse(msg.content);

      const result: any = {};

      if (msg.extractHybrid) {
        const isCstOnly = isCstOnlyLanguage(msg.languageId);
        const symbols =
          msg.existingSymbols ||
          (isCstOnly ? [] : extractSymbols(tree, msg.filePath, msg.languageId));
        const cstFacts = cstExtractor.extractCstFacts(tree, msg.filePath, msg.languageId, symbols);
        result.hybridFacts = [...symbols, ...cstFacts];
      } else {
        result.symbols = extractSymbols(tree, msg.filePath, msg.languageId);
      }

      tree.delete();
      parentPort?.postMessage({ type: 'result', id: msg.id, data: result });
    } catch (error) {
      parentPort?.postMessage({ type: 'result', id: msg.id, error: String(error) });
    }
  } else if (msg.type === 'serialize') {
    if (!isInitialized) {
      parentPort?.postMessage({ type: 'result', id: msg.id, error: 'Worker not initialized' });
      return;
    }
    const parser = parsers.get(msg.languageId);
    if (!parser) {
      parentPort?.postMessage({
        type: 'result',
        id: msg.id,
        error: `No parser for ${msg.languageId}`,
      });
      return;
    }
    try {
      const tree = parser.parse(msg.content);
      const serialized = serializeNode(tree.rootNode, msg.maxDepth || 5);
      tree.delete();
      parentPort?.postMessage({ type: 'result', id: msg.id, data: serialized });
    } catch (error) {
      parentPort?.postMessage({ type: 'result', id: msg.id, error: String(error) });
    }
  }
});
