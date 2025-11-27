# Pipeline Metric Test Report

**Generated:** 2025-11-27T10:47:07.782Z

**Overall Accuracy:** 49.6% (63/127 tests passed)

## Accuracy by Phase

| Phase | Tests | Passed | Failed | Accuracy | Status |
|-------|-------|--------|--------|----------|--------|
| Symbol Counts | 10 | 10 | 0 | 100.0% | ✅ |
| Edge Counting | 10 | 10 | 0 | 100.0% | ✅ |
| Structural Change Score | 4 | 1 | 3 | 25.0% | ⚠️ |
| Scope Calculation | 8 | 1 | 7 | 12.5% | ⚠️ |
| Intended State | 8 | 5 | 3 | 62.5% | ⚠️ |
| Incompleteness Detection | 10 | 7 | 3 | 70.0% | ⚠️ |
| Legacy Audit | 8 | 3 | 5 | 37.5% | ⚠️ |
| Hotspot Detection | 10 | 0 | 10 | 0.0% | ⚠️ |
| Moved Block Detection | 8 | 2 | 6 | 25.0% | ⚠️ |
| Workspace Facts | 8 | 5 | 3 | 62.5% | ⚠️ |
| Bundle Facts Assembly | 12 | 0 | 12 | 0.0% | ⚠️ |
| Pattern Drift | 10 | 3 | 7 | 30.0% | ⚠️ |
| Blast Radius | 10 | 10 | 0 | 100.0% | ✅ |
| Risk Detection | 11 | 6 | 5 | 54.5% | ⚠️ |

## Detailed Suite Summary

| Suite | Tests | Passed | Failed | Accuracy |
|-------|-------|--------|--------|----------|
| Symbol Counts | 10 | 10 | 0 | 100.0% |
| Edge Counting | 10 | 10 | 0 | 100.0% |
| Structural Change Score | 4 | 1 | 3 | 25.0% |
| Scope Calculation | 8 | 1 | 7 | 12.5% |
| Intended State | 8 | 5 | 3 | 62.5% |
| Incompleteness Detection | 10 | 7 | 3 | 70.0% |
| Legacy Audit | 8 | 3 | 5 | 37.5% |
| Hotspot Detection | 10 | 0 | 10 | 0.0% |
| Moved Block Detection | 8 | 2 | 6 | 25.0% |
| Workspace Facts | 8 | 5 | 3 | 62.5% |
| Bundle Facts Assembly | 12 | 0 | 12 | 0.0% |
| Pattern Drift | 10 | 3 | 7 | 30.0% |
| Blast Radius | 10 | 10 | 0 | 100.0% |
| Risk Detection | 11 | 6 | 5 | 54.5% |

## Symbol Counts

Tests symbol added/modified/removed counting logic

✅ All tests passed!

## Edge Counting

Tests edge counting and classification logic

✅ All tests passed!

## Structural Change Score

Tests structural change detection and scoring

⚠️ 3 test(s) failed:

### Detects interface changes

**Issues:**
- structuralChangeScore: expected 0.3, got 0 (diff: 0.3)
- interfaceChanged: expected true, got false
- linesAdded: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "structuralChangeScore": 0.3,
  "controlFlowChanged": false,
  "interfaceChanged": true,
  "movedBlocks": 0,
  "linesAdded": 1,
  "linesRemoved": 0
}
```

**Actual:**
```json
{
  "structuralChangeScore": 0,
  "controlFlowChanged": false,
  "interfaceChanged": false,
  "movedBlocks": 0,
  "linesAdded": 0,
  "linesRemoved": 0
}
```

**Formula:** `structuralChangeScore = min(linesChanged / 10, 1.0)`

**Duration:** 0ms

### Detects control flow changes

**Issues:**
- structuralChangeScore: expected 0.2, got 0 (diff: 0.2)
- controlFlowChanged: expected true, got false
- linesAdded: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "structuralChangeScore": 0.2,
  "controlFlowChanged": true,
  "interfaceChanged": false,
  "movedBlocks": 0,
  "linesAdded": 2,
  "linesRemoved": 0
}
```

**Actual:**
```json
{
  "structuralChangeScore": 0,
  "controlFlowChanged": false,
  "interfaceChanged": false,
  "movedBlocks": 0,
  "linesAdded": 0,
  "linesRemoved": 0
}
```

**Duration:** 0ms

### Calculates large structural changes

**Issues:**
- structuralChangeScore: expected 1, got 0 (diff: 1)
- controlFlowChanged: expected true, got false
- interfaceChanged: expected true, got false
- linesAdded: expected 15, got 0 (diff: 15)
- linesRemoved: expected 5, got 0 (diff: 5)

**Expected:**
```json
{
  "structuralChangeScore": 1,
  "controlFlowChanged": true,
  "interfaceChanged": true,
  "movedBlocks": 0,
  "linesAdded": 15,
  "linesRemoved": 5
}
```

**Actual:**
```json
{
  "structuralChangeScore": 0,
  "controlFlowChanged": false,
  "interfaceChanged": false,
  "movedBlocks": 0,
  "linesAdded": 0,
  "linesRemoved": 0
}
```

**Duration:** 0ms

## Scope Calculation

Tests simplified scope calculation for file and blast radius scoping

⚠️ 7 test(s) failed:

### Calculates scope for single commit with one file

