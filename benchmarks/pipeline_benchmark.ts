import { ensureDatabaseInitialized, getDatabaseManager } from '../src/storage/database';
import { getRefactorPipeline } from '../src/extension';
import { GitOperations } from '../src/analysis/git';
import { getGitRoot } from '../src/utils/config';
import * as fs from 'fs';
import * as path from 'path';

// Benchmark configuration
const BENCHMARK_CONFIG = {
    commitCounts: [5, 10, 20, 50], // Test with different numbers of commits
    iterations: 3, // Run each test multiple times for averaging
    enableLLM: false, // Skip LLM calls for performance testing
    enableEmbeddings: false // Skip embeddings for performance testing
};

// Results storage
interface BenchmarkResult {
    testName: string;
    commitCount: number;
    iteration: number;
    coldCacheTime: number;
    warmCacheTime: number;
    memoryUsage: number;
    errors: string[];
}

// Performance measurement utilities
class PerformanceMonitor {
    private startTime: number = 0;
    private startMemory: number = 0;

    start() {
        this.startTime = Date.now();
        this.startMemory = process.memoryUsage().heapUsed;
    }

    end(): { time: number; memoryDelta: number } {
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;
        return {
            time: endTime - this.startTime,
            memoryDelta: endMemory - this.startMemory
        };
    }
}

// Test data preparation
async function prepareTestData(): Promise<string[]> {
    const git = new GitOperations();
    const recentCommits = git.getRecentCommits(50); // Get up to 50 recent commits
    return recentCommits.slice(0, 50).map(c => c.sha); // Return SHAs
}

// Individual benchmark functions
async function benchmarkCommitIndexing(
    pipeline: any,
    commitShas: string[],
    iteration: number
): Promise<BenchmarkResult> {
    const monitor = new PerformanceMonitor();
    const errors: string[] = [];

    console.log(`  Iteration ${iteration}: Indexing ${commitShas.length} commits...`);

    // Cold cache run
    monitor.start();
    try {
        await pipeline.indexCommits(commitShas);
    } catch (error) {
        errors.push(`Cold cache error: ${error}`);
    }
    const coldResult = monitor.end();

    // Warm cache run
    monitor.start();
    try {
        await pipeline.indexCommits(commitShas); // Should hit cache
    } catch (error) {
        errors.push(`Warm cache error: ${error}`);
    }
    const warmResult = monitor.end();

    return {
        testName: 'commit_indexing',
        commitCount: commitShas.length,
        iteration,
        coldCacheTime: coldResult.time,
        warmCacheTime: warmResult.time,
        memoryUsage: Math.max(coldResult.memoryDelta, warmResult.memoryDelta),
        errors
    };
}

async function benchmarkWorkspaceAnalysis(
    pipeline: any,
    iteration: number
): Promise<BenchmarkResult[]> {
    const monitor = new PerformanceMonitor();
    const results: BenchmarkResult[] = [];

    // Test staged analysis
    monitor.start();
    let errors: string[] = [];
    try {
        await pipeline.workspaceIndexer.analyzeWorkspace('staged');
    } catch (error) {
        errors.push(`Staged analysis error: ${error}`);
    }
    const stagedResult = monitor.end();

    results.push({
        testName: 'workspace_staged',
        commitCount: 0, // Not applicable
        iteration,
        coldCacheTime: stagedResult.time,
        warmCacheTime: 0, // Single run
        memoryUsage: stagedResult.memoryDelta,
        errors
    });

    // Test unstaged analysis
    monitor.start();
    errors = [];
    try {
        await pipeline.workspaceIndexer.analyzeWorkspace('unstaged');
    } catch (error) {
        errors.push(`Unstaged analysis error: ${error}`);
    }
    const unstagedResult = monitor.end();

    results.push({
        testName: 'workspace_unstaged',
        commitCount: 0, // Not applicable
        iteration,
        coldCacheTime: unstagedResult.time,
        warmCacheTime: 0, // Single run
        memoryUsage: unstagedResult.memoryDelta,
        errors
    });

    return results;
}

async function benchmarkFullPipeline(
    pipeline: any,
    commitShas: string[],
    iteration: number
): Promise<BenchmarkResult> {
    const monitor = new PerformanceMonitor();
    const errors: string[] = [];

    console.log(`  Iteration ${iteration}: Full pipeline with ${commitShas.length} commits...`);

    monitor.start();
    try {
        const result = await pipeline.analyzeBundle(commitShas, true); // include workspace
        if (result.errors.length > 0) {
            errors.push(`Pipeline errors: ${result.errors.map((e: any) => e.error).join(', ')}`);
        }
    } catch (error) {
        errors.push(`Full pipeline error: ${error}`);
    }
    const result = monitor.end();

    return {
        testName: 'full_pipeline',
        commitCount: commitShas.length,
        iteration,
        coldCacheTime: result.time,
        warmCacheTime: 0, // Single comprehensive run
        memoryUsage: result.memoryDelta,
        errors
    };
}

