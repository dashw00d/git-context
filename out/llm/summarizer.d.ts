import { LLMResponse, AnalysisResult } from '../types';
export declare class LLMSummarizer {
    private _client;
    private get client();
    /**
     * Generate commit summary using two-stage LLM process
     */
    summarizeCommit(analysis: AnalysisResult): Promise<LLMResponse>;
    /**
     * Stage 1: Compress analysis data for efficient processing
     */
    private stage1Compression;
    /**
     * Stage 2: Generate final structured summary
     */
    private stage2Summary;
    /**
     * Extract a representative sample from the commit diff
     */
    private extractDiffSample;
    /**
     * Explain changes to a specific symbol
     */
    explainSymbolChange(symbolName: string, changeType: string, filePath: string, lineNumber: number, previousCode: string, currentCode: string, commitSha: string, commitMessage: string): Promise<string>;
    /**
     * Compare files between commits
     */
    compareFiles(commitASha: string, commitAMessage: string, commitBSha: string, commitBMessage: string, fileList: string[], diffSummary: string, symbolChanges: string[]): Promise<string>;
}
//# sourceMappingURL=summarizer.d.ts.map