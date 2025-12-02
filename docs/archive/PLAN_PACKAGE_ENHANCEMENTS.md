# Pipeline Enhancement Plan: Modern Package Integration

## Overview
This document outlines the comprehensive plan to integrate 5 npm packages into the git-context codebase to improve type safety, error handling, performance, and maintainability.

## Packages to Integrate

### High Priority
1. **simple-git** - Type-safe Git operations
2. **zod** - Runtime schema validation
3. **fast-glob** - Efficient file searching

### Medium Priority
4. **p-retry** - Robust retry logic
5. **pino** - Structured logging

---

## 1. simple-git - Git Operations

### Current State
- Manual `execSync` and `spawn` calls for every git command
- ~200 lines of custom git wrapper code
- Error-prone, no type safety, manual parsing of git output

### Files to Modify

#### Primary File (Complete Rewrite)
- **`src/analysis/git.ts`** (665 lines)
  - Replace entire `GitOperations` class with simple-git wrapper
  - Map all existing methods to simple-git equivalents

#### Additional Git Command Calls
- **`src/commands/commands.ts:467`**
  ```typescript
  // Before:
  sha = execSync(`git rev-parse ${shaOrRef}`, { cwd: gitRoot, encoding: 'utf8' }).trim();
  // After: Use simple-git
  ```

- **`src/analysis/contextExporter.ts:398`**
  ```typescript
  // Before:
  return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  // After: Use simple-git
  ```

- **`src/utils/config.ts:306`**
  ```typescript
  // Before:
  const remoteUrl = execSync('git config --get remote.origin.url', {
    cwd: gitRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  // After: Use simple-git
  ```

- **`src/extension.ts:45`**
  ```typescript
  // Before:
  const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
    cwd: gitRoot,
    encoding: 'utf8',
    timeout: 2000
  });
  // After: Use simple-git
  ```

### Method Mapping (GitOperations → simple-git)

| Current Method | simple-git Equivalent |
|---------------|----------------------|
| `execGit()` | Direct simple-git methods |
| `getCommitInfo()` | `git.show()` |
| `getRecentCommits()` | `git.log()` |
| `getFileChanges()` | `git.diffTree()` |
| `getCommitDiff()` | `git.show()` |
| `getFileDiff()` | `git.show()` |
| `getBundleDiff()` | `git.diff()` |
| `getStagedDiff()` | `git.diff(['--cached'])` |
| `getFileContent()` | `git.show()` |
| `safeGetFileContent()` | `git.show()` with error handling |
| `getStagedContent()` | `git.show([':${filePath}'])` |
| `safeGetStagedContent()` | `git.show()` with error handling |
| `getWorkingContent()` | Keep `fs.readFileSync` (not git operation) |
| `isIgnored()` | `git.checkIgnore()` |
| `isIgnoredAtCommit()` | `git.checkIgnore()` (approximation) |
| `getHeadSha()` | `git.revparse(['HEAD'])` |
| `getBlobSha()` | `git.raw(['ls-tree', '-r', sha, '--', filePath])` |
| `getBlobSize()` | `git.raw(['cat-file', '-s', ...])` |
| `getCurrentBranch()` | `git.revparse(['--abbrev-ref', 'HEAD'])` |
| `getBranchCommits()` | `git.log([branch, '--format=%H'])` |
| `isClean()` | `git.status()` + check for changes |
| `getWorkingDirectoryChanges()` | `git.status(['--porcelain'])` |
| `getStagedFiles()` | `git.status(['--porcelain'])` + parse |
| `getUnstagedFiles()` | `git.status(['--porcelain'])` + parse |
| `getFileDiffStats()` | `git.diff(['--numstat', '--', filePath])` |
| `spawnGit()` | simple-git's built-in methods |
| `execGitStream()` | simple-git's streaming support |

### Implementation Notes
- Maintain backward compatibility with existing return types
- Keep error handling patterns consistent
- Preserve performance characteristics (caching, etc.)
- Update all call sites to use new simple-git wrapper

---

## 2. zod - Runtime Schema Validation

### Current State
- No validation of LLM responses, config, or database schemas
- Silent failures, type mismatches at runtime
- Hard-to-debug errors from malformed JSON

### Critical JSON.parse Locations

