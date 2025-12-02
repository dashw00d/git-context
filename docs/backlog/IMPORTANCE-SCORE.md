Yeah, you’re right to pull this back in—**importance/centrality is pure juice** for both embeddings and the report.

Here’s a focused sketch of the **graph analytics piece only**: what it does, where it lives, and rough code/schema. I’ll stick to **degree + PageRank-style importance**, which are cheap enough if you run them periodically, and show exactly how they plug into your existing layers.

---

## 1. Where graph analytics lives in your stack

**Layer-wise:**

* **Inputs:**

  * `edges` table (symbol-level call/import edges from Layer 1 / 2).
* **Graph Analytics Layer (new mini-layer between 2 and 3):**

  * Builds `symbol_graph_metrics` (in/out degree + importance).
* **Outputs used by:**

  * **Layer 3 (Embeddings):**

    * Add `importance` and “hub” tags to commit/symbol shards.
  * **Layer 4 (Bundle Story Engine):**

    * Bundle facts: “this bundle hits high-importance nodes,”
    * LLM prompt gets a ranked list of impacted hubs.

Think of it as a **repo-wide call graph lens** that everything higher up can query.

---

## 2. Schema additions

Assuming you already have an `edges` table something like:

```sql
-- existing (roughly):
-- from_symbol_id, to_symbol_id are SymbolInfo.id or similar
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_symbol_id TEXT NOT NULL,
  to_symbol_id TEXT NOT NULL,
  kind TEXT,
  -- maybe commit_sha, file_path, etc...
  UNIQUE(from_symbol_id, to_symbol_id, kind /* optional */)
);
```

Add a **metrics table**:

```sql
CREATE TABLE IF NOT EXISTS symbol_graph_metrics (
  symbol_id TEXT PRIMARY KEY,
  in_degree INTEGER NOT NULL DEFAULT 0,
  out_degree INTEGER NOT NULL DEFAULT 0,
  importance REAL NOT NULL DEFAULT 0
);
```

You’ll run a **graph rebuild** job that:

1. Scans `edges`.
2. Computes in/out degrees.
3. Runs a small PageRank-style iteration for `importance`.
4. Writes into `symbol_graph_metrics`.

---

## 3. GraphMetrics helper

**File:** `src/analysis/stats/graphMetrics.ts`

### Types

```ts
interface EdgeRow {
  from_symbol_id: string;
  to_symbol_id: string;
}
```

### Core class

```ts
export class GraphMetrics {
  constructor(private db: Database) {}

  /**
   * Full rebuild: degrees + importance (PageRank-style).
   * Run on activation, or behind a command, not per bundle.
   */
  rebuild(): void {
    const edges: EdgeRow[] = [];
    const stmt = this.db.prepare(`
      SELECT from_symbol_id, to_symbol_id FROM edges
    `);
    while (stmt.step()) {
      edges.push(stmt.getAsObject() as EdgeRow);
    }

    // 1) Build node set and adjacency lists
    const nodes = new Set<string>();
    for (const e of edges) {
      nodes.add(e.from_symbol_id);
      nodes.add(e.to_symbol_id);
    }

    const nodeIds = Array.from(nodes); // stable order
    const indexById = new Map<string, number>();
    nodeIds.forEach((id, idx) => indexById.set(id, idx));

    const n = nodeIds.length || 1;
    const outAdj: number[][] = Array.from({ length: n }, () => []);
    const inAdj: number[][] = Array.from({ length: n }, () => []);

    for (const e of edges) {
      const fromIdx = indexById.get(e.from_symbol_id)!;
      const toIdx = indexById.get(e.to_symbol_id)!;
      outAdj[fromIdx].push(toIdx);
      inAdj[toIdx].push(fromIdx);
    }

    // 2) Degrees
    const inDegree = new Array<number>(n).fill(0);
    const outDegree = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      outDegree[i] = outAdj[i].length;
      inDegree[i] = inAdj[i].length;
    }

    // 3) PageRank-style importance
    const d = 0.85; // damping
    const base = (1 - d) / n;
    let rank = new Array<number>(n).fill(1 / n);
    const iterations = 20; // cheap enough

    for (let iter = 0; iter < iterations; iter++) {
      const next = new Array<number>(n).fill(base);

      // distribute rank along incoming edges
      for (let node = 0; node < n; node++) {
        const incoming = inAdj[node];
        let sum = 0;
        for (const src of incoming) {
          const outDeg = outDegree[src] || 1; // avoid div by 0
          sum += rank[src] / outDeg;
        }
        next[node] += d * sum;
      }

      rank = next;
    }

    // 4) Persist to DB
    const upsert = this.db.prepare(`
      INSERT INTO symbol_graph_metrics (symbol_id, in_degree, out_degree, importance)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(symbol_id) DO UPDATE SET
        in_degree = excluded.in_degree,
        out_degree = excluded.out_degree,
        importance = excluded.importance
    `);

    this.db.exec('BEGIN');
    try {
      for (let i = 0; i < n; i++) {
        upsert.run(nodeIds[i], inDegree[i], outDegree[i], rank[i]);
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getImportance(symbolId: string): number {
    const row = this.db
      .prepare(
        'SELECT importance FROM symbol_graph_metrics WHERE symbol_id = ?'
      )
      .get(symbolId);
    return row ? row.importance : 0;
  }

  getDegrees(symbolId: string): { inDegree: number; outDegree: number } {
    const row = this.db
      .prepare(
        'SELECT in_degree, out_degree FROM symbol_graph_metrics WHERE symbol_id = ?'
      )
      .get(symbolId);
    return row
      ? { inDegree: row.in_degree, outDegree: row.out_degree }
      : { inDegree: 0, outDegree: 0 };
  }
}
```

