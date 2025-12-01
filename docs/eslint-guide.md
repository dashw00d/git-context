# ESLint Configuration Guide

## Running ESLint

### Show All Issues (Warnings + Errors)
```bash
npm run lint
```

### Show Only Errors (Recommended)
```bash
npm run lint:errors
```

### Auto-Fix Issues
```bash
npm run lint:fix
```

### Direct ESLint Commands
```bash
# Only errors in src/
eslint src --ext ts --quiet

# Specific file
eslint src/services/databaseService.ts --quiet

# Specific directory
eslint src/webview/cockpit --ext ts --quiet
```

---

## VS Code Integration

Since `.vscode/settings.json` is gitignored, add these settings to your **User or Workspace Settings**:

### Method 1: VS Code Settings UI
1. Open Settings (Cmd/Ctrl + ,)
2. Search for "eslint"
3. Enable:
   - ✅ **ESLint: Enable**
   - ✅ **ESLint: Run** → "onSave"
   - ✅ **Editor: Code Actions On Save** → Add `source.fixAll.eslint`

### Method 2: Manual JSON Settings
Press `Cmd/Ctrl + Shift + P` → "Preferences: Open User Settings (JSON)"

Add:
```json
{
  "eslint.enable": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "eslint.run": "onSave",
  "eslint.format.enable": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.options": {
    "overrideConfigFile": ".eslintrc.cjs"
  }
}
```

### Recommended VS Code Extensions
- **ESLint** (dbaeumer.vscode-eslint) - Required
- **Error Lens** (usernamehw.errorlens) - Shows inline error messages

---

## Understanding the Rules

### Architecture Pattern Rules (Errors)

| Rule | What It Catches | Fix |
|------|----------------|-----|
| `db.prepare()` | Direct database access | Import `prepare` from `statement-wrapper` |
| `postMessage` | Bypassing Redux | Use `store.dispatch()` |
| `orchestrator.updateState()` | Legacy pattern | Use `store.dispatch()` |
| `throw` in services | Breaking best-effort | Log error and return partial data |
| Direct state mutation | Bypassing reducers | Use actions |
| `console.log` | No context | Use `logInfo/logError/logDebug` |
| `db.exec()` | SQL injection risk | Use prepared statements |

### Quick Fixes

#### Fix: db.prepare()
```typescript
// ❌ Before
const stmt = db.prepare('SELECT * FROM symbols WHERE sha = ?');

// ✅ After
import { prepare } from '../storage/statement-wrapper';
const stmt = prepare('SELECT * FROM symbols WHERE sha = ?');
```

#### Fix: postMessage
```typescript
// ❌ Before
this.view.webview.postMessage({ type: 'updateBundle', payload: data });

// ✅ After
import { getStore } from '../state/store';
getStore().dispatch({ type: 'BUNDLE_DATA_UPDATED', payload: data });
```

#### Fix: orchestrator.updateState
```typescript
// ❌ Before
orchestrator.updateState({ selectedCommitShas: shas }, 'reason');

// ✅ After
getStore().dispatch({ type: 'SELECTION_SET', payload: { shas } });
```

#### Fix: console.log
```typescript
// ❌ Before
console.log('Started analysis');

// ✅ After
import { logInfo } from '../utils/logger';
logInfo('[Analysis] Started');
```

---

## Suppressing Rules (Use Sparingly)

### Disable for one line
```typescript
// eslint-disable-next-line no-restricted-syntax
const stmt = db.prepare('SELECT * FROM old_table');
```

### Disable for entire file (Not recommended)
```typescript
/* eslint-disable no-restricted-syntax */
```

### When to suppress:
- ✅ Legacy code during migration
- ✅ Test files
- ✅ Generated code
- ❌ New feature development

---

## CI/CD Integration

### Recommended: Fail on errors only
Update `.github/workflows/` or CI config:
```yaml
- name: Lint
  run: npm run lint:errors
```

This prevents warnings from blocking merges while still catching critical architecture violations.

---

## Current Violations Summary

Run `npm run lint:errors` to see all current errors:
- ~50 `db.prepare()` violations
- ~20 `postMessage` violations  
- ~40 `orchestrator.updateState()` violations

**Total**: ~110 errors to fix during migration

See `docs/anti-patterns-audit.md` for detailed breakdown and prioritization.
