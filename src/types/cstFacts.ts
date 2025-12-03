import { SymbolInfo } from './index';

export type CstFactKind = 'cst_node' | 'heading' | 'property' | 'doc_comment';

export interface DeltaChange {
  type: 'added' | 'modified' | 'removed';
  oldDna?: string;
  newDna?: string;
  locationDelta?: {
    oldLine: number;
    newLine: number;
  };
}

export interface CstFact extends Omit<SymbolInfo, 'kind'> {
  kind: CstFactKind;
  nodeType: string;
  level?: number;
  bodyShape: string;
  timeline: Array<{
    version: string;
    dna: string;
    delta: DeltaChange;
  }>;
}

export type HybridFact = SymbolInfo | CstFact;

export function isCstFact(fact: HybridFact): fact is CstFact {
  return (
    fact.kind === 'cst_node' ||
    fact.kind === 'heading' ||
    fact.kind === 'property' ||
    fact.kind === 'doc_comment'
  );
}

export function isSymbolInfo(fact: HybridFact): fact is SymbolInfo {
  return !isCstFact(fact);
}
