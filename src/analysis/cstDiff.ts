import { DeltaChange, HybridFact } from '../types/cstFacts';
import { detectLanguage } from '../utils/config';
import { logDebug } from '../utils/logger';
import { AstSerializer } from './astSerializer';
import { DifftasticResult, getDifftasticIntegration } from './difftastic';
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

    const oldTree = await this.parser.parse(oldContent, language);
    const newTree = await this.parser.parse(newContent, language);

    if (!oldTree || !newTree) {
      return this.simpleFactDiff(oldFacts, newFacts);
    }

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

    const oldFactMap = new Map<string, HybridFact>();
    const newFactMap = new Map<string, HybridFact>();

    oldFacts.forEach(f => oldFactMap.set(f.id, f));
    newFacts.forEach(f => newFactMap.set(f.id, f));

    for (const newFact of newFacts) {
      const oldFact = oldFactMap.get(newFact.id);
      if (!oldFact) {
        const oldByDna = Array.from(oldFactMap.values()).find(f => f.id === newFact.id);
        if (oldByDna) {
          const delta: DeltaChange = {
            type: 'modified',
            oldDna: oldByDna.id,
            newDna: newFact.id,
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
        const isModified = this.isFactModified(
          oldFact,
          newFact,
          difftasticResult,
          oldTree,
          newTree
        );
        if (isModified) {
          const delta: DeltaChange = {
            type: 'modified',
            oldDna: oldFact.id,
            newDna: newFact.id,
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

    for (const oldFact of oldFacts) {
      if (!newFactMap.has(oldFact.id)) {
        const newByDna = Array.from(newFactMap.values()).find(f => f.id === oldFact.id);
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
    difftasticResult: DifftasticResult,
    oldTree?: any,
    newTree?: any
  ): boolean {
    if (oldFact.id !== newFact.id) {
      return true;
    }

    if (oldFact.location.start.line !== newFact.location.start.line) {
      return true;
    }

    const factLine = newFact.location.start.line;
    const isHighlighted = difftasticResult.highlights.some(h => {
      const match = h.match(/line (\d+)/i);
      return match && parseInt(match[1]) === factLine;
    });

    if (isHighlighted) return true;

    if (oldTree && newTree) {
      const oldNode = this.findNodeForFact(oldTree, oldFact);
      const newNode = this.findNodeForFact(newTree, newFact);
      if (oldNode && newNode && oldNode.type !== newNode.type) {
        return true;
      }
    }

    return false;
  }

  private findNodeForFact(tree: any, fact: HybridFact): any {
    try {
      return tree.rootNode.descendantForPosition(
        { row: fact.location.start.line, column: fact.location.start.column },
        { row: fact.location.end.line, column: fact.location.end.column }
      );
    } catch (e) {
      return null;
    }
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

    for (const newFact of newFacts) {
      const oldFact = oldFactMap.get(newFact.id);
      if (!oldFact) {
        const oldByDna = Array.from(oldFactMap.values()).find(f => f.id === newFact.id);
        if (oldByDna) {
          const delta: DeltaChange = {
            type: 'modified',
            oldDna: oldByDna.id,
            newDna: newFact.id,
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
        oldFact.id !== newFact.id ||
        oldFact.location.start.line !== newFact.location.start.line
      ) {
        const delta: DeltaChange = {
          type: 'modified',
          oldDna: oldFact.id,
          newDna: newFact.id,
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

    for (const oldFact of oldFacts) {
      if (!newFactMap.has(oldFact.id)) {
        const newByDna = Array.from(newFactMap.values()).find(f => f.id === oldFact.id);
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
    const language = detectLanguage(filePath);
    if (!language) {
      return { changedFacts: [], addedFacts: [], removedFacts: [] };
    }

    const oldTree = await this.parser.parse(oldSerialized, language);
    const newTree = await this.parser.parse(newSerialized, language);

    if (!oldTree || !newTree) {
      return { changedFacts: [], addedFacts: [], removedFacts: [] };
    }

    try {
      const difftasticResult = await this.difftastic.runDifftastic(
        oldSerialized,
        newSerialized,
        filePath,
        filePath
      );

      const oldFacts = await this.extractFactsFromTree(oldTree, filePath);
      const newFacts = await this.extractFactsFromTree(newTree, filePath);

      return this.mapDifftasticToFacts(difftasticResult, oldFacts, newFacts, oldTree, newTree);
    } catch (error) {
      logDebug(`[CstDiff] Error computing CST delta: ${error}`);
      return { changedFacts: [], addedFacts: [], removedFacts: [] };
    }
  }

  private async extractFactsFromTree(tree: any, filePath: string): Promise<HybridFact[]> {
    const language = detectLanguage(filePath);
    if (!language) return [];

    return this.parser.extractHybridFacts(tree, filePath, language);
  }
}

let cstDiffManagerInstance: CstDiffManager | null = null;

export function getCstDiffManager(): CstDiffManager {
  if (!cstDiffManagerInstance) {
    cstDiffManagerInstance = new CstDiffManager();
  }
  return cstDiffManagerInstance;
}