#### LLM Response Parsing (HIGHEST PRIORITY)
- **`src/analysis/llmAnalyst/runner.ts:411,415`**
  ```typescript
  // Before:
  return JSON.parse(extractedJson);
  return JSON.parse(jsonStr);
  // After: Validate with LLMResponseSchema
  ```

- **`src/llm/summarizer.ts:101,136`**
  ```typescript
  // Before:
  return JSON.parse(response);
  return JSON.parse(response) as LLMResponse;
  // After: Validate with LLMResponseSchema
  ```

#### Config File Parsing (HIGH PRIORITY)
- **`src/utils/config.ts:37`** - package.json parsing (optional validation)
- **`src/utils/config.ts:72`** - `.git-context.config.json` (CRITICAL - validate schema)
- **`src/utils/config.ts:180,181,204`** - Environment variable JSON parsing
  - `TOKENS_PER_STEP`
  - `CUSTOM_PROMPTS`
  - `DETECTOR_THRESHOLDS`

#### Database JSON Columns (MEDIUM PRIORITY)
- **`src/analysis/contextExporter.ts:122,161,162`** - risks, loc_pre, loc_post
- **`src/analysis/commitIndexer.ts:484,488`** - risks, hotspots_json
- **`src/analysis/workspaceIndexer.ts:360`** - risks
- **`src/analysis/runner/steps/movedBlockStep.ts:65`** - symbols_json
- **`src/analysis/embeddingIndexer.ts:343`** - hotspots_json
- **`src/cli/queries.ts:42`** - risks
- **`src/analysis/structuralDiffManager.ts:111`** - data_json
- **`src/analysis/snapshotManager.ts:183,184`** - symbols_json, edges_json
- **`src/analysis/cstTimeline.ts:74,113,210`** - serialized_fact
- **`src/storage/index.ts:322,323`** - loc_pre, loc_post
- **`src/providers/activeBundleProvider.ts:24`** - factsContent
- **`src/storage/reportManager.ts:249,250,254,255`** - commit_shas, selected_files, facts_json, analysis_json

### Schemas to Create (`src/utils/schemas.ts`)

```typescript
import { z } from 'zod';

// LLM Response Schemas
export const LLMResponseSchema = z.object({
  summary: z.string(),
  claims: z.array(z.object({
    severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    confidence: z.number().min(0).max(100),
    evidence: z.array(z.string())
  }))
});

// Config Schemas
export const ExtensionConfigSchema = z.object({
  openRouterApiKey: z.string().optional(),
  openRouterModel: z.string(),
  apiEndpoint: z.string().url(),
  // ... all config fields
});

// Git Operation Schemas
export const CommitInfoSchema = z.object({
  sha: z.string(),
  author: z.string(),
  date: z.string(),
  message: z.string(),
  parent: z.string().optional()
});

export const FileChangeSchema = z.object({
  path: z.string(),
  status: z.enum(['A', 'M', 'D', 'R', 'C', 'U']),
  oldPath: z.string().optional()
});

// Data Schemas
export const RiskItemSchema = z.object({
  type: z.string(),
  severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  description: z.string()
});

export const LocationSchema = z.object({
  start: z.object({ line: z.number(), column: z.number() }),
  end: z.object({ line: z.number(), column: z.number() })
});

export const SymbolInfoSchema = z.object({
  id: z.string(),
  symbol_id: z.string(),
  name: z.string(),
  kind: z.string(),
  // ... other fields
});

export const EdgeInfoSchema = z.object({
  from_symbol_id: z.string(),
  to_symbol_id: z.string(),
  edge_type: z.string(),
  confidence: z.number().optional()
});

// Type exports
export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type ExtensionConfig = z.infer<typeof ExtensionConfigSchema>;
// ... other types
```

### Implementation Strategy
1. Create `src/utils/schemas.ts` with all schemas
2. Update LLM response parsing to use `.safeParse()` for graceful error handling
3. Update config loading to validate before returning
4. Add validation for critical database JSON columns
5. Use `.parse()` for strict validation, `.safeParse()` for graceful handling
6. Log validation errors with detailed messages

---

## 3. fast-glob - File Searching

### Current State
- Using `find_by_name` and manual filesystem traversal
- Slower than specialized tools, less flexible patterns

### Potential Locations

