### Design an Ultimate Modular LLM Summarizer for Refactor Analyses

#### Context & Assumptions
- The project is a TypeScript-based VS Code extension using Tree-sitter for parsing, Difftastic for diffs, SQLite for DB storage, and Qdrant for embeddings, with LLM integration via OpenRouter for analysis summarization.
- Key components include the existing `LLMSummarizer` in `src/llm/summarizer.ts`, prompts in `src/llm/prompts.ts`, analysis pipeline steps in `src/analysis/runner/steps/*`, and supporting modules like `src/analysis/difftastic.ts` for diffs and `src/storage/qdrantClient.ts` for clustering.
- We assume the input is always an `AnalysisResult` or `RefactorBundleFacts` from the pipeline (e.g., via `bundleFactsStep.ts`), with access to git history and workspace files; no new external dependencies are added, reusing existing concurrency and caching.
- Token limits are enforced at 4K-8K per LLM call (model-dependent), and the system targets 95%+ reduction for inputs >1M chars while improving accuracy via thematic focus.

#### Discovery / Recon (quick)
1. Inspect `src/llm/prompts.ts` for current prompt templates (e.g., `STAGE_1_COMPRESSION_PROMPT`) to identify placeholders for snippets and chunking.
2. Search codebase for `LLMSummarizer` usages (e.g., grep "new LLMSummarizer" in `src/analysis/bundleStoryEngine.ts` and `src/analysis/llmAnalyst/runner.ts`) to map integration points.
3. Read `src/analysis/git.ts` and `src/analysis/difftastic.ts` for diff/snippet extraction methods, confirming APIs like `getDiffHunks` or `parseStructuredDiff`.
4. Query DB schema in `src/storage/schema.ts` for symbol/edge tables to ensure snippet attachment (e.g., join on `symbol_versions.dna_id`).
5. Run benchmark command `npx ts-node benchmarks/pipeline_diagnostics.ts --commits=3 --no-workspace` to baseline current summarizer performance on sample data.
6. List Qdrant integration in `src/analysis/embeddingIndexer.ts` and `src/storage/qdrantClient.ts` for clustering capabilities (e.g., search "cosine similarity").
7. Check types in `src/contracts/llmContext.ts` and `src/types/index.ts` for `LLMResponse` extensions like `themed_chunks`.

#### Comprehensive Step-by-Step Plan (main body)

