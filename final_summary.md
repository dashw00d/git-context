# Pipeline Execution Summary

**Date:** 11/27/2025, 1:42:47 AM
**Total Time:** 185.07s
**Steps Completed:** 5/5
**Errors:** 0

## Key Metrics
- **Commits Analyzed:** 2
- **Workspace Symbols:**
  - Added: 67
  - Modified: 3
  - Removed: 24

## LLM Insights
## Key Insights

**Most Critical:** Intended symbols fully match working symbols at 624 with zero absent or renamed. (high severity, 100% confidence)

**Immediate Actions:**
1. Fix security_sensitive_debt: 3 fixes identified [high priority, medium effort]
2. Fix multi_risk_cluster: 1 fixes identified [high priority, medium effort]
3. Fix performance_schema_drift: 2 fixes identified [high priority, medium effort]
4. Fix high_similarity_refactor: 1 fixes identified [high priority, medium effort]

**Refactor Health:** 100/100 ✅

**Quick Stats:** 2 commits, 624 symbols analyzed, no issues found


## Errors (Aggregated)
No errors found.

## Bundle Facts
```json
{
  "version": "2.0",
  "generated_at": "2025-11-27T07:40:07.198Z",
  "bundle": {
    "oldestSha": "0676e247877b7f18bde5cefd412acdb738dd46a0",
    "newestSha": "459804923ec8f55547c2df43e2d163d6c1dee2db",
    "shas": [
      "0676e247877b7f18bde5cefd412acdb738dd46a0",
      "459804923ec8f55547c2df43e2d163d6c1dee2db"
    ]
  },
  "scope": {
    "files": 53,
    "blastRadius": 0
  },
  "intended": {
    "present": 624,
    "absent": 0,
    "renamed": 0
  },
  "working": {
    "symbols": 624,
    "edges": 2628
  },
  "findings": {
    "incompleteness": {
      "missing": 0,
      "zombies": 0,
      "divergent": 0
    },
    "patternDrift": {
      "mixedTargets": 0,
      "oldNamespaces": 0
    },
    "legacyAudit": {
      "dead": 0,
      "legacyUsed": 0,
      "replacedLeftovers": []
    }
  },
  "evidence": {
    "risks": [
      "schema-migration",
      "refactor",
      "security",
      "performance",
      "auth",
      "payment"
    ],
    "structuralChangeScore": 0
  }
}
```