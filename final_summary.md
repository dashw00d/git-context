# Pipeline Execution Summary

**Date:** 11/26/2025, 11:27:41 PM
**Total Time:** 148.04s
**Steps Completed:** 5/5
**Errors:** 0

## Key Metrics
- **Commits Analyzed:** 2
- **Workspace Symbols:** 
  - Added: 0
  - Modified: 0
  - Removed: 0

## LLM Insights
No LLM summary generated.

## Errors (Aggregated)
No errors found.

## Bundle Facts
```json
{
  "version": "2.0",
  "generated_at": "2025-11-27T05:25:35.733Z",
  "bundle": {
    "oldestSha": "0c973858ddc0218c6b2c5772dfea87d9bb00f422",
    "newestSha": "7fae5f76c8747ec54b3105f58a1a51664f1b1abc",
    "shas": [
      "0c973858ddc0218c6b2c5772dfea87d9bb00f422",
      "7fae5f76c8747ec54b3105f58a1a51664f1b1abc"
    ]
  },
  "scope": {
    "files": 57,
    "blastRadius": 0
  },
  "intended": {
    "present": 601,
    "absent": 0,
    "renamed": 0
  },
  "working": {
    "symbols": 601,
    "edges": 2610
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
      "auth",
      "payment",
      "performance"
    ],
    "structuralChangeScore": 0
  }
}
```