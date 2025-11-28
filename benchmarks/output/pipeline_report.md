# Pipeline Diagnostics Report

**Run Time:** 2025-11-28T06:21:19.484Z to 2025-11-28T06:27:52.854Z (393.37s)
**Overall Health Score:** 99.41/100

## Key Metrics

- **totalCommits**: 3
- **totalSymbols**: 3714
- **totalEdges**: 25565
- **totalDriftIssues**: 0
- **unresolvedCallers**: 0
- **totalHotspots**: 0
- **bundleIncompleteness**: 0
- **patternDrift**: 32
- **totalLegacyDead**: 22
- **llmTotalCalls**: 6
- **llmTotalTokens**: 42437
- **overallHealthScore**: 99.41

## Step Details

### hotspots

- **Hash:** 97d170e1550eee4afc0af065b78cda302a97674c
- **Status:** Δ baseline (expected d4e5f3e9)
- **Timestamp:** 2025-11-28T06:21:19.597Z
- **Duration:** 109ms
- **Metrics:**
  - topHotspots: 0
  - totalChurn: 0

### intended

- **Hash:** 97d170e1550eee4afc0af065b78cda302a97674c
- **Status:** matches baseline
- **Summary:** symbols=0, present=0, absent=0, renamed=0
- **Timestamp:** 2025-11-28T06:21:19.597Z
- **Duration:** 110ms
- **Metrics:**
  - totalSymbols: 0
  - present: 0
  - absent: 0
  - renamed: 0

### scope

- **Hash:** 41f58153f3e5ab93fa4a68c9a76f8a201b8599ec
- **Status:** Δ baseline (expected f56edd51)
- **Summary:** files=152, working=91, blast=0
- **Timestamp:** 2025-11-28T06:21:20.804Z
- **Duration:** 1317ms
- **Metrics:**
  - commitFiles: 152
  - workingChanged: 91
  - blastRadiusFiles: 0
  - allPaths: 200

### index_commits

- **Hash:** 0a2339b0c744a67d6fbef733d35892037d57f462
- **Status:** Δ baseline (expected 4a1dc616)
- **Summary:** commits=3
- **Timestamp:** 2025-11-28T06:21:55.281Z
- **Duration:** 35795ms
- **Metrics:**
  - commitCount: 3
  - totalSymbols: 0
  - totalEdges: 0

### workspace_overlay

- **Hash:** cccf1afd0c3123898fc368aa381b777a68308dea
- **Status:** Δ baseline (expected 3bfb62b0)
- **Summary:** staged: files=55, symbols=641 | unstaged: files=36, symbols=1466
- **Timestamp:** 2025-11-28T06:22:16.092Z
- **Duration:** 56603ms
- **Metrics:**
  - stagedFiles: 55
  - stagedSymbols: 641
  - unstagedFiles: 36
  - unstagedSymbols: 1466

### working

- **Hash:** 9e262792e22fb73c94a41236624e3546f1bd7ed0
- **Status:** Δ baseline (expected 58de5e62)
- **Summary:** symbols=3714, edges=25565, paths=165
- **Timestamp:** 2025-11-28T06:22:18.142Z
- **Duration:** 2050ms
- **Metrics:**
  - symbols: 3714
  - edges: 25565
  - analyzedPaths: 165

### drift

- **Hash:** 6f6d82b13c7d10b500c7a78e22dec140ad421635
- **Status:** Δ baseline (expected 632e9fc8)
- **Summary:** missing=0, zombies=0, divergent=0, hybrid=0
- **Timestamp:** 2025-11-28T06:22:19.073Z
- **Duration:** 931ms
- **Metrics:**
  - missing_symbols: 0
  - zombie_symbols: 0
  - divergent_symbols: 0
  - missing_edges: 0
  - zombie_edges: 0
  - unresolved_callers: 0
  - hybridDrifts: 0
  - conventionDrift: 95
  - mixedConventionFiles: 31

### legacy