**Issues:**
- blastRadius: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "commitFiles": 1,
  "workingChanged": 1,
  "blastRadius": 1,
  "totalFiles": 1
}
```

**Actual:**
```json
{
  "commitFiles": 1,
  "workingChanged": 1,
  "blastRadius": 0,
  "totalFiles": 1,
  "scopeSet": {
    "commitFiles": {},
    "workingChanged": {},
    "blastRadius": {},
    "allPaths": {}
  }
}
```

**Formula:** `commitFiles = count(distinct files in commits), workingChanged = count(distinct files with symbols), blastRadius = files with dependencies, totalFiles = union of all`

**Duration:** 0ms

### Calculates scope for multiple commits with multiple files

**Issues:**
- blastRadius: expected 3, got 0 (diff: 3)

**Expected:**
```json
{
  "commitFiles": 3,
  "workingChanged": 3,
  "blastRadius": 3,
  "totalFiles": 3
}
```

**Actual:**
```json
{
  "commitFiles": 3,
  "workingChanged": 3,
  "blastRadius": 0,
  "totalFiles": 3,
  "scopeSet": {
    "commitFiles": {},
    "workingChanged": {},
    "blastRadius": {},
    "allPaths": {}
  }
}
```

**Duration:** 0ms

### Calculates blast radius including dependent files

**Issues:**
- commitFiles: expected 1, got 3 (diff: 2)

**Expected:**
```json
{
  "commitFiles": 1,
  "workingChanged": 3,
  "blastRadius": 3,
  "totalFiles": 3
}
```

**Actual:**
```json
{
  "commitFiles": 3,
  "workingChanged": 3,
  "blastRadius": 3,
  "totalFiles": 3,
  "scopeSet": {
    "commitFiles": {},
    "workingChanged": {},
    "blastRadius": {},
    "allPaths": {}
  }
}
```

**Duration:** 0ms

### Calculates scope for working directory changes only

**Issues:**
- commitFiles: expected 0, got 2 (diff: 2)
- blastRadius: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "commitFiles": 0,
  "workingChanged": 2,
  "blastRadius": 2,
  "totalFiles": 2
}
```

**Actual:**
```json
{
  "commitFiles": 2,
  "workingChanged": 2,
  "blastRadius": 0,
  "totalFiles": 2,
  "scopeSet": {
    "commitFiles": {},
    "workingChanged": {},
    "blastRadius": {},
    "allPaths": {}
  }
}
```

**Duration:** 0ms

### Extracts file paths from symbol IDs when filePath not provided

**Issues:**
- blastRadius: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "commitFiles": 1,
  "workingChanged": 1,
  "blastRadius": 1,
  "totalFiles": 1
}
```

**Actual:**
```json
{
  "commitFiles": 1,
  "workingChanged": 1,
  "blastRadius": 0,
  "totalFiles": 1,
  "scopeSet": {
    "commitFiles": {},
    "workingChanged": {},
    "blastRadius": {},
    "allPaths": {}
  }
}
```

**Duration:** 0ms

### Handles complex dependency networks for blast radius

**Issues:**
- commitFiles: expected 1, got 6 (diff: 5)

**Expected:**
```json
{
  "commitFiles": 1,
  "workingChanged": 6,
  "blastRadius": 6,
  "totalFiles": 6
}
```

**Actual:**
```json
{
  "commitFiles": 6,
  "workingChanged": 6,
  "blastRadius": 6,
  "totalFiles": 6,
  "scopeSet": {
    "commitFiles": {},
    "workingChanged": {},
    "blastRadius": {},
    "allPaths": {}
  }
}
```

**Duration:** 0ms

### Scales with large number of files and symbols

**Issues:**
- blastRadius: expected 20, got 16 (diff: 4)

**Expected:**
```json
{
  "commitFiles": 20,
  "workingChanged": 20,
  "blastRadius": 20,
  "totalFiles": 20
}
```

**Actual:**
```json
{
  "commitFiles": 20,
  "workingChanged": 20,
  "blastRadius": 16,
  "totalFiles": 20,
  "scopeSet": {
    "commitFiles": {},
    "workingChanged": {},
    "blastRadius": {},
    "allPaths": {}
  }
}
```

**Duration:** 0ms

## Intended State

Tests simplified intended state building for refactoring analysis

⚠️ 3 test(s) failed:

### Handles symbol renames correctly

**Issues:**
- renamed: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "present": 1,
  "absent": 1,
  "renamed": 1,
  "totalSymbols": 2
}
```

**Actual:**
```json
{
  "present": 1,
  "absent": 1,
  "renamed": 0,
  "totalSymbols": 2,
  "intendedMap": {}
}
```

**Duration:** 0ms

### Handles complex rename scenario with multiple renames

**Issues:**
- renamed: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "present": 2,
  "absent": 2,
  "renamed": 2,
  "totalSymbols": 4
}
```

**Actual:**
```json
{
  "present": 2,
  "absent": 2,
  "renamed": 0,
  "totalSymbols": 4,
  "intendedMap": {}
}
```

**Duration:** 0ms

### Scales with large number of symbols across multiple commits

**Issues:**
- present: expected 10, got 12 (diff: 2)
- totalSymbols: expected 13, got 15 (diff: 2)

**Expected:**
```json
{
  "present": 10,
  "absent": 3,
  "renamed": 0,
  "totalSymbols": 13
}
```

**Actual:**
```json
{
  "present": 12,
  "absent": 3,
  "renamed": 0,
  "totalSymbols": 15,
  "intendedMap": {}
}
```

**Duration:** 0ms

## Incompleteness Detection

Tests detection of missing symbols, zombies, and divergent code

⚠️ 3 test(s) failed:

### Detects divergent implementations

**Issues:**
- divergentSymbols: expected 3, got 0 (diff: 3)
- suggestedConsolidations: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "missingSymbols": 0,
  "zombieSymbols": 0,
  "divergentSymbols": 3,
  "incompleteMigrations": 0,
  "deadSymbols": 3,
  "suggestedConsolidations": 1
}
```

