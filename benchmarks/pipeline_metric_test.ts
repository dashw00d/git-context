/**
 * Pipeline Metric Test Runner
 *
 * Orchestrates granular metric testing for pipeline components
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
import { TestSuiteResult } from './mocks/framework/metricTestSuite';

async function runAllMetricTests(): Promise<void> {
  console.log('🧪 PIPELINE METRIC TEST RUNNER');
  console.log('='.repeat(50));
  console.log('Testing individual pipeline metrics at a granular level');
  console.log('');

  const suites = [
    symbolCountTests,
    blastRadiusTests,
    riskDetectionTests,
    incompletenessTests,
    edgeCountingTests,
    structuralChangeTests
  ];

  const results: TestSuiteResult[] = [];

  for (const suite of suites) {
    console.log(`📊 Running: ${suite.config.name}`);
    console.log(`   ${suite.config.description}`);

    const startTime = Date.now();
    const result = await suite.run();
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
  generateMetricTestReport(results);

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

function generateMetricTestReport(results: TestSuiteResult[]): void {
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

AVAILABLE SUITES:
  - Symbol Counts      (symbol counting logic)
  - Blast Radius       (dependency impact calculation)
  - Risk Detection     (risk pattern detection)
  - Incompleteness     (missing/zombie code detection)

EXAMPLES:
  npx ts-node benchmarks/pipeline_metric_test.ts                    # Run all tests
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

runAllMetricTests().catch(error => {
  console.error('💥 Test runner failed:', error);
  process.exit(1);
});
