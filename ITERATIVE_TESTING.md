# Quick Reference: Iterative Testing Commands

## Essential Commands

### Run Specific Test File

```bash
CI=true npm test tests/integration/invalidationIntegration.test.ts
```

### Run Specific Test by Name

```bash
CI=true npm test tests/integration/invalidationIntegration.test.ts -t "should mark symbols as stale"
```

### Run All Integration Tests

```bash
CI=true npm test tests/integration/
```

### Run with Verbose Output

```bash
CI=true npm test tests/integration/ --reporter=verbose
```

### Run Single Test in Isolation (No Parallel)

```bash
CI=true npm test tests/integration/invalidationIntegration.test.ts --run
```

## Debugging Commands

### See Only Failures

```bash
CI=true npm test tests/integration/ 2>&1 | grep -A 10 "FAIL"
```

### See Test Summary

```bash
CI=true npm test tests/integration/ 2>&1 | tail -20
```

### Run and Save Output

```bash
CI=true npm test tests/integration/ 2>&1 | tee test-output.log
```

## Code Quality Checks

### Fix Linting

```bash
npm run fix
```

### Compile TypeScript

```bash
npm run compile
```

### Run Linter Only

```bash
npm run lint
```

## Workflow Example

```bash
# 1. Start with failing test
CI=true npm test tests/integration/invalidationIntegration.test.ts -t "should mark symbols as stale"

# 2. Add debug logging, then run again
CI=true npm test tests/integration/invalidationIntegration.test.ts -t "should mark symbols as stale"

# 3. Make fix, verify
CI=true npm test tests/integration/invalidationIntegration.test.ts -t "should mark symbols as stale"

# 4. Check for regressions
CI=true npm test tests/integration/

# 5. Fix linting if needed
npm run fix

# 6. Final verification
CI=true npm test tests/integration/
```

## Test File Quick Reference

| Test File                         | Focus Area             | Key Tests       |
| --------------------------------- | ---------------------- | --------------- |
| `invalidationIntegration.test.ts` | Invalidation logic     | 3 failing tests |
| `quickScanFullScan.test.ts`       | Quick vs full scan     | 2 failing tests |
| `databaseIntegration.test.ts`     | Database persistence   | All passing ✅  |
| `bundleFacts.test.ts`             | Bundle facts structure | All passing ✅  |

## Common Patterns

### Add Debug Logging in Test

```typescript
const db = dbManager.getDatabase();
const symbols = db.prepare('SELECT * FROM symbols LIMIT 10').all();
console.log('Debug:', JSON.stringify(symbols, null, 2));
```

### Check Database Contents

```typescript
// After setup, before assertion
const count = db
  .prepare('SELECT COUNT(*) as count FROM symbols WHERE path = ? AND sha = ?')
  .get([testFile, commits[0]]);
console.log('Symbol count:', count);
```

### Normalize Path in Test

```typescript
import { GitOperations } from '../../src/analysis/git';
const normalizedPath = GitOperations.normalizePath(testFile);
```
