"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMSummarizer = void 0;
const openrouter_1 = require("./openrouter");
const prompts_1 = require("./prompts");
class LLMSummarizer {
    constructor() {
        this._client = null;
    }
    get client() {
        if (!this._client) {
            this._client = (0, openrouter_1.getLLMClient)();
        }
        return this._client;
    }
    /**
     * Generate commit summary using two-stage LLM process
     */
    async summarizeCommit(analysis) {
        try {
            // Stage 1: Compress the analysis data
            const stage1Data = await this.stage1Compression(analysis);
            // Stage 2: Generate final structured summary
            const summary = await this.stage2Summary(analysis, stage1Data);
            return summary;
        }
        catch (error) {
            console.error('LLM summarization failed:', error);
            // Return minimal fallback response
            return {
                summary_md: `- Commit analysis failed: ${error}\n- Files changed: ${analysis.files.length}\n- Symbols modified: ${analysis.symbols.modified.length}`,
                breaking_changes: [],
                migration_notes: [],
                refactor_clusters: [],
                tests_needed: ['Verify changes manually'],
                questions_for_author: ['LLM analysis failed - manual review required']
            };
        }
    }
    /**
     * Stage 1: Compress analysis data for efficient processing
     */
    async stage1Compression(analysis) {
        const symbolsAdded = analysis.symbols.added.map(s => ({
            name: s.name,
            type: s.kind,
            signature: s.signature.substring(0, 100) // Truncate long signatures
        }));
        const symbolsModified = analysis.symbols.modified.map(s => ({
            name: s.symbol.name,
            type: s.symbol.kind,
            change: s.changeType
        }));
        const symbolsRemoved = analysis.symbols.removed.map(s => ({
            name: s.name,
            type: s.kind
        }));
        const edgesAdded = analysis.edges.added.map(e => `${e.from} -> ${e.to} (${e.type})`);
        const edgesRemoved = analysis.edges.removed.map(e => `${e.from} -> ${e.to} (${e.type})`);
        const prompt = prompts_1.STAGE_1_COMPRESSION_PROMPT
            .replace('{file_count}', analysis.files.length.toString())
            .replace('{diff_stats}', `Files: ${analysis.files.length}, Symbols: ${analysis.symbols.added.length + analysis.symbols.modified.length + analysis.symbols.removed.length}`)
            .replace('{symbols_added}', JSON.stringify(symbolsAdded.slice(0, 10))) // Limit for token efficiency
            .replace('{symbols_modified}', JSON.stringify(symbolsModified.slice(0, 10)))
            .replace('{symbols_removed}', JSON.stringify(symbolsRemoved.slice(0, 10)))
            .replace('{edges_added}', JSON.stringify(edgesAdded.slice(0, 5)))
            .replace('{edges_removed}', JSON.stringify(edgesRemoved.slice(0, 5)))
            .replace('{morph_highlights}', JSON.stringify(analysis.difftasticHighlights.slice(0, 5)));
        const response = await this.client.complete([{
                role: 'user',
                content: prompt
            }], {
            temperature: 0.1,
            jsonMode: true,
            maxTokens: 1000
        });
        try {
            return JSON.parse(response);
        }
        catch {
            // Fallback if JSON parsing fails
            return {
                summary_points: ['Analysis compression failed'],
                breaking_changes: [],
                key_symbols: [],
                risk_indicators: [],
                change_patterns: []
            };
        }
    }
    /**
     * Stage 2: Generate final structured summary
     */
    async stage2Summary(analysis, stage1Data) {
        // Extract a small sample of the raw diff for context
        const diffSample = this.extractDiffSample(analysis);
        const prompt = prompts_1.STAGE_2_SUMMARY_PROMPT
            .replace('{stage_1_json}', JSON.stringify(stage1Data, null, 2))
            .replace('{diff_sample}', diffSample)
            .replace('{commit_message}', analysis.commit.message);
        const response = await this.client.complete([{
                role: 'user',
                content: prompt
            }], {
            temperature: 0.2,
            jsonMode: true,
            maxTokens: 2000
        });
        try {
            return JSON.parse(response);
        }
        catch (error) {
            throw new Error(`Failed to parse LLM response: ${error}`);
        }
    }
    /**
     * Extract a representative sample from the commit diff
     */
    extractDiffSample(analysis) {
        // In a real implementation, we'd get the actual diff
        // For now, create a summary based on the analysis
        const lines = [];
        lines.push(`Files changed: ${analysis.files.length}`);
        lines.push(`Symbols added: ${analysis.symbols.added.length}`);
        lines.push(`Symbols modified: ${analysis.symbols.modified.length}`);
        lines.push(`Symbols removed: ${analysis.symbols.removed.length}`);
        if (analysis.symbols.added.length > 0) {
            lines.push(`Added: ${analysis.symbols.added.slice(0, 3).map(s => s.name).join(', ')}`);
        }
        if (analysis.symbols.modified.length > 0) {
            lines.push(`Modified: ${analysis.symbols.modified.slice(0, 3).map(s => s.symbol.name).join(', ')}`);
        }
        return lines.join('\n');
    }
    /**
     * Explain changes to a specific symbol
     */
    async explainSymbolChange(symbolName, changeType, filePath, lineNumber, previousCode, currentCode, commitSha, commitMessage) {
        const prompt = prompts_1.SYMBOL_EXPLANATION_PROMPT
            .replace('{symbol_name}', symbolName)
            .replace('{change_type}', changeType)
            .replace('{file_path}', filePath)
            .replace('{line_number}', lineNumber.toString())
            .replace('{previous_code}', previousCode)
            .replace('{current_code}', currentCode)
            .replace('{commit_sha}', commitSha)
            .replace('{commit_message}', commitMessage);
        return await this.client.complete([{
                role: 'user',
                content: prompt
            }], {
            temperature: 0.3,
            maxTokens: 1000
        });
    }
    /**
     * Compare files between commits
     */
    async compareFiles(commitASha, commitAMessage, commitBSha, commitBMessage, fileList, diffSummary, symbolChanges) {
        const prompt = prompts_1.FILE_COMPARISON_PROMPT
            .replace('{commit_a_sha}', commitASha)
            .replace('{commit_a_message}', commitAMessage)
            .replace('{commit_b_sha}', commitBSha)
            .replace('{commit_b_message}', commitBMessage)
            .replace('{file_list}', fileList.join('\n'))
            .replace('{diff_summary}', diffSummary)
            .replace('{symbol_changes}', symbolChanges.join('\n'));
        return await this.client.complete([{
                role: 'user',
                content: prompt
            }], {
            temperature: 0.2,
            maxTokens: 1500
        });
    }
}
exports.LLMSummarizer = LLMSummarizer;
//# sourceMappingURL=summarizer.js.map