**Actual:**
```json
{
  "missingSymbols": 0,
  "zombieSymbols": 0,
  "divergentSymbols": 0,
  "incompleteMigrations": 0,
  "migrationProgress": 1,
  "deadSymbols": 3,
  "suggestedConsolidations": 0
}
```

**Duration:** 0ms

### Detects incomplete migrations

**Issues:**
- divergentSymbols: expected 4, got 0 (diff: 4)

**Expected:**
```json
{
  "missingSymbols": 0,
  "zombieSymbols": 0,
  "divergentSymbols": 4,
  "incompleteMigrations": 1,
  "migrationProgress": 0.5,
  "deadSymbols": 2
}
```

**Actual:**
```json
{
  "missingSymbols": 0,
  "zombieSymbols": 0,
  "divergentSymbols": 0,
  "incompleteMigrations": 1,
  "migrationProgress": 0.5,
  "deadSymbols": 2,
  "suggestedConsolidations": 0
}
```

**Duration:** 0ms

### Detects versioned symbol patterns

**Issues:**
- divergentSymbols: expected 3, got 0 (diff: 3)
- suggestedConsolidations: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "missingSymbols": 0,
  "zombieSymbols": 0,
  "divergentSymbols": 3,
  "incompleteMigrations": 0,
  "deadSymbols": 3,
  "suggestedConsolidations": 1
}
```

**Actual:**
```json
{
  "missingSymbols": 0,
  "zombieSymbols": 0,
  "divergentSymbols": 0,
  "incompleteMigrations": 0,
  "migrationProgress": 1,
  "deadSymbols": 3,
  "suggestedConsolidations": 0
}
```

**Duration:** 0ms

## Legacy Audit

Tests legacy code audit using real auditLegacy function

⚠️ 5 test(s) failed:

### Detects legacy symbols in audit

**Issues:**
- dead: expected 3, got 0 (diff: 3)
- legacyUsed: expected 2, got 0 (diff: 2)
- replacedLeftovers: expected 2, got 0 (diff: 2)
- totalUnreachable: expected 3, got 0 (diff: 3)
- reachabilityRatio: expected 0, got 1 (diff: 1)

**Expected:**
```json
{
  "dead": 3,
  "legacyUsed": 2,
  "replacedLeftovers": 2,
  "totalReachable": 0,
  "totalUnreachable": 3,
  "reachabilityRatio": 0
}
```

**Actual:**
```json
{
  "dead": 0,
  "legacyUsed": 0,
  "replacedLeftovers": 0,
  "totalReachable": 0,
  "totalUnreachable": 0,
  "reachabilityRatio": 1
}
```

**Duration:** 0ms

### Detects high legacy usage patterns

**Issues:**
- dead: expected 15, got 0 (diff: 15)
- legacyUsed: expected 25, got 0 (diff: 25)
- replacedLeftovers: expected 5, got 0 (diff: 5)

**Expected:**
```json
{
  "dead": 15,
  "legacyUsed": 25,
  "replacedLeftovers": 5,
  "totalReachable": 0,
  "totalUnreachable": 0,
  "reachabilityRatio": 1
}
```

**Actual:**
```json
{
  "dead": 0,
  "legacyUsed": 0,
  "replacedLeftovers": 0,
  "totalReachable": 0,
  "totalUnreachable": 0,
  "reachabilityRatio": 1
}
```

**Duration:** 0ms

### Includes drift findings in legacy audit

**Issues:**
- dead: expected 2, got 0 (diff: 2)
- legacyUsed: expected 1, got 0 (diff: 1)
- replacedLeftovers: expected 1, got 0 (diff: 1)
- totalUnreachable: expected 2, got 0 (diff: 2)
- reachabilityRatio: expected 0, got 1 (diff: 1)

**Expected:**
```json
{
  "dead": 2,
  "legacyUsed": 1,
  "replacedLeftovers": 1,
  "totalReachable": 0,
  "totalUnreachable": 2,
  "reachabilityRatio": 0
}
```

**Actual:**
```json
{
  "dead": 0,
  "legacyUsed": 0,
  "replacedLeftovers": 0,
  "totalReachable": 0,
  "totalUnreachable": 0,
  "reachabilityRatio": 1
}
```

**Duration:** 0ms

### Handles mixed legacy code patterns

**Issues:**
- dead: expected 7, got 0 (diff: 7)
- legacyUsed: expected 12, got 0 (diff: 12)
- replacedLeftovers: expected 2, got 0 (diff: 2)
- Missing metric: missing_symbols
- Missing metric: zombie_symbols
- Missing metric: drift_edges
- Missing metric: hotspots

**Expected:**
```json
{
  "dead": 7,
  "legacyUsed": 12,
  "replacedLeftovers": 2,
  "missing_symbols": 1,
  "zombie_symbols": 1,
  "drift_edges": 2,
  "hotspots": 3
}
```

**Actual:**
```json
{
  "dead": 0,
  "legacyUsed": 0,
  "replacedLeftovers": 0,
  "totalReachable": 0,
  "totalUnreachable": 0,
  "reachabilityRatio": 1
}
```

**Duration:** 0ms

### Scales with large legacy codebases

**Issues:**
- dead: expected 50, got 0 (diff: 50)
- legacyUsed: expected 100, got 0 (diff: 100)
- replacedLeftovers: expected 20, got 0 (diff: 20)
- Missing metric: missing_symbols
- Missing metric: zombie_symbols
- Missing metric: drift_edges
- Missing metric: hotspots

**Expected:**
```json
{
  "dead": 50,
  "legacyUsed": 100,
  "replacedLeftovers": 20,
  "missing_symbols": 10,
  "zombie_symbols": 15,
  "drift_edges": 25,
  "hotspots": 8
}
```

**Actual:**
```json
{
  "dead": 0,
  "legacyUsed": 0,
  "replacedLeftovers": 0,
  "totalReachable": 0,
  "totalUnreachable": 0,
  "reachabilityRatio": 1
}
```

**Duration:** 0ms

## Hotspot Detection

Tests hotspot detection using real HotspotDetector functions

⚠️ 10 test(s) failed:

### Detects high-risk hotspot with frequent changes by many authors

**Issues:**
- hotspotScore: expected 100, got 89.90030243369624 (diff: 10.09969756630376)
- recency: expected 1, got 0.9972602739726028 (diff: 0.002739726027397249)
- changeIntensity: expected 1, got 0.1 (diff: 0.9)

**Expected:**
```json
{
  "hotspotScore": 100,
  "riskLevel": "critical",
  "commitFrequency": 1,
  "recency": 1,
  "authorDiversity": 1,
  "changeIntensity": 1,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 89.90030243369624,
  "riskLevel": "critical",
  "commitFrequency": 1,
  "recency": 0.9972602739726028,
  "authorDiversity": 1,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Formula:** `hotspotScore = weighted sum of normalized metrics (commitFrequency, recency, authorDiversity, changeIntensity, temporalClustering)`

**Duration:** 0ms

### Detects low-risk hotspot with infrequent changes by few authors

**Issues:**
- hotspotScore: expected 0, got 31.333984388430746 (diff: 31.333984388430746)
- changeIntensity: expected 0.005, got 0.1 (diff: 0.095)

**Expected:**
```json
{
  "hotspotScore": 0,
  "riskLevel": "low",
  "commitFrequency": 0.05,
  "recency": 0,
  "authorDiversity": 0.2,
  "changeIntensity": 0.005,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 31.333984388430746,
  "riskLevel": "low",
  "commitFrequency": 0.05,
  "recency": 0,
  "authorDiversity": 0.2,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Detects medium-risk hotspot with moderate activity

**Issues:**
- hotspotScore: expected 50, got 71.63464334342645 (diff: 21.634643343426447)
- riskLevel: expected medium, got high
- changeIntensity: expected 0.031, got 0.1 (diff: 0.069)

**Expected:**
```json
{
  "hotspotScore": 50,
  "riskLevel": "medium",
  "commitFrequency": 0.4,
  "recency": 0.836,
  "authorDiversity": 0.6,
  "changeIntensity": 0.031,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 71.63464334342645,
  "riskLevel": "high",
  "commitFrequency": 0.4,
  "recency": 0.8356164383561644,
  "authorDiversity": 0.6,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Calculates file hotspot metrics

**Issues:**
- hotspotScore: expected 85, got 72.12316744298487 (diff: 12.876832557015135)
- commitFrequency: expected 0.75, got 0.25 (diff: 0.5)
- changeIntensity: expected 0.033, got 0.1 (diff: 0.067)

**Expected:**
```json
{
  "hotspotScore": 85,
  "riskLevel": "high",
  "commitFrequency": 0.75,
  "recency": 0.981,
  "authorDiversity": 0.8,
  "changeIntensity": 0.033,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 72.12316744298487,
  "riskLevel": "high",
  "commitFrequency": 0.25,
  "recency": 0.9808219178082191,
  "authorDiversity": 0.8,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Calculates symbol hotspot metrics

**Issues:**
- hotspotScore: expected 60, got 67.10301136261879 (diff: 7.103011362618787)
- riskLevel: expected medium, got high
- commitFrequency: expected 0.6, got 0.25 (diff: 0.35)
- changeIntensity: expected 0.025, got 0.1 (diff: 0.07500000000000001)

**Expected:**
```json
{
  "hotspotScore": 60,
  "riskLevel": "medium",
  "commitFrequency": 0.6,
  "recency": 0.962,
  "authorDiversity": 0.4,
  "changeIntensity": 0.025,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 67.10301136261879,
  "riskLevel": "high",
  "commitFrequency": 0.25,
  "recency": 0.9616438356164384,
  "authorDiversity": 0.4,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Handles very old changes with low recency score

**Issues:**
- hotspotScore: expected 25, got 65.8488381309017 (diff: 40.8488381309017)
- riskLevel: expected low, got high
- changeIntensity: expected 0.04, got 0.1 (diff: 0.060000000000000005)

**Expected:**
```json
{
  "hotspotScore": 25,
  "riskLevel": "low",
  "commitFrequency": 0.5,
  "recency": 0,
  "authorDiversity": 1,
  "changeIntensity": 0.04,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 65.8488381309017,
  "riskLevel": "high",
  "commitFrequency": 0.5,
  "recency": 0,
  "authorDiversity": 1,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Handles high change intensity per commit

**Issues:**
- hotspotScore: expected 75, got 63.2918148305851 (diff: 11.708185169414897)
- changeIntensity: expected 1, got 0.1 (diff: 0.9)

**Expected:**
```json
{
  "hotspotScore": 75,
  "riskLevel": "high",
  "commitFrequency": 0.15,
  "recency": 0.918,
  "authorDiversity": 0.4,
  "changeIntensity": 1,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 63.2918148305851,
  "riskLevel": "high",
  "commitFrequency": 0.15,
  "recency": 0.9178082191780822,
  "authorDiversity": 0.4,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Handles single author with high commit frequency

**Issues:**
- hotspotScore: expected 45, got 80.02414435653553 (diff: 35.02414435653553)
- riskLevel: expected medium, got critical
- changeIntensity: expected 0.033, got 0.1 (diff: 0.067)

**Expected:**
```json
{
  "hotspotScore": 45,
  "riskLevel": "medium",
  "commitFrequency": 0.9,
  "recency": 0.877,
  "authorDiversity": 0.2,
  "changeIntensity": 0.033,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 80.02414435653553,
  "riskLevel": "critical",
  "commitFrequency": 0.9,
  "recency": 0.8767123287671232,
  "authorDiversity": 0.2,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Handles edge case of zero commits

**Issues:**
- hotspotScore: expected 0, got 47.092475329996795 (diff: 47.092475329996795)
- riskLevel: expected low, got medium
- commitFrequency: expected 0, got 0.25 (diff: 0.25)
- authorDiversity: expected 0, got 0.4 (diff: 0.4)
- changeIntensity: expected 0, got 0.1 (diff: 0.1)

**Expected:**
```json
{
  "hotspotScore": 0,
  "riskLevel": "low",
  "commitFrequency": 0,
  "recency": 0,
  "authorDiversity": 0,
  "changeIntensity": 0,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 47.092475329996795,
  "riskLevel": "medium",
  "commitFrequency": 0.25,
  "recency": 0,
  "authorDiversity": 0.4,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

### Handles maximum author diversity and commit frequency

**Issues:**
- hotspotScore: expected 100, got 89.1094284405803 (diff: 10.890571559419698)
- recency: expected 1, got 0.9178082191780822 (diff: 0.0821917808219178)
- changeIntensity: expected 1, got 0.1 (diff: 0.9)

**Expected:**
```json
{
  "hotspotScore": 100,
  "riskLevel": "critical",
  "commitFrequency": 1,
  "recency": 1,
  "authorDiversity": 1,
  "changeIntensity": 1,
  "temporalClustering": 0.5
}
```

**Actual:**
```json
{
  "hotspotScore": 89.1094284405803,
  "riskLevel": "critical",
  "commitFrequency": 1,
  "recency": 0.9178082191780822,
  "authorDiversity": 1,
  "changeIntensity": 0.1,
  "temporalClustering": 0.5
}
```

**Duration:** 0ms

## Moved Block Detection

Tests moved block detection using real MovedBlockDetector functions

⚠️ 6 test(s) failed:

### Detects simple function rename within same file

**Issues:**
- totalMovedBlocks: expected 1, got 0 (diff: 1)
- blockMoves: expected 1, got 0 (diff: 1)
- symbolRenames: expected 1, got 0 (diff: 1)
- averageSimilarity: expected 0.9, got 0 (diff: 0.9)
- movedSymbols: expected 1, got 0 (diff: 1)
- movedLines: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "totalMovedBlocks": 1,
  "fileRenames": 0,
  "blockMoves": 1,
  "symbolRenames": 1,
  "averageSimilarity": 0.9,
  "movedSymbols": 1,
  "movedLines": 1
}
```

**Actual:**
```json
{
  "totalMovedBlocks": 0,
  "fileRenames": 0,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 0,
  "movedSymbols": 0,
  "movedLines": 0
}
```

**Duration:** 0ms

### Detects code moved due to file rename

**Issues:**
- totalMovedBlocks: expected 1, got 0 (diff: 1)
- fileRenames: expected 1, got 0 (diff: 1)
- averageSimilarity: expected 1, got 0 (diff: 1)
- movedSymbols: expected 1, got 0 (diff: 1)
- movedLines: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "totalMovedBlocks": 1,
  "fileRenames": 1,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 1,
  "movedSymbols": 1,
  "movedLines": 1
}
```

**Actual:**
```json
{
  "totalMovedBlocks": 0,
  "fileRenames": 0,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 0,
  "movedSymbols": 0,
  "movedLines": 0
}
```

**Duration:** 1ms

### Detects multiple moved code blocks

**Issues:**
- totalMovedBlocks: expected 3, got 0 (diff: 3)
- blockMoves: expected 3, got 0 (diff: 3)
- averageSimilarity: expected 0.95, got 0 (diff: 0.95)
- movedSymbols: expected 3, got 0 (diff: 3)
- movedLines: expected 3, got 0 (diff: 3)

**Expected:**
```json
{
  "totalMovedBlocks": 3,
  "fileRenames": 0,
  "blockMoves": 3,
  "symbolRenames": 0,
  "averageSimilarity": 0.95,
  "movedSymbols": 3,
  "movedLines": 3
}
```

**Actual:**
```json
{
  "totalMovedBlocks": 0,
  "fileRenames": 0,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 0,
  "movedSymbols": 0,
  "movedLines": 0
}
```

**Duration:** 0ms

### Handles mixed rename and move scenarios

**Issues:**
- totalMovedBlocks: expected 2, got 0 (diff: 2)
- fileRenames: expected 1, got 0 (diff: 1)
- blockMoves: expected 1, got 0 (diff: 1)
- symbolRenames: expected 2, got 0 (diff: 2)
- averageSimilarity: expected 0.85, got 0 (diff: 0.85)
- movedSymbols: expected 2, got 0 (diff: 2)
- movedLines: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "totalMovedBlocks": 2,
  "fileRenames": 1,
  "blockMoves": 1,
  "symbolRenames": 2,
  "averageSimilarity": 0.85,
  "movedSymbols": 2,
  "movedLines": 2
}
```

**Actual:**
```json
{
  "totalMovedBlocks": 0,
  "fileRenames": 0,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 0,
  "movedSymbols": 0,
  "movedLines": 0
}
```

**Duration:** 0ms

### Detects large code blocks that were moved

**Issues:**
- totalMovedBlocks: expected 1, got 0 (diff: 1)
- blockMoves: expected 1, got 0 (diff: 1)
- symbolRenames: expected 1, got 0 (diff: 1)
- averageSimilarity: expected 0.95, got 0 (diff: 0.95)
- movedSymbols: expected 1, got 0 (diff: 1)
- movedLines: expected 7, got 0 (diff: 7)

**Expected:**
```json
{
  "totalMovedBlocks": 1,
  "fileRenames": 0,
  "blockMoves": 1,
  "symbolRenames": 1,
  "averageSimilarity": 0.95,
  "movedSymbols": 1,
  "movedLines": 7
}
```

**Actual:**
```json
{
  "totalMovedBlocks": 0,
  "fileRenames": 0,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 0,
  "movedSymbols": 0,
  "movedLines": 0
}
```

**Duration:** 1ms

### Detects module split or join operations

**Issues:**
- totalMovedBlocks: expected 2, got 0 (diff: 2)
- fileRenames: expected 2, got 0 (diff: 2)
- averageSimilarity: expected 1, got 0 (diff: 1)
- movedSymbols: expected 2, got 0 (diff: 2)
- movedLines: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "totalMovedBlocks": 2,
  "fileRenames": 2,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 1,
  "movedSymbols": 2,
  "movedLines": 2
}
```

**Actual:**
```json
{
  "totalMovedBlocks": 0,
  "fileRenames": 0,
  "blockMoves": 0,
  "symbolRenames": 0,
  "averageSimilarity": 0,
  "movedSymbols": 0,
  "movedLines": 0
}
```

**Duration:** 0ms

## Workspace Facts

Tests simplified workspace facts calculation for unstaged/staged changes

⚠️ 3 test(s) failed:

### Calculates workspace facts for new symbols only

**Issues:**
- structuralChangeScore: expected 0.1, got 0.3 (diff: 0.19999999999999998)

**Expected:**
```json
{
  "symbolsAdded": 3,
  "symbolsModified": 0,
  "symbolsRemoved": 0,
  "edgesAdded": 2,
  "edgesRemoved": 0,
  "totalSymbols": 3,
  "totalEdges": 2,
  "filesChanged": 3,
  "blastRadius": 6,
  "structuralChangeScore": 0.1
}
```

**Actual:**
```json
{
  "symbolsAdded": 3,
  "symbolsModified": 0,
  "symbolsRemoved": 0,
  "edgesAdded": 2,
  "edgesRemoved": 0,
  "totalSymbols": 3,
  "totalEdges": 2,
  "filesChanged": 3,
  "blastRadius": 6,
  "structuralChangeScore": 0.3,
  "workspaceFacts": {
    "workspaceHash": "test-workspace-hash",
    "headSha": "test-head-sha",
    "symbolsAdded": 3,
    "symbolsModified": 0,
    "symbolsRemoved": 0,
    "edgesAdded": 2,
    "edgesRemoved": 0,
    "risks": [],
    "filesChanged": 3,
    "structuralChangeScore": 0.3,
    "blastRadius": 6
  }
}
```

**Formula:** `blastRadius = totalSymbols * 2, structuralChangeScore = min(totalSymbols/10, 1.0), edgesAdded = count(edges), symbolsAdded = count(symbols with status added)`

**Duration:** 0ms

### Calculates workspace facts for mixed symbol changes

**Issues:**
- structuralChangeScore: expected 0.1, got 0.3 (diff: 0.19999999999999998)

**Expected:**
```json
{
  "symbolsAdded": 1,
  "symbolsModified": 1,
  "symbolsRemoved": 1,
  "edgesAdded": 1,
  "edgesRemoved": 0,
  "totalSymbols": 3,
  "totalEdges": 1,
  "filesChanged": 3,
  "blastRadius": 6,
  "structuralChangeScore": 0.1
}
```

**Actual:**
```json
{
  "symbolsAdded": 1,
  "symbolsModified": 1,
  "symbolsRemoved": 1,
  "edgesAdded": 1,
  "edgesRemoved": 0,
  "totalSymbols": 3,
  "totalEdges": 1,
  "filesChanged": 3,
  "blastRadius": 6,
  "structuralChangeScore": 0.3,
  "workspaceFacts": {
    "workspaceHash": "test-workspace-hash",
    "headSha": "test-head-sha",
    "symbolsAdded": 1,
    "symbolsModified": 1,
    "symbolsRemoved": 1,
    "edgesAdded": 1,
    "edgesRemoved": 0,
    "risks": [],
    "filesChanged": 3,
    "structuralChangeScore": 0.3,
    "blastRadius": 6
  }
}
```

**Duration:** 0ms

### Scales with large workspace changes

**Issues:**
- symbolsAdded: expected 17, got 16 (diff: 1)
- symbolsModified: expected 16, got 17 (diff: 1)
- symbolsRemoved: expected 16, got 17 (diff: 1)

**Expected:**
```json
{
  "symbolsAdded": 17,
  "symbolsModified": 16,
  "symbolsRemoved": 16,
  "edgesAdded": 30,
  "edgesRemoved": 0,
  "totalSymbols": 50,
  "totalEdges": 30,
  "filesChanged": 50,
  "blastRadius": 100,
  "structuralChangeScore": 1
}
```

**Actual:**
```json
{
  "symbolsAdded": 16,
  "symbolsModified": 17,
  "symbolsRemoved": 17,
  "edgesAdded": 30,
  "edgesRemoved": 0,
  "totalSymbols": 50,
  "totalEdges": 30,
  "filesChanged": 50,
  "blastRadius": 100,
  "structuralChangeScore": 1,
  "workspaceFacts": {
    "workspaceHash": "test-workspace-hash",
    "headSha": "test-head-sha",
    "symbolsAdded": 16,
    "symbolsModified": 17,
    "symbolsRemoved": 17,
    "edgesAdded": 30,
    "edgesRemoved": 0,
    "risks": [],
    "filesChanged": 50,
    "structuralChangeScore": 1,
    "blastRadius": 100
  }
}
```

**Duration:** 0ms

## Bundle Facts Assembly

Tests bundle facts assembly using real buildRefactorBundleFacts with full pipeline state

⚠️ 12 test(s) failed:

### Assembles basic bundle facts from commit and workspace data

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 1ms

### Assembles bundle facts for complex multi-commit refactoring

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for workspace-only changes

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts with high incompleteness indicators

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for clean, complete refactoring

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for large-scale codebase refactoring

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for API modernization with breaking changes

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for database schema migration

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for security-related refactoring

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for microservice extraction

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for configuration system refactoring

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

### Assembles bundle facts for performance optimization refactoring

**Issues:**
- Test failed: Error: Bundle facts assembly tests require shared state

**Duration:** 0ms

## Pattern Drift

Tests pattern drift detection using real factsAssembler functions

⚠️ 7 test(s) failed:

### Detects mixed naming conventions (camelCase vs snake_case)

**Issues:**
- conventionDriftPercent: expected 50, got 0 (diff: 50)
- driftSymbolCount: expected 2, got 0 (diff: 2)
- mixedConventionFiles: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "mixedTargets": 2,
  "oldNamespaces": 0,
  "conventionDriftPercent": 50,
  "driftSymbolCount": 2,
  "mixedConventionFiles": 2
}
```

**Actual:**
```json
{
  "mixedTargets": 2,
  "oldNamespaces": 0,
  "conventionDriftPercent": 0,
  "driftSymbolCount": 0,
  "mixedConventionFiles": 0
}
```

**Duration:** 0ms

### Detects old namespace patterns

**Issues:**
- conventionDriftPercent: expected 67, got 0 (diff: 67)
- driftSymbolCount: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "mixedTargets": 0,
  "oldNamespaces": 2,
  "conventionDriftPercent": 67,
  "driftSymbolCount": 2,
  "mixedConventionFiles": 0
}
```

**Actual:**
```json
{
  "mixedTargets": 0,
  "oldNamespaces": 2,
  "conventionDriftPercent": 0,
  "driftSymbolCount": 0,
  "mixedConventionFiles": 0
}
```

**Duration:** 1ms

### Detects both mixed targets and old namespaces

**Issues:**
- conventionDriftPercent: expected 75, got 0 (diff: 75)
- driftSymbolCount: expected 3, got 0 (diff: 3)
- mixedConventionFiles: expected 1, got 0 (diff: 1)

**Expected:**
```json
{
  "mixedTargets": 1,
  "oldNamespaces": 2,
  "conventionDriftPercent": 75,
  "driftSymbolCount": 3,
  "mixedConventionFiles": 1
}
```

**Actual:**
```json
{
  "mixedTargets": 1,
  "oldNamespaces": 2,
  "conventionDriftPercent": 0,
  "driftSymbolCount": 0,
  "mixedConventionFiles": 0
}
```

**Duration:** 0ms

### Detects high convention drift percentage

**Issues:**
- conventionDriftPercent: expected 100, got 0 (diff: 100)
- driftSymbolCount: expected 5, got 0 (diff: 5)
- mixedConventionFiles: expected 5, got 0 (diff: 5)

**Expected:**
```json
{
  "mixedTargets": 4,
  "oldNamespaces": 1,
  "conventionDriftPercent": 100,
  "driftSymbolCount": 5,
  "mixedConventionFiles": 5
}
```

**Actual:**
```json
{
  "mixedTargets": 4,
  "oldNamespaces": 1,
  "conventionDriftPercent": 0,
  "driftSymbolCount": 0,
  "mixedConventionFiles": 0
}
```

**Duration:** 0ms

### Detects convention drift across multiple files

**Issues:**
- conventionDriftPercent: expected 67, got 0 (diff: 67)
- driftSymbolCount: expected 2, got 0 (diff: 2)

**Expected:**
```json
{
  "mixedTargets": 1,
  "oldNamespaces": 1,
  "conventionDriftPercent": 67,
  "driftSymbolCount": 2,
  "mixedConventionFiles": 1
}
```

**Actual:**
```json
{
  "mixedTargets": 1,
  "oldNamespaces": 1,
  "conventionDriftPercent": 0,
  "driftSymbolCount": 0,
  "mixedConventionFiles": 1
}
```

**Duration:** 0ms

### Detects complex mixed naming patterns

**Issues:**
- conventionDriftPercent: expected 50, got 0 (diff: 50)
- driftSymbolCount: expected 3, got 0 (diff: 3)
- mixedConventionFiles: expected 3, got 0 (diff: 3)

**Expected:**
```json
{
  "mixedTargets": 3,
  "oldNamespaces": 0,
  "conventionDriftPercent": 50,
  "driftSymbolCount": 3,
  "mixedConventionFiles": 3
}
```

**Actual:**
```json
{
  "mixedTargets": 3,
  "oldNamespaces": 0,
  "conventionDriftPercent": 0,
  "driftSymbolCount": 0,
  "mixedConventionFiles": 0
}
```

**Duration:** 1ms

### Scales with large codebase having mixed patterns

**Issues:**
- conventionDriftPercent: expected 35, got 0 (diff: 35)
- driftSymbolCount: expected 35, got 0 (diff: 35)
- mixedConventionFiles: expected 25, got 0 (diff: 25)

**Expected:**
```json
{
  "mixedTargets": 25,
  "oldNamespaces": 10,
  "conventionDriftPercent": 35,
  "driftSymbolCount": 35,
  "mixedConventionFiles": 25
}
```

**Actual:**
```json
{
  "mixedTargets": 25,
  "oldNamespaces": 10,
  "conventionDriftPercent": 0,
  "driftSymbolCount": 0,
  "mixedConventionFiles": 0
}
```

**Duration:** 0ms

## Blast Radius

Tests blast radius calculation based on symbol connections

✅ All tests passed!

## Risk Detection

Tests risk detection rules based on symbol patterns

⚠️ 5 test(s) failed:

### Detects breaking API changes

**Issues:**
- totalRisks: expected 1, got 0 (diff: 1)
- riskCategories.Missing metric: breaking-api
- riskFactors: expected [breaking-api], got []

**Expected:**
```json
{
  "totalRisks": 1,
  "riskCategories": {
    "breaking-api": 1
  },
  "riskFactors": [
    "breaking-api"
  ]
}
```

**Actual:**
```json
{
  "totalRisks": 0,
  "riskCategories": {},
  "riskFactors": [],
  "highRiskSymbols": 0,
  "criticalRiskSymbols": 0,
  "riskScore": 0
}
```

**Duration:** 0ms

### Detects multiple risk categories

**Issues:**
- totalRisks: expected 4, got 2 (diff: 2)
- riskCategories.Missing metric: database
- riskCategories.Missing metric: refactor
- riskFactors: expected [auth,payment,database,refactor], got [auth,payment]

**Expected:**
```json
{
  "totalRisks": 4,
  "riskCategories": {
    "auth": 1,
    "payment": 1,
    "database": 1,
    "refactor": 1
  },
  "riskFactors": [
    "auth",
    "payment",
    "database",
    "refactor"
  ]
}
```

**Actual:**
```json
{
  "totalRisks": 2,
  "riskCategories": {
    "auth": 1,
    "payment": 1
  },
  "riskFactors": [
    "auth",
    "payment"
  ],
  "highRiskSymbols": 3,
  "criticalRiskSymbols": 0,
  "riskScore": 10
}
```

**Duration:** 0ms

### Counts critical risk symbols

**Issues:**
- totalRisks: expected 3, got 2 (diff: 1)
- riskCategories.Missing metric: auth
- highRiskSymbols: expected 4, got 0 (diff: 4)
- criticalRiskSymbols: expected 3, got 4 (diff: 1)
- riskFactors: expected [auth,security,payment], got [security,payment]

**Expected:**
```json
{
  "totalRisks": 3,
  "riskCategories": {
    "auth": 1,
    "security": 1,
    "payment": 1
  },
  "highRiskSymbols": 4,
  "criticalRiskSymbols": 3,
  "riskScore": 10,
  "riskFactors": [
    "auth",
    "security",
    "payment"
  ]
}
```

**Actual:**
```json
{
  "totalRisks": 2,
  "riskCategories": {
    "security": 1,
    "payment": 1
  },
  "riskFactors": [
    "security",
    "payment"
  ],
  "highRiskSymbols": 0,
  "criticalRiskSymbols": 4,
  "riskScore": 10
}
```

**Duration:** 1ms

### Detects database migration risks

**Issues:**
- totalRisks: expected 1, got 0 (diff: 1)
- riskCategories.Missing metric: schema-migration
- riskFactors: expected [schema-migration], got []

**Expected:**
```json
{
  "totalRisks": 1,
  "riskCategories": {
    "schema-migration": 1
  },
  "riskFactors": [
    "schema-migration"
  ]
}
```

**Actual:**
```json
{
  "totalRisks": 0,
  "riskCategories": {},
  "riskFactors": [],
  "highRiskSymbols": 0,
  "criticalRiskSymbols": 0,
  "riskScore": 0
}
```

**Duration:** 0ms

### Detects refactor patterns

**Issues:**
- totalRisks: expected 1, got 2 (diff: 1)
- riskCategories.Missing metric: refactor
- riskFactors: expected [refactor], got [security,auth]

**Expected:**
```json
{
  "totalRisks": 1,
  "riskCategories": {
    "refactor": 1
  },
  "riskFactors": [
    "refactor"
  ]
}
```

**Actual:**
```json
{
  "totalRisks": 2,
  "riskCategories": {
    "security": 1,
    "auth": 1
  },
  "riskFactors": [
    "security",
    "auth"
  ],
  "highRiskSymbols": 2,
  "criticalRiskSymbols": 0,
  "riskScore": 10
}
```

**Duration:** 0ms

