Perfect, let’s bake the “small LLM tie-breaker” into the DNA layer and lay out a **single, start-to-finish plan** that goes from “raw git” → “facts” → “explanations + 30-day playbook”.

I’ll structure this as:

1. **End-to-end pipeline (one glance)**
2. **Where the small LLM lives + how it behaves**
3. **Phased implementation plan (ordered, concrete)**
4. **How the big LLM consumes the data at the end**

---

## 1. End-to-end pipeline (single mental model)

From repo → report:

1. **Git Snapshot Layer**

   * Inputs: repo, commit window (e.g. last N commits / 90 days)
   * Output: concrete files per commit + diffs

2. **AST Layer (Tree-sitter)**

   * Input: source files at each commit
   * Output: ASTs per file

3. **Symbol & Callsite Layer (Deterministic)**

   * Input: ASTs
   * Output:

     * `RawSymbol` rows (function/class/method definitions)
     * `RawCallSite` rows (call expressions with callee name, positions)

4. **Symbol DNA Layer (Deterministic + Small LLM tie-breaker)**

   * Input: Raw symbols across commits
   * Output:

     * `SymbolDNA` records (stable ID per logical symbol)
     * `SymbolVersion` rows (per-commit instances of that symbol)

5. **History & Metrics Layer**

   * Input: DNA + versions + callsites
   * Output:

     * `symbol_history` in SQLite
     * per-symbol metrics: age, frequency, last_called, etc.

6. **Quant Analyzer Layer (Ghost / Zombie / Drift / Hotspots)**

   * Input: symbol history + current call graph
   * Output:

     * `AnalysisFact[]` – typed, deterministic findings

7. **Summary Layer (Bundles for AI/UI)**

   * Input: Analysis facts + history
   * Output:

     * `TimelineSummary` (per-symbol stories)
     * Aggregates: counts, per-file hotness, severity buckets

8. **LLM Narrative Layer (Big model)**

   * Input: TimelineSummary + Facts + Repo rules
   * Output:

     * Markdown report (“Why this matters”)
     * 30-day refactor playbook
     * (Optionally) Q&A

Small model only lives in **Layer 4** as a tie-breaker. Big model only lives in **Layer 8**.

---

## 2. Small LLM tie-breaker: how and where it runs

### The core problem it solves

When building DNA, you’ll sometimes have ambiguous candidates:

* Old symbol: `UserService::createUserV2`
* New symbol: `UserService::createUser`
* Bodies are similar but not identical, file paths moved, signatures tweaked.

You want to decide: **same logical symbol or not?**

### Matching pipeline

For each new RawSymbol version:

1. **Deterministic candidate search**

   * Match by:

     * same receiver / class (if method)
     * similar signature fingerprint (params & return)
     * same or nearby file/module (by path prefix)
   * Compute a **similarity score** (0–1) using:

     * signature similarity
     * body structure similarity (e.g., token-level diff)
     * name similarity (Levenshtein)
   * Pick top K candidates above a **deterministic threshold** (e.g. 0.6).

2. **Immediate decisions (no AI)**

   * If there’s a single candidate with score ≥ **high threshold** (e.g. 0.9) → **same DNA**.
   * If all candidates < **low threshold** (e.g. 0.4) → **new DNA**.

3. **Ambiguous zone → ask small LLM tie-breaker**

   * If top candidate’s score is in [0.4, 0.9):

     * Build a tiny prompt to a **cheap/local model** (Phi, Qwen-coder-mini, whatever):

       > “You are deciding whether two function versions are the same logical function or independent.
       > Here is the old version (from commit X):
       >
       > ```lang
       > [old signature + body]  
       > ```
       >
       > Here is the new version (from commit Y):
       >
       > ```lang
       > [new signature + body]  
       > ```
       >
       > Answer with JSON: `{ "same": true/false, "reason": "short" }`.”

   * Use the answer as:

     * `same: true` → reuse DNA
     * `same: false` → new DNA

4. **Auditability**

   * Store the decision and small LLM’s reason in a `dna_decision_log` table with:

     * `old_version_id`, `new_version_id`, `det_score`, `llm_same`, `reason`, `model_name`
   * This lets you:

     * Inspect weird calls
     * Adjust thresholds
     * Potentially retrain heuristics later

So the small LLM **only** acts as a bias-reducer in the “gray area” of rename/move detection, never as the core of DNA.

---

## 3. Comprehensive build plan (phases in order)

### Phase 0 – Contracts & DB schema

**Goal:** lock in data shapes so the rest isn’t rework.

1. Define TypeScript types for:

   * `RawSymbol`, `RawCallSite`
   * `SymbolDNA`, `SymbolVersion`
   * `AnalysisFact` variants (Ghost, Zombie, Drift, etc.)
   * `TimelineSummary`
2. Design SQLite schema:

   * `symbols_raw` (optional cache)
   * `symbol_dna`
   * `symbol_versions`
   * `callsites`
   * `analysis_facts`
   * `dna_decision_log`