#### Current File Operations
Most file discovery currently uses git operations, not filesystem traversal:
- `src/facts/workingSnapshot.ts` - iterates over `scopePaths` Set (not a search)
- `src/analysis/workspaceIndexer.ts` - uses git to get changed files
- `src/facts/scope.ts` - uses git operations

#### Where fast-glob Could Help
1. **WASM File Discovery**
   - Finding WASM files in `out/` directory
   - Currently uses `fs.existsSync` checks in multiple places:
     - `src/utils/config.ts:233`
     - `src/analysis/tree-sitter.ts:29,38`
     - `src/storage/database.ts:256`

2. **Config File Discovery**
   - Finding `.git-context.config.json` files
   - Currently: `src/utils/config.ts:70` uses direct path check

3. **Future Enhancements**
   - Bulk file pattern matching for analysis
   - Finding files matching patterns outside git tracking
   - Pattern-based file filtering (supplement to git operations)

### Implementation Strategy
- Replace `fs.existsSync` checks for WASM files with `fg('out/**/*.wasm')`
- Use `gitignore: true` option to respect `.gitignore` automatically
- Leverage fast-glob's performance for large repositories
- Keep git-based file discovery as primary method (fast-glob for supplementary searches)

### Example Usage
```typescript
import fg from 'fast-glob';

// Find all WASM files
const wasmFiles = await fg('out/**/*.wasm', { 
  ignore: ['**/node_modules/**'],
  gitignore: true 
});

// Find config files
const configFiles = await fg('**/.git-context.config.json', {
  gitignore: true,
  deep: 3
});
```

---

## 4. p-retry - Robust Retry Logic

### Current State
- Custom retry with exponential backoff in multiple places
- Reinventing the wheel, no jitter options
- Inconsistent retry logic across codebase

### Files to Modify

#### 1. `src/analysis/commitIndexer.ts:71-99`
**Current:**
```typescript
private async retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  // Custom exponential backoff with jitter
}
```

**After:**
```typescript
import pRetry from 'p-retry';

private async retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return pRetry(fn, {
    retries: maxRetries,
    minTimeout: baseDelay,
    factor: 2,
    onFailedAttempt: (error) => {
      logDebug(`[CommitIndexer] Retry attempt ${error.attemptNumber}/${maxRetries + 1}: ${error.message}`);
    }
  });
}
```

#### 2. `src/llm/openrouter.ts:39-69`
**Current:**
```typescript
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    // ... API call
  } catch (error: any) {
    // Don't retry on 401/400/404
    if (error.status === 401 || error.status === 400 || error.status === 404) {
      throw new Error(...);
    }
    // Exponential backoff
    const delayMs = Math.pow(2, attempt) * 1000;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
```

**After:**
```typescript
import pRetry from 'p-retry';

return pRetry(
  () => this.client.chat.completions.create({...}),
  {
    retries: maxRetries,
    minTimeout: 1000,
    factor: 2,
    onFailedAttempt: (error) => {
      // Don't retry on certain errors
      if (error.error?.status === 401 || error.error?.status === 400 || error.error?.status === 404) {
        throw error;
      }
      console.warn(`LLM API call failed (attempt ${error.attemptNumber}/${maxRetries + 1}), retrying...`, error.message);
    }
  }
);
```

#### 3. `src/storage/database.ts:373-395`
**Current:**
```typescript
export async function ensureDatabaseInitialized(): Promise<void> {
  const manager = getDatabaseManager();
  try {
    await manager.initialize();
  } catch (error: any) {
    // If database is locked (SQLITE_IOERR), retry once after a short delay
    if (error.message && error.message.includes('locked')) {
      console.warn('Database locked, retrying initialization...');
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
        await manager.initialize();
      } catch (retryError) {
        // ...
      }
    }
  }
}
```

**After:**
```typescript
import pRetry from 'p-retry';

export async function ensureDatabaseInitialized(): Promise<void> {
  const manager = getDatabaseManager();
  return pRetry(
    () => manager.initialize(),
    {
      retries: 1,
      minTimeout: 100,
      onFailedAttempt: (error) => {
        // Only retry on locked database
        if (!error.message?.includes('locked')) {
          throw error;
        }
        console.warn('Database locked, retrying initialization...');
      }
    }
  );
}
```

