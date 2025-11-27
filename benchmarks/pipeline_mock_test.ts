/**
 * Mock Data Pipeline Test for LLM Insight Tuning
 *
 * Runs LLM analysis on synthetic test data to validate and tune analysis quality
 */

import { MockScenario, MockDataFactory } from './mocks/dataFactory';
import { allScenarios } from './mocks/scenarios';
import { CommitFacts } from '../src/analysis/commitIndexer';
import { WorkspaceFacts } from '../src/analysis/workspaceIndexer';
import { RefactorBundleFacts } from '../src/facts/types';
import { LlmAnalyst } from '../src/analysis/llmAnalyst/runner';
import { ensureDatabaseInitialized } from '../src/storage/database';
import { validateInsights } from './mocks/validator';
import { saveReport, TestResult } from './mocks/reporter';

/**
 * Convert mock commit data to CommitFacts format expected by the pipeline
 */
function mockToCommitFacts(scenario: MockScenario): CommitFacts[] {
  return scenario.commits.map(commit => ({
    sha: commit.sha,
    symbolsAdded: commit.symbols.filter(s => s.status === 'added').length,
    symbolsModified: commit.symbols.filter(s => s.status === 'modified').length,
    symbolsRemoved: commit.symbols.filter(s => s.status === 'removed').length,
    edgesAdded: commit.edges.length, // Simplified - all edges are "added" in mock
    edgesRemoved: 0, // Mock scenarios don't have edge removals
    risks: commit.risks,
    structuralChangeScore: commit.blastRadius / 10, // Convert blast radius to structural change score
    filesChanged: commit.files.length,
    blastRadius: commit.blastRadius,
    hotspots: [] // Mock scenarios don't specify hotspots
  }));
}

/**
 * Convert mock workspace data to WorkspaceFacts format expected by the pipeline
 */
function mockToWorkspaceFacts(scenario: MockScenario): WorkspaceFacts | null {
  if (!scenario.workspace) {
    return null;
  }

  return {
    workspaceHash: `mock-${scenario.name.toLowerCase().replace(/\s+/g, '-')}`,
    headSha: scenario.commits.length > 0 ? scenario.commits[scenario.commits.length - 1].sha : 'mock-head',
    symbolsAdded: scenario.workspace.symbols.filter(s => s.status === 'added').length,
    symbolsModified: scenario.workspace.symbols.filter(s => s.status === 'modified').length,
    symbolsRemoved: scenario.workspace.symbols.filter(s => s.status === 'removed').length,
    edgesAdded: scenario.workspace.edges.length,
    edgesRemoved: 0,
    risks: [], // Mock workspace doesn't have specific risks
    filesChanged: scenario.workspace.files.length,
    structuralChangeScore: scenario.workspace.blastRadius / 10,
    blastRadius: scenario.workspace.blastRadius
  };
}

/**
 * Create minimal bundle facts with mock evidence for testing
 */
function createMockBundleFacts(scenario: MockScenario): RefactorBundleFacts {
  const commitFacts = mockToCommitFacts(scenario);
  const workspaceFacts = mockToWorkspaceFacts(scenario);

  let totalSymbols = commitFacts.reduce((sum, c) => sum + c.symbolsAdded + c.symbolsModified + c.symbolsRemoved, 0);
  const totalEdges = commitFacts.reduce((sum, c) => sum + c.edgesAdded + c.edgesRemoved, 0);
  let totalFiles = commitFacts.reduce((sum, c) => sum + c.filesChanged, 0);
  const allRisks = Array.from(new Set(commitFacts.flatMap(c => c.risks)));
  const maxStructuralChange = Math.max(...commitFacts.map(c => c.structuralChangeScore), 0);

  // Add workspace facts if available
  if (workspaceFacts) {
    totalSymbols += workspaceFacts.symbolsAdded + workspaceFacts.symbolsModified + workspaceFacts.symbolsRemoved;
    totalFiles += workspaceFacts.filesChanged;
    allRisks.push(...workspaceFacts.risks);
  }

  const oldestSha = commitFacts.length > 0 ? commitFacts[0].sha : 'unknown';
  const newestSha = commitFacts.length > 0 ? commitFacts[commitFacts.length - 1].sha : 'unknown';

  // Create evidence map with mock data
  const evidence: Record<string, any> = {
    'scope.files': scenario.workspace?.files || scenario.commits.flatMap(c => c.files.map(f => f.path)),
    risks: allRisks,
    structuralChangeScore: maxStructuralChange
  };

  // Add specific evidence for the scenario expectations
  if (scenario.expectedInsights.shouldDetect.incompleteness) {
    // For missing dependencies scenario, add evidence of missing symbols
    if (scenario.name === 'Missing Dependencies') {
      evidence['findings.incompleteness.missing'] = [
        'StripeService.charge',
        'EmailService.sendReceipt',
        'PaymentValidator.validate'
      ];
    }
  }

  if (scenario.expectedInsights.shouldDetect.legacyAudit) {
    // For incomplete refactor scenario, add evidence of zombie symbols
    if (scenario.name === 'Incomplete Refactor') {
      evidence['findings.incompleteness.zombies'] = [
        'LegacyAuth.login',
        'LegacyAuth.logout'
      ];
    }
  }

  return {
    version: '2.0',
    generated_at: new Date().toISOString(),
    bundle: {
      oldestSha,
      newestSha,
      shas: commitFacts.map(c => c.sha)
    },
    scope: {
      files: totalFiles,
      blastRadius: maxStructuralChange * 10
    },
    intended: {
      present: totalSymbols,
      absent: 0,
      renamed: 0
    },
    working: {
      symbols: totalSymbols,
      edges: totalEdges
    },
    findings: {
      incompleteness: {
        missing: scenario.expectedInsights.shouldDetect.incompleteness?.missing || 0,
        zombies: scenario.expectedInsights.shouldDetect.incompleteness?.zombies || 0,
        divergent: 0
      },
      patternDrift: {
        mixedTargets: scenario.expectedInsights.shouldDetect.patternDrift?.mixedTargets || 0,
        oldNamespaces: 0
      },
      legacyAudit: {
        dead: scenario.expectedInsights.shouldDetect.legacyAudit?.dead || 0,
        legacyUsed: 0,
        replacedLeftovers: []
      }
    },
    evidence
  };
}