- **Hash:** 160b4c4e62595fb3ebb79572bcf7f88dc5c6f4c8
- **Status:** Δ baseline (expected c3f11aa2)
- **Summary:** dead=22, legacyUsed=0, leftovers=0
- **Timestamp:** 2025-11-28T06:22:19.077Z
- **Duration:** 777ms
- **Metrics:**
  - dead: 22
  - legacyUsed: 0
  - replacedLeftovers: 0

### bundle_facts

- **Hash:** 7149cca67dd0536ce241aa0280ab26a1afbb35e6
- **Status:** Δ baseline (expected 837658ed)
- **Summary:** intended.present=0, absent=50, renamed=0, hybridFacts=0 (0 files)
- **Timestamp:** 2025-11-28T06:22:19.172Z
- **Duration:** 95ms
- **Metrics:**
  - incompleteness: 0
  - patternDrift: 32
  - legacySummary: 22
  - intended: {"present":0,"absent":50,"renamed":0}
  - hybridFactsCount: 0
  - hybridFilesCount: 0

### embedding_index

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Timestamp:** 2025-11-28T06:22:31.561Z
- **Duration:** 12389ms

### retrieve_history

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Timestamp:** 2025-11-28T06:22:32.247Z
- **Duration:** 685ms
- **Metrics:**
  - historyItems: 9
  - retrievedCommits: 0

### llm_story

- **Hash:** n/a (external/complex)
- **Status:** no baseline
- **Timestamp:** 2025-11-28T06:27:52.854Z
- **Duration:** 320607ms
- **Metrics:**
  - storyLength: 1
  - totalHealthScore: 99.40764674205708
  - totalTokens: 42437
  - totalCalls: 6
  - blocksCount: 4
- **LLM Summary:**
  - Summary: ## Key Insights

**Most Critical:** All 50 intended absent symbols were successfully removed with zero missing, zombies, or divergent symbols. (high severity, 100% confidence)

**Immediate Actions:**
...
  - Health Score: 99.40764674205708/100
  - Tokens: 42437
  - Blocks: 4

## LLM Analysis Summaries

### Summary 1

## Key Insights

**Most Critical:** All 50 intended absent symbols were successfully removed with zero missing, zombies, or divergent symbols. (high severity, 100% confidence)

**Immediate Actions:**
1. Remove all 22 dead symbols (e.g., src/extension.ts:function_getRepoContext, src/facts/factsAssembler.ts:function_getIntendedLists) as they have zero callers and blastRadius 0 ensures safety [high priority, low effort]
2. Standardize constants in src/utils/supportedLanguages.ts to camelCase (e.g.,...

#### Full Markdown Output

# LLM Analysis Report

**Generated:** 11/28/2025, 12:27:52 AM

**Bundle:** 3 commits

## Refactor Intent & Story

### Findings

- **HIGH:** All 50 intended absent symbols were successfully removed with zero missing, zombies, or divergent symbols. (confidence: 100%)
  - Evidence: `intended.absent`
  - Evidence: `findings.incompleteness`
- **HIGH:** 22 dead functions confirmed unused and safe for deletion. (confidence: 100%)
  - Evidence: `findings.legacyAudit.dead`
- **MEDIUM:** No legacy code remains in use and no replaced leftovers. (confidence: 100%)
  - Evidence: `findings.legacyAudit.legacyUsed`
  - Evidence: `findings.legacyAudit.replacedLeftovers`
- **MEDIUM:** Convention drift is low at 2.56% across 95 symbols with dominant camelCase. (confidence: 100%)
  - Evidence: `findings.patternDrift.conventionDrift`
- **HIGH:** Zero blast radius confirms minimal architectural disruption. (confidence: 100%)
  - Evidence: `scope.blastRadius`

## Drift Verification

### Findings

- **HIGH:**... [truncated]

**Metadata:**
- Health Score: 99.40764674205708/100
- Total Tokens: 42437
- LLM Calls: 6
- Model: x-ai/grok-4.1-fast:free
- Validated Evidence: 8
- Analysis Blocks: 4
- Generated: 2025-11-28T06:27:52.853Z

## Summary

- **Total Steps:** 12
- **Errors:** 0
- **Total Symbols:** 3714
- **Total Edges:** 25565
- **Drift Issues:** 0

*Generated by pipeline diagnostics at 2025-11-28T06:27:52.857Z*
