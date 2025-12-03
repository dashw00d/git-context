import * as crypto from 'crypto';
import { SymbolInfo } from '../types';
import { HybridFact, isCstFact } from '../types/cstFacts';
import { getTreeSitterParser } from './tree-sitter';

/**
 * DNA Configuration (Feature Flags)
 */
export interface DnaConfig {
  enableV2: boolean;
  preferV2: boolean;
  v2MaxDepth: number;
  v2NgramSizes: number[];
}

const DEFAULT_DNA_CONFIG: DnaConfig = {
  enableV2: false,
  preferV2: false,
  v2MaxDepth: 5,
  v2NgramSizes: [2, 3],
};

let dnaConfig: DnaConfig = { ...DEFAULT_DNA_CONFIG };

export function configureDNA(config: Partial<DnaConfig>): void {
  dnaConfig = { ...dnaConfig, ...config };
}

export function getDNAConfig(): DnaConfig {
  return { ...dnaConfig };
}

/**
 * Generate stable DNA hash for symbol (survives renames, moves)
 */
export function computeSymbolDNA(symbol: SymbolInfo, bodyText?: string): string {

  const parts = [
    symbol.kind,
    normalizeSignature(symbol.signature),
    bodyText ? computeBodyShape(bodyText) : '',
  ];

  return crypto.createHash('sha256').update(parts.join('::')).digest('hex').substring(0, 16);
}

/**
 * Generate enhanced DNA hash using AST n-grams (v2)
 */
export async function computeSymbolDNA_v2(
  symbol: SymbolInfo,
  bodyText?: string,
  language?: string
): Promise<string> {
  const parts = [symbol.kind, normalizeSignature(symbol.signature)];

  if (bodyText && language) {

    const ngrams = await extractAstNgrams(bodyText, language, {
      n: dnaConfig.v2NgramSizes,
      maxDepth: dnaConfig.v2MaxDepth,
    });
    const astFingerprint = computeAstFingerprint(ngrams);
    parts.push(astFingerprint);


    const legacyShape = computeBodyShape(bodyText);
    parts.push(legacyShape);
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
    .replace(/\/\*[\s\S]*?\*\
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

export function assignDNAIds(symbols: SymbolInfo[], bodyTexts?: Map<string, string>): SymbolInfo[] {
  return symbols.map(symbol => {
    const bodyText = bodyTexts?.get(symbol.id);
    const dnaId = computeSymbolDNA(symbol, bodyText);
    const bodyHash = bodyText ? computeBodyHash(bodyText) : undefined;

    return {
      ...symbol,
      dnaId,
      bodyHash,
      dnaVersion: 1,
    };
  });
}

export async function assignDNAIds_v2(
  symbols: SymbolInfo[],
  bodyTexts?: Map<string, string>,
  language?: string
): Promise<SymbolInfo[]> {
  const results: SymbolInfo[] = [];

  for (const symbol of symbols) {
    const bodyText = bodyTexts?.get(symbol.id);


    const dnaId = computeSymbolDNA(symbol, bodyText);
    const bodyHash = bodyText ? computeBodyHash(bodyText) : undefined;

    let enhanced: SymbolInfo = {
      ...symbol,
      dnaId,
      bodyHash,
    };


    if (dnaConfig.enableV2 && bodyText && language) {
      const dnaIdV2 = await computeSymbolDNA_v2(symbol, bodyText, language);
      enhanced = {
        ...enhanced,
        dnaIdV2,
        dnaVersion: 2,
      };
    } else {
      enhanced = {
        ...enhanced,
        dnaVersion: 1,
      };
    }

    results.push(enhanced);
  }

  return results;
}

export function computeHybridDna(fact: HybridFact, bodyText?: string): string {
  if (isCstFact(fact)) {

    const parts = [
      fact.kind,
      fact.name,
      fact.level !== undefined ? String(fact.level) : '',
      fact.bodyShape,
      String(fact.timeline.length),
    ];
    return crypto.createHash('sha256').update(parts.join('::')).digest('hex').substring(0, 16);
  } else {

    return computeSymbolDNA(fact, bodyText);
  }
}