/**
 * Run mock pipeline test
 */
async function runMockPipeline(scenarios: MockScenario[] = allScenarios) {
  console.log('🧪 MOCK PIPELINE TEST RUNNER');
  console.log('='.repeat(50));

  // Initialize minimal components
  console.log('\n🏗️ Initializing minimal components...');
  await ensureDatabaseInitialized();

  const llmAnalyst = new LlmAnalyst();
  console.log('✅ Components initialized');

  const results: TestResult[] = [];

  for (const scenario of scenarios) {
    console.log(`\n🧪 Testing scenario: ${scenario.name}`);
    console.log(`   ${scenario.description}`);

    const startTime = Date.now();

    try {
      // Convert mock data to pipeline format
      const bundleFacts = createMockBundleFacts(scenario);

      console.log(`   📊 Bundle facts: ${bundleFacts.working.symbols} symbols, ${bundleFacts.working.edges} edges`);

      // Run LLM analysis
      console.log('   🤖 Running LLM analysis...');
      const llmAnalysis = await llmAnalyst.analyze(bundleFacts, {});
      const duration = Date.now() - startTime;

      console.log(`   📝 Analysis summary: ${llmAnalysis.summary.substring(0, 100)}...`);

      // Validate outputs against expectations
      const validation = validateInsights(llmAnalysis, scenario.expectedInsights);

      const testResult: TestResult = {
        scenario: scenario.name,
        passed: validation.passed,
        validation,
        analysis: llmAnalysis,
        bundleFacts,
        duration
      };

      results.push(testResult);

      if (validation.passed) {
        console.log('   ✅ PASS');
      } else {
        console.log('   ❌ FAIL');
        validation.issues.forEach((issue: string) => {
          console.log(`      - ${issue}`);
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`   💥 Failed: ${error}`);

      const testResult: TestResult = {
        scenario: scenario.name,
        passed: false,
        validation: {
          passed: false,
          issues: [`Analysis failed: ${error}`],
          metrics: {
            healthScore: 0,
            confidenceAvg: 0,
            claimsFound: [],
            claimsMissing: [],
            claimsUnexpected: []
          }
        },
        analysis: null,
        bundleFacts: null,
        duration
      };

      results.push(testResult);
    }
  }

  // Generate comparison report
  const reportPath = saveReport(results);
  console.log(`\n📊 Detailed report saved to ${reportPath}`);

  // Print summary to console
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n📈 Summary: ${passed}/${total} tests passed`);
  console.log('\n🎉 Mock pipeline test completed!');

  return results;
}


// CLI interface
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Mock Pipeline Test Runner

Usage:
  npx ts-node benchmarks/pipeline_mock_test.ts [options]

Options:
  --scenario <name>    Run specific scenario
  --all                Run all scenarios (default)
  --help               Show this help

Available scenarios:
${allScenarios.map(s => `  - ${s.name}`).join('\n')}
`);
  process.exit(0);
}

const scenarioArg = args.find((arg, i) => arg === '--scenario' && args[i + 1]);
if (scenarioArg) {
  const scenarioName = args[args.indexOf(scenarioArg) + 1];
  const scenario = allScenarios.find(s => s.name.toLowerCase() === scenarioName.toLowerCase());
  if (scenario) {
    runMockPipeline([scenario]);
  } else {
    console.error(`Unknown scenario: ${scenarioName}`);
    console.log('Available scenarios:', allScenarios.map(s => s.name));
    process.exit(1);
  }
} else {
  runMockPipeline();
}
