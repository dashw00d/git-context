import { AnalysisResult, LLMResponse } from '../types';
import { withTimeout } from '../utils/async';
import { logError } from '../utils/logger';
import { getLLMClient } from './openrouter';
import {
  FILE_COMPARISON_PROMPT,
  STAGE_1_COMPRESSION_PROMPT,
  STAGE_2_SUMMARY_PROMPT,
  SYMBOL_EXPLANATION_PROMPT,
} from './prompts';

export class LLMSummarizer {
  private _client: ReturnType<typeof getLLMClient> | null = null;

  private get client() {
    if (!this._client) {
      this._client = getLLMClient();
    }
    return this._client;
  }

  /**
   * Generate commit summary using two-stage LLM process
   */
  async summarizeCommit(analysis: AnalysisResult): Promise<LLMResponse> {
    try {
      const stage1Data = await this.stage1Compression(analysis);

      const summary = await this.stage2Summary(analysis, stage1Data);

      return summary;
    } catch (error) {
      logError('LLM summarization failed:', error);

      return {
        summary_md: `- Commit analysis failed: ${error}\n- Files changed: ${analysis.files.length}\n- Symbols modified: ${analysis.symbols.modified.length}`,
        breaking_changes: [],
        migration_notes: [],
        refactor_clusters: [],
        tests_needed: ['Verify changes manually'],
        questions_for_author: ['LLM analysis failed - manual review required'],
      };
    }
  }

  /**
   * Stage 1: Compress analysis data for efficient processing
   */
  private async stage1Compression(analysis: AnalysisResult): Promise<any> {
    const symbolsAdded = analysis.symbols.added.map(s => ({
      name: s.name,
      type: s.kind,
      signature: s.signature.substring(0, 100),
    }));

    const symbolsModified = analysis.symbols.modified.map(s => ({
      name: s.symbol.name,
      type: s.symbol.kind,
      change: s.changeType,
    }));

    const symbolsRemoved = analysis.symbols.removed.map(s => ({
      name: s.name,
      type: s.kind,
    }));

    const edgesAdded = analysis.edges.added.map(e => `${e.from} -> ${e.to} (${e.type})`);
    const edgesRemoved = analysis.edges.removed.map(e => `${e.from} -> ${e.to} (${e.type})`);

    let snippetsJson = '(none)';
    if (analysis.drift?.missing_symbols && analysis.drift.missing_symbols.length > 0) {
      const topMissing = analysis.drift.missing_symbols.slice(0, 3);
      const snippets = await this.fetchBreakingSnippets(topMissing);
      if (snippets.length > 0) {
        snippetsJson = JSON.stringify(snippets);
      }
    }

    const prompt = STAGE_1_COMPRESSION_PROMPT.replace(
      '{file_count}',
      analysis.files.length.toString()
    )
      .replace(
        '{diff_stats}',
        `Files: ${analysis.files.length}, Symbols: ${
          analysis.symbols.added.length +
          analysis.symbols.modified.length +
          analysis.symbols.removed.length
        }`
      )
      .replace('{symbols_added}', JSON.stringify(symbolsAdded.slice(0, 10)))
      .replace('{symbols_modified}', JSON.stringify(symbolsModified.slice(0, 10)))
      .replace('{symbols_removed}', JSON.stringify(symbolsRemoved.slice(0, 10)))
      .replace('{edges_added}', JSON.stringify(edgesAdded.slice(0, 5)))
      .replace('{edges_removed}', JSON.stringify(edgesRemoved.slice(0, 5)))
      .replace('{morph_highlights}', JSON.stringify(analysis.difftasticHighlights.slice(0, 5)))
      .replace('{snippets_json}', snippetsJson);

    const response = await withTimeout(
      this.client.complete(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.1,
          jsonMode: true,
          maxTokens: 1000,
        }
      ),
      120000,
      'Stage 1 compression'
    );