**Where it runs:**

* On extension activation or via a command like `git-context.rebuildGraphMetrics`.
* Not inside the hot bundle pipeline; it just feeds data to it.

---

## 4. Using importance in embeddings (Layer 3)

You already have `EmbeddingIndexer` building commit shards. Now you can inject graph information.

### Commit shard enhancement

**File:** `src/analysis/embeddingIndexer.ts`

Add a `GraphMetrics` dependency:

```ts
export class EmbeddingIndexer {
  constructor(private graphMetrics: GraphMetrics) {}

  async indexCommits(commitFacts: CommitFacts[]): Promise<void> {
    // ... existing code ...
  }

  private buildCommitShard(facts: CommitFacts): { text: string; metadata: any } {
    // Suppose facts includes a list of impacted symbols with IDs + file paths
    const impactedSymbols = facts.impactedSymbols || [];

    let maxImportance = 0;
    let hubCount = 0;

    for (const s of impactedSymbols) {
      const importance = this.graphMetrics.getImportance(s.id);
      maxImportance = Math.max(maxImportance, importance);
      if (importance > 0.9) hubCount++;
    }

    const tags = [
      ...facts.risks.map(r => `[${r}]`),
      maxImportance > 0.9 ? '[hits-hub-symbol]' : '',
      hubCount >= 3 ? '[multi-hub-refactor]' : '',
    ].filter(Boolean);

    const text =
      `${tags.join(' ')} Commit ${facts.sha}: ` +
      `Added ${facts.symbolsAdded} symbols, modified ${facts.symbolsModified}, removed ${facts.symbolsRemoved}. ` +
      `${facts.filesChanged} files changed. Structural change score: ${facts.structuralChangeScore.toFixed(
        2
      )}. ` +
      `Max symbol importance touched: ${maxImportance.toFixed(3)}.`;

    return {
      text,
      metadata: {
        sha: facts.sha,
        risks: facts.risks,
        structural_change_score: facts.structuralChangeScore,
        max_symbol_importance: maxImportance,
        hub_symbol_count: hubCount,
      },
    };
  }
}
```

Now the **commit embedding** knows:

* How “hubby” this change is structurally, not just syntactically.

You can do the same for **symbol-level shards** when you add them:

* Include `importance`, `in_degree`, `out_degree` in the payload.
* Tag embeddings with `[hub]`, `[leaf]`, etc.

---

## 5. Using importance in bundle facts / LLM story (Layer 4)

When you assemble `RefactorBundleFacts`, you can fold in graph metrics:

**File:** `factsAssembler.ts` (or wherever `buildRefactorBundleFacts` lives)

Rough idea:

```ts
function buildRefactorBundleFacts(
  commitFacts: CommitFacts[],
  workspaceFacts?: WorkspaceFacts | null,
  graphMetrics: GraphMetrics
): RefactorBundleFacts {
  // ... existing aggregation ...

  // Sample structure: each commit has a list of impacted symbols
  const allSymbols = new Map<string, { id: string; filePath: string }>();

  for (const commit of commitFacts) {
    for (const s of commit.impactedSymbols || []) {
      allSymbols.set(s.id, s);
    }
  }

  const importanceStats = {
    maxImportance: 0,
    avgImportance: 0,
    topSymbols: [] as Array<{ id: string; importance: number; filePath: string }>,
  };

  const values: Array<{ id: string; importance: number; filePath: string }> = [];

  for (const s of allSymbols.values()) {
    const importance = graphMetrics.getImportance(s.id);
    values.push({ id: s.id, importance, filePath: s.filePath });
  }

  if (values.length) {
    values.sort((a, b) => b.importance - a.importance);
    importanceStats.maxImportance = values[0].importance;
    importanceStats.avgImportance =
      values.reduce((sum, v) => sum + v.importance, 0) / values.length;
    importanceStats.topSymbols = values.slice(0, 10);
  }

  return {
    // ...existing bundle fields...
    graph: {
      importance: importanceStats,
    },
  } as RefactorBundleFacts;
}
```

Then in **BundleStoryEngine**:

* You already pass `bundleFacts` into LLM.

Now `bundleFacts.graph.importance` contains:

* max importance touched,
* avg importance,
* list of top hub symbols impacted by the bundle.

The LLM prompt can say:

> “This bundle touches N hub symbols, including X, Y, Z with importance scores 0.97, 0.95, 0.93. These are high-centrality functions in the call graph.”

That’s exactly the “juice” you wanted.

---

## 6. Where this sits in your overall flow

Putting it back into your phases:

1. **Layer 1 / 2 (existing):**

   * Snapshots, diffs, symbol + edge extraction.
   * `edges` table is continuously updated as commits are indexed.

2. **Graph Metrics (new mini-phase, offline-ish):**

   * `GraphMetrics.rebuild()`:

     * Run on activation or behind a command.
     * Reads `edges`, computes degrees + importance, writes `symbol_graph_metrics`.

3. **Layer 3: Embedding Index:**

   * `EmbeddingIndexer` pulls `importance` from `GraphMetrics` and:

     * tags commit/symbol shards,
     * includes importance in Qdrant payloads.

4. **Layer 4: Bundle Story Engine:**

   * `buildRefactorBundleFacts` computes a **graph importance summary** for the bundle.
   * LLM prompt uses that to explain:

     * “hub-heavy refactor,”
     * “you are touching critical nodes of the call graph,” etc.

No change to the orchestrator / runner—this is all extra **data** the same pipeline steps can read.

If you want, next we can tighten the glue points for **where edges come from** (per commit vs global) so the importance is explicitly “global call graph” vs “latest commit graph,” but this is the core pattern and where it lives.
