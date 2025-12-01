import { SymbolInfo } from '../types';
import { HybridFact, CstFact, DeltaChange, isCstFact } from '../types/cstFacts';
import { detectLanguage } from '../utils/config';
import { logDebug } from '../utils/logger';
import { AstSerializer } from './astSerializer';
import { getDifftasticIntegration, DifftasticResult } from './difftastic';
import { getTreeSitterParser } from './tree-sitter';

export interface CstDiffResult {
  changedFacts: Array<{
    fact: HybridFact;
    delta: DeltaChange;
    oldFact?: HybridFact;
  }>;
  addedFacts: HybridFact[];
  removedFacts: HybridFact[];
}

/**
 * CST Diff Manager - computes diffs between CST trees and generates deltas
 */
export class CstDiffManager {
  private astSerializer = new AstSerializer();
  private difftastic = getDifftasticIntegration();
  private parser = getTreeSitterParser();

  /**
   * Diff two CST trees and generate deltas for hybrid facts
   */
  async diffCst(
    oldContent: string,
    newContent: string,
    filePath: string,
    oldFacts: HybridFact[],
    newFacts: HybridFact[]
  ): Promise<CstDiffResult> {
    const language = detectLanguage(filePath);
    if (!language) {
      return {
        changedFacts: [],
        addedFacts: newFacts,
        removedFacts: oldFacts,
      };
    }

    // Parse both versions
    const oldTree = await this.parser.parse(oldContent, language);
    const newTree = await this.parser.parse(newContent, language);

    if (!oldTree || !newTree) {
      // Fallback: simple fact comparison
      return this.simpleFactDiff(oldFacts, newFacts);
    }

    // Try Difftastic first (for text-based CST)
    try {
      const difftasticResult = await this.difftastic.runDifftastic(
        oldContent,
        newContent,
        filePath,
        filePath
      );

      return this.mapDifftasticToFacts(difftasticResult, oldFacts, newFacts, oldTree, newTree);
    } catch (error) {
      logDebug(`[CstDiff] Difftastic failed, using tree-sitter diff: ${error}`);
      // Fallback: Tree-sitter query-based diff
      return this.treeSitterDiff(oldTree, newTree, oldFacts, newFacts);
    }
  }

  /**
   * Map Difftastic output to fact changes
   */
  private mapDifftasticToFacts(
    difftasticResult: DifftasticResult,
    oldFacts: HybridFact[],
    newFacts: HybridFact[],
    oldTree: any,
    newTree: any
  ): CstDiffResult {
    const changedFacts: Array<{ fact: HybridFact; delta: DeltaChange; oldFact?: HybridFact }> = [];
    const addedFacts: HybridFact[] = [];
    const removedFacts: HybridFact[] = [];

    // Create maps for quick lookup
    const oldFactMap = new Map<string, HybridFact>();
    const newFactMap = new Map<string, HybridFact>();

    oldFacts.forEach(f => oldFactMap.set(f.id, f));
    newFacts.forEach(f => newFactMap.set(f.id, f));

    // Find added facts (in new but not in old)
    for (const newFact of newFacts) {
      const oldFact = oldFactMap.get(newFact.id);
      if (!oldFact) {
        // Check if it's a rename (same DNA, different ID)
        const oldByDna = Array.from(oldFactMap.values()).find(f => f.dnaId === newFact.dnaId);
        if (oldByDna) {
          // Renamed/modified
          const delta: DeltaChange = {
            type: 'modified',
            oldDna: oldByDna.dnaId,
            newDna: newFact.dnaId,
            locationDelta: {
              oldLine: oldByDna.location.start.line,
              newLine: newFact.location.start.line,
            },
          };
          changedFacts.push({ fact: newFact, delta, oldFact: oldByDna });
        } else {
          addedFacts.push(newFact);
        }
      } else {
        // Check if modified
        const isModified = this.isFactModified(oldFact, newFact, difftasticResult);
        if (isModified) {
          const delta: DeltaChange = {
            type: 'modified',
            oldDna: oldFact.dnaId,
            newDna: newFact.dnaId,
            locationDelta:
              oldFact.location.start.line !== newFact.location.start.line
                ? {
                    oldLine: oldFact.location.start.line,
                    newLine: newFact.location.start.line,
                  }
                : undefined,
          };
          changedFacts.push({ fact: newFact, delta, oldFact });
        }
      }
    }

    // Find removed facts (in old but not in new)
    for (const oldFact of oldFacts) {
      if (!newFactMap.has(oldFact.id)) {
        // Check if it's a rename (same DNA, different ID)
        const newByDna = Array.from(newFactMap.values()).find(f => f.dnaId === oldFact.dnaId);
        if (!newByDna) {
          removedFacts.push(oldFact);
        }
      }
    }

    return { changedFacts, addedFacts, removedFacts };
  }

