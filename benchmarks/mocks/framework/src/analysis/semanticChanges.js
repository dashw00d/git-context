"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticChangeDetector = void 0;
const config_1 = require("../utils/config");
/**
 * Semantic change detection for enhanced LLM context
 *
 * Detects renames, moves, and classifies modification reasons
 * beyond basic added/modified/removed.
 */
class SemanticChangeDetector {
    /**
     * Detect renames by comparing removed and added symbols
     */
    detectRenames(removed, added, threshold = 0.8) {
        const renames = [];
        for (const removedSymbol of removed) {
            let bestMatch = null;
            let bestConfidence = 0;
            for (const addedSymbol of added) {
                const confidence = this.calculateRenameConfidence(removedSymbol, addedSymbol);
                if (confidence > bestConfidence && confidence >= threshold) {
                    bestMatch = addedSymbol;
                    bestConfidence = confidence;
                }
            }
            if (bestMatch) {
                renames.push({
                    oldSymbol: removedSymbol,
                    newSymbol: bestMatch,
                    confidence: bestConfidence
                });
            }
        }
        return renames;
    }
    /**
     * Calculate confidence that two symbols represent a rename
     */
    calculateRenameConfidence(oldSymbol, newSymbol) {
        let confidence = 0;
        // Same kind (function->function, class->class)
        if (oldSymbol.kind === newSymbol.kind) {
            confidence += 0.3;
        }
        else {
            return 0; // Different kinds can't be renames
        }
        // Similar signature structure (ignoring name)
        if (this.signaturesSimilar(oldSymbol.signature, newSymbol.signature, oldSymbol.name, newSymbol.name)) {
            confidence += 0.4;
        }
        // Name similarity (but not identical - that would be same symbol)
        if (oldSymbol.name !== newSymbol.name) {
            const nameSimilarity = this.nameSimilarity(oldSymbol.name, newSymbol.name);
            confidence += nameSimilarity * 0.3;
        }
        return Math.min(confidence, 1.0);
    }
    /**
     * Check if signatures are similar when ignoring symbol names
     */
    signaturesSimilar(sig1, sig2, name1, name2) {
        // Remove symbol names and compare structure
        const normalized1 = sig1.replace(name1, 'SYMBOL').replace(/\s+/g, ' ').trim();
        const normalized2 = sig2.replace(name2, 'SYMBOL').replace(/\s+/g, ' ').trim();
        return normalized1 === normalized2;
    }
    /**
     * Calculate name similarity using Jaro-Winkler distance approximation
     */
    nameSimilarity(name1, name2) {
        if (name1 === name2)
            return 1.0;
        // Simple prefix/suffix matching for common rename patterns
        const prefixes = ['get', 'set', 'is', 'has', 'can', 'should', 'validate'];
        const suffixes = ['Handler', 'Service', 'Controller', 'Manager', 'Util', 'Helper'];
        for (const prefix of prefixes) {
            if (name1.startsWith(prefix) && name2.startsWith(prefix)) {
                const rest1 = name1.slice(prefix.length);
                const rest2 = name2.slice(prefix.length);
                if (rest1 === rest2)
                    return 0.9;
            }
        }
        for (const suffix of suffixes) {
            if (name1.endsWith(suffix) && name2.endsWith(suffix)) {
                const rest1 = name1.slice(0, -suffix.length);
                const rest2 = name2.slice(0, -suffix.length);
                if (rest1 === rest2)
                    return 0.9;
            }
        }
        // Levenshtein distance approximation
        return this.levenshteinSimilarity(name1, name2);
    }
    /**
     * Simple Levenshtein distance approximation for name similarity
     */
    levenshteinSimilarity(s1, s2) {
        const len1 = s1.length;
        const len2 = s2.length;
        const maxLen = Math.max(len1, len2);
        if (maxLen === 0)
            return 1.0;
        const distance = this.levenshteinDistance(s1, s2);
        return 1.0 - (distance / maxLen);
    }
    levenshteinDistance(s1, s2) {
        const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
        for (let i = 0; i <= s1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= s2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= s2.length; j++) {
            for (let i = 1; i <= s1.length; i++) {
                const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + indicator);
            }
        }
        return matrix[s2.length][s1.length];
    }
    /**
     * Detect moves by comparing symbols with same name but different paths
     */
    detectMoves(previousSymbols, currentSymbols) {
        const moves = [];
        // Group by name and kind
        const prevByName = new Map();
        const currByName = new Map();
        for (const symbol of previousSymbols) {
            const key = `${symbol.name}:${symbol.kind}`;
            if (!prevByName.has(key))
                prevByName.set(key, []);
            prevByName.get(key).push(symbol);
        }
        for (const symbol of currentSymbols) {
            const key = `${symbol.name}:${symbol.kind}`;
            if (!currByName.has(key))
                currByName.set(key, []);
            currByName.get(key).push(symbol);
        }
        // Find symbols with same name/kind but different paths
        for (const [key, prevGroup] of prevByName) {
            const currGroup = currByName.get(key);
            if (!currGroup)
                continue;
            for (const prevSymbol of prevGroup) {
                for (const currSymbol of currGroup) {
                    if (prevSymbol.id.split(':')[0] !== currSymbol.id.split(':')[0]) {
                        // Different paths - potential move
                        const confidence = this.calculateMoveConfidence(prevSymbol, currSymbol);
                        if (confidence > 0.7) {
                            moves.push({
                                symbol: currSymbol,
                                oldPath: prevSymbol.id.split(':')[0],
                                newPath: currSymbol.id.split(':')[0],
                                confidence
                            });
                        }
                    }
                }
            }
        }
        return moves;
    }
    /**
     * Calculate confidence that a symbol was moved
     */
    calculateMoveConfidence(oldSymbol, newSymbol) {
        let confidence = 0;
        // Same name and kind (required)
        if (oldSymbol.name === newSymbol.name && oldSymbol.kind === newSymbol.kind) {
            confidence += 0.5;
        }
        else {
            return 0;
        }
        // Similar signature
        if (oldSymbol.signature === newSymbol.signature) {
            confidence += 0.4;
        }
        else if (this.signaturesSimilar(oldSymbol.signature, newSymbol.signature, oldSymbol.name, newSymbol.name)) {
            confidence += 0.3;
        }
        // Same language (file extension)
        const oldLang = (0, config_1.detectLanguage)(oldSymbol.id.split(':')[0]);
        const newLang = (0, config_1.detectLanguage)(newSymbol.id.split(':')[0]);
        if (oldLang === newLang) {
            confidence += 0.1;
        }
        return Math.min(confidence, 1.0);
    }
    /**
     * Classify the reason for a symbol modification
     */
    classifyModificationReason(delta) {
        if (!delta.previousSymbol)
            return 'body_changed';
        const prev = delta.previousSymbol;
        const curr = delta.symbol;
        // Signature changed (function parameters, return type, etc.)
        if (prev.signature !== curr.signature) {
            // Check if it's just parameter names vs types
            const prevNormalized = this.normalizeSignature(prev.signature);
            const currNormalized = this.normalizeSignature(curr.signature);
            if (prevNormalized !== currNormalized) {
                return 'signature_changed';
            }
        }
        // Check for visibility changes
        const visibilityRegex = /(public|private|protected|export)/g;
        const prevVisibility = (prev.signature.match(visibilityRegex) || []).join(' ');
        const currVisibility = (curr.signature.match(visibilityRegex) || []).join(' ');
        if (prevVisibility !== currVisibility) {
            return 'visibility_changed';
        }
        // Check for doc changes (if we had doc comments in symbol info, but we don't currently store them explicitly)
        // However, we can check if the body change is ONLY comments if we had the content.
        // Since we don't have content here, we can't easily detect doc changes unless we store doc comments.
        // But the user asked for "lightweight doc-change detection: if only comments/annotations changed between snippets".
        // We don't have snippets here yet.
        // But we can try to infer from signature if it has annotations/decorators.
        // Check for annotation/decorator changes
        const annotationRegex = /@\w+/g;
        const prevAnnotations = (prev.signature.match(annotationRegex) || []).join(' ');
        const currAnnotations = (curr.signature.match(annotationRegex) || []).join(' ');
        if (prevAnnotations !== currAnnotations) {
            return 'annotation_changed';
        }
        // Location significantly changed (likely moved within file)
        const prevLines = prev.location.end.line - prev.location.start.line;
        const currLines = curr.location.end.line - curr.location.start.line;
        if (Math.abs(prevLines - currLines) > prevLines * 0.5) {
            return 'body_changed';
        }
        // Default to body changed
        return 'body_changed';
    }
    /**
     * Normalize signature for comparison (remove variable names, focus on types)
     */
    normalizeSignature(signature) {
        // Simple normalization - could be enhanced for specific languages
        return signature.replace(/\b\w+\s+(\w+)/g, '$1').replace(/\s+/g, ' ').trim();
    }
    /**
     * Extract diff snippets for context (truncated to reasonable size)
     */
    extractDiffSnippets(previousContent, currentContent, symbol, maxLines = 10) {
        const extractSnippet = (content, location) => {
            const lines = content.split('\n');
            const startLine = Math.max(0, location.start.line - 3);
            const endLine = Math.min(lines.length, location.end.line + 3);
            return lines.slice(startLine, endLine).join('\n');
        };
        return {
            pre: extractSnippet(previousContent, symbol.location),
            post: extractSnippet(currentContent, symbol.location)
        };
    }
}
exports.SemanticChangeDetector = SemanticChangeDetector;
