"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCstDiffManager = exports.CstDiffManager = void 0;
const astSerializer_1 = require("./astSerializer");
const difftastic_1 = require("./difftastic");
const tree_sitter_1 = require("./tree-sitter");
const config_1 = require("../utils/config");
const logger_1 = require("../utils/logger");
/**
 * CST Diff Manager - computes diffs between CST trees and generates deltas
 */
class CstDiffManager {
    constructor() {
        this.astSerializer = new astSerializer_1.AstSerializer();
        this.difftastic = (0, difftastic_1.getDifftasticIntegration)();
        this.parser = (0, tree_sitter_1.getTreeSitterParser)();
    }
    /**
     * Diff two CST trees and generate deltas for hybrid facts
     */
    async diffCst(oldContent, newContent, filePath, oldFacts, newFacts) {
        const language = (0, config_1.detectLanguage)(filePath);
        if (!language) {
            return {
                changedFacts: [],
                addedFacts: newFacts,
                removedFacts: oldFacts
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
            const difftasticResult = await this.difftastic.runDifftastic(oldContent, newContent, filePath, filePath);
            return this.mapDifftasticToFacts(difftasticResult, oldFacts, newFacts, oldTree, newTree);
        }
        catch (error) {
            (0, logger_1.logDebug)(`[CstDiff] Difftastic failed, using tree-sitter diff: ${error}`);
            // Fallback: Tree-sitter query-based diff
            return this.treeSitterDiff(oldTree, newTree, oldFacts, newFacts);
        }
    }
    /**
     * Map Difftastic output to fact changes
     */
    mapDifftasticToFacts(difftasticResult, oldFacts, newFacts, oldTree, newTree) {
        const changedFacts = [];
        const addedFacts = [];
        const removedFacts = [];
        // Create maps for quick lookup
        const oldFactMap = new Map();
        const newFactMap = new Map();
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
                    const delta = {
                        type: 'modified',
                        oldDna: oldByDna.dnaId,
                        newDna: newFact.dnaId,
                        locationDelta: {
                            oldLine: oldByDna.location.start.line,
                            newLine: newFact.location.start.line
                        }
                    };
                    changedFacts.push({ fact: newFact, delta, oldFact: oldByDna });
                }
                else {
                    addedFacts.push(newFact);
                }
            }
            else {
                // Check if modified
                const isModified = this.isFactModified(oldFact, newFact, difftasticResult);
                if (isModified) {
                    const delta = {
                        type: 'modified',
                        oldDna: oldFact.dnaId,
                        newDna: newFact.dnaId,
                        locationDelta: oldFact.location.start.line !== newFact.location.start.line ? {
                            oldLine: oldFact.location.start.line,
                            newLine: newFact.location.start.line
                        } : undefined
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
    isFactModified(oldFact, newFact, difftasticResult) {
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
    treeSitterDiff(oldTree, newTree, oldFacts, newFacts) {
        // Simplified diff: compare facts directly
        return this.simpleFactDiff(oldFacts, newFacts);
    }
    /**
     * Simple fact comparison (fallback when parsing fails)
     */
    simpleFactDiff(oldFacts, newFacts) {
        const changedFacts = [];
        const addedFacts = [];
        const removedFacts = [];
        const oldFactMap = new Map();
        const newFactMap = new Map();
        oldFacts.forEach(f => oldFactMap.set(f.id, f));
        newFacts.forEach(f => newFactMap.set(f.id, f));
        // Find added and modified
        for (const newFact of newFacts) {
            const oldFact = oldFactMap.get(newFact.id);
            if (!oldFact) {
                // Check for rename by DNA
                const oldByDna = Array.from(oldFactMap.values()).find(f => f.dnaId === newFact.dnaId);
                if (oldByDna) {
                    const delta = {
                        type: 'modified',
                        oldDna: oldByDna.dnaId,
                        newDna: newFact.dnaId,
                        locationDelta: {
                            oldLine: oldByDna.location.start.line,
                            newLine: newFact.location.start.line
                        }
                    };
                    changedFacts.push({ fact: newFact, delta, oldFact: oldByDna });
                }
                else {
                    addedFacts.push(newFact);
                }
            }
            else if (oldFact.dnaId !== newFact.dnaId ||
                oldFact.location.start.line !== newFact.location.start.line) {
                const delta = {
                    type: 'modified',
                    oldDna: oldFact.dnaId,
                    newDna: newFact.dnaId,
                    locationDelta: oldFact.location.start.line !== newFact.location.start.line ? {
                        oldLine: oldFact.location.start.line,
                        newLine: newFact.location.start.line
                    } : undefined
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
    async computeCstDelta(oldSerialized, newSerialized, filePath) {
        // Parse serialized ASTs back to trees (if needed)
        // For now, use content-based diff
        const language = (0, config_1.detectLanguage)(filePath);
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
            const difftasticResult = await this.difftastic.runDifftastic(oldSerialized, newSerialized, filePath, filePath);
            // Extract facts from both trees
            const oldFacts = await this.extractFactsFromTree(oldTree, filePath);
            const newFacts = await this.extractFactsFromTree(newTree, filePath);
            return this.mapDifftasticToFacts(difftasticResult, oldFacts, newFacts, oldTree, newTree);
        }
        catch (error) {
            (0, logger_1.logDebug)(`[CstDiff] Error computing CST delta: ${error}`);
            return { changedFacts: [], addedFacts: [], removedFacts: [] };
        }
    }
    /**
     * Extract facts from a tree (helper for delta computation)
     */
    async extractFactsFromTree(tree, filePath) {
        const language = (0, config_1.detectLanguage)(filePath);
        if (!language)
            return [];
        // Use parser's hybrid extraction
        return this.parser.extractHybridFacts(tree, filePath, language);
    }
}
exports.CstDiffManager = CstDiffManager;
// Singleton instance
let cstDiffManagerInstance = null;
function getCstDiffManager() {
    if (!cstDiffManagerInstance) {
        cstDiffManagerInstance = new CstDiffManager();
    }
    return cstDiffManagerInstance;
}
exports.getCstDiffManager = getCstDiffManager;
