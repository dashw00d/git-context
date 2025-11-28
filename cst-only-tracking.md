### Detailed Step-by-Step Plan to Implement Incremental Fact Building for All Languages (CST-Only + Hybrid Augmentation)

This plan implements the incremental approach for **all languages**: CST-only (e.g., Markdown, JSON) via hashing, diffs, and timelines; and **hybrid augmentation** for supported languages (PHP, JS/TS) to layer structural facts (e.g., comments, docstrings) on top of semantic symbols/edges. This enables richer narratives in reports/stories. Builds on existing pipeline, focusing on extensibility. Goal: Basic analysis (drift, hotspots) for CST-only + enhanced storytelling for all.

The implementation is phased for manageability: **Preparation** (setup and types), **Core Logic** (hashing, extraction, diffs), **Pipeline Integration** (steps and storage), **Testing and Validation**, and **Deployment/Iteration**. Estimated total effort: 2.5-4.5 weeks for a single developer, assuming familiarity with the codebase. Use TypeScript best practices (2-space indent, explicit types from `contracts/`).

#### Phase 1: Preparation (1-2 days) - Define Types and Config
   - **Step 1.1: Extend Types for CST Facts**
     - In [`types.ts`](src/types/index.ts) or [`pipelineTypes.ts`](src/analysis/runner/pipelineTypes.ts), add interfaces for CST-specific facts:
       - `CstFact` extends `SymbolInfo`: `{ kind: 'cst_node' | 'heading' | 'property' | 'doc_comment'; nodeType: string; level?: number; bodyShape: string; timeline: Array<{ version: string; dna: string; delta: DeltaChange }> }`.
       - `DeltaChange`: `{ type: 'added' | 'modified' | 'removed'; oldDna?: string; newDna?: string; locationDelta?: { oldLine: number; newLine: number } }`.
       - Update `RefactorBundleFacts` to include `hybridFacts: Map<string, (SymbolInfo | CstFact)[]>` (keyed by filePath; for both CST-only and augmentation).
     - Export from `contracts/` for consistency (e.g., `contracts/treeNodes.ts` for node unions).
     - Effort: 1 hour. Test: Compile with `tsc --noEmit`.

   - **Step 1.2: Config for CST-Only and Hybrid Augmentation**
     - In [`config.ts`](src/utils/config.ts), add `enableCstTracking: boolean` (default: true) for CST-only, `enableCstAugmentation: boolean` (default: false) for hybrid on supported langs, and `cstLanguages: Language[]` (default: ['markdown', 'json', 'yaml', 'css']) to `getExtensionConfig()`.
     - Update [`supportedLanguages.ts`](src/utils/supportedLanguages.ts) to expose `getAugmentableLanguages(): Language[]` (all `SUPPORTED_LANGUAGES`; optionally filter by config).
     - Invalidate cache on config changes (`invalidateCache()`).
     - Effort: 45 min. Test: Unit test with Vitest (`vitest.config.ts`): `expect(getAugmentableLanguages()).toContain('php'); expect(getAugmentableLanguages()).toContain('markdown')`.

   - **Step 1.3: Research and Prototype Node Extraction**
     - Use Tree-sitter playground (tree-sitter.github.io/playground) for Markdown/JSON/etc. and supported langs (e.g., JS comments): Parse samples, note key nodes (e.g., Markdown: `heading[depth=1]`; JS: `comment`).
     - Create sample files in `benchmarks/fixtures/` (e.g., `sample.md` with headings; `app.js` with function + JSDoc).
     - Effort: 2-4 hours. Output: Notes in a new `docs/cst-extractors.md` file.

