import { SymbolInfo, SymbolDelta, FileChange } from '../types';
import { GitOperations } from './git';
export declare class SymbolExtractor {
    private git;
    private parser;
    private semanticDetector;
    constructor(git: GitOperations);
    /**
     * Extract symbols from all changed files in a commit with semantic enrichment
     */
    extractCommitSymbols(sha: string, files: FileChange[]): Promise<{
        added: SymbolInfo[];
        removed: SymbolInfo[];
        modified: SymbolDelta[];
        renames: Array<{
            oldSymbol: SymbolInfo;
            newSymbol: SymbolInfo;
            confidence: number;
        }>;
        moves: Array<{
            symbol: SymbolInfo;
            oldPath: string;
            newPath: string;
            confidence: number;
        }>;
    }>;
    /**
     * Extract symbols from a single file in a commit
     */
    private extractFileSymbols;
    /**
     * Extract symbols from file content
     */
    private extractSymbolsFromContent;
    /**
     * Compare two sets of symbols and determine changes
     */
    private compareSymbolSets;
    /**
     * Determine the type of change between two symbol versions
     */
    private determineSymbolChange;
    /**
     * Check if a symbol is public (exported)
     */
    private isPublicSymbol;
    /**
     * Check if a file should be analyzed for symbols
     */
    private shouldAnalyzeFile;
    /**
     * Extract symbols from staged changes
     */
    extractStagedSymbols(): Promise<{
        added: SymbolInfo[];
        removed: SymbolInfo[];
        modified: SymbolDelta[];
    }>;
}
//# sourceMappingURL=symbols.d.ts.map