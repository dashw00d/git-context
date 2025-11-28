# Pipeline Diagnostics Report

**Run Time:** 2025-11-28T11:20:17.982Z to 2025-11-28T11:20:32.913Z (14.93s)
**Overall Health Score:** 100.00/100

## Key Metrics

- **totalCommits**: 3
- **totalSymbols**: 0
- **totalEdges**: 0
- **totalDriftIssues**: 0
- **unresolvedCallers**: 0
- **totalHotspots**: 0
- **bundleIncompleteness**: 0
- **patternDrift**: 0
- **totalLegacyDead**: 0
- **llmTotalCalls**: 6
- **llmTotalTokens**: 0
- **overallHealthScore**: 100.00

## Step Details

### workspace_overlay

- **Hash:** 65f031615e9b7bde0e2e5af9d8d24f0562f4f6db
- **Status:** no baseline
- **Summary:** staged: files=0, symbols=0 | unstaged: files=0, symbols=0
- **Timestamp:** 2025-11-28T11:20:18.420Z
- **Duration:** 436ms
- **Metrics:**
  - stagedFiles: 0
  - stagedSymbols: 0
  - unstagedFiles: 0
  - unstagedSymbols: 0

### scope

- **Hash:** edb82ec2d55ee5ae59754a45f33510dfeaed7fc2
- **Status:** no baseline
- **Summary:** files=168, working=86, blast=0
- **Timestamp:** 2025-11-28T11:20:19.229Z
- **Duration:** 1238ms
- **Metrics:**
  - commitFiles: 168
  - workingChanged: 86
  - blastRadiusFiles: 0
  - allPaths: 0

### working

- **Hash:** dd874a26c0cb97d303538978d8b38124cb9b0749
- **Status:** no baseline
- **Summary:** symbols=0, edges=0, paths=0
- **Timestamp:** 2025-11-28T11:20:19.954Z
- **Duration:** 725ms
- **Metrics:**
  - symbols: 0
  - edges: 0
  - analyzedPaths: 0

### index_commits

- **Hash:** fb98fb65e97d75c550c6504a4993a7c6b58023dd
- **Status:** no baseline
- **Summary:** commits=3
- **Timestamp:** 2025-11-28T11:20:30.418Z
- **Duration:** 11189ms
- **Metrics:**
  - commitCount: 3
  - totalSymbols: 0
  - totalEdges: 0

### hotspots

- **Hash:** 97d170e1550eee4afc0af065b78cda302a97674c
- **Status:** no baseline
- **Timestamp:** 2025-11-28T11:20:30.425Z
- **Duration:** 4ms
- **Metrics:**
  - topHotspots: 0
  - totalChurn: 0
  - withVersionTracking: 0
  - versionDescriptions: []

### intended

- **Hash:** 97d170e1550eee4afc0af065b78cda302a97674c
- **Status:** no baseline
- **Summary:** symbols=0, present=0, absent=0, renamed=0
- **Timestamp:** 2025-11-28T11:20:30.425Z
- **Duration:** 6ms
- **Metrics:**
  - totalSymbols: 0
  - present: 0
  - absent: 0
  - renamed: 0

### moved_blocks

- **Hash:** 97d170e1550eee4afc0af065b78cda302a97674c
- **Status:** no baseline
- **Timestamp:** 2025-11-28T11:20:30.426Z
- **Duration:** 5ms
- **Metrics:**
  - totalMoves: 0
  - withVersionDescription: 0
  - moveTypes: {"rename":0,"relocate":0,"refactor":0}

### drift

- **Hash:** 13f7acde44dafc4f2b1dfcb173515b1610953d0c
- **Status:** no baseline
- **Summary:** missing=0, zombies=0, divergent=0, hybrid=0
- **Timestamp:** 2025-11-28T11:20:30.458Z
- **Duration:** 32ms
- **Metrics:**
  - missing_symbols: 0
  - zombie_symbols: 0
  - divergent_symbols: 0
  - missing_edges: 0
  - zombie_edges: 0
  - unresolved_callers: 0
  - hybridDrifts: 0
  - conventionDrift: 0
  - mixedConventionFiles: 0

### legacy

- **Hash:** 6fda6f32fdfaa0f64de3e5277bc7b4311dbcdc54
- **Status:** no baseline
- **Summary:** dead=0, legacyUsed=0, leftovers=0
- **Timestamp:** 2025-11-28T11:20:30.459Z
- **Duration:** 1ms
- **Metrics:**
  - dead: 0
  - legacyUsed: 0
  - replacedLeftovers: 0

### bundle_facts

- **Hash:** 8909f1f14b01d598e6c4aa8202ff4c643898675c
- **Status:** no baseline
- **Summary:** intended.present=0, absent=0, renamed=0, hybridFacts=0 (0 files)
- **Timestamp:** 2025-11-28T11:20:30.460Z
- **Duration:** 1ms
- **Metrics:**
  - incompleteness: 0
  - patternDrift: 0
  - legacySummary: 0
  - intended: {"present":0,"absent":0,"renamed":0}
  - hybridFactsCount: 0
  - hybridFilesCount: 0

### embedding_index

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Timestamp:** 2025-11-28T11:20:31.779Z
- **Duration:** 1318ms

### retrieve_history

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Timestamp:** 2025-11-28T11:20:32.517Z
- **Duration:** 738ms
- **Metrics:**
  - historyItems: 17
  - retrievedCommits: 0

### llm_story

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Timestamp:** 2025-11-28T11:20:32.913Z
- **Duration:** 396ms
- **Metrics:**
  - storyLength: 1
  - totalHealthScore: 100
  - totalTokens: 0
  - totalCalls: 6
  - blocksCount: 4
- **LLM Summary:**
  - Summary: ## Key Insights

**Refactor Health:** 100/100 ✅

**Quick Stats:** 3 commits, 0 symbols analyzed, no issues found
...
  - Health Score: 100/100
  - Blocks: 4

## LLM Analysis Summaries

### Summary 1

## Key Insights

**Refactor Health:** 100/100 ✅

**Quick Stats:** 3 commits, 0 symbols analyzed, no issues found


#### Full Markdown Output

# LLM Analysis Report

**Generated:** 11/28/2025, 5:20:32 AM

**Bundle:** 3 commits

## Refactor Intent & Story

## Drift Verification

## Cleanup Plan

## LLM-Driven Pattern Discovery



**Metadata:**
- Health Score: 100/100
- LLM Calls: 6
- Model: x-ai/grok-4.1-fast:free
- Validated Evidence: 0
- Analysis Blocks: 4
- Generated: 2025-11-28T11:20:32.911Z

## Summary

- **Total Steps:** 13
- **Errors:** 0
- **Total Symbols:** 0
- **Total Edges:** 0
- **Drift Issues:** 0

*Generated by pipeline diagnostics at 2025-11-28T11:20:32.914Z*