3. Add a `Run` or `AnalysisRun` table:

   * `id`, `timestamp`, `commit_window`, `config_hash`.

Acceptance: simple migrations + types compile; you can write/read dummy rows.

---

### Phase 1 – Tree-sitter extraction → Raw symbols & callsites

**Goal:** pure structural extraction, no intelligence.

1. Integrate Tree-sitter parsers for your target languages.
2. Write extraction visitors per language:

   * **Symbols:** functions, methods, classes, etc.
   * **Callsites:** function/method calls, plus name + receiver info.
3. For a **single commit**:

   * Walk all relevant files.
   * Produce `RawSymbol[]` and `RawCallSite[]` with:

     * file path
     * range (start/end line/col)
     * commit SHA
4. Persistence:

   * Optionally store `RawSymbol`/`RawCallSite` in a staging table for debugging.

Tests:

* Fixture repo with known functions and calls.
* Snapshot tests: “symbols extracted = expected JSON”.

---

### Phase 2 – DNA engine (deterministic first, then tie-breaker)

**Goal:** stable symbol identity across commits.

1. Implement deterministic fingerprinting:

   * `signature_fingerprint(symbol)` – normalized text of name+params+return.
   * `body_fingerprint(symbol)` – minimal hash of body structure.
   * `name_similarity(a,b)`, `signature_similarity(a,b)`, `body_similarity(a,b)`.

2. Implement candidate lookup:

   * For each new RawSymbol (commit N):

     * Query `symbol_dna` + `symbol_versions` in nearby history (e.g. last 50 commits).
     * Compute similarity scores for candidates.

3. Decision logic w/out AI:

   * If `score >= 0.9` and no competitor within 0.1 → reuse DNA.
   * If no candidate `score >= 0.4` → new DNA.

4. Integrate small-LLM tie-breaker:

   * In ambiguous band [0.4, 0.9):

     * Call small LLM with old/new versions.
     * Use JSON output to decide.
     * Log decisions in `dna_decision_log`.

5. Upsert:

   * Ensure `symbol_dna` is created/updated.
   * Insert `symbol_versions` rows per commit.

Tests:

* Tiny repo where you:

  * rename functions
  * move files
  * lightly refactor bodies
* Assert that:

  * deterministic-only path handles obvious cases
  * tie-breaker decides correct mapping in edge cases.

---

### Phase 3 – History builder & metrics

**Goal:** build a timeline per DNA and compute basic statistics.

1. History assembly:

   * For each DNA, gather all versions sorted by commit date.
   * Annotate with:

     * `status` per commit: added/modified/deleted/renamed/moved.
2. Call metrics:

   * Count callsites per symbol per commit (or per time bucket).
   * Compute:

     * `first_seen_at`, `last_modified_at`
     * `last_called_at`
     * `total_calls`
     * `calls_per_month` (simple aggregation).
3. Store in `symbol_history` and possibly a denormalized table of **current status**:

   * `symbol_current` with one row per DNA (latest name, file, status, metrics).

Tests:

* Controlled fixture:

  * known timeline (add → call → stop calling → delete)
* Assertions:

  * statuses and dates match expectations.

---

### Phase 4 – Quant analyzers: ghosts, zombies, drift, hotspots

**Goal:** emit deterministic `AnalysisFact[]` on top of history + call graph.

1. **Ghost callers**

   * For each current callsite:

     * Resolve `callee_name` → candidate DNA in current snapshot.
     * If **no** matching symbol:

       * search history for similar names/signatures (like DNA matching but across all)
       * if there’s a clear candidate:

         * emit `GhostCallerFact` with guessed `dna_id`
       * else:

         * emit `GhostCallerFact` with `guessed_target_dna_id = null`.
   * Severity can depend on:

     * number of occurrences
     * whether in hot paths.

2. **Zombies**

   * For each `symbol_current`:

     * If `last_called_at` is null or older than threshold (e.g. 6–12 months) AND

       * symbol is still present (status != deleted):

         * emit `ZombieSymbolFact` with last seen info.
     * Optionally classify:

       * `never_called`, `legacy`.

3. **Drift**

   * For each DNA:

     * Compare older signature to latest.
     * If large changes:

       * Check if callsites changed in tandem.
       * If not, mark as `DriftFact` with risk grade.

4. **Hotspots**

   * Aggregate facts per file/module:

     * count facts, weight by severity.
   * Store a simple “heat” metric per file.

5. Persistence:

   * Store all generated facts in `analysis_facts` tied to `analysis_run_id`.

Tests:

* Fixture repo with planted:

  * ghost calls
  * zombies
  * signature drift
* Assert exact facts emitted.

---

### Phase 5 – Progressive run orchestration + streaming UI (still no big AI)

**Goal:** turn the above into something that feels alive in the webview.

1. Define phases:

   * Phase A: last 5 commits
   * Phase B: last 15 commits
   * Phase C: full window (last N commits / last X days)

