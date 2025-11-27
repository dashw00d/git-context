/**
 * Pipeline Metric Test Runner
 *
 * Orchestrates granular metric testing for pipeline components
 *
 * TEST ORDER:
 * Tests are ordered to match the pipeline step execution order in refactorPipeline.ts:
 * 1. index_commits: symbolCountTests, edgeCountingTests, structuralChangeTests
 * 2. scope: scopeCalculationTests
 * 3. intended: intendedStateTests
 * 4. working: (not directly tested - depends on file system)
 * 5. drift: incompletenessTests
 * 6. legacy: legacyAuditTests
 * 7. hotspots: hotspotDetectionTests
 * 8. moved_blocks: movedBlockDetectionTests
 * 9. workspace_overlay: workspaceFactsTests
 * 10. bundle_facts: bundleFactsAssemblyTests
 * 11-13. embedding/history/llm_story: (not tested - LLM/embedding logic)
 * Cross-step: patternDriftTests, blastRadiusTests, riskDetectionTests
 *
 * TESTING PHILOSOPHY:
 * - Tests are designed to FAIL when pipeline logic has gaps
 * - DO NOT modify test expectations or fixtures to make tests pass
 * - ONLY fix the pipeline/validator logic when tests reveal limitations
 * - Failing tests are valuable feedback for tuning the analysis pipeline
 * - Add MORE test cases when current ones all pass to find new edge cases
 */

import { symbolCountTests } from './mocks/metrics/symbolCounts.test';
import { blastRadiusTests } from './mocks/metrics/blastRadius.test';
import { riskDetectionTests } from './mocks/metrics/riskDetection.test';
import { incompletenessTests } from './mocks/metrics/incompleteness.test';
import { edgeCountingTests } from './mocks/metrics/edgeCounting.test';
import { structuralChangeTests } from './mocks/metrics/structuralChange.test';
import { scopeCalculationTests } from './mocks/metrics/scopeCalculation.test';
import { intendedStateTests } from './mocks/metrics/intendedState.test';
import { workspaceFactsTests } from './mocks/metrics/workspaceFacts.test';
import { legacyAuditTests } from './mocks/metrics/legacyAudit.test';
import { hotspotDetectionTests } from './mocks/metrics/hotspotDetection.test';
import { movedBlockDetectionTests } from './mocks/metrics/movedBlockDetection.test';
import { patternDriftTests } from './mocks/metrics/patternDrift.test';
import { bundleFactsAssemblyTests } from './mocks/metrics/bundleFactsAssembly.test';
import { TestSuiteResult } from './mocks/framework/metricTestSuite';
import { TestPipelineState } from './mocks/framework/testPipelineState';