// Results analysis and reporting
function analyzeResults(results: BenchmarkResult[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('BENCHMARK RESULTS ANALYSIS');
    console.log('='.repeat(80));

    // Group results by test type
    const byTest = new Map<string, BenchmarkResult[]>();
    results.forEach(result => {
        if (!byTest.has(result.testName)) {
            byTest.set(result.testName, []);
        }
        byTest.get(result.testName)!.push(result);
    });

    // Analyze each test type
    for (const [testName, testResults] of byTest) {
        console.log(`\n📊 ${testName.toUpperCase()}`);
        console.log('-'.repeat(40));

        if (testName.includes('workspace')) {
            // Workspace tests - show average times
            const avgTime = testResults.reduce((sum, r) => sum + r.coldCacheTime, 0) / testResults.length;
            const avgMemory = testResults.reduce((sum, r) => sum + r.memoryUsage, 0) / testResults.length;

            console.log(`  Average Time: ${(avgTime / 1000).toFixed(3)}s`);
            console.log(`  Average Memory: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
        } else {
            // Commit-based tests - group by commit count
            const byCommitCount = new Map<number, BenchmarkResult[]>();
            testResults.forEach(result => {
                if (!byCommitCount.has(result.commitCount)) {
                    byCommitCount.set(result.commitCount, []);
                }
                byCommitCount.get(result.commitCount)!.push(result);
            });

            for (const [commitCount, countResults] of byCommitCount) {
                const avgColdTime = countResults.reduce((sum, r) => sum + r.coldCacheTime, 0) / countResults.length;
                const avgWarmTime = countResults.reduce((sum, r) => sum + r.warmCacheTime, 0) / countResults.length;
                const avgMemory = countResults.reduce((sum, r) => sum + r.memoryUsage, 0) / countResults.length;

                console.log(`  ${commitCount} commits:`);
                console.log(`    Cold Cache: ${(avgColdTime / 1000).toFixed(3)}s (${(avgColdTime / commitCount).toFixed(1)}ms/commit)`);
                console.log(`    Warm Cache: ${(avgWarmTime / 1000).toFixed(3)}s (${(avgWarmTime / commitCount).toFixed(1)}ms/commit)`);
                console.log(`    Speedup: ${(avgColdTime / avgWarmTime).toFixed(1)}x`);
                console.log(`    Memory: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
            }
        }

        // Report errors
        const allErrors = testResults.flatMap(r => r.errors);
        if (allErrors.length > 0) {
            console.log(`  ⚠️ Errors: ${allErrors.length}`);
            allErrors.forEach(error => console.log(`    - ${error}`));
        }
    }
}

// Main benchmark runner
async function runBenchmarks(): Promise<void> {
    console.log('🚀 PIPELINE PERFORMANCE BENCHMARKS');
    console.log('=' .repeat(80));
    console.log(`Configuration: ${BENCHMARK_CONFIG.iterations} iterations per test`);
    console.log(`LLM Enabled: ${BENCHMARK_CONFIG.enableLLM}`);
    console.log(`Embeddings Enabled: ${BENCHMARK_CONFIG.enableEmbeddings}`);
    console.log('');

    // Initialize
    console.log('📋 Initializing benchmark environment...');
    await ensureDatabaseInitialized();
    const pipeline = await getRefactorPipeline();
    const testCommitShas = await prepareTestData();

    console.log(`📊 Available test commits: ${testCommitShas.length}`);
    console.log('');

    const allResults: BenchmarkResult[] = [];

    // Run benchmarks
    for (const commitCount of BENCHMARK_CONFIG.commitCounts) {
        if (commitCount > testCommitShas.length) {
            console.log(`⚠️ Skipping ${commitCount} commits test (only ${testCommitShas.length} available)`);
            continue;
        }

        const testShas = testCommitShas.slice(0, commitCount);
        console.log(`\n🔬 Testing with ${commitCount} commits`);

        for (let i = 1; i <= BENCHMARK_CONFIG.iterations; i++) {
            // Commit indexing benchmark
            const commitResults = await benchmarkCommitIndexing(pipeline, testShas, i);
            allResults.push(commitResults);

            // Workspace analysis benchmark
            const workspaceResults = await benchmarkWorkspaceAnalysis(pipeline, i);
            allResults.push(...workspaceResults);

            // Full pipeline benchmark (only for smaller counts to avoid timeout)
            if (commitCount <= 10) {
                const fullResult = await benchmarkFullPipeline(pipeline, testShas, i);
                allResults.push(fullResult);
            }
        }
    }

    // Analyze and report results
    analyzeResults(allResults);

    console.log('\n' + '='.repeat(80));
    console.log('✅ BENCHMARKS COMPLETE');
    console.log('='.repeat(80));
}

// Export for use as module or direct execution
if (require.main === module) {
    runBenchmarks().catch(error => {
        console.error('❌ Benchmark failed:', error);
        process.exit(1);
    });
}

export { runBenchmarks, BENCHMARK_CONFIG };