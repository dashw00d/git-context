## 1. Unified Flow Chart – End-to-End

Think in **layers**:

* **Layer 0 – Raw Git & Workspace**
* **Layer 1 – Structural Index (Tree-Sitter snapshots + Difftastic)**
* **Layer 2 – Facts & Metrics (DB)**
* **Layer 3 – Semantic Memory (Quant embeddings)**
* **Layer 4 – Story Engine (LLM)**
* **Layer 5 – Cockpit UI (queries only)**

### 1.0 High-Level

```text
                ┌───────────────────────────────────────────┐
                │           RAW SOURCES                     │
                │  Git history (immutable) + Workspace      │
                └───────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 1: STRUCTURAL INDEX                                        │
│  Tree-Sitter AST snapshots + Difftastic structural diffs         │
└──────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 2: FACTS & METRICS                                         │
│  commits_analysis, symbol_versions, edges, renames, risks, etc.  │
└──────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 3: SEMANTIC MEMORY (QUANT)                                │
│  Commit/story shards, symbol story shards, theme shards → vecs  │
└──────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 4: STORY ENGINE (LLM)                                      │
│  Bundle facts + retrieved history → stories, drift, plans        │
└──────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 5: COCKPIT UI                                              │
│  React webview reading DB + LLM outputs, never re-analyzing      │
└──────────────────────────────────────────────────────────────────┘
```

Now expanded with actual steps.

---

### 1.1 Commit Indexing (Immutable Layer)

**Runs once per commit per analysis_version.**

```text
For each commit SHA (on demand):

1. ensureCommitIndexed(sha)
   ├─ Check commits_analysis WHERE sha, analysis_version, status='complete'
   │   ├─ If found → return stored CommitFacts (no heavy work)
   │   └─ Else:
   │       ├─ Mark row as status='pending'
   │       └─ Run commit pipeline:
   │
   └─ Commit Pipeline:
       ├─ git.getFileChanges(sha)
       │   → list of changed files + parent_sha + blobSha pairs
       │
       ├─ For each changed file:
       │   ├─ blobSha_parent = git.getBlobSha(parent_sha, path)
       │   ├─ blobSha_curr   = git.getBlobSha(sha, path)
       │   │
       │   ├─ parentSnapshot = getOrCreateSnapshot(path, blobSha_parent)
       │   ├─ currSnapshot   = getOrCreateSnapshot(path, blobSha_curr)
       │   │   (TREE-SITTER invoked only on cache miss)
       │   │
       │   ├─ symDiff  = compareSymbolSets(parentSnapshot.symbols, currSnapshot.symbols)
       │   ├─ edgeDiff = diffEdges(parentSnapshot.edges, currSnapshot.edges)
       │   │
       │   ├─ structDiff = getOrCreateStructuralDiff(blobSha_parent, blobSha_curr)
       │   │   (DIFFTASTIC invoked only on miss → structural_diffs table)
       │   │
       │   ├─ renames  = detectRenames(symDiff, structDiff)   (O(N) + bucketed fuzzy)
       │   ├─ moves    = detectMoves(parentPath, currPath)
       │   └─ risks    = riskDetector.detect({symDiff, edgeDiff, structDiff})
       │
       ├─ Aggregate per-commit metrics:
       │   ├─ symbol counts, churn, hotspots
       │   ├─ drift flags, “legacy touched”, “surface area”
       │   └─ per-symbol deltas (add/modify/remove)
       │
       ├─ Optional cheap LLM:
       │   └─ commitSummary = smallLLM.summarizeCommit(facts)
       │
       └─ saveCommitFactsToDb(sha, facts, analysis_version):
           ├─ commits_analysis
           ├─ symbols / symbol_versions (linked to snapshots)
           ├─ edges
           ├─ symbol_renames
           ├─ structural_diffs (if new)
           └─ commit_summaries (for embeddings)
```

**Tools used here:**

* **Tree-Sitter:** in `getOrCreateSnapshot`
* **Difftastic:** in `getOrCreateStructuralDiff`
* **LLM (cheap model):** optional, for short commit shards
* **Quant embeddings:** after this for semantic memory (see 1.3)

---

### 1.2 Workspace Overlay (Mutable Layer)

**Only for changed files vs HEAD; recomputed when workspace changes hash.**

