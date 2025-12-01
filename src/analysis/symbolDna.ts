import * as crypto from 'crypto';
import { SymbolInfo } from '../types';
import { CstFact, HybridFact, isCstFact } from '../types/cstFacts';

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
 * Compute structural shape of body (ignores identifiers)
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
 * Assign DNA IDs to symbols
 */
export function assignDNAIds(symbols: SymbolInfo[], bodyTexts?: Map<string, string>): SymbolInfo[] {
  return symbols.map(symbol => {
    const bodyText = bodyTexts?.get(symbol.id);
    const dnaId = computeSymbolDNA(symbol, bodyText);
    const bodyHash = bodyText ? computeBodyHash(bodyText) : undefined;

    return {
      ...symbol,
      dnaId, // Add DNA as separate field, don't overwrite id
      bodyHash,
    };
  });
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