### Configuration Summary

| Location | Retries | minTimeout | factor | Special Handling |
|----------|---------|-----------|--------|------------------|
| commitIndexer.ts | 3 | 1000 | 2 | None |
| openrouter.ts | 3 | 1000 | 2 | Don't retry on 401/400/404 |
| database.ts | 1 | 100 | N/A | Only retry on "locked" errors |

---

## 5. pino - Structured Logging

### Current State
- `console.log`, `console.warn`, `console.error` throughout codebase
- Custom `logDebug`, `logInfo`, `logWarn`, `logError` in `src/utils/logger.ts`
- No log levels, no structured data, hard to parse

### Files to Modify

#### Primary File (Complete Rewrite)
- **`src/utils/logger.ts`** - Replace entire file with pino

#### Files with console.* Calls (184 matches found)

**High Priority (Core Functionality):**
- `src/analysis/symbols.ts` - 5 calls
- `src/analysis/llmAnalyst/runner.ts` - 10 calls
- `src/analysis/dependencies.ts` - 3 calls
- `src/analysis/git.ts` - 6 calls
- `src/storage/database.ts` - 30+ calls
- `src/llm/openrouter.ts` - 1 call

**Medium Priority:**
- `src/metrics/legacyAuditAdapter.ts` - 1 call
- `src/analysis/runner/steps/intendedStep.ts` - 5 calls
- `src/metrics/movedBlockAdapter.ts` - 2 calls
- `src/facts/legacyAudit.ts` - 1 call
- `src/facts/driftDetector.ts` - 2 calls
- `src/utils/config.ts` - 4 calls
- `src/providers/commitsProvider.ts` - 6 calls
- `src/facts/workingSnapshot.ts` - 3 calls
- `src/analysis/workspaceIndexer.ts` - 1 call
- `src/analysis/contextExporter.ts` - 1 call

**Low Priority (CLI Output):**
- `src/cli/queries.ts` - 20+ calls (keep chalk for user output, use pino for errors)

### Implementation Strategy

#### 1. Create Pino Logger (`src/utils/logger.ts`)
```typescript
import pino from 'pino';

let vscode: any;
try {
  vscode = require('vscode');
} catch {
  vscode = null;
}

// Create pino logger
const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});

// VS Code output channels (for user-facing messages)
let infoChannel: any | undefined;
let debugChannel: any | undefined;

function getInfoChannel(): any | undefined {
  if (!vscode?.window) return undefined;
  if (!infoChannel) {
    infoChannel = vscode.window.createOutputChannel('Git Context');
  }
  return infoChannel;
}

function getDebugChannel(): any | undefined {
  if (!vscode?.window) return undefined;
  if (!debugChannel) {
    debugChannel = vscode.window.createOutputChannel('Git Context (Debug)');
  }
  return debugChannel;
}

// Wrapper functions that maintain VS Code channel integration
export function logInfo(message: string, data?: object): void {
  const channel = getInfoChannel();
  if (channel) {
    channel.appendLine(message);
  }
  pinoLogger.info(data || {}, message);
}

export function logDebug(message: string, data?: object): void {
  const channel = getDebugChannel();
  if (channel) {
    channel.appendLine(message);
  }
  pinoLogger.debug(data || {}, message);
}

export function logWarn(message: string, data?: object): void {
  const infoCh = getInfoChannel();
  if (infoCh) infoCh.appendLine(`[WARN] ${message}`);
  const debugCh = getDebugChannel();
  if (debugCh) debugCh.appendLine(`[WARN] ${message}`);
  pinoLogger.warn(data || {}, message);
}

export function logError(message: string, error?: any, data?: object): void {
  const errorMsg = error ? `${message}: ${error}` : message;
  const infoCh = getInfoChannel();
  if (infoCh) infoCh.appendLine(`[ERROR] ${errorMsg}`);
  const debugCh = getDebugChannel();
  if (debugCh) {
    debugCh.appendLine(`[ERROR] ${errorMsg}`);
    if (error instanceof Error && error.stack) {
      debugCh.appendLine(error.stack);
    }
  }
  pinoLogger.error({ ...data, err: error }, message);
}

// Export pino logger for direct use if needed
export const logger = pinoLogger;
```