```text
WorkspaceOverlayPipeline()
├─ headSha       = git.getHeadSha()
├─ workspaceHash = hash(changedFiles + contentHashes)
│
├─ Check workspace_analysis WHERE (headSha, workspaceHash)
│   ├─ If found → return cached WorkspaceFacts
│   └─ Else:
│       ├─ changedFiles = git.listChangedFiles(vs HEAD)
│       │
│       ├─ For each changed file:
│       │   ├─ headBlobSha       = git.getBlobSha('HEAD', path)
│       │   ├─ headSnapshot      = getOrCreateSnapshot(path, headBlobSha)
│       │   │     (Tree-Sitter unseen only once)
│       │   ├─ workingContent    = fs.readFile(path)
│       │   ├─ workspaceBlobSha  = 'WORKSPACE:' + sha256(workingContent)
│       │   ├─ workspaceSnapshot = getOrCreateSnapshot(path, workspaceBlobSha)
│       │   │     (Tree-Sitter again only once per workspaceHash)
│       │   │
│       │   ├─ symDiff  = compareSymbolSets(headSnapshot.symbols, workspaceSnapshot.symbols)
│       │   ├─ edgeDiff = diffEdges(headSnapshot.edges, workspaceSnapshot.edges)
│       │   │
│       │   ├─ structDiff? (optional premium):
│       │   │    getOrCreateStructuralDiff(headBlobSha, workspaceBlobSha)
│       │   └─ workspaceRisks = riskDetector.detectWorkspace({symDiff, edgeDiff, structDiff})
│       │
│       └─ workspaceFacts = aggregateWorkspaceFacts(symDiffs, edgeDiffs, workspaceRisks)
│
└─ INSERT OR REPLACE workspace_analysis(headSha, workspaceHash, facts_json)
   → return workspaceFacts
```

**Tools:**

* **Tree-Sitter:** snapshots for HEAD + workspace
* **Difftastic:** optional for expensive workspace diffs

---

### 1.3 Semantic Memory (Quant Embeddings)

**Turns facts into temporal, cross-bundle recall.**

```text
EmbeddingIndexing()
For each indexed commit:
  ├─ Build Commit Story Shard (text)
  │   "Commit abc123 (2025-03-14) [extraction refactor, billing, async]:
      Split ChargeRetry into RetryWorkflow, moved retries from controller to worker,
      reduced direct gateway calls; high structural change in Billing::ChargeRetry."
  │
  ├─ For each changed symbol:
  │   └─ Symbol Story Shard (text)
  │      "Symbol Billing::ChargeRetry::handle (v7) [async upgrade, retry logic]:
       Previously performed sync charge + inline retry. Now enqueues job to RetryWorkflow,
       removes direct DB writes, increases complexity in validation."
  │
  ├─ Optional Theme Shards:
  │   "Theme: Billing retry architecture, evolution toward async workflows…"
  │
  ├─ For each shard:
  │   ├─ shardText includes:
  │   │   - type tags: [extraction refactor], [rename], [API shape change], etc.
  │   │   - subsystem tags: [billing], [auth], [onboarding]
  │   │   - change-type tags: [async upgrade], [delete legacy], [surface area increase]
  │   ├─ vector = quant.embed(shardText)
  │   └─ upsert vector into Qdrant with metadata:
  │       { sha, symbol_id?, subsystem, tags[], date, file_path }
  │
  └─ Store vec IDs linked back to commits/symbols.
```

**Tools:**

* **Quant embeddings:** commit vectors, symbol vectors, theme vectors
* Gets its input from **Tree-Sitter + Difftastic metrics + risk labels + summaries**.

---

### 1.4 Bundle / Story Generation

User selects N commits + optional workspace → we build a “refactor episode.”

```text
BundleStoryPipeline(bundleId, selectedCommitShas, includeWorkspace)
├─ commitFacts[]  = Promise.all(selectedCommitShas.map(ensureCommitIndexed))
├─ workspaceFacts = includeWorkspace ? WorkspaceOverlayPipeline() : null
├─ bundleFacts    = aggregateFacts(commitFacts, workspaceFacts)
│
├─ Persist:
│   INSERT OR REPLACE bundle_facts(bundleId, facts_json)
│
├─ Build Bundle Story Query Shard
│   "Bundle touching Billing::ChargeRetry and Billing::Invoice:
      - Step 1: initial async introduction (symbols X, Y)
      - Step 2: extraction into RetryWorkflow
      - Current: removal of v1 gateway + rule duplication risk..."
│
├─ Cross-Time Retrieval via embeddings
│   ├─ q_bundle = quant.embed(bundleShard)
│   ├─ similarCommits  = search(commit_vectors, q_bundle, topK=20)
│   ├─ similarSymbols  = search(symbol_vectors, q_bundle, topK=30)
│   └─ driftEpisodes   = search(theme_vectors, q_theme, ... )
│
└─ LLM Story Engine (see next section)
    ├─ Inputs:
    │   - bundleFacts (compact view)
    │   - short summaries of similarCommits / similarSymbols
    │   - timelines for key symbols (sorted by date)
    │   - drift theme snapshots
    └─ Outputs:
        - Story: what’s happening in this refactor
        - Drift: where things have diverged over time
        - Problems: contradictions, risky patterns
        - Plan: cleanup/refactor strategy
        - (Optional) 30-day playbook
```