#### Phase 2: Core Logic (3-5 days) - Hashing, Extraction, and Diffs
   - **Step 2.1: Implement Generic CST Extraction (CST-Only + Hybrid)**
     - In [`tree-sitter.ts`](src/analysis/tree-sitter.ts), add `extractCstFacts(node: Node, language: Language): CstFact[]`:
       - For CST-only (`isCstOnlyLanguage()`): Traverse recursively (depth limit 3); lang-specific (Markdown `heading`, JSON/YAML keys as `{ name: n.text, kind: 'heading', level: n.namedChildren[0]?.textContent.match(/#{1,6}/)?.length || 1, bodyShape: hashChildren(n) }` (use `symbolDna.ts` for hash); JSON/YAML: Traverse `object`/`block_mapping`, extract keys as `{ kind: 'property', name: key.value, bodyShape: hashValue(valueNode) }`).
       - For hybrid (supported langs + `enableCstAugmentation`): Extract auxiliary nodes (e.g., JS/PHP: `comment`/`doc_comment` as kind:'doc_comment'; strings as paths if relevant). Filter overlaps: `cstFacts.filter(f => !symbols.some(s => s.id === f.id || s.name === f.name))`.
       - Merge: `hybridFacts = [...symbols as any[], ...cstFacts]` (union type).
       - Return array or empty if no relevant nodes.
     - Integrate: In `extractSymbols()`, always call if enabled (CST-only or augment); return hybrid.
     - Effort: 1.5 days. Test: Unit test with mocked CST (from `benchmarks/mocks/fixtures/symbols.ts`): Mock JS file (function + comment); expect hybrid array length > symbols.

   - **Step 2.2: Enhance Hashing and Timeline Storage (Hybrid Support)**
     - In [`fingerprint.ts`](src/utils/fingerprint.ts), add `hashCstSubset(node: Node, includeChildren: boolean = true): string` (SHA-256 of serialized node via `astSerializer.ts`, exclude trivia like whitespace).
     - In [`symbolDna.ts`](src/analysis/symbolDna.ts), extend `computeDna()` for hybrid: `dna = stableHash(semanticDna + cstBodyShape)` if mixed; for CstFacts: `dna = stableHash(kind + name + level + bodyShape + timeline.length)`.
     - Create `CstTimelineManager` in new `src/analysis/cstTimeline.ts`:
       - Methods: `saveFacts(filePath: string, commitSha: string, facts: (SymbolInfo | CstFact)[], prevHash?: string)` (hybrid array; append to timeline, compute deltas per type).
       - `getPriorFacts(filePath: string, commitSha: string): (SymbolInfo | CstFact)[] | null` (query by hash/version; return hybrid).
     - Effort: 1 day. Test: Mock DB insert/query; hybrid mock (symbol + CST fact); verify merged timeline.

   - **Step 2.3: Implement CST Diff and Delta Generation**
     - In [`difftastic.ts`](src/analysis/difftastic.ts) or new `cstDiff.ts`, add `diffCst(oldCst: Node, newCst: Node): DiffResult[]`:
       - Serialize both CSTs (`astSerializer.ts`), run Difftastic on strings.
       - Parse diff output to map changes to nodes (e.g., "modified heading at line 5" → find matching node by location; for hybrid, prioritize semantic nodes).
       - Generate deltas: For each affected node, `{ type: 'modified', oldFact: prior, newFact: extractFromNewCst(node), locationDelta: ... }`; support hybrid (e.g., semantic rename + CST comment update).
     - Fallback: If Difftastic fails on CST (non-text), use Tree-sitter query-based diff (e.g., capture changed subtrees).
     - Integrate with `structuralDiffManager.ts`: Add `computeCstDelta(oldSerialized: string, newSerialized: string)`.
     - Effort: 1-2 days. Test: Diff sample.md v1 vs. v2 (change a heading); hybrid JS diff (function + comment); verify delta has `type: 'modified'`.

#### Phase 3: Pipeline Integration (4-6 days) - Hook into Steps and Storage
   - **Step 3.1: Update Indexing and Workspace Steps**
     - In [`indexCommitsStep.ts`](src/analysis/runner/steps/indexCommitsStep.ts), after parsing: If CST-only or augment enabled, compute fileHash, extract hybrid facts, save via `CstTimelineManager.saveFacts(..., commitSha)`.
     - In [`workingStep.ts`](src/analysis/runner/steps/workingStep.ts) and [`workspaceStep.ts`](src/analysis/runner/steps/workspaceStep.ts): On live changes (`liveTracker.ts`), re-hash, diff against prior (from DB or cache), update hybrid facts incrementally.
     - Handle unstaged/staged: Prioritize workspace overlay (`workspaceFactsAdapter.ts`) for live diffs.
     - Effort: 1 day. Test: Run pipeline on fixture repo with Markdown/JS changes; check DB for hybrid timelines.

   - **Step 3.2: Integrate with Analysis Steps (Hybrid)**
     - In [`driftStep.ts`](src/analysis/runner/steps/driftStep.ts): Extend `DriftFindings` to `hybridDrifts: (SymbolInfo | CstFact)[]` (e.g., "Symbol renamed + doc updated—no gap"; compare to `intended`).
     - In [`legacyStep.ts`](src/analysis/runner/steps/legacyStep.ts): Treat old timeline entries as "legacy facts" (e.g., unchanged headings/docs since v1 = low risk); flag zombie comments tied to deleted symbols.
     - In [`hotspotStep.ts`](src/analysis/runner/steps/hotspotStep.ts): Score hybrid changes in `HotspotDetector` (e.g., frequent heading mods + code churn = "doc/code hotspot").
     - In [`bundleFactsStep.ts`](src/analysis/runner/steps/bundleFactsStep.ts): Assemble `hybridFacts` into `bundleFacts` (via `bundleFactsAdapter.ts`); add to incompleteness metrics if timeline gaps (e.g., semantic change without doc update).
     - Effort: 2.5 days. Test: Mock hybrid facts; ensure drifts/hotspots include blended data.

   - **Step 3.3: Storage and DB Updates (Hybrid)**
     - In [`database.ts`](src/storage/database.ts) and [`schema.ts`](src/storage/schema.ts): Add `hybrid_facts` table/column (columns: filePath, version, serializedFacts JSON (hybrid array), timeline JSON, hash).
     - Use `safeAddColumn` for migration; run `migrateDatabase()` in `extension.ts` activate.
     - In `reportManager.ts`: Serialize hybrid timelines for export (JSON + Mermaid graph: `graph TD; v1[Heading: Main] --> v2[Updated: Main v2]; code[Function foo] --> doc[Doc foo]`).
     - Cache: Extend `snapshotManager.ts` for hybrid hashes (key: `${filePath}_${commitSha}`).
     - Effort: 1 day. Test: `auditAllModules()`; hybrid insert/query sample data.

   - **Step 3.4: Live Tracking Enhancements**
     - In [`liveAnalysis.ts`](src/analysis/liveAnalysis.ts): On debounce, if CST-only or augment, compute partial diff (limit to changed lines via Tree-sitter incremental parse if supported).
     - Update `LiveDiffTracker` in `liveTracker.ts` to trigger `CstTimelineManager` updates for hybrid.
     - Effort: 30 min. Test: Simulate edits in VS Code (e.g., JS comment change); check live UI tab (`cockpit/components/LiveTabContent.tsx`).

