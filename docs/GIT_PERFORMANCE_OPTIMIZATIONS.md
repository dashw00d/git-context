# Git Operations Performance Optimizations

## Summary

This document describes performance optimizations made to address severe bottlenecks in git operations within the git-context extension. The key insight: **individual git operations take 2-4ms, but artificial concurrency limits and queue contention were causing 20-60 second delays**.

---

## Architecture: Init Step as the Data Foundation

### Design Philosophy

The pipeline follows a **"gather once, use everywhere"** philosophy. The `initStep` is designed to be the **single source of truth** for all git data. It runs first and pre-populates all caches so that subsequent steps never need to call git directly.

```
┌─────────────────────────────────────────────────────────────────┐
│                        INIT STEP                                 │
│  • Fetch all commit file changes (git diff-tree)                │
│  • Get commit metadata (git log)                                │
│  • Check workspace status (git status, ls-files)                │
│  • Compute ignored paths (git check-ignore)                     │
│  • Warm sizes cache (git cat-file --batch-check)                │
│                                                                  │
│  Stores everything in:                                          │
│  • state.plan.fileChanges                                       │
│  • state.plan.ignoredPaths                                      │
│  • state.plan.sizes                                             │
│  • gitCacheService.fileChangesCache                             │
│  • GitOperations.sharedCommitInfoCache                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUBSEQUENT STEPS                              │
│  scope → index_commits → cst → overlay → symbols → ...          │
│                                                                  │
│  These steps should:                                             │
│  ✓ Read from plan.fileChanges                                   │
│  ✓ Read from plan.ignoredPaths                                  │
│  ✓ Use cacheService.getCachedFileChanges()                      │
│  ✗ NEVER call git.getFileChanges() directly                     │
│  ✗ NEVER call git.areIgnored() without checking plan first      │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline Dependencies

The `pipelineManifest.ts` defines step dependencies:

```
init ──┬──> scope ──> index_commits ──> cst ──> ...
       │
       └──> workspace_overlay
```

All steps depend on `init` completing first (directly or transitively). This ensures caches are warm before any step runs.

### What Init Step Caches

| Data | Source | Stored In | Used By |
|------|--------|-----------|---------|
| File changes per commit | `git diff-tree` | `plan.fileChanges`, `cacheService.fileChangesCache` | scope, index_commits, cst |
| Commit metadata | `git log` | `GitOperations.sharedCommitInfoCache` | All steps needing author/date/parent |
| Ignored paths | `git check-ignore` | `plan.ignoredPaths`, `cacheService.ignoredPaths` | scope, pathFilter |
| Workspace state | `git status`, `ls-files` | `plan.fileChanges` (for workspace SHAs) | workspace_overlay |
| File sizes | `git cat-file --batch-check` | `plan.sizes` | sizeStep, filtering |

### Contract for New Steps

When adding a new pipeline step:

1. **Never call git directly** for data that init already gathers
2. **Check plan first**: `plan.fileChanges.get(sha)` before `git.getFileChanges(sha)`
3. **Use the cacheService**: `cacheService.getCachedFileChanges(sha)` which checks cache first
4. **Add new data to init**: If your step needs new git data, add the gathering to init, not your step

### Anti-Patterns to Avoid

```typescript
// ❌ BAD: Direct git call in a step
async run(state: PipelineState) {
  for (const sha of state.shas) {
    const files = await git.getFileChanges(sha);  // Slow! Bypasses cache
  }
}

// ✓ GOOD: Use pre-cached data from plan
async run(state: PipelineState) {
  for (const sha of state.shas) {
    const files = state.plan.fileChanges.get(sha) || [];  // Instant!
  }
}

// ✓ GOOD: Use cacheService which checks cache first
async run(state: PipelineState) {
  const files = await cacheService.getCachedFileChanges(sha);  // Cache hit = instant
}
```

---

## Root Causes Identified


### 1. SimpleGit Queue Contention (`maxConcurrentProcesses`)

**Problem**: `simple-git` was configured with `{ maxConcurrentProcesses: 10 }`, limiting concurrent git processes. When many operations were queued:
- Operations waited in queue for 20-60 seconds
- The `withTimeout` wrapper measured **queue wait time + execution time**
- This made 2ms operations appear to take 58 seconds on average

**Fix**: Removed the `maxConcurrentProcesses` limit entirely in `src/analysis/git.ts`:
```typescript
// Before
simpleGit(root, { maxConcurrentProcesses: 10 })