**Tools:**

* **Quant embeddings:** finds related history
* **LLM:** stitches into long-arc narrative & concrete plan

---

### 1.5 Cockpit UI

```text
Cockpit React Webview
├─ Queries:
│   ├─ commits_metadata, commits_analysis
│   ├─ workspace_analysis (if exists)
│   ├─ symbols, edges, symbol_renames, structural_diffs
│   ├─ bundle_facts, bundle_analytics (story, plan, drift)
│   └─ Vector-search-backed endpoints (e.g. "similar episodes")
│
├─ Renders:
│   ├─ Tree views: commits → files → symbols → diffs
│   ├─ Hotspot/risk indicators (from metrics)
│   ├─ Drift timeline & symbol evolution
│   └─ Story/plan markdown panels from LLM
│
└─ Does NOT:
    - Run Tree-Sitter
    - Call Difftastic
    - Directly call Quant or LLM
    (all done in host; UI only consumes results)
```

---

## 2. Enhancements by Tool

Now the per-tool “turn it to 11” breakdown.

---

### 2.1 Tree-Sitter – Structural Ground Truth

**Role:**
Single source of AST, symbols, scopes, and structural fingerprints for each blob/workspace hash.

**Core Enhancements:**

1. **Parser Pool + Snapshot API (already sketched)**

   * One `ParserPool` per language (TS/JS/PHP).
   * `getOrCreateSnapshot(path, blobSha)`:

     * Cache by `blobSha`.
     * On miss: parse once, extract symbols, edges, scopes, shape hashes.
     * Store to `file_snapshots`, `symbol_versions`, `edges`.

2. **Scopes & Ownership Metadata**
   For each symbol:

   ```ts
   interface SymbolInfo {
     id: number;
     kind: 'function' | 'class' | 'method' | 'hook' | ...;
     name: string;
     signature: string;
     bodyText: string;
     startLine: number;
     endLine: number;
     scopePath: string;   // e.g. "App\\Billing\\ChargeRetry::handle"
     filePath: string;
     shapeHash: string;   // hash of AST shape
   }
   ```

   This drives:

   * Better rename detection (class-to-class vs class-to-function confusion).
   * Clearer LLM prompts (“method moved from Class A to Class B”).

3. **AST-based Edge Extraction (No More Regex for Calls/Imports)**

   Use Tree-Sitter queries per language to extract:

   * Imports/uses/requires.
   * Function/method calls.
   * New expressions / instantiations.

   That produces:

   ```ts
   interface EdgeInfo {
     fromSymbolId?: number;   // callsite symbol
     toSymbolName: string;    // callee or imported symbol
     edgeType: 'import' | 'call' | 'inherit' | 'implements';
     confidence: number;      // 0–1
   }
   ```

   **Why:** more precise dependency graphs → better hotspot/risk scoring.

4. **Structural Fingerprints (Shape Hashes)**

   Build a compact “shape hash” from the AST:

   * Node kind sequence.
   * Approximated nesting.
   * Ignoring identifiers & literals (so rename doesn’t break it).

   Use it for:

   * Recognizing “same logic, new name.”
   * Differentiating true refactor vs superficial changes.

5. **Optional: Incremental-like reuse**

   Even if you don’t do real incremental parsing, you can:

   * Reuse snapshots for unchanged blobs.
   * For workspace, treat each workspaceHash as unique, but keep snapshots in memory for the session.

---

### 2.2 Difftastic – Premium Structural Diff Oracle

**Role:**
High-quality structural diff once per `(parentBlobSha, currentBlobSha)` pair → metrics + morph facts.

**Core Enhancements:**

1. **Content-addressed caching**

   * `getOrCreateStructuralDiff(parentBlobSha, currentBlobSha)`:

     * Check `structural_diffs` table.
     * If missing:

       * Dump contents to temp files.
       * Run Difftastic.
       * Parse JSON output (or structured output).
       * Store as `data_json`.

2. **Derive metrics for facts, not just text**

   From Difftastic output, compute per-file/per-symbol metrics like:

   * `structural_change_score` (0–1).
   * `lines_added_removed`.
   * `control_flow_changed` boolean.
   * `interface_changed` boolean (params/return types).
   * `moved_blocks` count.

   These metrics feed:

   * Risk scoring.
   * “High-impact change” labeling.
   * LLM prompts (tiny numeric summary instead of huge diff text).

