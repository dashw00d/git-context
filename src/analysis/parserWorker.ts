import * as fs from 'fs';
import * as path from 'path';
import { parentPort } from 'worker_threads';
import { SymbolInfo } from '../types';
import { isCstOnlyLanguage, LANGUAGES } from '../utils/config';
import { logDebug, logError, logWarn } from '../utils/logger';
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
    if (
      node.type === 'class_declaration' ||
      node.type === 'interface_declaration' ||
      node.type === 'trait_declaration'
    ) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        const kind: SymbolInfo['kind'] =
          node.type === 'class_declaration'
            ? 'class'
            : node.type === 'interface_declaration'
              ? 'interface'
              : 'trait';
        return {
          id: `${kind}_${name}`, // Temporary ID, will be replaced by DNA
          filePath,
          name,
          kind,
          signature: `${kind} ${name}`,
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
    if (
      node.type === 'class_declaration' ||
      node.type === 'interface_declaration' ||
      node.type === 'type_alias_declaration' ||
      node.type === 'enum_declaration'
    ) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        const name = nameNode.text;
        let kind: SymbolInfo['kind'] = 'class';
        if (node.type === 'interface_declaration') kind = 'interface';
        if (node.type === 'type_alias_declaration') kind = 'type';
        if (node.type === 'enum_declaration') kind = 'enum';

        return {
          id: `${kind}_${name}`, // Temporary ID, will be replaced by DNA
          filePath,
          name,
          kind,
          signature: node.text.split('{')[0].split('=')[0].trim(),
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

// Maximum reasonable symbol count for a source file
// Files with more symbols are likely minified/bundled and should be skipped
const MAX_REASONABLE_SYMBOLS = 1000;
// Maximum iterations to prevent infinite loops in malformed trees
const MAX_ITERATIONS = 500000;

// Return type to indicate if file was filtered
type ExtractSymbolsResult = {
  symbols: SymbolInfo[];
  wasFiltered: boolean;
};

function extractSymbols(tree: any, filePath: string, language: string): ExtractSymbolsResult {
  const startTime = Date.now();
  const symbols: SymbolInfo[] = [];
  const cursor = tree.walk();
  let iterations = 0;
  let completedSuccessfully = false;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const node = cursor.currentNode;
      const symbol = extractSymbolFromNode(node, filePath, language);
      if (symbol) {
        symbols.push(symbol);
        // Stop early if we've found too many symbols (likely minified/bundled file)
        if (symbols.length >= MAX_REASONABLE_SYMBOLS) {
          logWarn(
            `[ParserWorker] Reached symbol limit (${MAX_REASONABLE_SYMBOLS}) for ${filePath}, stopping symbol extraction early. Found ${symbols.length} symbols in ${Date.now() - startTime}ms (${iterations} iterations). File may be minified/bundled.`
          );
          // Return empty array to indicate this file should be filtered out
          return { symbols: [], wasFiltered: true };
        }
      }

      if (cursor.gotoFirstChild()) continue;
      while (!cursor.gotoNextSibling()) {
        if (!cursor.gotoParent()) {
          // Successfully completed traversal
          completedSuccessfully = true;
          logDebug(
            `[ParserWorker] extractSymbols completed for ${filePath}: ${symbols.length} symbols in ${Date.now() - startTime}ms (${iterations} iterations)`
          );
          return { symbols, wasFiltered: false };
        }
      }
    }

    // If we hit the limit, log a warning but return what we have
    if (iterations >= MAX_ITERATIONS) {
      logWarn(
        `[ParserWorker] Reached max iterations limit (${MAX_ITERATIONS}) for ${filePath}, stopping symbol extraction early. Found ${symbols.length} symbols in ${Date.now() - startTime}ms.`
      );
    }
  } catch (error) {
    const endTime = Date.now();
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (
      errorMsg.includes('Maximum call stack') ||
      errorMsg.includes('stack overflow') ||
      errorMsg.includes('RangeError')
    ) {
      logWarn(
        `[ParserWorker] Stack overflow in extractSymbols for ${filePath}, returning partial symbols (${symbols.length} found) in ${endTime - startTime}ms`
      );
    } else {
      logError(
        `[ParserWorker] Error in extractSymbols for ${filePath} (${endTime - startTime}ms): ${errorMsg}`
      );
    }
  } finally {
    // Always delete cursor to prevent memory leaks
    cursor.delete();
  }

  // Only log success message if we completed successfully
  if (completedSuccessfully) {
    const endTime = Date.now();
    logDebug(
      `[ParserWorker] extractSymbols finished for ${filePath}: ${symbols.length} symbols in ${endTime - startTime}ms (${iterations} iterations)`
    );
  }

  return { symbols, wasFiltered: false };
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

// Validation helpers
function validateParseMessage(msg: any): msg is Extract<WorkerMessage, { type: 'parse' }> {
  return (
    msg &&
    typeof msg === 'object' &&
    msg.type === 'parse' &&
    typeof msg.id === 'number' &&
    typeof msg.content === 'string' &&
    typeof msg.languageId === 'string' &&
    typeof msg.filePath === 'string'
  );
}

function validateSerializeMessage(msg: any): msg is Extract<WorkerMessage, { type: 'serialize' }> {
  return (
    msg &&
    typeof msg === 'object' &&
    msg.type === 'serialize' &&
    typeof msg.id === 'number' &&
    typeof msg.content === 'string' &&
    typeof msg.languageId === 'string'
  );
}

function validateInitMessage(msg: any): msg is Extract<WorkerMessage, { type: 'init' }> {
  return (
    msg &&
    typeof msg === 'object' &&
    msg.type === 'init' &&
    typeof msg.wasmDir === 'string' &&
    Array.isArray(msg.languages)
  );
}

// Cleanup function for worker termination
function cleanup(): void {
  parsers.clear();
  isInitialized = false;
}

// Handle worker termination
if (parentPort) {
  parentPort.once('close', cleanup);
}

parentPort?.on('message', async (msg: WorkerMessage) => {
  if (msg.type === 'init') {
    // Validate message structure
    if (!validateInitMessage(msg)) {
      parentPort?.postMessage({
        type: 'initialized',
        success: false,
        error: 'Invalid init message: missing required fields',
      });
      return;
    }

    const startTime = Date.now();
    await initialize(msg.wasmDir, msg.languages);
    const endTime = Date.now();
    logDebug(`[ParserWorker] Initialization completed in ${endTime - startTime}ms`);
  } else if (msg.type === 'parse') {
    // Validate message structure
    if (!validateParseMessage(msg)) {
      parentPort?.postMessage({
        type: 'result',
        id: typeof msg === 'object' && typeof (msg as any).id === 'number' ? (msg as any).id : -1,
        error: 'Invalid parse message: missing required fields',
      });
      return;
    }

    const parseStartTime = Date.now();
    if (!isInitialized) {
      parentPort?.postMessage({ type: 'result', id: msg.id, error: 'Worker not initialized' });
      return;
    }

    const parser = parsers.get(msg.languageId);
    if (!parser) {
      logWarn(
        `[ParserWorker] No parser for ${msg.languageId}. Available parsers: ${Array.from(parsers.keys()).join(', ')}`
      );
      parentPort?.postMessage({
        type: 'result',
        id: msg.id,
        error: `No parser for ${msg.languageId}`,
      });
      return;
    }

    let tree: any = null;
    try {
      const parseTreeStartTime = Date.now();
      try {
        tree = parser.parse(msg.content);
        const parseTreeEndTime = Date.now();
        logDebug(
          `[ParserWorker] parser.parse() for ${msg.filePath}: ${parseTreeEndTime - parseTreeStartTime}ms (${msg.content.length} bytes)`
        );
      } catch (parseError) {
        const parseTreeEndTime = Date.now();
        const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        if (
          parseErrorMsg.includes('Maximum call stack') ||
          parseErrorMsg.includes('stack overflow') ||
          parseErrorMsg.includes('RangeError')
        ) {
          logWarn(
            `[ParserWorker] Stack overflow parsing ${msg.filePath} (${parseTreeEndTime - parseTreeStartTime}ms), returning empty result`
          );
          parentPort?.postMessage({
            type: 'result',
            id: msg.id,
            data: { symbols: [], hybridFacts: [] },
          });
          return;
        }
        logError(
          `[ParserWorker] Unexpected parse error for ${msg.filePath} (${parseTreeEndTime - parseTreeStartTime}ms):`,
          parseError
        );
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
        const extractSymbolsStartTime = Date.now();
        let symbols: SymbolInfo[] = [];
        let wasFiltered = false;

        if (msg.existingSymbols) {
          symbols = msg.existingSymbols;
          // Check if existingSymbols exceeds limit
          if (symbols.length >= MAX_REASONABLE_SYMBOLS) {
            logWarn(
              `[ParserWorker] File ${msg.filePath} has ${symbols.length} symbols (exceeds ${MAX_REASONABLE_SYMBOLS}), likely minified/bundled. Skipping.`
            );
            symbols = [];
            wasFiltered = true;
          }
        } else if (isCstOnly) {
          symbols = [];
        } else {
          const result = extractSymbols(tree, msg.filePath, msg.languageId);
          symbols = result.symbols;
          wasFiltered = result.wasFiltered;
        }
        const extractSymbolsEndTime = Date.now();

        if (!msg.existingSymbols && !isCstOnly) {
          logDebug(
            `[ParserWorker] extractSymbols for ${msg.filePath}: ${extractSymbolsEndTime - extractSymbolsStartTime}ms (${symbols.length} symbols)`
          );
        }

        // If file was filtered out, return empty hybridFacts (don't include CST facts)
        if (wasFiltered) {
          result.hybridFacts = [];
        } else {
          // Wrap CST extraction in try-catch for stack overflow
          let cstFacts: any[] = [];
          const extractCstStartTime = Date.now();
          try {
            cstFacts = cstExtractor.extractCstFacts(tree, msg.filePath, msg.languageId, symbols);
            const extractCstEndTime = Date.now();
            logDebug(
              `[ParserWorker] extractCstFacts for ${msg.filePath}: ${extractCstEndTime - extractCstStartTime}ms (${cstFacts.length} facts)`
            );
          } catch (cstError) {
            const extractCstEndTime = Date.now();
            const cstErrorMsg = cstError instanceof Error ? cstError.message : String(cstError);
            if (
              cstErrorMsg.includes('Maximum call stack') ||
              cstErrorMsg.includes('stack overflow') ||
              cstErrorMsg.includes('RangeError')
            ) {
              logWarn(
                `[ParserWorker] Stack overflow in CST extraction for ${msg.filePath} (${extractCstEndTime - extractCstStartTime}ms), skipping CST facts`
              );
              cstFacts = [];
            } else {
              logError(
                `[ParserWorker] Unexpected error in CST extraction for ${msg.filePath} (${extractCstEndTime - extractCstStartTime}ms):`,
                cstError
              );
              cstFacts = [];
            }
          }

          result.hybridFacts = [...symbols, ...cstFacts];
        }
      } else {
        const extractSymbolsStartTime = Date.now();
        const extractResult = extractSymbols(tree, msg.filePath, msg.languageId);
        const extractSymbolsEndTime = Date.now();

        // extractSymbols returns empty array if it hits MAX_REASONABLE_SYMBOLS (filters out minified/bundled files)
        result.symbols = extractResult.symbols;
        if (extractResult.symbols.length > 0) {
          logDebug(
            `[ParserWorker] extractSymbols for ${msg.filePath}: ${extractSymbolsEndTime - extractSymbolsStartTime}ms (${extractResult.symbols.length} symbols)`
          );
        }
      }

      const parseEndTime = Date.now();
      logDebug(
        `[ParserWorker] Total parse operation for ${msg.filePath}: ${parseEndTime - parseStartTime}ms`
      );
      parentPort?.postMessage({ type: 'result', id: msg.id, data: result });
    } catch (error) {
      const parseEndTime = Date.now();
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Check for stack overflow specifically
      if (
        errorMsg.includes('Maximum call stack') ||
        errorMsg.includes('stack overflow') ||
        errorMsg.includes('RangeError')
      ) {
        logWarn(
          `[ParserWorker] Stack overflow parsing ${msg.filePath} (${parseEndTime - parseStartTime}ms), returning empty result`
        );
        parentPort?.postMessage({
          type: 'result',
          id: msg.id,
          data: { symbols: [], hybridFacts: [] },
        });
      } else {
        logError(
          `[ParserWorker] Error parsing ${msg.filePath} (${parseEndTime - parseStartTime}ms): ${errorMsg}`
        );
        parentPort?.postMessage({ type: 'result', id: msg.id, error: errorMsg });
      }
    } finally {
      // Always delete tree to prevent memory leaks
      if (tree) {
        tree.delete();
      }
    }
  } else if (msg.type === 'serialize') {
    // Validate message structure
    if (!validateSerializeMessage(msg)) {
      parentPort?.postMessage({
        type: 'result',
        id: typeof msg === 'object' && typeof (msg as any).id === 'number' ? (msg as any).id : -1,
        error: 'Invalid serialize message: missing required fields',
      });
      return;
    }

    const serializeStartTime = Date.now();
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
    let tree: any = null;
    try {
      const parseStartTime = Date.now();
      tree = parser.parse(msg.content);
      const parseEndTime = Date.now();
      logDebug(`[ParserWorker] serialize parser.parse(): ${parseEndTime - parseStartTime}ms`);

      const serializeNodeStartTime = Date.now();
      const serialized = serializeNode(tree.rootNode, msg.maxDepth || 5);
      const serializeNodeEndTime = Date.now();
      logDebug(
        `[ParserWorker] serializeNode(): ${serializeNodeEndTime - serializeNodeStartTime}ms`
      );

      const serializeEndTime = Date.now();
      logDebug(
        `[ParserWorker] Total serialize operation: ${serializeEndTime - serializeStartTime}ms`
      );
      parentPort?.postMessage({ type: 'result', id: msg.id, data: serialized });
    } catch (error) {
      const serializeEndTime = Date.now();
      logError(
        `[ParserWorker] Error in serialize (${serializeEndTime - serializeStartTime}ms): ${error}`
      );
      parentPort?.postMessage({ type: 'result', id: msg.id, error: String(error) });
    } finally {
      // Always delete tree to prevent memory leaks
      if (tree) {
        tree.delete();
      }
    }
  } else {
    // Unknown message type
    logWarn(`[ParserWorker] Received unknown message type: ${(msg as any).type}`);
    parentPort?.postMessage({
      type: 'result',
      id: typeof (msg as any).id === 'number' ? (msg as any).id : -1,
      error: `Unknown message type: ${(msg as any).type}`,
    });
  }
});