    try {
      return JSON.parse(response);
    } catch {
      return {
        summary_points: ['Analysis compression failed'],
        breaking_changes: [],
        key_symbols: [],
        risk_indicators: [],
        change_patterns: [],
      };
    }
  }

  /**
   * Stage 2: Generate final structured summary
   */
  private async stage2Summary(analysis: AnalysisResult, stage1Data: any): Promise<LLMResponse> {
    const diffSample = this.extractDiffSample(analysis);

    const prompt = STAGE_2_SUMMARY_PROMPT.replace(
      '{stage_1_json}',
      JSON.stringify(stage1Data, null, 2)
    )
      .replace('{diff_sample}', diffSample)
      .replace('{commit_message}', analysis.commit.message);

    const response = await withTimeout(
      this.client.complete(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.2,
          jsonMode: true,
          maxTokens: 2000,
        }
      ),
      120000,
      'Stage 2 summary'
    );

    try {
      return JSON.parse(response) as LLMResponse;
    } catch (error) {
      logError(`Failed to parse LLM response: ${error}`);

      return {
        summary_md: 'Failed to parse LLM response',
        breaking_changes: [],
        migration_notes: [],
        refactor_clusters: [],
        tests_needed: [],
        questions_for_author: [],
      };
    }
  }

  /**
   * Extract a representative sample from the commit diff
   */
  private extractDiffSample(analysis: AnalysisResult): string {
    const lines: string[] = [];

    lines.push(`Files changed: ${analysis.files.length}`);
    lines.push(`Symbols added: ${analysis.symbols.added.length}`);
    lines.push(`Symbols modified: ${analysis.symbols.modified.length}`);
    lines.push(`Symbols removed: ${analysis.symbols.removed.length}`);

    if (analysis.symbols.added.length > 0) {
      lines.push(
        `Added: ${analysis.symbols.added
          .slice(0, 3)
          .map(s => s.name)
          .join(', ')}`
      );
    }

    if (analysis.symbols.modified.length > 0) {
      lines.push(
        `Modified: ${analysis.symbols.modified
          .slice(0, 3)
          .map(s => s.symbol.name)
          .join(', ')}`
      );
    }

    return lines.join('\n');
  }

  /**
   * Fetch code snippets for breaking changes
   */
  private async fetchBreakingSnippets(missingSymbols: any[]): Promise<any[]> {
    const { GitOperations } = await import('../analysis/git');
    const git = new GitOperations();
    const snippets = [];

    for (const missing of missingSymbols.slice(0, 3)) {
      const lastSha = missing.expected?.lastSha;

      const filePath = missing.expected?.lastPath || missing.symbol_id?.split(':')[0];
      if (!lastSha || !filePath) continue;

      try {
        const beforeContent = (await git.safeGetFileContent(`${lastSha}~1`, filePath)) || '';
        const afterContent = (await git.safeGetFileContent(lastSha, filePath)) || '';

        if (beforeContent || afterContent) {
          snippets.push({
            symbol: missing.symbol_id,
            file: filePath,
            before: beforeContent.substring(0, 500),
            after: afterContent.substring(0, 500),
            version: missing.introducedAtVersion || lastSha,
          });
        }
      } catch (error) {
        continue;
      }
    }

    return snippets;
  }

  /**
   * Explain changes to a specific symbol
   */
  async explainSymbolChange(
    symbolName: string,
    changeType: string,
    filePath: string,
    lineNumber: number,
    previousCode: string,
    currentCode: string,
    commitSha: string,
    commitMessage: string
  ): Promise<string> {
    const prompt = SYMBOL_EXPLANATION_PROMPT.replace('{symbol_name}', symbolName)
      .replace('{change_type}', changeType)
      .replace('{file_path}', filePath)
      .replace('{line_number}', lineNumber.toString())
      .replace('{previous_code}', previousCode)
      .replace('{current_code}', currentCode)
      .replace('{commit_sha}', commitSha)
      .replace('{commit_message}', commitMessage);

    return await withTimeout(
      this.client.complete(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.3,
          maxTokens: 1000,
        }
      ),
      120000,
      'Explain symbol change'
    );
  }

  /**
   * Compare files between commits
   */
  async compareFiles(
    commitASha: string,
    commitAMessage: string,
    commitBSha: string,
    commitBMessage: string,
    fileList: string[],
    diffSummary: string,
    symbolChanges: string[]
  ): Promise<string> {
    const prompt = FILE_COMPARISON_PROMPT.replace('{commit_a_sha}', commitASha)
      .replace('{commit_a_message}', commitAMessage)
      .replace('{commit_b_sha}', commitBSha)
      .replace('{commit_b_message}', commitBMessage)
      .replace('{file_list}', fileList.join('\n'))
      .replace('{diff_summary}', diffSummary)
      .replace('{symbol_changes}', symbolChanges.join('\n'));

    return await withTimeout(
      this.client.complete(
        [
          {
            role: 'user',
            content: prompt,
          },
        ],
        {
          temperature: 0.2,
          maxTokens: 1500,
        }
      ),
      120000,
      'Compare files'
    );
  }
}