#### Phase 4: Testing and Validation (2-3 days)
   - **Step 4.1: Unit and Integration Tests**
     - Add tests in `benchmarks/liveAnalysis.test.ts` and `pipeline_metric_test.ts`: Cover extraction (mock CST), diffing (v1→v2), timeline append (hybrid scenarios: add/remove heading + symbol rename).
     - Use `benchmarks/mocks/scenarios/` for Markdown/JS refactor scenarios.
     - Effort: 1 day. Run: `vitest run src/analysis/cst*`.

   - **Step 4.2: Benchmark and Diagnostics**
     - Extend [`pipeline_diagnostics.ts`](benchmarks/pipeline_diagnostics.ts): Add `--cst-languages=markdown --augment=true` flag; measure extraction time, fact count, delta accuracy (hybrid coverage).
     - Run on fixtures (`benchmarks/fixtures/pipeline_frozen/`): Compare before/after (e.g., `npx ts-node benchmarks/pipeline_diagnostics.ts --commits=3 --no-workspace`).
     - Perf goal: <10% overhead for CST files, 5-15% for hybrid; validate no regressions in supported langs.
     - Effort: 1 day. Output: Update `PIPELINE_DIAGNOSTICS.md`.

   - **Step 4.3: Manual Validation**
     - Create test repo with Markdown/JS files; commit changes (e.g., rename heading + function).
     - Run CLI (`cli/analyze.ts`); verify reports include hybrid drifts/timelines/narratives.
     - Edge cases: Large files (limit nodes), no changes (reuse cache), rollbacks, overlaps (e.g., symbol vs. comment ID conflict).
     - Effort: 4-6 hours.

#### Phase 5: Deployment and Iteration (1 day + ongoing)
   - **Step 5.1: UI and Reporting Polish (Hybrid Narratives)**
     - In `webview/cockpit/components/BundleTabContent.tsx`: Add "Hybrid Facts" section (blended timelines/Mermaid viz).
     - In `storyStep.ts` (`llmAnalyst/`): LLM prompts: "Weave semantic + CST for narrative: [hybridFacts]" (e.g., "Function renamed, doc updated—full alignment").
     - Effort: 3 hours.

   - **Step 5.2: Rollout and Monitoring**
     - Merge to main; update CHANGELOG.md.
     - Monitor via `metrics/` (add "hybrid_coverage" counter); expose in Cockpit (`MetricsRow.tsx` toggle for augmentation).
     - Iterate: Gather feedback; extend to more langs (e.g., YAML next).
     - Effort: 1 hour. Post-deploy: Run on real project; fix issues.

#### Phase 6: Narrative Enhancements (2 days)
   - **Step 6.1: LLM and Export Integration**
     - In `llmContext.ts`/`bundleStoryEngine.ts`: Include hybrid facts for token-budgeted stories (e.g., "Enhance with structural evolutions").
     - `mermaidGenerator.ts`: Hybrid graphs (e.g., symbol --> doc delta).
     - `contextExporter.ts`: Export hybrid JSON.
     - Effort: 1 day. Test: Verify story output is richer (e.g., narrative depth metrics).

   - **Step 6.2: Metrics and Monitoring**
     - Extend `metrics/` (e.g., `patternDriftAdapter.ts`): Track narrative gaps (semantic change without CST update).
     - Cockpit `MetricsRow.tsx`: Visualize hybrid coverage.
     - Effort: 1 day. Test: End-to-end pipeline run with augmentation.

#### Risks and Mitigations
- **Perf**: Augmentation overhead (5-15%); limit depth/aux nodes, cache aggressively.
- **DB**: Unified `hybrid_facts` prevents bloat; TTL prune in `branchManager.ts`; JSON compression.
- **Accuracy**: Filter overlaps; CST diffs may miss semantics—start with Markdown/JS, validate manually.
- **Dependencies**: Relies on Difftastic for CST; if unstable, implement simple tree diff in `cstDiff.ts`.
- **Toggle**: Config flags for granular control (e.g., disable augment for speed).

This plan is self-contained, testable at each step, and aligns with codebase invariants (e.g., modular steps, DB safety). Once complete, all languages contribute meaningfully to analysis, with hybrid enabling enhanced, holistic narratives.