  /**
   * Check if a fact was modified based on Difftastic output
   */
  private isFactModified(
    oldFact: HybridFact,
    newFact: HybridFact,
    difftasticResult: DifftasticResult
  ): boolean {
    // Check DNA change
    if (oldFact.dnaId !== newFact.dnaId) {
      return true;
    }

    // Check location change
    if (oldFact.location.start.line !== newFact.location.start.line) {
      return true;
    }

    // Check if line is in difftastic highlights
    const factLine = newFact.location.start.line;
    const isHighlighted = difftasticResult.highlights.some(h => {
      // Parse highlight line number (simplified)
      const match = h.match(/line (\d+)/i);
      return match && parseInt(match[1]) === factLine;
    });

    return isHighlighted;
  }

  /**
   * Tree-sitter query-based diff (fallback)
   */
  private treeSitterDiff(
    oldTree: any,
    newTree: any,
    oldFacts: HybridFact[],
    newFacts: HybridFact[]
  ): CstDiffResult {
    // Simplified diff: compare facts directly
    return this.simpleFactDiff(oldFacts, newFacts);
  }

  /**
   * Simple fact comparison (fallback when parsing fails)
   */
  private simpleFactDiff(oldFacts: HybridFact[], newFacts: HybridFact[]): CstDiffResult {
    const changedFacts: Array<{ fact: HybridFact; delta: DeltaChange; oldFact?: HybridFact }> = [];
    const addedFacts: HybridFact[] = [];
    const removedFacts: HybridFact[] = [];

    const oldFactMap = new Map<string, HybridFact>();
    const newFactMap = new Map<string, HybridFact>();

    oldFacts.forEach(f => oldFactMap.set(f.id, f));
    newFacts.forEach(f => newFactMap.set(f.id, f));

    // Find added and modified
    for (const newFact of newFacts) {
      const oldFact = oldFactMap.get(newFact.id);
      if (!oldFact) {
        // Check for rename by DNA
        const oldByDna = Array.from(oldFactMap.values()).find(f => f.dnaId === newFact.dnaId);
        if (oldByDna) {
          const delta: DeltaChange = {
            type: 'modified',
            oldDna: oldByDna.dnaId,
            newDna: newFact.dnaId,
            locationDelta: {
              oldLine: oldByDna.location.start.line,
              newLine: newFact.location.start.line,
            },
          };
          changedFacts.push({ fact: newFact, delta, oldFact: oldByDna });
        } else {
          addedFacts.push(newFact);
        }
      } else if (
        oldFact.dnaId !== newFact.dnaId ||
        oldFact.location.start.line !== newFact.location.start.line
      ) {
        const delta: DeltaChange = {
          type: 'modified',
          oldDna: oldFact.dnaId,
          newDna: newFact.dnaId,
          locationDelta:
            oldFact.location.start.line !== newFact.location.start.line
              ? {
                  oldLine: oldFact.location.start.line,
                  newLine: newFact.location.start.line,
                }
              : undefined,
        };
        changedFacts.push({ fact: newFact, delta, oldFact });
      }
    }

    // Find removed
    for (const oldFact of oldFacts) {
      if (!newFactMap.has(oldFact.id)) {
        const newByDna = Array.from(newFactMap.values()).find(f => f.dnaId === oldFact.dnaId);
        if (!newByDna) {
          removedFacts.push(oldFact);
        }
      }
    }

    return { changedFacts, addedFacts, removedFacts };
  }

  /**
   * Compute CST delta for structural diff manager integration
   */
  async computeCstDelta(
    oldSerialized: string,
    newSerialized: string,
    filePath: string
  ): Promise<CstDiffResult> {
    // Parse serialized ASTs back to trees (if needed)
    // For now, use content-based diff
    const language = detectLanguage(filePath);
    if (!language) {
      return { changedFacts: [], addedFacts: [], removedFacts: [] };
    }

    // Try to parse as content
    const oldTree = await this.parser.parse(oldSerialized, language);
    const newTree = await this.parser.parse(newSerialized, language);

    if (!oldTree || !newTree) {
      return { changedFacts: [], addedFacts: [], removedFacts: [] };
    }

    // Use Difftastic on serialized strings
    try {
      const difftasticResult = await this.difftastic.runDifftastic(
        oldSerialized,
        newSerialized,
        filePath,
        filePath
      );

      // Extract facts from both trees
      const oldFacts = await this.extractFactsFromTree(oldTree, filePath);
      const newFacts = await this.extractFactsFromTree(newTree, filePath);

      return this.mapDifftasticToFacts(difftasticResult, oldFacts, newFacts, oldTree, newTree);
    } catch (error) {
      logDebug(`[CstDiff] Error computing CST delta: ${error}`);
      return { changedFacts: [], addedFacts: [], removedFacts: [] };
    }
  }

  /**
   * Extract facts from a tree (helper for delta computation)
   */
  private async extractFactsFromTree(tree: any, filePath: string): Promise<HybridFact[]> {
    const language = detectLanguage(filePath);
    if (!language) return [];

    // Use parser's hybrid extraction
    return this.parser.extractHybridFacts(tree, filePath, language);
  }
}

// Singleton instance
let cstDiffManagerInstance: CstDiffManager | null = null;

export function getCstDiffManager(): CstDiffManager {
  if (!cstDiffManagerInstance) {
    cstDiffManagerInstance = new CstDiffManager();
  }
  return cstDiffManagerInstance;
}