1. **Extend LLMSummarizer Class with Modular Chunking Interface**  
   Begin by refactoring `src/llm/summarizer.ts` to introduce an `UltimateSummarizer` subclass or extension of `LLMSummarizer`, adding a new public method `summarizeModular(analysis: AnalysisResult): Promise<EnhancedLLMResponse>` that orchestrates chunking before the existing two-stage process. This connects to the goal by providing a drop-in replacement for `summarizeCommit`, enabling thematic organization without breaking current calls—e.g., if `includeModular` config is false (from `src/utils/config.ts`), it falls back to the original. Why? The current holistic approach loses nuance in large analyses; chunking ensures focused LLM inputs, reducing hallucinations and token waste.  
   Define `EnhancedLLMResponse` extending `LLMResponse` with `themed_chunks: ThemedChunk[]`, where `ThemedChunk = { theme: string; summary: string; risks: string[]; snippets: CodeSnippet[]; validation: ValidationResult; }` and `CodeSnippet = { path: string; before: string; after: string; lines: [number, number]; }`, plus metadata like `chunkCount: number; totalTokens: number; reductionPercent: number`. Update the class constructor to inject dependencies: `private qdrant: QdrantClient` from `src/storage/qdrantClient.ts`, `private git: GitHelper` from `src/analysis/git.ts`, and `private concurrency: WorkerPool` from `src/analysis/runner/concurrency.ts`.  
   Example code addition (after line 216 in `src/llm/summarizer.ts`):  
   ```typescript
   // Before: Existing class ends with compareFiles method.
   // After: Add interface and new method.
   import { QdrantClient } from '../../storage/qdrantClient';
   import { GitHelper } from '../../analysis/git';
   import { WorkerPool } from '../../analysis/runner/concurrency';
   import { IntendedState } from '../../facts/intendedMap';  // For validation

   interface ThemedChunk { /* as above */ }
   interface EnhancedLLMResponse extends LLMResponse {
     themed_chunks: ThemedChunk[];
     metadata: {
       chunkCount: number;
       totalTokens: number;
       reductionPercent: number;
       snippetUsage: number;  // Chunks with snippets
     };
   }
   interface ValidationResult { matchesIntended: boolean; score: number; discrepancies: string[]; }

   export class UltimateSummarizer extends LLMSummarizer {
     constructor(
       private qdrant: QdrantClient,
       private git: GitHelper,
       private concurrency: WorkerPool,
       client?: ReturnType<typeof getLLMClient>
     ) {
       super(client);
     }

     async summarizeModular(analysis: AnalysisResult, options: { maxChunks?: number; includeSnippets?: boolean } = {}): Promise<EnhancedLLMResponse> {
       const { maxChunks = 10, includeSnippets = true } = options;
       try {
         // Step 1-3: Chunking, parallel summary, assembly (detailed in later steps)
         const chunks = await this.chunkAnalysis(analysis, maxChunks, includeSnippets);
         const summaries = await this.concurrency.parallelMap(chunks, chunk => this.summarizeChunk(chunk), { concurrency: 8 });
         const enhanced = await this.assembleChunks(summaries, analysis);
         return enhanced;
       } catch (error) {
         console.error('Modular summarization failed:', error);
         // Fallback to original
         return { ...await this.summarizeCommit(analysis), themed_chunks: [], metadata: { chunkCount: 0, totalTokens: 0, reductionPercent: 0, snippetUsage: 0 } };
       }
     }

     private async chunkAnalysis(/* ... */) { /* Implemented in Step 2 */ }
     private async summarizeChunk(/* ... */) { /* Step 3 */ }
     private async assembleChunks(/* ... */) { /* Step 4 */ }
   }
   ```  
   This sets up the orchestration, ensuring the new method integrates seamlessly with callers like `bundleStoryEngine.ts` by exporting `UltimateSummarizer` alongside the original.

