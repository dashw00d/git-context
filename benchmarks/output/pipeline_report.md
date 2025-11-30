# Pipeline Diagnostics Report

**Run Time:** 2025-11-30T04:47:05.083Z to 2025-11-30T04:50:25.809Z (200.73s)
**Overall Health Score:** 0.00/100

## Key Metrics

- **totalCommits**: 3
- **totalSymbols**: 1971
- **totalEdges**: 37272
- **totalDriftIssues**: 176
- **unresolvedCallers**: 0
- **totalHotspots**: 50
- **bundleIncompleteness**: 176
- **patternDrift**: 39
- **totalLegacyDead**: 61
- **embeddingShards**: 543
- **historySimilarCommits**: 3
- **historySimilarSymbols**: 2
- **historyRelatedRefactors**: 0
- **llmDurationMs**: 0
- **embeddingDurationMs**: 16085
- **historyDurationMs**: 530
- **llmTotalCalls**: 6
- **llmTotalTokens**: 242928
- **overallHealthScore**: 0.00

## Step Details

### scope

- **Hash:** f1e0e5cc68b024dedc6ffee8d9124066a3bb5847
- **Status:** no baseline
- **Summary:** files=138, working=75, blast=0
- **Timestamp:** 2025-11-30T04:47:21.683Z
- **Duration:** 16599ms
- **Metrics:**
  - commitFiles: 138
  - workingChanged: 75
  - blastRadiusFiles: 0
  - allPaths: 109

### workspace_overlay

- **Hash:** 5f17bf80df621574f578e1116c24681116083bf3
- **Status:** no baseline
- **Summary:** staged: files=59, symbols=185 | unstaged: files=29, symbols=65
- **Timestamp:** 2025-11-30T04:47:24.445Z
- **Duration:** 19361ms
- **Metrics:**
  - stagedFiles: 59
  - stagedSymbols: 185
  - unstagedFiles: 29
  - unstagedSymbols: 65

### working

- **Hash:** cd1e431e2b851f55abaceddf2fb81427d1beda04
- **Status:** no baseline
- **Summary:** symbols=1701, edges=37272, paths=106
- **Timestamp:** 2025-11-30T04:47:51.402Z
- **Duration:** 26957ms
- **Metrics:**
  - symbols: 1701
  - edges: 37272
  - analyzedPaths: 106

### index_commits

- **Hash:** 2acd1324090f0a2523546385cb65398fac9fb71a
- **Status:** no baseline
- **Summary:** commits=3
- **Timestamp:** 2025-11-30T04:49:00.328Z
- **Duration:** 95883ms
- **Metrics:**
  - commitCount: 3
  - totalSymbols: 551
  - totalEdges: 4064

### intended

- **Hash:** 144db29538f66151d5b0c1a2cd8ad973d1dcdcb5
- **Status:** no baseline
- **Summary:** symbols=270, present=91, absent=179, renamed=0
- **Timestamp:** 2025-11-30T04:49:00.372Z
- **Duration:** 44ms
- **Metrics:**
  - totalSymbols: 270
  - present: 91
  - absent: 179
  - renamed: 0

### hotspots

