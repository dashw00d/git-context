import * as fs from 'fs';
import * as path from 'path';
import { parentPort } from 'worker_threads';
import { SymbolInfo } from '../types';
import { isCstOnlyLanguage, LANGUAGES } from '../utils/config';
import { logError, logWarn } from '../utils/logger';
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
  const MAX_ITERATIONS = 100000; // Safety limit to prevent infinite loops
  let iterations = 0;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;
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

    if (iterations >= MAX_ITERATIONS) {
      logWarn(
        `[ParserWorker] Reached max iterations limit for ${filePath}, stopping symbol extraction early`
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (
      errorMsg.includes('Maximum call stack') ||
      errorMsg.includes('stack overflow') ||
      errorMsg.includes('RangeError')
    ) {
      logWarn(
        `[ParserWorker] Stack overflow in extractSymbols for ${filePath}, returning partial symbols`
      );
    } else {
      logError(`[ParserWorker] Error in extractSymbols for ${filePath}: ${errorMsg}`);
    }
  }

  return symbols;
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
      let tree: any;
      try {
        tree = parser.parse(msg.content);
      } catch (parseError) {
        const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        if (
          parseErrorMsg.includes('Maximum call stack') ||
          parseErrorMsg.includes('stack overflow') ||
          parseErrorMsg.includes('RangeError')
        ) {
          logWarn(`[ParserWorker] Stack overflow parsing ${msg.filePath}, returning empty result`);
          parentPort?.postMessage({
            type: 'result',
            id: msg.id,
            data: { symbols: [], hybridFacts: [] },
          });
          return;
        }
        logError(`[ParserWorker] Unexpected parse error for ${msg.filePath}:`, parseError);
        parentPort?.postMessage({
          type: 'result',
          id: msg.id,
          data: { symbols: [], hybridFacts: [] },
        });
        return;
      }

      const result: any = {};

      if (msg.extractHybrid) {
        const isCstOnly = isCstOnlyLanguage(msg.languageId);
        const symbols =
          msg.existingSymbols ||
          (isCstOnly ? [] : extractSymbols(tree, msg.filePath, msg.languageId));

        // Wrap CST extraction in try-catch for stack overflow
        let cstFacts: any[] = [];
        try {
          cstFacts = cstExtractor.extractCstFacts(tree, msg.filePath, msg.languageId, symbols);
        } catch (cstError) {
          const cstErrorMsg = cstError instanceof Error ? cstError.message : String(cstError);
          if (
            cstErrorMsg.includes('Maximum call stack') ||
            cstErrorMsg.includes('stack overflow') ||
            cstErrorMsg.includes('RangeError')
          ) {
            logWarn(
              `[ParserWorker] Stack overflow in CST extraction for ${msg.filePath}, skipping CST facts`
            );
            cstFacts = [];
          } else {
            logError(
              `[ParserWorker] Unexpected error in CST extraction for ${msg.filePath}:`,
              cstError
            );
            cstFacts = [];
          }
        }

        result.hybridFacts = [...symbols, ...cstFacts];
      } else {
        result.symbols = extractSymbols(tree, msg.filePath, msg.languageId);
      }

      tree.delete();
      parentPort?.postMessage({ type: 'result', id: msg.id, data: result });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check for stack overflow specifically
      if (
        errorMsg.includes('Maximum call stack') ||
        errorMsg.includes('stack overflow') ||
        errorMsg.includes('RangeError')
      ) {
        logWarn(`[ParserWorker] Stack overflow parsing ${msg.filePath}, returning empty result`);
        parentPort?.postMessage({
          type: 'result',
          id: msg.id,
          data: { symbols: [], hybridFacts: [] },
        });
      } else {
        parentPort?.postMessage({ type: 'result', id: msg.id, error: errorMsg });
      }
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
