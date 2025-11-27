/**
 * Core Framework for Metric-Based Testing
 *
 * Provides a structured way to test individual pipeline metrics with
 * reusable fixtures, validators, and reporting.
 *
 * TESTING PHILOSOPHY:
 * - Tests are designed to FAIL when pipeline logic has gaps or issues
 * - DO NOT modify test expectations or fixtures to make tests pass
 * - ONLY fix the pipeline/validator logic when tests reveal limitations
 * - Failing tests are valuable feedback for tuning the analysis pipeline
 * - Add MORE test cases when current ones all pass to find new edge cases
 */

import { RefactorBundleFacts } from '../../../src/facts/types';

export interface MetricTest {
  name: string;
  fixture: any;
  expectedMetrics: Record<string, any>;
  expectedIssues?: string[];
  formula?: string;  // Documentation of calculation
  tolerance?: number; // For floating-point comparisons
}

export interface TestResult {
  name: string;
  passed: boolean;
  issues: string[];
  duration: number;
  formula?: string;
  expected?: Record<string, any>;
  actual?: Record<string, any>;
}

export interface TestSuiteResult {
  suiteName: string;
  description: string;
  totalTests: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

export interface MetricValidator {
  calculate(bundleFacts: RefactorBundleFacts): Promise<Record<string, any>>;
}

export class MetricTestSuite {
  private tests: MetricTest[] = [];

  constructor(
    public config: {
      name: string;
      description: string;
      validator: MetricValidator;
    }
  ) {}

  test(testCase: MetricTest): void {
    this.tests.push(testCase);
  }

  async run(): Promise<TestSuiteResult> {
    const results: TestResult[] = [];

    for (const test of this.tests) {
      const startTime = Date.now();

      try {
        // Convert fixture to pipeline format
        const bundleFacts = this.fixtureToBundle(test.fixture);

        // Run the specific metric calculation
        const actualMetrics = await this.config.validator.calculate(bundleFacts);

        // Compare with expectations
        const comparison = this.compareMetrics(
          test.expectedMetrics,
          actualMetrics,
          test.tolerance
        );

        results.push({
          name: test.name,
          passed: comparison.passed,
          issues: comparison.issues,
          duration: Date.now() - startTime,
          formula: test.formula,
          expected: test.expectedMetrics,
          actual: actualMetrics
        });

      } catch (error) {
        results.push({
          name: test.name,
          passed: false,
          issues: [`Test failed: ${error}`],
          duration: Date.now() - startTime
        });
      }
    }

    return {
      suiteName: this.config.name,
      description: this.config.description,
      totalTests: this.tests.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results
    };
  }

  private fixtureToBundle(fixture: any): RefactorBundleFacts {
    // Convert test fixture to RefactorBundleFacts format
    // This is a simplified conversion - in practice, this might delegate
    // to specific fixture converters

    const commits = fixture.commits || [];
    const workspace = fixture.workspace;

    // Collect all symbols from commits
    const allSymbols: any[] = [];
    const allEdges: any[] = [];

    for (const commit of commits) {
      if (commit.symbols) {
        allSymbols.push(...commit.symbols);
      }
      if (commit.edges) {
        allEdges.push(...commit.edges);
      }
    }

    // Add workspace symbols if present
    if (workspace?.symbols) {
      allSymbols.push(...workspace.symbols);
    }
    if (workspace?.edges) {
      allEdges.push(...workspace.edges);
    }

    // Count symbol statuses
    const symbolsAdded = allSymbols.filter((s: any) => s.status === 'added').length;
    const symbolsModified = allSymbols.filter((s: any) => s.status === 'modified').length;
    const symbolsRemoved = allSymbols.filter((s: any) => s.status === 'removed').length;

    return {
      version: '2.0',
      generated_at: new Date().toISOString(),
      bundle: {
        oldestSha: commits[0]?.sha || 'test-sha',
        newestSha: commits[commits.length - 1]?.sha || 'test-sha',
        shas: commits.map((c: any) => c.sha)
      },
      scope: {
        files: commits.reduce((sum: number, c: any) => sum + (c.files?.length || 0), 0),
        blastRadius: allSymbols.length * 2 // Simplified calculation
      },
      intended: {
        present: allSymbols.length,
        absent: 0,
        renamed: 0
      },
      working: {
        symbols: allSymbols.length,
        edges: allEdges.length
      },
      findings: {
        incompleteness: {
          missing: fixture.expectedMissing || 0,
          zombies: fixture.expectedZombies || 0,
          divergent: 0
        },
        patternDrift: {
          mixedTargets: fixture.mixedTargets || 0,
          oldNamespaces: 0
        },
        legacyAudit: {
          dead: fixture.deadSymbols || 0,
          legacyUsed: 0,
          replacedLeftovers: []
        }
      },
      evidence: {
        // Merge fixture.evidence with collected symbols/edges
        // Priority: explicit fixture.evidence overrides collected data
        symbols: fixture.evidence?.symbols || allSymbols,
        edges: fixture.evidence?.edges || allEdges,
        ...fixture.evidence
      }
    };
  }

  private compareMetrics(
    expected: Record<string, any>,
    actual: Record<string, any>,
    tolerance = 0.001
  ): { passed: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const [key, expectedValue] of Object.entries(expected)) {
      const actualValue = actual[key];

      if (actualValue === undefined) {
        issues.push(`Missing metric: ${key}`);
        continue;
      }

      if (typeof expectedValue === 'number' && typeof actualValue === 'number') {
        if (Math.abs(expectedValue - actualValue) > tolerance) {
          issues.push(
            `${key}: expected ${expectedValue}, got ${actualValue} ` +
            `(diff: ${Math.abs(expectedValue - actualValue)})`
          );
        }
      } else if (Array.isArray(expectedValue)) {
        if (!this.arraysEqual(expectedValue, actualValue)) {
          issues.push(
            `${key}: expected [${expectedValue}], got [${actualValue}]`
          );
        }
      } else if (typeof expectedValue === 'object' && expectedValue !== null) {
        // Handle nested objects with recursive comparison
        if (typeof actualValue !== 'object' || actualValue === null) {
          issues.push(`${key}: expected object, got ${typeof actualValue}`);
        } else {
          // Recursively compare nested objects
          const nested = this.compareMetrics(expectedValue, actualValue, tolerance);
          if (!nested.passed) {
            nested.issues.forEach(issue => issues.push(`${key}.${issue}`));
          }
        }
      } else if (expectedValue !== actualValue) {
        issues.push(`${key}: expected ${expectedValue}, got ${actualValue}`);
      }
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  private arraysEqual(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  }
}
