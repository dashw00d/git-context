import { LlmContextReport } from '../contracts/llmContext';
/**
 * Export LLM context in structured JSON format
 *
 * Generates versioned, machine-readable reports for LLM consumption
 * with deterministic truncation and context budgeting.
 */
export declare class ContextExporter {
    private readonly MAX_TOKEN_BUDGET;
    private readonly TOKEN_PER_CHAR;
    private readonly mermaidGenerator;
    private readonly dependencyExtractor;
    private readonly legacyAuditService;
    /**
     * Export full context report for specified commits
     */
    exportContext(shas: string[]): Promise<LlmContextReport>;
    /**
     * Export context to JSON file
     */
    exportToFile(shas: string[], filePath?: string): Promise<string>;
    /**
     * Build context for a single commit
     */
    private buildCommitContext;
    /**
     * Build context for a single file
     */
    private buildFileContext;
    /**
     * Build cross-commit rollups
     */
    private buildRollups;
    /**
     * Apply context budgeting with predictable truncation
     */
    private applyContextBudget;
    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokenCount;
    /**
     * Truncate diff hunks (lowest priority)
     */
    private truncateDiffHunks;
    /**
     * Remove low-confidence edges with dynamic threshold
     */
    private truncateLowConfidenceEdges;
    /**
     * Remove unchanged callers (would need implementation)
     */
    private truncateUnchangedCallers;
    /**
     * Remove documentation changes
     */
    private truncateDocChanges;
    /**
     * Get current HEAD SHA
     */
    private getHeadSha;
    /**
     * Get current branch name
     */
    private getCurrentBranch;
    /**
     * Generate Mermaid graphs for the report
     */
    private generateGraphs;
}
//# sourceMappingURL=contextExporter.d.ts.map