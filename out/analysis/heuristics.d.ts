import { RiskFlag, SymbolDelta, FileChange, EdgeInfo } from '../types';
export declare class RiskDetector {
    /**
     * Analyze a commit and detect risk flags
     */
    detectRisks(files: FileChange[], symbols: {
        added: any[];
        removed: any[];
        modified: SymbolDelta[];
    }, edges: {
        added: EdgeInfo[];
        removed: EdgeInfo[];
    }): RiskFlag[];
    /**
     * Check for breaking API changes
     */
    private hasBreakingChanges;
    /**
     * Check for database/schema migrations
     */
    private hasMigrations;
    /**
     * Check for large refactoring operations
     */
    private hasRefactor;
    /**
     * Check for security-related changes
     */
    private hasSecurityChanges;
    /**
     * Check for performance-related changes
     */
    private hasPerformanceChanges;
    /**
     * Check for authentication-related changes
     */
    private hasAuthChanges;
    /**
     * Check for payment-related changes
     */
    private hasPaymentChanges;
    /**
     * Check if a symbol is public (not private)
     */
    private isPublicSymbol;
    /**
     * Check if a symbol change represents a rename
     */
    private isRename;
}
//# sourceMappingURL=heuristics.d.ts.map