import * as crypto from 'crypto';
import { SymbolInfo } from '../types';
import { HybridFact, isCstFact } from '../types/cstFacts';
import { getTreeSitterParser } from './tree-sitter';

/**
 * DNA Configuration (Feature Flags)
 */
export interface DnaConfig {
  enableV2: boolean; // Compute v2 DNA
  preferV2: boolean; // Use v2 for queries
  v2MaxDepth: number; // AST depth limit
  v2NgramSizes: number[]; // e.g., [2, 3]
}

const DEFAULT_DNA_CONFIG: DnaConfig = {
  enableV2: false, // Disabled by default
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
  // DNA based on: kind + signature + body shape (not name, not location)
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
    // AST-based structural fingerprint
    const ngrams = await extractAstNgrams(bodyText, language, {
      n: dnaConfig.v2NgramSizes,
      maxDepth: dnaConfig.v2MaxDepth,
    });
    const astFingerprint = computeAstFingerprint(ngrams);
    parts.push(astFingerprint);

    // Keep legacy bodyShape for comparison
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
    // Use extractHybridFacts to parse and extract structure
    // We'll parse the body text as a standalone snippet
    const facts = await parser.extractHybridFacts(bodyText, 'temp.ts', language);

    // Extract node types by walking the facts structure
    // Since we don't have direct tree access, we'll use a simplified approach
    // based on fact kinds and structure
    const nodeTypes: string[] = [];
    const skipTypes = new Set(options.skipTypes || ['comment', 'whitespace']);

    for (const fact of facts) {
      if (!skipTypes.has(fact.kind)) {
        nodeTypes.push(fact.kind);
      }
    }

    // Generate n-grams from extracted node types
    const ngrams: string[] = [];
    for (const n of options.n) {
      for (let i = 0; i <= nodeTypes.length - n; i++) {
        const gram = nodeTypes.slice(i, i + n).join(',');
        ngrams.push(gram);
      }
    }

    // Deduplicate and sort (order-independent bag)
    return [...new Set(ngrams)].sort();
  } catch (error) {
    // If AST parsing fails, fallback to empty ngrams
    return [];
  }
}

/**
 * Compute fingerprint from n-grams (frequency-based)
 */
function computeAstFingerprint(ngrams: string[]): string {
  if (ngrams.length === 0) return '';

  // Frequency map
  const freq = new Map<string, number>();
  for (const gram of ngrams) {
    freq.set(gram, (freq.get(gram) || 0) + 1);
  }

  // Serialize as sorted "gram:count" pairs
  const serialized = Array.from(freq.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([gram, count]) => `${gram}:${count}`)
    .join('|');

  return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 12);
}

/**
 * Compute body hash (for modification detection)
 */
export function computeBodyHash(bodyText: string): string {
  // Normalize whitespace, remove comments
  const normalized = bodyText
    .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
    .replace(/\/\/.*/g, '') // Line comments
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16);
}

/**
 * Compute structural shape of body (ignores identifiers) - LEGACY v1
 */
function computeBodyShape(bodyText: string): string {
  // Extract AST node types only (no identifiers)
  // This is a simplified version - real implementation would use Tree-sitter
  const tokens = bodyText
    .replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, 'ID') // Replace identifiers
    .replace(/\d+/g, 'NUM') // Replace numbers
    .replace(/["'].*?["']/g, 'STR') // Replace strings
    .replace(/\s+/g, ''); // Remove whitespace

  return crypto.createHash('sha256').update(tokens).digest('hex').substring(0, 8);
}

function normalizeSignature(sig: string): string {
  // Remove parameter names, keep types only
  return sig
    .replace(/\w+\s*:/g, ':') // Remove param names in TS
    .replace(/\s+/g, '') // Remove whitespace
    .toLowerCase();
}

/**
 * Assign DNA IDs to symbols (v1 only - synchronous)
 */
export function assignDNAIds(symbols: SymbolInfo[], bodyTexts?: Map<string, string>): SymbolInfo[] {
  return symbols.map(symbol => {
    const bodyText = bodyTexts?.get(symbol.id);
    const dnaId = computeSymbolDNA(symbol, bodyText);
    const bodyHash = bodyText ? computeBodyHash(bodyText) : undefined;

    return {
      ...symbol,
      dnaId,
      bodyHash,
      dnaVersion: 1, // v1 by default
    };
  });
}

/**
 * Assign DNA IDs to symbols (supports dual DNA mode with v2) - ASYNC
 */
export async function assignDNAIds_v2(
  symbols: SymbolInfo[],
  bodyTexts?: Map<string, string>,
  language?: string
): Promise<SymbolInfo[]> {
  const results: SymbolInfo[] = [];

  for (const symbol of symbols) {
    const bodyText = bodyTexts?.get(symbol.id);

    // Always compute v1 DNA
    const dnaId = computeSymbolDNA(symbol, bodyText);
    const bodyHash = bodyText ? computeBodyHash(bodyText) : undefined;

    let enhanced: SymbolInfo = {
      ...symbol,
      dnaId,
      bodyHash,
    };

    // Optionally compute v2 DNA if enabled
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

/**
 * Compute DNA for hybrid fact (symbol or CST fact)
 */
export function computeHybridDna(fact: HybridFact, bodyText?: string): string {
  if (isCstFact(fact)) {
    // For CST facts: kind + name + level + bodyShape + timeline.length
    const parts = [
      fact.kind,
      fact.name,
      fact.level !== undefined ? String(fact.level) : '',
      fact.bodyShape,
      String(fact.timeline.length),
    ];
    return crypto.createHash('sha256').update(parts.join('::')).digest('hex').substring(0, 16);
  } else {
    // For semantic symbols: use existing computeSymbolDNA
    return computeSymbolDNA(fact, bodyText);
  }
}
