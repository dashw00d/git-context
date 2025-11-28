import { SymbolInfo } from './index';

/**
 * CST-specific fact types for tracking structural elements
 * (headings, properties, doc comments, etc.) that don't map to semantic symbols
 */
export type CstFactKind = 'cst_node' | 'heading' | 'property' | 'doc_comment';

/**
 * Delta change information for tracking evolution of CST facts
 */
export interface DeltaChange {
  type: 'added' | 'modified' | 'removed';
  oldDna?: string;
  newDna?: string;
  locationDelta?: {
    oldLine: number;
    newLine: number;
  };
}

/**
 * CST Fact - extends SymbolInfo for structural elements
 */
export interface CstFact extends Omit<SymbolInfo, 'kind'> {
  kind: CstFactKind;
  nodeType: string;  // Tree-sitter node type (e.g., 'heading', 'pair', 'comment')
  level?: number;   // For headings: depth (1-6)
  bodyShape: string; // Hash of structural shape
  timeline: Array<{
    version: string;  // Commit SHA or 'workspace'
    dna: string;      // DNA hash for this version
    delta: DeltaChange;
  }>;
}

/**
 * Union type for hybrid facts (semantic symbols + CST facts)
 */
export type HybridFact = SymbolInfo | CstFact;

/**
 * Type guard to check if a fact is a CST fact
 */
export function isCstFact(fact: HybridFact): fact is CstFact {
  return fact.kind === 'cst_node' || fact.kind === 'heading' || fact.kind === 'property' || fact.kind === 'doc_comment';
}

/**
 * Type guard to check if a fact is a semantic symbol
 */
export function isSymbolInfo(fact: HybridFact): fact is SymbolInfo {
  return !isCstFact(fact);
}