#### 2. Migration Pattern
**Before:**
```typescript
console.log(`[SYMBOLS] Extracting ${file.path} at ${sha.substring(0, 8)}`);
```

**After:**
```typescript
logInfo('Extracting symbols', { file: file.path, sha: sha.substring(0, 8) });
```

**Before:**
```typescript
console.warn(`Failed to extract symbols from ${file.path}:`, error);
```

**After:**
```typescript
logWarn('Failed to extract symbols', { file: file.path, error });
```

**Before:**
```typescript
console.error('Failed to get working directory changes:', error);
```

**After:**
```typescript
logError('Failed to get working directory changes', error);
```

#### 3. CLI Files Special Handling
For `src/cli/queries.ts`, keep chalk for user-facing output but use pino for errors:
```typescript
// Keep for user output:
console.log(chalk.blue(`Commit: ${commit.sha}`));

// Replace with pino for errors:
logError('Failed to load commit', error, { sha });
```

### Log Levels
- `trace` - Very detailed debugging
- `debug` - Debug information
- `info` - General information (default)
- `warn` - Warnings
- `error` - Errors

### Configuration
- Set log level via `process.env.LOG_LEVEL` or config
- JSON output for machine parsing
- Maintain VS Code channel integration for user-facing messages
- Structured logging with context objects

---

## Implementation Order

### Phase 1: Foundation (High Priority)
1. **simple-git** - Foundation for other improvements
   - Replace `GitOperations` class
   - Update all git command calls
   - Test with various repository states

2. **zod** - Catch errors early
   - Create schemas file
   - Validate LLM responses (critical)
   - Validate config files
   - Add validation for database JSON columns

### Phase 2: Performance & Reliability (Medium Priority)
3. **fast-glob** - Performance improvement
   - Replace WASM file discovery
   - Add pattern-based file searching where beneficial

4. **p-retry** - Reliability improvement
   - Replace custom retry logic in 3 locations
   - Configure retry options appropriately

5. **pino** - Observability improvement
   - Replace logger.ts
   - Migrate all console.* calls
   - Maintain VS Code integration

---

## Testing Strategy

### simple-git
- Test with various repository states (detached HEAD, shallow clones)
- Test with missing git repository
- Test with large repositories
- Verify all existing functionality still works

### zod
- Test with malformed LLM responses (should fail gracefully)
- Test with invalid config files (should show clear errors)
- Test with corrupted database JSON (should handle gracefully)
- Verify type inference works correctly

### fast-glob
- Test with .gitignore patterns
- Test with large directory trees
- Verify performance improvement

### p-retry
- Test retry logic with simulated failures
- Test error filtering (don't retry on 401/400/404)
- Verify exponential backoff works correctly

### pino
- Test log levels (trace, debug, info, warn, error)
- Verify JSON output is parseable
- Test VS Code channel integration
- Verify structured logging includes necessary context

---

## Migration Notes

### Backward Compatibility
- Keep existing interfaces/return types unchanged where possible
- Maintain error handling patterns
- Preserve performance characteristics

### Error Messages
- Update error messages to reference new packages where appropriate
- Provide clear migration paths for any breaking changes

### Documentation
- Update README with new dependencies
- Document new logging format
- Document schema validation behavior

### Dependencies
Add to `package.json`:
```json
{
  "dependencies": {
    "simple-git": "^3.20.0",
    "zod": "^3.22.0",
    "fast-glob": "^3.3.2",
    "p-retry": "^6.2.0",
    "pino": "^8.17.0"
  }
}
```

---

## Summary Statistics

- **simple-git**: 4 files (1 major rewrite, 3 minor updates)
- **zod**: 20+ files (focus on LLM responses and config, plus database JSON)
- **fast-glob**: Limited (mostly for WASM discovery and future enhancements)
- **p-retry**: 3 files (replace custom retry logic)
- **pino**: 20+ files (184 console.* calls to migrate)

**Total Impact**: ~50+ files across the codebase

---

## Next Steps

1. Review and approve this plan
2. Install packages: `npm install simple-git zod fast-glob p-retry pino`
3. Implement Phase 1 (simple-git + zod)
4. Test thoroughly
5. Implement Phase 2 (fast-glob + p-retry + pino)
6. Update documentation
7. Release