2. **Implement Semantic Chunking with Embeddings and Issue Typing**  
   Add the private `chunkAnalysis(analysis: AnalysisResult, maxChunks: number, includeSnippets: boolean): Promise<AnalysisChunk[]>` method to `src/llm/summarizer.ts`, where `AnalysisChunk = { theme: string; symbols: Symbol[]; edges: Edge[]; issues: IssueType[]; snippets?: CodeSnippet[]; embedding?: number[]; }` and `IssueType = 'breaking' | 'feature' | 'legacy' | 'hotspot'`. This step creates 5-10 thematic chunks by embedding symbols/edges via Qdrant, clustering with cosine similarity (>0.7 threshold), and typing via pipeline outputs (e.g., `drift.findings` from `src/facts/driftDetector.ts`). Why? Chunking organizes unorganized tokens into focused groups (e.g., "Auth Feature" vs. "UI Breaking Changes"), directly addressing the 1M+ token problem by capping each at ~5K-10K chars. It connects to the goal by enabling per-theme summaries, leveraging existing `embeddingStep.ts` for vectors.  
   Process: (1) Extract raw elements from `analysis` (symbols/edges/files). (2) Embed via `qdrant.embedAndStore` if not cached (use `symbolDna.ts` for stable IDs). (3) Query Qdrant for clusters (e.g., `searchSimilar(analysis.commit.sha, limit: maxChunks)`). (4) Assign types: Map `drift.missing/zombie` to 'breaking', `hotspots.top25` to 'hotspot', added clusters to 'feature' via simple grouping (e.g., shared file prefix or DNA hash). (5) If `includeSnippets`, attach via `git.getHunks` (detailed in Step 3). Limit chunks to `maxChunks`; merge small ones.  
   Example code (insert after the new constructor in `src/llm/summarizer.ts`):  
   ```typescript
   // Before: No chunking logic.
   // After: Add chunkAnalysis method.
   import { DriftFindings } from '../../facts/types';  // For issue typing
   import { Hotspot } from '../../analysis/hotspotDetector';  // For hotspots

   interface AnalysisChunk { /* as above */ }

   private async chunkAnalysis(analysis: AnalysisResult, maxChunks: number, includeSnippets: boolean): Promise<AnalysisChunk[]> {
     const { symbols, edges, drift, hotspots, commit } = analysis;
     const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol), ...symbols.removed];
     const rawChunks: Partial<AnalysisChunk>[] = [];

     // 1. Embed symbols/edges if needed
     const vectors = await this.qdrant.embedBatch(allSymbols.map(s => ({ text: `${s.name} ${s.kind} ${s.signature.substring(0, 200)}`, metadata: { sha: commit.sha, dna: s.dnaId } })));
     const embeddedSymbols = allSymbols.map((s, i) => ({ ...s, embedding: vectors[i] }));

     // 2. Cluster via Qdrant similarity (reuse historyRetrieval logic)
     const clusters = await this.qdrant.searchClusters(embeddedSymbols.map(s => s.embedding!), { threshold: 0.7, maxClusters: maxChunks });
     for (const cluster of clusters) {
       const chunkSymbols = embeddedSymbols.filter(s => cluster.includes(s.dnaId));
       const chunkEdges = edges.added.filter(e => chunkSymbols.some(s => s.id === e.from || s.id === e.to));
       
       // 3. Type issues
       let issues: IssueType[] = [];
       if (drift) {
         const breaking = (drift.missing || []).filter(m => chunkSymbols.some(s => s.id === m.symbolId));
         if (breaking.length > 0) issues.push('breaking');
         const legacy = (drift.zombie || []).filter(z => chunkSymbols.some(s => s.id === z.symbolId));
         if (legacy.length > 0) issues.push('legacy');
       }
       if (hotspots) {
         const hot = hotspots.filter(h => chunkSymbols.some(s => s.id === h.symbolId));
         if (hot.length > 0) issues.push('hotspot');
       }
       if (issues.length === 0) issues.push('feature');  // Default for adds

       // 4. Theme from top symbols or files
       const theme = this.inferTheme(chunkSymbols);  // Simple: common file prefix or LLM micro-call if >5 symbols

       rawChunks.push({ theme, symbols: chunkSymbols, edges: chunkEdges, issues, embedding: cluster.centroid });
     }

     // 5. Attach snippets if flagged (delegate to Step 3 logic)
     if (includeSnippets) {
       for (const chunk of rawChunks) {
         chunk.snippets = await this.fetchRelevantSnippets(chunk.symbols, commit.sha);
       }
     }

     // Merge small chunks (<3 symbols) into nearest large one via similarity
     return this.mergeSmallChunks(rawChunks, maxChunks);
   }

   private inferTheme(symbols: Symbol[]): string {
     // Heuristic: Common file or kind
     const files = [...new Set(symbols.map(s => s.filePath.split('/').slice(-2).join('/')))];
     return files.length === 1 ? `Feature: ${files[0]}` : `Changes: ${symbols[0].kind}`;
   }

   private async fetchRelevantSnippets(/* ... */) { /* Implemented in Step 3 */ }
   private mergeSmallChunks(/* ... */): AnalysisChunk[] { /* Simple similarity merge */ }
   ```  
   This method ensures chunks are semantically coherent, preparing for parallel processing while respecting token budgets (e.g., embed only if `!s.embedding`).