async function runAllMetricTests(useSharedState: boolean = true): Promise<void> {
  // Initialize shared state if requested
  const sharedState = useSharedState ? new TestPipelineState() : undefined;

  if (useSharedState) {
    console.log('🔗 SHARED STATE MODE: Tests will accumulate state like real pipeline');
    console.log('');
  } else {
    console.log('⚠️  INDEPENDENT MODE: Tests run without shared state (limited pipeline logic)');
    console.log('');
  }
  console.log('🧪 PIPELINE METRIC TEST RUNNER');
  console.log('='.repeat(50));
  console.log('Testing individual pipeline metrics at a granular level');
  console.log('');

  // Test suites ordered to match pipeline step execution order
  // See src/analysis/refactorPipeline.ts for pipeline step order
  const suites = [
    // Step 1: index_commits - Symbol and edge counting happens during commit indexing
    symbolCountTests,        // Tests symbol counting from CommitIndexer
    edgeCountingTests,       // Tests edge counting from CommitIndexer
    structuralChangeTests,   // Tests structural change detection from CommitIndexer

    // Step 2: scope - Scope calculation
    scopeCalculationTests,   // Tests scopeCalculator.ts (test-only adapter)

    // Step 3: intended - Intended state building
    intendedStateTests,      // Tests intendedStateAdapter.ts (test-only adapter)

    // Step 4: working - Working snapshot (depends on scope)

    // Step 5: drift - Incompleteness detection
    incompletenessTests,     // Tests detectDrift() from driftStep.ts

    // Step 6: legacy - Legacy audit
    legacyAuditTests,        // Tests auditLegacy() from legacyStep.ts

    // Step 7: hotspots - Hotspot detection
    hotspotDetectionTests,   // Tests HotspotDetector from hotspotStep.ts

    // Step 8: moved_blocks - Moved block detection
    movedBlockDetectionTests, // Tests MovedBlockDetector from movedBlockStep.ts

    // Step 9: workspace_overlay - Workspace facts
    workspaceFactsTests,     // Tests workspaceFactsAdapter.ts (test-only adapter)

    // Step 10: bundle_facts - Bundle facts assembly
    bundleFactsAssemblyTests, // Tests buildRefactorBundleFacts() with full state

    // Step 11-12: embedding, history - Not tested (LLM/embedding logic)

    // Step 13: llm_story - Not tested (LLM output generation)

    // Cross-step metrics (used in multiple steps):
    patternDriftTests,       // Uses factsAssembler pattern drift detection
    blastRadiusTests,        // Uses DependencyExtractor (used in multiple steps)
    riskDetectionTests       // Uses RiskDetector (used in multiple steps)
  ];

  const results: TestSuiteResult[] = [];

  for (const suite of suites) {
    console.log(`📊 Running: ${suite.config.name}`);
    console.log(`   ${suite.config.description}`);

    if (suite.config.useSharedState && sharedState) {
      console.log(`   🔗 Using shared state (${sharedState.getSummary()})`);
    }

    const startTime = Date.now();
    const result = await suite.run(sharedState);
    const duration = Date.now() - startTime;

    // Calculate accuracy for this phase
    const accuracy = result.totalTests > 0 
      ? ((result.passed / result.totalTests) * 100).toFixed(1)
      : '0.0';

    results.push(result);

    console.log(`   ✅ ${result.passed}/${result.totalTests} tests passed`);
    console.log(`   📈 Accuracy: ${accuracy}%`);

    if (result.failed > 0) {
      console.log(`   ❌ ${result.failed} failures:`);
      const failures = result.results.filter(r => !r.passed).slice(0, 3); // Show first 3
      failures.forEach(f => {
        console.log(`      - ${f.name}`);
        f.issues.forEach(issue => console.log(`        ${issue}`));
      });

      if (result.failed > 3) {
        console.log(`      ... and ${result.failed - 3} more`);
      }
    }

    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log('');
  }

  // Generate detailed report
  generateMetricTestReport(results, sharedState);

  // Summary with accuracy per phase
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0);
  const totalSuites = results.length;

  console.log('📈 FINAL SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total Suites: ${totalSuites}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Total Passed: ${totalPassed}`);
  console.log(`Total Failed: ${totalTests - totalPassed}`);
  console.log(`Overall Accuracy: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
  console.log('');
  console.log('📊 ACCURACY BY PHASE:');
  console.log('='.repeat(50));

  results.forEach(result => {
    const accuracy = result.totalTests > 0
      ? ((result.passed / result.totalTests) * 100).toFixed(1)
      : '0.0';
    const status = result.passed === result.totalTests ? '✅' : '⚠️';
    console.log(`${status} ${result.suiteName.padEnd(30)} ${result.passed.toString().padStart(3)}/${result.totalTests.toString().padStart(3)}  ${accuracy.padStart(5)}%`);
  });

  if (totalPassed === totalTests) {
    console.log('');
    console.log('🎉 ALL TESTS PASSED!');
    console.log('Pipeline metrics are working correctly.');
    console.log('');
    console.log('💡 NEXT STEPS:');
    console.log('   - Consider adding more challenging test cases to find edge cases');
    console.log('   - The goal is to make tests fail so we can improve the pipeline');
  } else {
    console.log('');
    console.log('⚠️  SOME TESTS FAILED');
    console.log('This is GOOD - it shows gaps in the pipeline logic.');
    console.log('');
    console.log('💡 HOW TO FIX:');
    console.log('   - DO NOT modify test expectations to make them pass');
    console.log('   - INSTEAD: Fix the pipeline logic in src/ or validators/');
    console.log('   - Review the detailed report to understand what needs fixing');
    process.exitCode = 1;
  }
}

function generateMetricTestReport(results: TestSuiteResult[], sharedState?: import('./mocks/framework/testPipelineState').TestPipelineState): void {
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.totalTests, 0);

  let report = '# Pipeline Metric Test Report\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  const overallAccuracy = totalTests > 0
    ? ((totalPassed / totalTests) * 100).toFixed(1)
    : '0.0';

  report += `**Overall Accuracy:** ${overallAccuracy}% (${totalPassed}/${totalTests} tests passed)\n\n`;

  // Accuracy by Phase table
  report += '## Accuracy by Phase\n\n';
  report += '| Phase | Tests | Passed | Failed | Accuracy | Status |\n';
  report += '|-------|-------|--------|--------|----------|--------|\n';

  for (const result of results) {
    const accuracy = result.totalTests > 0
      ? ((result.passed / result.totalTests) * 100).toFixed(1)
      : '0.0';
    const status = result.passed === result.totalTests ? '✅' : '⚠️';
    report += `| ${result.suiteName} | ${result.totalTests} | ${result.passed} | ${result.failed} | ${accuracy}% | ${status} |\n`;
  }

  report += '\n';

  // Suite summary table (detailed)
  report += '## Detailed Suite Summary\n\n';
  report += '| Suite | Tests | Passed | Failed | Accuracy |\n';
  report += '|-------|-------|--------|--------|----------|\n';

  for (const result of results) {
    const accuracy = result.totalTests > 0
      ? ((result.passed / result.totalTests) * 100).toFixed(1)
      : '0.0';
    report += `| ${result.suiteName} | ${result.totalTests} | ${result.passed} | ${result.failed} | ${accuracy}% |\n`;
  }

  report += '\n';

  // Detailed results
  for (const result of results) {
    report += `## ${result.suiteName}\n\n`;
    report += `${result.description}\n\n`;

    if (result.failed === 0) {
      report += '✅ All tests passed!\n\n';
    } else {
      report += `⚠️ ${result.failed} test(s) failed:\n\n`;

      const failures = result.results.filter(r => !r.passed);
      for (const failure of failures) {
        report += `### ${failure.name}\n\n`;
        report += '**Issues:**\n';
        failure.issues.forEach(issue => {
          report += `- ${issue}\n`;
        });

        if (failure.expected && failure.actual) {
          report += '\n**Expected:**\n```json\n';
          report += JSON.stringify(failure.expected, null, 2);
          report += '\n```\n\n**Actual:**\n```json\n';
          report += JSON.stringify(failure.actual, null, 2);
          report += '\n```\n';
        }

        if (failure.formula) {
          report += `\n**Formula:** \`${failure.formula}\`\n`;
        }

        report += `\n**Duration:** ${failure.duration}ms\n\n`;
      }
    }
  }

  // Save report
  const fs = require('fs');
  const path = require('path');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportPath = path.join(process.cwd(), `metric_test_report_${timestamp}.md`);

  fs.writeFileSync(reportPath, report);
  console.log(`📄 Detailed report saved to: ${reportPath}`);

  // Show final state summary if using shared state
  if (sharedState) {
    console.log('');
    console.log('🔗 FINAL SHARED STATE SUMMARY:');
    console.log('='.repeat(50));
    console.log(sharedState.getSummary());
  }
}

