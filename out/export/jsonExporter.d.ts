/**
 * JSON Context Exporter
 *
 * Generates machine-readable LLM context in the versioned JSON schema.
 * This is the SOURCE OF TRUTH - Markdown reports render FROM this data.
 */
import { LlmContextReport } from '../contracts/llmContext';
export declare function exportCommitContext(commitShas?: string[]): Promise<LlmContextReport>;
/**
 * Export and save JSON context to file
 */
export declare function exportAndSaveContext(commitShas?: string[]): Promise<string>;
/**
 * Generate prompt pack for LLM consumption
 */
export declare function generatePromptPack(context: LlmContextReport): string;
//# sourceMappingURL=jsonExporter.d.ts.map