3. **Add Selective Snippet Fetching and Parallel Per-Chunk Summarization**  
   Implement `fetchRelevantSnippets(symbols: Symbol[], sha: string): Promise<CodeSnippet[]>` and the private `summarizeChunk(chunk: AnalysisChunk): Promise<MiniLLMResponse>` in `src/llm/summarizer.ts`, using `git.getFileDiff(sha, symbol.filePath)` from `src/analysis/git.ts` and `difftastic.parseHunks` from `src/analysis/difftastic.ts` to extract 50-200 line snippets (before/after around symbol lines, truncated if >100 lines). For each chunk, adapt the two-stage prompts: Stage 1 compresses chunk data + snippets; Stage 2 synthesizes with theme context. Why? Snippets provide concrete evidence for accuracy (e.g., spotting a breaking rename), but selectively to avoid bloat—only for 'breaking'/'hotspot' issues or if `includeSnippets=true`. Parallelize via `concurrency.parallelMap` to process 8 chunks concurrently, connecting to the goal by enabling efficient, evidence-based summaries per theme.  
   In `fetchRelevantSnippets`: For each symbol, get diff hunk via git (fallback to workspace read if live), extract lines ±5 around symbol start/end using Tree-sitter nodes from `src/analysis/tree-sitter.ts`. Limit to top 3 hunks/chunk. In `summarizeChunk`: Reuse `stage1Compression` but scoped (e.g., `symbols: chunk.symbols.slice(0,20)`), inject `{snippets_json}` into prompts (update `STAGE_1_COMPRESSION_PROMPT` in Step 5). Output `MiniLLMResponse` mirroring `LLMResponse` but chunk-scoped. Track tokens via client metadata.  
   Example code (insert after `chunkAnalysis`):  
   ```typescript
   // Before: No snippet or chunk summary logic.
   // After: Add methods.
   import { DifftasticParser } from '../../analysis/difftastic';
   import { TreeSitterExtractor } from '../../analysis/tree-sitter';

   private async fetchRelevantSnippets(symbols: Symbol[], sha: string): Promise<CodeSnippet[]> {
     const snippets: CodeSnippet[] = [];
     const difftastic = new DifftasticParser();  // Assume init
     const extractor = new TreeSitterExtractor();

     for (const symbol of symbols.slice(0, 10)) {  // Limit per chunk
       try {
         // Get raw diff hunk
         const diff = await this.git.getFileDiff(sha, symbol.filePath, { contextLines: 5 });
         if (!diff) continue;

         // Parse structured hunks
         const hunks = difftastic.parseHunks(diff, symbol.lineStart, symbol.lineEnd);
         const topHunk = hunks[0];  // Prioritize first/most relevant

         // Extract before/after with Tree-sitter for precise bounds
         const beforeContent = await this.git.getFileContent(sha + '~1', symbol.filePath);  // Previous commit
         const afterContent = await this.git.getFileContent(sha, symbol.filePath);
         const beforeLines = extractor.extractSnippet(beforeContent, symbol.lineStart - 5, symbol.lineEnd + 5);
         const afterLines = extractor.extractSnippet(afterContent, symbol.lineStart - 5, symbol.lineEnd + 5);

         // Truncate to 100 lines max
         const snippet: CodeSnippet = {
           path: symbol.filePath,
           before: beforeLines.join('\n').substring(0, 2000),  // Char limit
           after: afterLines.join('\n').substring(0, 2000),
           lines: [symbol.lineStart - 5, symbol.lineEnd + 5]
         };
         snippets.push(snippet);
       } catch (error) {
         console.warn(`Snippet fetch failed for ${symbol.name}: ${error}`);
       }
     }
     return snippets.slice(0, 3);  // Top 3 per chunk
   }

   private async summarizeChunk(chunk: AnalysisChunk): Promise<MiniLLMResponse> {
     const inputSize = JSON.stringify(chunk).length;  // Baseline for reduction
     const stage1 = await this.stage1CompressionChunk(chunk);  // Scoped version
     const stage2 = await this.stage2SummaryChunk(chunk, stage1);
     
     const outputSize = JSON.stringify(stage2).length;
     stage2.metadata = { ...stage2.metadata, inputTokens: Math.ceil(inputSize / 4), outputTokens: Math.ceil(outputSize / 4), reduction: 1 - (outputSize / inputSize) };

     return stage2;
   }

   private async stage1CompressionChunk(chunk: AnalysisChunk): Promise<any> {
     // Similar to stage1Compression, but chunk-scoped
     const symbolsAdded = chunk.symbols.filter(s => s.changeType === 'added').map(s => ({ name: s.name, type: s.kind, signature: s.signature.substring(0, 100) }));
     // ... (adapt for modified/removed, edges, issues)
     const snippetsJson = JSON.stringify(chunk.snippets || []);
     const prompt = STAGE_1_COMPRESSION_PROMPT  // Updated in Step 5
       .replace('{symbols_added}', JSON.stringify(symbolsAdded.slice(0, 10)))
       // ... other replaces
       .replace('{snippets_json}', snippetsJson)
       .replace('{theme}', chunk.theme)
       .replace('{issues}', chunk.issues.join(', '));

     const response = await this.client.complete([{ role: 'user', content: prompt }], { temperature: 0.1, jsonMode: true, maxTokens: 800 });
     return JSON.parse(response);
   }

   private async stage2SummaryChunk(chunk: AnalysisChunk, stage1: any): Promise<MiniLLMResponse> {
     // Similar to stage2Summary, inject theme/snippet sample
     const snippetSample = (chunk.snippets || []).slice(0, 1).map(s => `Path: ${s.path}\nBefore: ${s.before.substring(0, 500)}\nAfter: ${s.after.substring(0, 500)}`).join('\n');
     const prompt = STAGE_2_SUMMARY_PROMPT
       .replace('{stage_1_json}', JSON.stringify(stage1))
       .replace('{snippet_sample}', snippetSample)
       .replace('{theme}', chunk.theme);

     const response = await this.client.complete([{ role: 'user', content: prompt }], { temperature: 0.2, jsonMode: true, maxTokens: 1500 });
     return JSON.parse(response) as MiniLLMResponse;
   }
   ```  
   This ensures snippets are fetched efficiently (cached by SHA/path in `snapshotManager.ts` if extended), and per-chunk summaries are lightweight, with token tracking for metadata.

