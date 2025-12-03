import * as fs from 'fs';
import * as path from 'path';
import { GitOperations } from '../../src/analysis/git';
import { getRefactorPipeline } from '../../src/extension';
import { ensureDatabaseInitialized } from '../../src/storage/database';
import { getGitRoot } from '../../src/utils/config';

const BENCHMARK_CONFIG = {
  commitCounts: [5, 10, 20, 50],
  iterations: 3,
  enableLLM: false,
  enableEmbeddings: false,
};

interface BenchmarkResult {
  testName: string;
  commitCount: number;
  iteration: number;
  durationMs: number;
  memoryUsageMB: number;
  dbSizeMB: number;
}

const results: BenchmarkResult[] = [];

async function runBenchmark() {
  console.log('🚀 Starting Pipeline Performance Benchmark');
  console.log('========================================');

  const gitRoot = getGitRoot();
  if (!gitRoot) {
    console.error('❌ No git root found. Please run from within a git repository.');
    process.exit(1);
  }
  console.log(`📂 Git Root: ${gitRoot}`);

  await ensureDatabaseInitialized(path.join(gitRoot, '.git-context'));

  for (const count of BENCHMARK_CONFIG.commitCounts) {
    console.log(`\n📊 Testing with ${count} commits...`);

    for (let i = 0; i < BENCHMARK_CONFIG.iterations; i++) {
      process.stdout.write(`   Iteration ${i + 1}/${BENCHMARK_CONFIG.iterations}: `);

      const startMemory = process.memoryUsage().heapUsed;
      const startTime = performance.now();

      try {
        const pipeline = getRefactorPipeline();

        // HACK: For this benchmark, we'll instantiate the components directly to have more control

        const gitOps = new GitOperations();
        const commits = await gitOps.getRecentCommits(count);

        const history = await gitOps.getRecentCommits(count);

        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        const duration = endTime - startTime;
        const memoryDiff = (endMemory - startMemory) / 1024 / 1024;

        const dbPath = path.join(gitRoot, '.git-context', 'db.sqlite');
        const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size / 1024 / 1024 : 0;

        console.log(`✅ ${duration.toFixed(2)}ms, ${memoryDiff.toFixed(2)}MB RAM`);

        results.push({
          testName: 'Git+Parse',
          commitCount: count,
          iteration: i + 1,
          durationMs: duration,
          memoryUsageMB: memoryDiff,
          dbSizeMB: dbSize,
        });
      } catch (error) {
        console.log(`❌ Failed: ${error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  printSummary();
}

function printSummary() {
  console.log('\n📈 Benchmark Summary');
  console.log('===================');
  console.log('Commits | Avg Duration (ms) | Avg Memory (MB) | Avg DB Size (MB)');
  console.log('--------|-------------------|-----------------|------------------');

  for (const count of BENCHMARK_CONFIG.commitCounts) {
    const relevantResults = results.filter(r => r.commitCount === count);
    if (relevantResults.length === 0) continue;

    const avgDuration =
      relevantResults.reduce((sum, r) => sum + r.durationMs, 0) / relevantResults.length;
    const avgMemory =
      relevantResults.reduce((sum, r) => sum + r.memoryUsageMB, 0) / relevantResults.length;
    const avgDbSize =
      relevantResults.reduce((sum, r) => sum + r.dbSizeMB, 0) / relevantResults.length;

    console.log(
      `${count.toString().padEnd(7)} | ${avgDuration.toFixed(2).padEnd(17)} | ${avgMemory.toFixed(2).padEnd(15)} | ${avgDbSize.toFixed(2)}`
    );
  }

  const reportPath = path.join(__dirname, 'benchmark_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Detailed results saved to ${reportPath}`);
}

runBenchmark().catch(console.error);
