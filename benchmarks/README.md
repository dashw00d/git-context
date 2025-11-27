# Pipeline Performance Benchmarks

This directory contains performance benchmarks for the layered Git Context analysis pipeline.

## Quick Start

```bash
# Run all benchmarks
cd /home/ryan/plugins/git-context
npx ts-node benchmarks/pipeline_benchmark.ts

# Run with custom configuration (edit the file)
# Modify BENCHMARK_CONFIG in pipeline_benchmark.ts
```

## Benchmark Types

### 1. Commit Indexing (`commit_indexing`)
- **Cold Cache**: First-time analysis of commits
- **Warm Cache**: Re-analysis with cached snapshots/diffs
- **Metrics**: Time per commit, cache speedup ratio

### 2. Workspace Analysis (`workspace_staged`, `workspace_unstaged`)
- **Staged Changes**: Analysis of `git diff --cached`
- **Unstaged Changes**: Analysis of working directory changes
- **Metrics**: Analysis time, content-aware caching effectiveness

### 3. Full Pipeline (`full_pipeline`)
- **End-to-End**: Complete analysis pipeline with all layers
- **Metrics**: Total time, per-commit throughput, memory usage

## Configuration

Edit `BENCHMARK_CONFIG` in `pipeline_benchmark.ts`:

```typescript
const BENCHMARK_CONFIG = {
    commitCounts: [5, 10, 20, 50], // Test different commit volumes
    iterations: 3,                   // Statistical averaging
    enableLLM: false,               // Skip expensive LLM calls
    enableEmbeddings: false         // Skip Qdrant operations
};
```

## Expected Performance Improvements

The layered pipeline should show significant improvements:

- **3-6x faster** commit indexing (content-addressed caching)
- **2-4x faster** bundle analysis (structural diff caching)
- **10-50x faster** cache hits vs cold starts
- **Stable memory usage** regardless of repository size

## Troubleshooting

### Database Issues
```bash
# Clear benchmark database
rm -f .git/commit-tracker/commit_tracker.db
```

### Memory Issues
```bash
# Run with increased memory
NODE_OPTIONS="--max-old-space-size=4096" npx ts-node benchmarks/pipeline_benchmark.ts
```

### LLM/Embedding Timeouts
- Set `enableLLM: false` and `enableEmbeddings: false` for pure performance testing
- Reduce `commitCounts` for faster iteration

## Interpreting Results

### Good Signs
- **Cache speedup > 5x**: Effective content-addressed caching
- **Memory usage < 100MB**: Efficient data structures
- **Linear scaling**: Performance degrades gracefully with commit count

### Warning Signs
- **Cache speedup < 2x**: Caching not working effectively
- **Memory usage > 500MB**: Possible memory leaks
- **Exponential scaling**: Algorithm inefficiencies

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: Run Pipeline Benchmarks
  run: |
    cd /home/ryan/plugins/git-context
    npx ts-node benchmarks/pipeline_benchmark.ts > benchmark_results.txt
    # Parse results and fail if performance regressions detected
```