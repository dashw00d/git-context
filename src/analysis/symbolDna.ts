import * as crypto from 'crypto';
import { SymbolInfo } from '../types';
import { HybridFact, isCstFact } from '../types/cstFacts';
import { getTreeSitterParser } from './tree-sitter';

/**
 * DNA Configuration
 */
export interface DnaConfig {
  maxDepth: number;
  ngramSizes: number[];
}

const DEFAULT_DNA_CONFIG: DnaConfig = {
  maxDepth: 5,
  ngramSizes: [2, 3],
};

let dnaConfig: DnaConfig = { ...DEFAULT_DNA_CONFIG };

export function configureDNA(config: Partial<DnaConfig>): void {
  dnaConfig = { ...dnaConfig, ...config };
}

export function getDNAConfig(): DnaConfig {
  return { ...dnaConfig };
}

/**
 * Generate DNA hash for symbol using AST n-grams
 */
export async function computeSymbolDNA(
  symbol: SymbolInfo,
  bodyText?: string,
  language?: string
): Promise<string> {
  const parts = [symbol.kind, normalizeSignature(symbol.signature)];

  if (bodyText && language) {
    const ngrams = await extractAstNgrams(bodyText, language, {
      n: dnaConfig.ngramSizes,
      maxDepth: dnaConfig.maxDepth,
    });
    const astFingerprint = computeAstFingerprint(ngrams);
    parts.push(astFingerprint);

    const bodyShape = computeBodyShape(bodyText);
    parts.push(bodyShape);
  } else if (bodyText) {
    const bodyShape = computeBodyShape(bodyText);
    parts.push(bodyShape);
  }

  return crypto.createHash('sha256').update(parts.join('::')).digest('hex').substring(0, 16);
}

/**
 * Extract AST n-grams from body text
 */
async function extractAstNgrams(
  bodyText: string,
  language: string,
  options: { n: number[]; maxDepth: number; skipTypes?: string[] }
): Promise<string[]> {
  const parser = getTreeSitterParser();

  try {
    const facts = await parser.extractHybridFacts(bodyText, 'temp.ts', language);

    const nodeTypes: string[] = [];
    const skipTypes = new Set(options.skipTypes || ['comment', 'whitespace']);

    for (const fact of facts) {
      if (!skipTypes.has(fact.kind)) {
        nodeTypes.push(fact.kind);
      }
    }

    const ngrams: string[] = [];
    for (const n of options.n) {
      for (let i = 0; i <= nodeTypes.length - n; i++) {
        const gram = nodeTypes.slice(i, i + n).join(',');
        ngrams.push(gram);
      }
    }

    return [...new Set(ngrams)].sort();
  } catch (error) {
    return [];
  }
}

function computeAstFingerprint(ngrams: string[]): string {
  if (ngrams.length === 0) return '';

  const freq = new Map<string, number>();
  for (const gram of ngrams) {
    freq.set(gram, (freq.get(gram) || 0) + 1);
  }

  const serialized = Array.from(freq.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([gram, count]) => `${gram}:${count}`)
    .join('|');

  return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 12);
}

export function computeBodyHash(bodyText: string): string {
  const normalized = bodyText
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

function computeBodyShape(bodyText: string): string {
  const tokens = bodyText
    .replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, 'ID')
    .replace(/\d+/g, 'NUM')
    .replace(/["'].*?["']/g, 'STR')
    .replace(/\s+/g, '');

  return crypto.createHash('sha256').update(tokens).digest('hex').substring(0, 8);
}

function normalizeSignature(sig: string): string {
  return sig
    .replace(/\w+\s*:/g, ':')
    .replace(/\s+/g, '')
    .toLowerCase();
}

/**
 * Assign DNA IDs to symbols
 * Sets id = DNA hash (replacing any temporary ID)
 * Uses filePath for bodyText lookup if available, otherwise falls back to id
 */
export async function assignDNAIds(
  symbols: SymbolInfo[],
  bodyTexts?: Map<string, string>,
  language?: string
): Promise<SymbolInfo[]> {
  const results: SymbolInfo[] = [];

  for (const symbol of symbols) {
    // Try to get bodyText using filePath first, then fall back to id
    const bodyTextKey = symbol.filePath || symbol.id;
    const bodyText = bodyTexts?.get(bodyTextKey);
    const bodyHash = bodyText ? computeBodyHash(bodyText) : undefined;

    const dnaId = await computeSymbolDNA(symbol, bodyText, language);

    const enhanced: SymbolInfo = {
      ...symbol,
      id: dnaId, // id becomes the DNA hash
      bodyHash,
      dnaVersion: 2,
      filePath: symbol.filePath, // Preserve filePath
    };

    results.push(enhanced);
  }

  return results;
}

export async function computeHybridDna(
  fact: HybridFact,
  bodyText?: string,
  language?: string
): Promise<string> {
  // Always use computeSymbolDNA for consistent IDs between quick scan and full scan
  // Previously CST facts used a different algorithm which caused ID mismatches
  // Cast to SymbolInfo since HybridFact has compatible properties (kind, signature)
  return computeSymbolDNA(fact as unknown as SymbolInfo, bodyText, language);
}