3. **Verify & refine renames**

   Use Tree-Sitter + shape hash for candidate rename pairs:

   * If shapeHash and structural_change_score are high → “confident rename.”
   * If shapeHash diverges and structural_change_score is huge → treat as “replacement”, not rename.

4. **LLM Input as distilled morph facts**

   Instead of dumping Difftastic’s raw output, send something like:

   ```json
   {
     "file": "app/Billing/ChargeRetry.php",
     "symbol": "ChargeRetry::handle",
     "structural_change_score": 0.9,
     "control_flow_changed": true,
     "interface_changed": false,
     "notes": [
       "Extracted retry logic into RetryWorkflow::run",
       "Removed direct gateway calls from controller"
     ]
   }
   ```

   This keeps token usage down and signal high.

---

### 2.3 Quant Embeddings – Long-Arc Story Spine

**Role:**
Semantic memory that connects **refactor episodes across time**, symbols across versions, and themes (billing, auth, etc.).

**Core Enhancements:**

1. **Story-shard-first design**

   Never embed raw code; always embed **change stories** that include:

   * What changed.
   * Where.
   * How big/structural.
   * Which subsystem.
   * Any refactor tags.

   Example commit shard:

   > `[extraction refactor] [billing] [async upgrade]  
   > Commit abc123 (2025-03-14): In Billing::ChargeRetry and RetryWorkflow, moved retry logic from controller to queued worker, removed legacy v1 gateway calls, high structural change, increased async complexity.`

2. **Three primary indices**

   * `commit_vectors` – episode-level shards.
   * `symbol_vectors` – symbol version shards.
   * `theme_vectors` – optional subsystem/theme shards (billing, auth, etc.)

3. **Refactor tags baked into text**

   Tags like:

   * `[extraction refactor]`
   * `[rename only]`
   * `[API shape change]`
   * `[async upgrade]`
   * `[delete legacy feature]`

   These cluster similar refactors across time.

4. **Time-aware querying**

   Use metadata in Qdrant:

   * `date`, `sha`, `feature`, `subsystem`.

   Support queries like:

   * “Similar refactors in last 6 months.”
   * “All episodes modifying billing retries before 2025-01.”

5. **Direct support for drift / arc questions**

   For a bundle, you can formulate queries like:

   * “History of symbol Billing::ChargeRetry::handle”
   * “Other commits that changed retry logic AND increased structural change score”
   * “Past episodes where we partially migrated to async but left legacy paths”

   Embeddings pull those; the LLM stitches them into narrative.

---

### 2.4 LLM – Story & Strategy, Not Raw Analysis

**Role:**
Turns **facts + retrieved history** into:

* Refactor stories.
* Drift explanations.
* Cleanup/refactor plans and playbooks.

**Core Enhancements:**

1. **Role split: cheap vs premium**

   * **Cheap model:**

     * Per-commit micro-summaries for embedding.
     * Per-symbol micro descriptions.

   * **Premium model:**

     * Bundle narrative (story).
     * Drift analysis.
     * Cleanup strategy & playbooks.

2. **View-based prompts, not full blob facts**

   Instead of dumping whole `RefactorBundleFacts`, create small views:

   * `IntentView`: high-level goals, touched subsystems, risk summary.
   * `DriftView`: conflicting patterns, duplicated rules, partial migrations.
   * `CleanupView`: hotspots, risk metrics, “WTF clusters.”
   * `HistoryView`: top related commits/symbols from embeddings with 1-line summaries.

3. **Multi-pass chain, but with reuse**

   For bundle:

   ```text
   discoverPatterns(facts, history)  → discovery_json
   quantifyPatterns(discovery)       → quantification_json
   planRefactor(quantification)      → plan_md
   ```

   Persist each step in `bundle_analytics`:

   * Regenerate plan without recomputing discovery/quantification.
   * Or regenerate discovery only when facts change.

4. **Refactor story shape templates**

   You can nudge the model to produce **consistent arcs**, e.g.:

   * Past state → First refactor wave → Second wave → Current bundle.
   * “What we were trying to achieve in each wave.”
   * “Where drift accumulated (e.g., duplication, half-migrations, forgotten contracts).”
   * “What we should consolidate now.”

5. **Tight integration with metrics**

   LLM sees:

   * Structural_change_scores.
   * Risk counts & types.
   * Hotspot scores.
   * Rename/move confidence.

   So it can say:

   > “This bundle’s risk profile is high because 3 core billing symbols have structural_change_score > 0.8 and no corresponding test changes.
   > Past similar episodes (X, Y) resulted in regressions around retry limits…”

---

If you want, next step I can:

* Take a **single concrete scenario** (e.g., “billing async refactor bundle”) and write the *exact* data that flows through each layer (snapshot → commit facts → story shard → embedding query → LLM prompt), so you can literally mirror it in your code.
