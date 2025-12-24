/**
 * Unified Symbol Extraction
 * Ensures quick scan and full scan use identical extraction logic
 * Only completeness flags differ between modes
 */

import { detectLanguage } from '../utils/config';
import { logDebug } from '../utils/logger';
import { assignDNAIds } from './symbolDna';
import { SymbolExtractor } from './symbols';
import type { SymbolInfo } from '../types';

/**
 * Options for symbol extraction
 */
export interface ExtractionOptions {
  /** Whether to extract edges (Quick scan: false, Full scan: true) */
  includeEdges: boolean;
  /** Worker priority */
  priority: boolean;
}

/**
 * Result of symbol extraction
 */
export interface ExtractionResult {
  /** Extracted symbols with DNA IDs */
  symbols: SymbolInfo[];
  /** Extracted edges (only if includeEdges=true) */
  edges?: Array<{
    fromSymbolId: string;
    toSymbolId: string;
    edgeType: string;
  }>;
  /** Language detected for the file */
  language: string | null;
}

/**
 * Unified symbol extraction - used by both quick scan and full scan
 * This ensures identical symbol structures regardless of scan mode
 *
 * @param content File content to analyze
 * @param filePath Path to the file
 * @param options Extraction options
 * @param symbolExtractor SymbolExtractor instance
 */
export async function extractSymbolsUnified(
  content: string,
  filePath: string,
  options: ExtractionOptions,
  symbolExtractor: SymbolExtractor
): Promise<ExtractionResult> {
  const language = detectLanguage(filePath);

  // Use same extraction logic for both modes
  const symbols = await symbolExtractor.extractSymbolsFromContent(content, filePath);

  // Assign DNA IDs (same for both modes)
  const bodyTexts = new Map<string, string>();
  for (const symbol of symbols) {
    const startLine = symbol.location?.start?.line;
    const endLine = symbol.location?.end?.line;
    if (!startLine || !endLine) {
      continue;
    }
    const bodyText = symbolExtractor.extractBodyText(content, startLine, endLine);
    bodyTexts.set(symbol.id, bodyText);
  }
  const symbolsWithDNA = await assignDNAIds(symbols, bodyTexts, language || undefined);

  logDebug(
    `[UnifiedExtraction] Extracted ${symbolsWithDNA.length} symbols from ${filePath} (includeEdges: ${options.includeEdges})`
  );

  const result: ExtractionResult = {
    symbols: symbolsWithDNA,
    language,
  };

  // Only extract edges for full scan
  if (options.includeEdges && symbolsWithDNA.length > 0) {
    // Simple edge extraction - look for function calls and references
    result.edges = extractSimpleEdges(symbolsWithDNA, content);
  }

  return result;
}

/**
 * Extract simple edges from symbols by looking for references in the code
 * This is a lightweight edge extraction for the unified interface
 */
function extractSimpleEdges(
  symbols: SymbolInfo[],
  content: string
): Array<{ fromSymbolId: string; toSymbolId: string; edgeType: string }> {
  const edges: Array<{ fromSymbolId: string; toSymbolId: string; edgeType: string }> = [];

  // Build a map of symbol names to IDs
  const nameToId = new Map<string, string>();
  for (const symbol of symbols) {
    nameToId.set(symbol.name, symbol.id);
  }

  // Split content into lines once for all symbols
  const lines = content.split('\n');

  // For each symbol, look for references to other symbols in its body
  for (const symbol of symbols) {
    const startLine = symbol.location.start.line - 1;
    const endLine = symbol.location.end.line;
    const body = lines.slice(startLine, endLine).join('\n');

    for (const [name, targetId] of nameToId) {
      if (name === symbol.name) continue; // Skip self-references

      // Look for the symbol name as a word boundary (simple heuristic)
      const regex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'g');
      if (regex.test(body)) {
        edges.push({
          fromSymbolId: symbol.id,
          toSymbolId: targetId,
          edgeType: 'calls',
        });
      }
    }
  }

  return edges;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compare two extraction results for identity
 * Used in tests to verify quick scan and full scan produce same symbols
 */
export function areSymbolsIdentical(a: ExtractionResult, b: ExtractionResult): boolean {
  if (a.symbols.length !== b.symbols.length) return false;

  for (let i = 0; i < a.symbols.length; i++) {
    const symA = a.symbols[i];
    const symB = b.symbols[i];

    // Check identity properties
    if (symA.id !== symB.id) return false;
    if (symA.name !== symB.name) return false;
    if (symA.kind !== symB.kind) return false;
    if (symA.signature !== symB.signature) return false;
    if (symA.filePath !== symB.filePath) return false;
  }

  return true;
}
