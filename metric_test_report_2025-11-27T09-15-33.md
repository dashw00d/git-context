# Pipeline Metric Test Report

**Generated:** 2025-11-27T09:15:33.824Z

**Overall Accuracy:** 80.0% (44/55 tests passed)

## Accuracy by Phase

| Phase | Tests | Passed | Failed | Accuracy | Status |
|-------|-------|--------|--------|----------|--------|
| Symbol Counts | 10 | 10 | 0 | 100.0% | ✅ |
| Blast Radius | 10 | 10 | 0 | 100.0% | ✅ |
| Risk Detection | 11 | 6 | 5 | 54.5% | ⚠️ |
| Incompleteness Detection | 10 | 7 | 3 | 70.0% | ⚠️ |
| Edge Counting | 10 | 10 | 0 | 100.0% | ✅ |
| Structural Change Score | 4 | 1 | 3 | 25.0% | ⚠️ |

## Detailed Suite Summary

| Suite | Tests | Passed | Failed | Accuracy |
|-------|-------|--------|--------|----------|
| Symbol Counts | 10 | 10 | 0 | 100.0% |
| Blast Radius | 10 | 10 | 0 | 100.0% |
| Risk Detection | 11 | 6 | 5 | 54.5% |
| Incompleteness Detection | 10 | 7 | 3 | 70.0% |
| Edge Counting | 10 | 10 | 0 | 100.0% |
| Structural Change Score | 4 | 1 | 3 | 25.0% |

## Symbol Counts

Tests symbol added/modified/removed counting logic

✅ All tests passed!

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

**Duration:** 0ms

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