// After
simpleGit(root)
```

### 2. Multiple SimpleGit Instances

**Problem**: Several files created their own `simpleGit()` instances directly:
- `src/features/coreFeatures.ts`
- `src/utils/config.ts`
- `src/commands/commands.ts`

Each instance had its own internal queue, and default concurrency limits were re-applied.

**Fix**: Added `GitOperations.getSimpleGit(root)` static method that returns the shared instance, then updated call sites to use it.

### 3. Sequential Git Operations in Loops

**Problem**: `initStep.ts` gathered commit data sequentially:
```typescript
// Before - Sequential, each awaited before next started
for (const sha of allShas) {
  const files = await git.getFileChanges(sha);  // Wait for each
  const commitInfo = await git.getCommitInfo(sha);
}
```

**Fix**: Parallelized using `p-limit`:
```typescript
// After - Parallel with concurrency control
const limit = pLimit(8);
await Promise.all(allShas.map(sha => limit(async () => {
  const files = await git.getFileChanges(sha);
  const commitInfo = await git.getCommitInfo(sha);
})));
```

### 4. Dual Cache Problem

**Problem**: `initStep.ts` populated `plan.fileChanges` but `gitCacheService.fileChangesCache` was a separate cache. Later code called `getCachedFileChanges()` which missed the cache and re-called `git diff-tree`.

**Fix**: Modified `initStep.ts` to also populate `gitCacheService.fileChangesCache`:
```typescript
const files = await git.getFileChanges(sha);
plan.fileChanges.set(sha, files);
cacheService.cacheFileChanges(sha, files);  // Also cache here
```

### 5. Instance-Level vs Static Caches

**Problem**: `commitInfoCache` was an instance property, so each `new GitOperations()` had its own empty cache.

**Fix**: Added `sharedCommitInfoCache` as a static property that persists across instances.

---

## How to Identify Similar Issues

### 1. Check AsyncStats Output

The `withTimeout` wrapper logs statistics every 30 seconds:
```
📊 [AsyncStats] Summary:
Git revparse HEAD: 4 runs, avg 58543ms, 0 err, 0 timeout
```

**Red flags**:
- High average times (>1s) for operations that should be instant
- Many runs of the same operation (indicates duplicate calls)
- Timeouts (indicates queue contention or actual slowness)

### 2. Verify Actual Operation Speed

Run git commands directly to check real performance:
```bash
time git rev-parse HEAD        # Should be <10ms
time git diff-tree -r HEAD     # Should be <50ms
time git status --porcelain    # Should be <100ms
time git ls-files --others     # Should be <50ms
```

If these are fast but AsyncStats shows slow times, the issue is **queue contention** or **redundant calls**.

### 3. Search for Concurrency Limits

```bash
grep -rn "maxConcurrentProcesses" src/
grep -rn "pLimit(" src/
```

For `pLimit`, ask: is the limit reasonable for the operation type?
- **CPU-bound** (parsing): Limit to CPU count is reasonable
- **I/O-bound** (git, file reads): Higher limits are fine
- **Mutex** (pLimit(1) for DB writes): Necessary, but minimize scope

### 4. Search for Direct SimpleGit Usage

```bash
grep -rn "simpleGit(" src/
```

All instances should use `GitOperations.getSimpleGit()` to share the queue.

### 5. Look for Sequential Await in Loops

Pattern to find:
```bash
grep -rn "for.*await\|forEach.*await" src/
```

These are often performance bottlenecks. Consider:
- `Promise.all()` for independent operations
- `p-limit()` if you need controlled concurrency

### 6. Check for Duplicate Data Gathering

If the same data is gathered in multiple places:
1. Gather once in an early step (e.g., `initStep`)
2. Store in a shared location (`plan` or `cacheService`)
3. Later steps read from cache instead of re-fetching

---

## Files Modified

| File | Change |
|------|--------|
| `src/analysis/git.ts` | Removed concurrency limit, added shared cache, added `getSimpleGit()` |
| `src/analysis/runner/steps/initStep.ts` | Parallelized commit gathering, sync caches |
| `src/facts/scope.ts` | Use plan data for ignore checks |
| `src/utils/pathFilter.ts` | Skip redundant git-ignore checks |
| `src/services/gitCacheService.ts` | Added `cacheFileChanges()` method |
| `src/features/coreFeatures.ts` | Use shared SimpleGit instance |
| `src/utils/config.ts` | Use shared SimpleGit instance |
| `src/commands/commands.ts` | Use shared SimpleGit instance |
| `src/analysis/runner/steps/scopeStep.ts` | Pass plan to computeScope |

---

## Testing Performance

After making changes:

1. **Compile**: Run VS Code extension debug (auto-compiles)
2. **Watch AsyncStats**: Monitor the 30-second summary logs
3. **Expected results**:
   - Git operations: <500ms average
   - Init step: <5 seconds
   - Full pipeline: <30 seconds (depending on repo size)

If performance is still poor, check for:
- New code paths creating separate caches
- Operations not using the shared SimpleGit instance
- Sequential loops that weren't parallelized
