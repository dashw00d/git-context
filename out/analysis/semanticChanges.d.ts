import { SymbolInfo, SymbolDelta, ModReason } from '../types';
/**
 * Semantic change detection for enhanced LLM context
 *
 * Detects renames, moves, and classifies modification reasons
 * beyond basic added/modified/removed.
 */
export declare class SemanticChangeDetector {
    /**
     * Detect renames by comparing removed and added symbols
     */
    detectRenames(removed: SymbolInfo[], added: SymbolInfo[], threshold?: number): Array<{
        oldSymbol: SymbolInfo;
        newSymbol: SymbolInfo;
        confidence: number;
    }>;
    /**
     * Calculate confidence that two symbols represent a rename
     */
    private calculateRenameConfidence;
    /**
     * Check if signatures are similar when ignoring symbol names
     */
    private signaturesSimilar;
    /**
     * Calculate name similarity using Jaro-Winkler distance approximation
     */
    private nameSimilarity;
    /**
     * Simple Levenshtein distance approximation for name similarity
     */
    private levenshteinSimilarity;
    private levenshteinDistance;
    /**
     * Detect moves by comparing symbols with same name but different paths
     */
    detectMoves(previousSymbols: SymbolInfo[], currentSymbols: SymbolInfo[]): Array<{
        symbol: SymbolInfo;
        oldPath: string;
        newPath: string;
        confidence: number;
    }>;
    /**
     * Calculate confidence that a symbol was moved
     */
    private calculateMoveConfidence;
    /**
     * Classify the reason for a symbol modification
     */
    classifyModificationReason(delta: SymbolDelta): ModReason;
    /**
     * Normalize signature for comparison (remove variable names, focus on types)
     */
    private normalizeSignature;
    /**
     * Extract diff snippets for context (truncated to reasonable size)
     */
    extractDiffSnippets(previousContent: string, currentContent: string, symbol: SymbolInfo, maxLines?: number): {
        pre: string;
        post: string;
    };
}
//# sourceMappingURL=semanticChanges.d.ts.map