- **Hash:** 3f94272c41c028304a971367962c632779fc3cc8
- **Status:** no baseline
- **Summary:** topHotspots=50, totalChurn=3890.3
- **Timestamp:** 2025-11-30T04:49:11.272Z
- **Duration:** 10937ms
- **Metrics:**
  - topHotspots: 50
  - totalChurn: 3890.33774104209
  - withVersionTracking: 25
  - versionDescriptions: ["3/6 versions","1/6 versions","1/6 versions","1/6 versions","3/6 versions","6/6 versions","2/6 vers

### moved_blocks

- **Hash:** 97d170e1550eee4afc0af065b78cda302a97674c
- **Status:** no baseline
- **Summary:** totalMoves=0
- **Timestamp:** 2025-11-30T04:50:04.722Z
- **Duration:** 64382ms
- **Metrics:**
  - totalMoves: 0
  - withVersionDescription: 0
  - moveTypes: {"rename":0,"relocate":0,"refactor":0}

### drift

- **Hash:** a509d6a91b327209aa6c432bf76de96fdf37d055
- **Status:** no baseline
- **Summary:** missing=1, zombies=175, divergent=0, hybrid=100
- **Timestamp:** 2025-11-30T04:50:06.006Z
- **Duration:** 1284ms
- **Metrics:**
  - missing_symbols: 1
  - zombie_symbols: 175
  - divergent_symbols: 0
  - missing_edges: 82
  - zombie_edges: 12883
  - unresolved_callers: 0
  - hybridDrifts: 100
  - conventionDrift: 87
  - mixedConventionFiles: 38

### legacy

- **Hash:** 471dcc77b4cbc00ded86ebeff2b3d9ab42393e73
- **Status:** no baseline
- **Summary:** dead=61, legacyUsed=0, leftovers=17
- **Timestamp:** 2025-11-30T04:50:08.947Z
- **Duration:** 2941ms
- **Metrics:**
  - dead: 61
  - legacyUsed: 0
  - replacedLeftovers: 17

### bundle_facts

- **Hash:** 02fa24cd768da0e9c4f5ace22dd78ae894f99d58
- **Status:** no baseline
- **Summary:** intended.present=91, absent=179, renamed=0, hybridFacts=897 (87 files)
- **Timestamp:** 2025-11-30T04:50:09.061Z
- **Duration:** 114ms
- **Metrics:**
  - incompleteness: 176
  - patternDrift: 39
  - legacySummary: 61
  - intended: {"present":91,"absent":179,"renamed":0}
  - hybridFactsCount: 897
  - hybridFilesCount: 87

### embedding_index

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Summary:** commits=3, commitShards=3, symbolShards=537, themeShards=3
- **Timestamp:** 2025-11-30T04:50:25.147Z
- **Duration:** 16086ms
- **Metrics:**
  - commitCount: 3
  - commitShardCount: 3
  - symbolShardCount: 537
  - themeShardCount: 3
  - durationMs: 16085
  - skipped: false
  - reason: undefined

### retrieve_history

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Summary:** similarCommits=3, similarSymbols=2, relatedRefactors=0
- **Timestamp:** 2025-11-30T04:50:25.678Z
- **Duration:** 531ms
- **Metrics:**
  - similarCommits: 3
  - similarSymbols: 2
  - relatedRefactors: 0
  - durationMs: 530
  - skipped: false
  - reason: undefined

### llm_story

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Summary:** tokens=242928, calls=6, health=0
- **Timestamp:** 2025-11-30T04:50:25.808Z
- **Duration:** 129ms
- **Metrics:**
  - storyLength: 1
  - totalHealthScore: 0
  - totalTokens: 242928
  - totalCalls: 6
  - blocksCount: 4
  - durationMs: 0
  - validatedEvidenceCount: 0
- **LLM Summary:**
  - Summary: ## Key Insights

**Refactor Health:** 0/100 🔴

**Quick Stats:** 3 commits, 1701 symbols analyzed, 237 issues (0 high-priority actions)
...
  - Health Score: 0/100
  - Tokens: 242928
  - Blocks: 4

## LLM Analysis Summaries

### Summary 1

## Key Insights

**Refactor Health:** 0/100 🔴

**Quick Stats:** 3 commits, 1701 symbols analyzed, 237 issues (0 high-priority actions)


#### Full Markdown Output

# LLM Analysis Report

**Generated:** 11/29/2025, 10:50:25 PM

**Bundle:** 3 commits

## Refactor Intent & Story

## Drift Verification

## Cleanup Plan

## LLM-Driven Pattern Discovery



**Metadata:**
- Health Score: 0/100
- Total Tokens: 242928
- LLM Calls: 6
- Model: x-ai/grok-4.1-fast:free
- Validated Evidence: 0
- Analysis Blocks: 4
- Generated: 2025-11-30T04:50:25.802Z

## Visualization

```mermaid
graph TD
  A[High Churn Files] --> B[Top 50 Hotspots]
  C[Drift Detection] --> D[176 Issues Found]
  D --> E[1 Missing]
  D --> F[175 Zombies]
```

## Summary

- **Total Steps:** 13
- **Errors:** 0
- **Total Symbols:** 1971
- **Total Edges:** 37272
- **Drift Issues:** 176

*Generated by pipeline diagnostics at 2025-11-30T04:50:25.922Z*