2. For each phase:

   * Run:

     * extraction → DNA updates (with small LLM tie-breaker where needed) → history updates → analyzers.
   * Emit progress/summary events:

     ```ts
     type ProgressEvent =
       | { type: "phase_started"; phase: "A" | "B" | "C" }
       | { type: "phase_progress"; phase: ..., percent: number }
       | { type: "phase_summary"; phase: ..., counts: { ghosts: number; zombies: number; drift: number } }
       | { type: "run_complete"; run_id: string }
     ```

3. Webview UX:

   * Shows:

     * spinner per phase
     * live counts: “Found 3 ghosts, 12 zombies…”
     * hotspots list with file paths
   * All of this without any big LLM.

Acceptance:

* For a test repo, running “Analyze recent changes” shows:

  * progress across 3 phases
  * stable counts
  * clickable facts (even if detail view is basic).

---

### Phase 6 – Summary layer: TimelineSummary & Fact bundles

**Goal:** prepare clean payloads for the big LLM and UI.

1. `TimelineSummary` builder:

   * For all DNA with interesting facts:

     * compress history into a small struct:

       * first/last seen
       * commit count
       * calls_per_month (downsampled)
       * status

2. Fact bundling:

   * Group facts by:

     * symbol
     * file
     * category (ghost/zombie/drift)
   * Produce:

     * “Top 20 important facts” list
     * “Per-file fact clusters”.

3. Size control:

   * Put hard caps on:

     * # of facts sent to LLM
     * # of history points per symbol
   * Keep the rest in DB for drill-down.

Acceptance:

* For a real repo, JSON payload to LLM is:

  * bounded
  * obviously human-readable
  * clearly grounded in your DB rows.

---

### Phase 7 – Big LLM integration: report + 30-day playbook

**Goal:** use the big model as narrator/planner only.

1. Inputs to the prompt:

   * `TIMELINE_SUMMARY` – compressed symbol histories.
   * `FACTS` – selected `AnalysisFact[]` (with severity).
   * `REPO_RULES` – parsed `repo-conventions.json`.

2. Core prompt (two responsibilities):

   1. **Report with “Why this matters”**

      * For each fact:

        * explain what it is
        * explain why it matters using timeline & rules
        * propose concrete action (delete/fix/rename).

   2. **30-day refactor playbook**

      * Group actions by week (1–4) based on:

        * severity
        * dependency (don’t fix drift before ghosts in the same area)
        * rough effort (derived from # of callsites, files touched).

3. Streaming:

   * Once Phase C is complete and data is ready:

     * call LLM (local or remote) and stream markdown into webview.

4. Safety:

   * LLM **never** directly inspects raw code; it reads facts/histories you computed.
   * This guarantees “no lies about what changed,” only opinions about what to do.

Acceptance:

* On a medium repo, running analysis:

  * UI shows facts and hotspots as before.
  * Then the narrative appears:

    * clearly referencing actual symbols/files seen in facts.
    * with a coherent Week 1–4 plan.

---

### Phase 8 – Teach-the-AI config (configurable AI rules)

**Goal:** let repos customize both quant + narrative behavior.

1. `repo-conventions.json` design (v1):

   * `naming`, `bannedPatterns`, `falsePositives`, `parameterOrder`, etc.
   * `ignorePaths`, `excludeFiles` for noisy areas.
2. Apply to **quant analyzers**:

   * suppress facts for false-positives
   * adjust thresholds (e.g. treat some long-lived symbols as “legacy”, not zombies).
3. Inject into **big LLM prompt**:

   * “Obey these repo conventions…”
   * let it:

     * mention violations
     * prioritize according to rules.
4. (Later) UI panel:

   * read/edit this JSON
   * validate and show a quick preview (“these rules will suppress X zombies”).

Tie-in: this also lets you swap models (configurable AI), but at core it’s “teach the analyzers & narrator how this repo thinks.”

---

## 4. Answering your “pipeline timing” question directly

> *When does quant run and how? Will the AI get more insight in a certain phase if it gets a look at raw data mid-pipeline?*

* **Quant** (ghost/zombie/drift) always runs **after**:

  * symbols → DNA → history
  * in each progressive phase (5/15/full)
* The **small LLM** only runs mid-pipeline inside **DNA** as a tie-breaker on ambiguous matches.
* The **big LLM** runs **once, after all quant is done**, on the final snapshot.
* Giving the big LLM raw data mid-pipeline doesn’t give it meaningful extra insight–it just gives it incomplete, noisy inputs.

  * The sweet spot is: **you** transform raw data into structured facts, then LLM reasons over that. Not earlier.

---

If you want, next step I can take this and produce:

* a `PIPELINE.md` you can drop into the repo,
* plus a `schema.ts` sketch for the core types (`SymbolDNA`, `SymbolVersion`, `AnalysisFact`, `TimelineSummary`) so this can start being coded without rethinking the architecture.
