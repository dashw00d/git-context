# Plan: LLM Context Enhancements (Phase 2)

This plan addresses the remaining gaps in the LLM pipeline context, specifically focusing on missing data flows for hotspots and hybrid drifts, snippet coverage, and discovery feed integration.

## Goals
1.  **Perfect Data Flow:** Ensure `hotspots` and `hybridDrifts` flow correctly from detection to the final `RefactorBundleFacts` evidence.
2.  **Rich Context:** Augment `hybridDrifts` and `hotspots` with code snippets in `buildSlimFacts`.
3.  **Efficient Prompts:** Switch the Discovery/Quantify/Plan prompt chain to use the curated `discoveryFeed` instead of raw dumps.

## Step 1: Fix Data Flow (Hotspots & Hybrid Drifts)

### 1.1 Update Facts Assembler
**File:** `src/facts/factsAssembler.ts`
-   Update `buildRefactorBundleFacts` options interface to include `hotspots: any[]`.
-   Map `options.hotspots` to `evidence.hotspots` in the returned `RefactorBundleFacts` object.

### 1.2 Update Bundle Facts Step
**File:** `src/analysis/runner/steps/bundleFactsStep.ts`
-   Pass `state.hotspots` to `buildRefactorBundleFacts` in the options object.

## Step 2: Enhance LLM Analyst Runner

### 2.1 Update `buildSlimFacts`
**File:** `src/analysis/llmAnalyst/runner.ts`
-   **Hybrid Drifts:** Ensure `evidenceSummary.hybridDrifts` is populated. Add snippet extraction for these items (using `getSnippet`).
-   **Hotspots:** Ensure `evidenceSummary.hotspots` is populated from `evidence.hotspots`. Add snippet extraction (read file at line 0 or use `touchedInVersions` to find relevant lines if possible, otherwise top of file).
-   **Discovery Feed:** Ensure `discoveryFeed` includes top items from `hybridDrifts` and `hotspots`, enriched with snippets.

### 2.2 Update `discoverPatterns`
**File:** `src/analysis/llmAnalyst/runner.ts`
-   Modify `discoverPatterns` to check for `facts.discoveryFeed`.
-   If present, pass `discoveryFeed` to the LLM prompt instead of `rawFeed`.
-   Update the prompt construction to label it `DISCOVERY FEED JSON`.

## Step 3: Update Prompts

### 3.1 Update Discovery Prompt
**File:** `src/llm/prompts.ts`
-   Update `PROMPT_DISCOVER` description and instructions to refer to `DISCOVERY FEED JSON`.
-   Update examples in the prompt to match the shape of the discovery feed items (which will have `type`, `file`, `snippet`, etc.).

## Step 4: Verification

### 4.1 Run Diagnostics
-   Run `npx ts-node benchmarks/pipeline_diagnostics.ts --commit-count=6` to generate a report.
-   Check `benchmarks/output/pipeline_diagnostics.json` (or console output) to verify:
    -   `evidence.hotspots` is present.
    -   `evidenceSummary.hotspots` is populated.
    -   `discoveryFeed` contains hotspots and hybrid drifts.
    -   Token counts are reasonable.

## Execution Order
1.  Step 1 (Assembler & Step)
2.  Step 2 (Runner Logic)
3.  Step 3 (Prompts)
4.  Step 4 (Verification)
