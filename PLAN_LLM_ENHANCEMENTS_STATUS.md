# LLM Prompt/Report Enhancements — Status & Notes

## Phase 1 (Completed)
1. **Evidence normalization + counts**
   - Missing/zombie/divergent lists deduped & sorted.
   - Category counts surfaced via `evidenceSummary.counts`.
2. **Slim payload + hybrid summary**
   - Raw `hybridFacts` dropped; replaced by `hybridSummary`.
   - Prompt-capture path uses slim facts.
3. **Curated discovery feed**
   - `discoveryFeed` added with top items.
4. **Origin tags in evidence links**
   - `origin` field supported in evidence links.
5. **Snippets for top items**
   - Snippets for missing/zombie/divergent items.
6. **Webview improvements**
   - UI updated to show stats/counts.

## Phase 2 (Completed & Verified)
1.  **Data Flow Fixes**
    -   `hotspots` now flow from detection to `RefactorBundleFacts` (evidence & summary).
    -   `hybridDrifts` flow into evidence summary.
2.  **Rich Context**
    -   `buildSlimFacts` now extracts snippets for:
        -   `hybridDrifts` (using location info).
        -   `hotspots` (using file content/touched versions).
3.  **Efficient Prompts**
    -   `discoverPatterns` now prioritizes `discoveryFeed` over raw feed (bug fix applied to ensure correct facts object is passed).
    -   `PROMPT_DISCOVER` updated to handle the curated feed format.

## Verification
-   `pipeline_diagnostics.json` confirms `hotspots` are present in `evidence` and `evidenceSummary` (with snippets).
-   `llm_summarized_facts.json` confirms `discoveryFeed` is populated.
-   Prompt capture logic updated to correctly use the slimmed facts containing the feed.

**Ready for next tasks.**
