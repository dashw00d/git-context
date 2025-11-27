/**
 * Intended State Tests
 *
 * Tests intended state building logic for refactoring analysis
 *
 * TESTING PHILOSOPHY:
 * - Tests simplified intended state calculation logic for test fixtures
 * - Real intended state building requires database access (see buildIntendedMap() in facts/intendedMap.ts)
 * - Tests validate the test-only adapter, not the real pipeline function
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { buildIntendedStateFromCommits, createIntendedMap } from '../../../src/metrics/intendedStateAdapter';
import { SymbolFixtures } from '../fixtures/symbols';

export const intendedStateTests = new MetricTestSuite({
  name: 'Intended State',
  description: 'Tests simplified intended state building for refactoring analysis',
  validator: {
    calculate: async (bundleFacts) => {
      // Transform test data to intended state format
      const commits = bundleFacts.evidence.symbols?.reduce((acc: Array<{ sha: string; symbols: Array<{ id: string; name: string; status: string; changeType?: string; filePath: string }>; renames: Array<{ oldId: string; newId: string; confidence: number }> }>, symbol: { id: string; name?: string; status?: string; changeType?: string; filePath: string; commitSha?: string; renames?: Array<{ oldId: string; newId: string; confidence: number }> }): Array<{ sha: string; symbols: Array<{ id: string; name: string; status: string; changeType?: string; filePath: string }>; renames: Array<{ oldId: string; newId: string; confidence: number }> }> => {
        const commit = acc.find(c => c.sha === (symbol.commitSha || 'test-sha'));
        if (!commit) {
          acc.push({
            sha: symbol.commitSha || 'test-sha',
            symbols: [{
              id: symbol.id,
              name: symbol.name || symbol.id.split('.').pop() || symbol.id,
              status: symbol.status || 'added',
              changeType: symbol.changeType,
              filePath: symbol.filePath
            }],
            renames: symbol.renames || []
          });
        } else {
          commit.symbols.push({
            id: symbol.id,
            name: symbol.name || symbol.id.split('.').pop() || symbol.id,
            status: symbol.status || 'added',
            changeType: symbol.changeType,
            filePath: symbol.filePath
          });
        }
        return acc;
      }, []) || [];

      // USE TEST-ONLY ADAPTER (simplified calculation)
      const intendedMetrics = buildIntendedStateFromCommits(commits);

      return {
        present: intendedMetrics.present,
        absent: intendedMetrics.absent,
        renamed: intendedMetrics.renamed,
        totalSymbols: intendedMetrics.totalSymbols,
        intendedMap: createIntendedMap(commits.flatMap((c: { sha: string; symbols: Array<{ id: string; name: string; status: string; changeType?: string; filePath: string; commitSha?: string }>; renames: Array<{ oldId: string; newId: string; confidence: number }> }) => c.symbols).map((s: { id: string; name: string; status: string; changeType?: string; filePath: string; commitSha?: string }) => ({
          id: s.id,
          expect: s.status === 'removed' ? 'absent' : 'present',
          lastSha: s.commitSha || 'test-sha'
        })))
      };
    }
  },
  stepId: 'intended' // Maps to intendedStep.ts
});

// Test 1: Single commit with additions
intendedStateTests.test({
  name: 'Builds intended state for single commit with symbol additions',
  fixture: {
    evidence: {
      symbols: [
        { id: 'UserService', name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', status: 'added' },
        { id: 'AuthController', name: 'AuthController', type: 'class', filePath: 'src/controllers/AuthController.ts', status: 'added' as const }
      ]
    }
  },
  expectedMetrics: {
    present: 2,
    absent: 0,
    renamed: 0,
    totalSymbols: 2
  },
  formula: 'present = count(symbols with status added/modified), absent = count(symbols with status removed), renamed = count(renamed symbols), totalSymbols = present + absent'
});

// Test 2: Multiple commits with additions and removals
intendedStateTests.test({
  name: 'Builds intended state across multiple commits with additions and removals',
  fixture: {
    evidence: {
      symbols: [
        { id: 'UserService', name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', status: 'added' },
        { id: 'AuthController', name: 'AuthController', type: 'class', filePath: 'src/controllers/AuthController.ts', status: 'added' },
        { id: 'OldService', name: 'OldService', type: 'class', filePath: 'src/services/OldService.ts', status: 'removed' }
      ]
    }
  },
  expectedMetrics: {
    present: 2,
    absent: 1,
    renamed: 0,
    totalSymbols: 3
  }
});

// Test 3: Symbol renames
intendedStateTests.test({
  name: 'Handles symbol renames correctly',
  fixture: {
    evidence: {
      symbols: [
        { id: 'NewUserService', name: 'NewUserService', type: 'class', filePath: 'src/services/NewUserService.ts', status: 'added' as const },
        { ...{ id: 'OldUserService', name: 'OldUserService', type: 'class', filePath: 'src/services/OldUserService.ts', status: 'removed' as const }, renames: [{ oldId: 'OldUserService', newId: 'NewUserService', confidence: 1.0 }] }
      ]
    }
  },
  expectedMetrics: {
    present: 1,
    absent: 1,
    renamed: 1,
    totalSymbols: 2
  }
});

// Test 4: Mixed additions, modifications, and removals
intendedStateTests.test({
  name: 'Handles mixed symbol changes (add/modify/remove)',
  fixture: {
    evidence: {
      symbols: [
        { id: 'NewFeature', name: 'NewFeature', type: 'class', filePath: 'src/features/NewFeature.ts', status: 'added' as const },
        { id: 'ExistingService', name: 'ExistingService', type: 'class', filePath: 'src/services/ExistingService.ts', status: 'modified' as const },
        { id: 'DeprecatedUtil', name: 'DeprecatedUtil', type: 'function', filePath: 'src/utils/deprecated.ts', status: 'removed' as const }
      ]
    }
  },
  expectedMetrics: {
    present: 2,
    absent: 1,
    renamed: 0,
    totalSymbols: 3
  }
});

// Test 5: Multiple commits in chronological order
intendedStateTests.test({
  name: 'Processes multiple commits in chronological order',
  fixture: {
    evidence: {
      symbols: [
        { ...{ id: 'BaseService', name: 'BaseService', type: 'class', filePath: 'src/services/BaseService.ts', status: 'added' as const }, commitSha: 'commit1' },
        { ...{ id: 'ExtendedService', name: 'ExtendedService', type: 'class', filePath: 'src/services/ExtendedService.ts', status: 'added' as const }, commitSha: 'commit2' },
        { ...{ id: 'BaseService', name: 'BaseService', type: 'class', filePath: 'src/services/BaseService.ts', status: 'modified' as const }, commitSha: 'commit3' },
        { ...{ id: 'ExtendedService', name: 'ExtendedService', type: 'class', filePath: 'src/services/ExtendedService.ts', status: 'removed' as const }, commitSha: 'commit4' }
      ]
    }
  },
  expectedMetrics: {
    present: 1,
    absent: 1,
    renamed: 0,
    totalSymbols: 2
  }
});

// Test 6: Empty intended state
intendedStateTests.test({
  name: 'Handles empty intended state with no symbols',
  fixture: {
    evidence: {
      symbols: []
    }
  },
  expectedMetrics: {
    present: 0,
    absent: 0,
    renamed: 0,
    totalSymbols: 0
  }
});

// Test 7: Complex rename scenario
intendedStateTests.test({
  name: 'Handles complex rename scenario with multiple renames',
  fixture: {
    evidence: {
      symbols: [
        { id: 'UserManager', name: 'UserManager', type: 'class', filePath: 'src/managers/UserManager.ts', status: 'added' as const },
        { id: 'OrderProcessor', name: 'OrderProcessor', type: 'class', filePath: 'src/processors/OrderProcessor.ts', status: 'added' as const },
        { ...{ id: 'UserHandler', name: 'UserHandler', type: 'class', filePath: 'src/handlers/UserHandler.ts', status: 'removed' as const }, renames: [{ oldId: 'UserHandler', newId: 'UserManager', confidence: 1.0 }] },
        { ...{ id: 'OrderHandler', name: 'OrderHandler', type: 'class', filePath: 'src/handlers/OrderHandler.ts', status: 'removed' as const }, renames: [{ oldId: 'OrderHandler', newId: 'OrderProcessor', confidence: 1.0 }] }
      ]
    }
  },
  expectedMetrics: {
    present: 2,
    absent: 2,
    renamed: 2,
    totalSymbols: 4
  }
});

// Test 8: Large intended state with many symbols
intendedStateTests.test({
  name: 'Scales with large number of symbols across multiple commits',
  fixture: {
    evidence: {
      symbols: [
        // Commit 1: Add 10 services
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `Service${i}`,
          name: `Service${i}`,
          type: 'class' as const,
          filePath: `src/services/Service${i}.ts`,
          status: 'added' as const,
          commitSha: 'commit1'
        })),
        // Commit 2: Add 5 controllers
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `Controller${i}`,
          name: `Controller${i}`,
          type: 'class' as const,
          filePath: `src/controllers/Controller${i}.ts`,
          status: 'added' as const,
          commitSha: 'commit2'
        })),
        // Commit 3: Remove 3 services
        ...Array.from({ length: 3 }, (_, i) => ({
          id: `Service${i}`,
          name: `Service${i}`,
          type: 'class' as const,
          filePath: `src/services/Service${i}.ts`,
          status: 'removed' as const,
          commitSha: 'commit3'
        })),
        // Commit 4: Modify 2 controllers
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `Controller${i}`,
          name: `Controller${i}`,
          type: 'class' as const,
          filePath: `src/controllers/Controller${i}.ts`,
          status: 'modified' as const,
          commitSha: 'commit4'
        }))
      ]
    }
  },
  expectedMetrics: {
    present: 10,
    absent: 3,
    renamed: 0,
    totalSymbols: 13
  }
});