// CLI interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Pipeline Metric Test Runner

Runs granular tests for individual pipeline metrics.

USAGE:
  npx ts-node benchmarks/pipeline_metric_test.ts [options]

OPTIONS:
  --help, -h          Show this help message
  --verbose, -v       Show detailed output for each test
  --suite <name>      Run only specific test suite
  --report-only       Generate report from previous run (if available)
  --no-shared-state   Disable shared state mode (tests run independently for faster execution)

AVAILABLE SUITES:
  - Symbol Counts        (CommitIndexer symbol counting)
  - Edge Counting        (CommitIndexer edge counting)
  - Structural Change    (CommitIndexer structural change)
  - Scope Calculation    (scopeStep scope calculation)
  - Intended State       (intendedStep intended state)
  - Workspace Facts      (workspaceStep workspace facts)
  - Legacy Audit         (legacyStep legacy code audit)
  - Hotspot Detection    (hotspotStep hotspot analysis)
  - Moved Block Detection (movedBlockStep code movement)
  - Pattern Drift        (pattern drift detection)
  - Bundle Facts Assembly (bundleFactsStep full assembly)
  - Blast Radius         (DependencyExtractor impact analysis)
  - Risk Detection       (RiskDetector risk patterns)
  - Incompleteness       (driftStep missing/zombie detection)

EXAMPLES:
  npx ts-node benchmarks/pipeline_metric_test.ts                    # Run all tests (independent mode)
  npx ts-node benchmarks/pipeline_metric_test.ts --shared-state     # Run with shared state
  npx ts-node benchmarks/pipeline_metric_test.ts --suite="Blast Radius"  # Run specific suite
  npx ts-node benchmarks/pipeline_metric_test.ts --verbose          # Verbose output
`);
  process.exit(0);
}

// Check for suite filter
const suiteArg = args.find((arg, i) => arg === '--suite' && args[i + 1]);
if (suiteArg) {
  const suiteName = args[args.indexOf(suiteArg) + 1];
  console.log(`Running only suite: ${suiteName}`);
  // TODO: Implement suite filtering
}

// Check for shared state mode (default enabled, can be disabled with --no-shared-state)
const useSharedState = !args.includes('--no-shared-state');

runAllMetricTests(useSharedState).catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