4. **Build Assembly and Validation Logic**  
   Add `assembleChunks(summaries: MiniLLMResponse[], analysis: AnalysisResult): Promise<EnhancedLLMResponse>` to `src/llm/summarizer.ts`, merging summaries into sectioned markdown (e.g., `summary_md = summaries.map(s => `## ${s.theme}\n${s.summary_md}\n${s.risks.join('\n')}`).join('\n\n')`), computing aggregate metadata (e.g., `totalTokens = sum(s.metadata.outputTokens)`), and validating via `validateAgainstIntended(summaries, analysis.intended)`. For validation, use a quick LLM call or rule-based check: Compare chunk risks against `intendedState` map (e.g., flag if 'breaking' chunk has unresolved callers not in `intended.absent`). Why? Assembly weaves modular outputs into a cohesive report, while validation ensures accuracy (e.g., cross-check snippets against expected states), tying back to the goal by producing an enhanced, verifiable `LLMResponse` with `themed_chunks`. This step connects upstream chunking to downstream UI integration (e.g., render in `RefactorReportView.tsx`).  
   In assembly: Sort chunks by priority ('breaking' first), add cross-links (e.g., scan for shared symbols via `dependencies.ts`), optional meta-LLM for intro ("Overall: 2 features, 1 issue"). For validation: Per chunk, prompt "Does {snippet.after} match {intendedState[symbol.name]}?" (temp 0.1, 500 tokens).  
   Example code (insert after `summarizeChunk`):  
   ```typescript
   // Before: No assembly.
   // After: Add assembleChunks.
   import { IntendedMap } from '../../facts/intendedMap';
   import { DependencyGraph } from '../../analysis/dependencies';

   private async assembleChunks(summaries: MiniLLMResponse[], analysis: AnalysisResult): Promise<EnhancedLLMResponse> {
     const deps = new DependencyGraph(analysis.edges);  // For cross-links
     let summaryMd = '';
     const themedChunks: ThemedChunk[] = [];
     let totalInputTokens = 0, totalOutputTokens = 0;

     // Sort by priority: breaking > hotspot > feature > legacy
     const sortedSummaries = summaries.sort((a, b) => {
       const prio = { breaking: 0, hotspot: 1, feature: 2, legacy: 3 };
       return prio[a.issues[0] || 'feature'] - prio[b.issues[0] || 'feature'];
     });

     for (const summary of sortedSummaries) {
       // Validate
       const validation = await this.validateChunk(summary, analysis.intended);
       
       // Build chunk
       const chunk: ThemedChunk = {
         theme: summary.theme,
         summary: summary.summary_md,
         risks: summary.breaking_changes || [],
         snippets: summary.snippets || [],  // From input chunk
         validation
       };

       // Cross-link: Find related chunks
       const related = deps.findRelatedSymbols(summary.key_symbols || [], 0.5);  // Threshold
       if (related.length > 0) chunk.summary += `\n**Related:** ${related.map(r => r.theme).join(', ')}`;

       themedChunks.push(chunk);
       summaryMd += `## ${summary.theme}\n${summary.summary}\n\n**Risks:** ${summary.risks.join('\n- ')}\n\n`;
       totalInputTokens += summary.metadata.inputTokens;
       totalOutputTokens += summary.metadata.outputTokens;
     }

     // Aggregate
     const reduction = 1 - (totalOutputTokens / totalInputTokens);
     const metadata = {
       chunkCount: summaries.length,
       totalTokens: totalOutputTokens,
       reductionPercent: Math.round(reduction * 100),
       snippetUsage: themedChunks.filter(c => c.snippets.length > 0).length
     };

     // Meta-summary optional: Low-token LLM for intro
     const introPrompt = `Weave intro from these themes: ${sortedSummaries.map(s => s.theme).join(', ')}. Focus on overall refactor health.`;
     const introResponse = await this.client.complete([{ role: 'user', content: introPrompt }], { temperature: 0.2, maxTokens: 300 });
     summaryMd = `${introResponse}\n\n${summaryMd}`;

     // Base LLMResponse + enhancements
     const base = { summary_md: summaryMd, breaking_changes: themedChunks.flatMap(c => c.risks), /* ... other fields aggregated */ };
     return { ...base, themed_chunks: themedChunks, metadata };
   }

   private async validateChunk(summary: MiniLLMResponse, intended: IntendedMap): Promise<ValidationResult> {
     let score = 1.0;
     const discrepancies: string[] = [];
     for (const risk of summary.breaking_changes || []) {
       const symbolName = risk.match(/symbol: (\w+)/)?.[1];
       if (symbolName && intended.has(symbolName)) {
         const expected = intended.get(symbolName)!;
         if (expected.state === 'absent' && risk.includes('breaking')) {
           score -= 0.2;  // Penalty
           discrepancies.push(`Expected absent but found in ${risk}`);
         }
       }
     }
     // Optional LLM validation for snippets
     if (summary.snippets && summary.snippets.length > 0) {
       const valPrompt = `Validate: For theme "${summary.theme}", does after-snippet match intended? Snippets: ${JSON.stringify(summary.snippets.slice(0,1))}. Intended: ${JSON.stringify([...intended.entries()].slice(0,5))}`;
       const valResponse = await this.client.complete([{ role: 'user', content: valPrompt }], { temperature: 0.1, maxTokens: 500, jsonMode: true });
       const parsed = JSON.parse(valResponse);
       score *= parsed.confidence || 1;
       if (!parsed.matches) discrepancies.push(...(parsed.discrepancies || []));
     }
     return { matchesIntended: score > 0.8, score, discrepancies };
   }
   ```  
   This produces a rich, validated output, with cross-links enhancing usability in reports (e.g., clickable in `cockpit/components/BundlePanel.tsx`).

5. **Update Prompts, Integrate into Pipeline, and Add Config/Exports**  
   Modify `src/llm/prompts.ts` to add chunk-aware templates (e.g., `STAGE_1_COMPRESSION_CHUNK_PROMPT` with `{snippets_json}` and `{theme}` placeholders), then update `src/llm/summarizer.ts` exports to default to `UltimateSummarizer` (inject deps via factory). Integrate by replacing calls in `src/analysis/bundleStoryEngine.ts` (e.g., `summarizer.summarizeModular(facts)` in `generateStory`) and `src/analysis/llmAnalyst/runner.ts` (e.g., in `runAnalysis` if facts.size > 1M chars). Add config flag `useModularSummarizer` in `src/utils/config.ts` (default true). Why? Prompts must support new inputs for snippet/theme awareness; integration ensures automatic use in large analyses, connecting the summarizer to the full pipeline (e.g., after `bundleFactsStep`). This finalizes the goal by making the ultimate version production-ready.  
   Export factory: `export const getUltimateSummarizer = () => new UltimateSummarizer(new QdrantClient(), new GitHelper(), new WorkerPool(8));`. Test via updated benchmark in `benchmarks/pipeline_diagnostics.ts` (add `--modular` flag).  
   Example code for prompts (`src/llm/prompts.ts`, after existing constants):  
   ```typescript
   // Before: Existing STAGE_2_SUMMARY_PROMPT lacks snippet/theme.
   // After: Add new prompts.
   export const STAGE_1_COMPRESSION_CHUNK_PROMPT = `
   Compress this themed analysis chunk for summarization.
   Theme: {theme}
   Issues: {issues}
   Symbols added: {symbols_added}
   Symbols modified: {symbols_modified}
   Edges: {edges_added}
   Snippets (code evidence): {snippets_json}
   Provide JSON: { summary_points, key_risks, patterns }
   `;

   export const STAGE_2_SUMMARY_CHUNK_PROMPT = `
   Generate structured summary for theme: {theme}
   From compressed: {stage_1_json}
   Evidence snippets: {snippet_sample}
   Focus on risks for issues: {issues}
   Output JSON: { summary_md, breaking_changes, migration_notes, tests_needed }
   `;
   ```  
   For integration in `src/analysis/bundleStoryEngine.ts` (around line 100, assuming):  
   ```typescript
   // Before: const summary = await summarizer.summarizeCommit(analysis);
   // After:
   import { getUltimateSummarizer } from '../llm/summarizer';
   const summarizer = getUltimateSummarizer();
   const enhanced = await summarizer.summarizeModular(analysis, { maxChunks: config.maxChunks || 10, includeSnippets: true });
   // Use enhanced.themed_chunks for story generation
   const storyMd = enhanced.themed_chunks.map(c => c.summary).join('\n\n');
   ```  
   This ensures seamless adoption, with config controlling rollout.

#### Risks, Unknowns, Decisions
- **Edge Case: Oversized Chunks Despite Limits**: If a single theme exceeds 20K tokens (e.g., massive file refactor), recursive sub-chunking could fail on very dense code. Risk: LLM overload or fallback to holistic (losing modularity). Mitigation: Add pre-check in `chunkAnalysis` to split by file/sub-issue.
- **Performance Risk: Parallel LLM Calls in Low-Resource Env**: 8 concurrent calls could spike CPU/memory in VS Code (e.g., on laptops), increasing latency from 2s to 10s for 10 chunks. Migration: No DB changes, but Qdrant queries add ~500ms. Test via benchmarks to cap at 4 workers if needed.
- **Accuracy Risk: Snippet Truncation Leading to Misinterpretation**: Short snippets (100 lines) might omit context (e.g., a function call without imports), causing false positives in validation. Unknown: LLM sensitivity to partial code. Mitigation: Always include signature + 3-line context; validate with full `intendedState`.
- **Decision: Rule-Based vs. LLM for Theme Inference (Option A: Heuristic like file prefix—Pros: Fast (0ms), deterministic; Cons: Less semantic for cross-file themes. Option B: Micro-LLM call (200 tokens)—Pros: Accurate for complex (e.g., "auth" across modules); Cons: +10% cost/latency. Choose A for default, B if config `advancedTheming=true`—balances speed/quality.**
- **Decision: Full vs. Selective Snippets (Option A: Always include for issues only—Pros: Targeted (saves 50% tokens), focused accuracy; Cons: Misses feature nuances. Option B: All chunks—Pros: Comprehensive; Cons: Token bloat (2x overhead). Choose A, as it aligns with prioritization from `riskDetector.ts`.**
- **Unknown: Qdrant Availability in Offline Mode**: If no embeddings (e.g., first run), fallback to file-based grouping. Risk: Poorer clustering. Decision: Cache local vectors in DB (`symbol_versions.embedding` column via `safeAddColumn` in `src/storage/database.ts`).