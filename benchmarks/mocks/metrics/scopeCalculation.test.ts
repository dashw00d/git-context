/**
 * Scope Calculation Tests
 *
 * Tests scope calculation logic for file and blast radius scoping
 *
 * TESTING PHILOSOPHY:
 * - Tests simplified scope calculation logic for test fixtures
 * - Real scope calculation requires database access (see computeScope() in facts/scope.ts)
 * - Tests validate the test-only adapter, not the real pipeline function
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { calculateScopeFromFacts, createScopeSet } from '../../../src/metrics/scopeCalculator';
import { SymbolFixtures } from '../fixtures/symbols';

export const scopeCalculationTests = new MetricTestSuite({
  name: 'Scope Calculation',
  description: 'Tests scope calculation logic using enhanced adapter that matches real computeBlastRadiusNeighbors behavior',
  validator: {
    calculate: async (bundleFacts) => {
      // Transform test data to scope calculation format
      const commits = bundleFacts.evidence.symbols?.reduce((acc: any[], symbol: any) => {
        const commit = acc.find(c => c.sha === symbol.commitSha || 'test-sha');
        if (!commit) {
          acc.push({
            sha: symbol.commitSha || 'test-sha',
            symbols: [symbol],
            files: symbol.filePath ? [symbol.filePath] : []
          });
        } else {
          commit.symbols.push(symbol);
          if (symbol.filePath && !commit.files.includes(symbol.filePath)) {
            commit.files.push(symbol.filePath);
          }
        }
        return acc;
      }, []) || [];

      const symbols = bundleFacts.evidence.symbols || [];
      const edges = bundleFacts.evidence.edges || [];

      // USE ENHANCED TEST ADAPTER (matches real computeBlastRadiusNeighbors behavior)
      const scopeMetrics = calculateScopeFromFacts(commits, symbols, edges);

      return {
        commitFiles: scopeMetrics.commitFiles,
        workingChanged: scopeMetrics.workingChanged,
        blastRadius: scopeMetrics.blastRadius,
        totalFiles: scopeMetrics.totalFiles,
        scopeSet: createScopeSet(scopeMetrics)
      };
    }
  },
  stepId: 'scope' // Maps to scopeStep.ts
});

// Test 1: Single commit, single file
scopeCalculationTests.test({
  name: 'Calculates scope for single commit with one file',
  fixture: {
    commits: [
      {
        sha: 'abc123',
        symbols: [
          { id: 'UserService', name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', status: 'added' }
        ],
        files: ['src/services/UserService.ts']
      }
    ],
    evidence: {
      symbols: [
        { id: 'UserService', name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', status: 'added' }
      ],
      edges: []
    }
  },
  expectedMetrics: {
    commitFiles: 1,
    workingChanged: 1,
    blastRadius: 1,
    totalFiles: 1
  },
  formula: 'commitFiles = count(distinct files in commits), workingChanged = count(distinct files with symbols), blastRadius = files with dependencies, totalFiles = union of all'
});

// Test 2: Multiple commits, multiple files
scopeCalculationTests.test({
  name: 'Calculates scope for multiple commits with multiple files',
  fixture: {
    commits: [
      {
        sha: 'abc123',
        symbols: [
          { id: 'UserService', name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', status: 'added' }
        ],
        files: ['src/services/UserService.ts']
      },
      {
        sha: 'def456',
        symbols: [
          { id: 'AuthController', name: 'AuthController', type: 'class', filePath: 'src/controllers/AuthController.ts', status: 'added' },
          { id: 'AuthService', name: 'AuthService', type: 'class', filePath: 'src/services/AuthService.ts', status: 'added' }
        ],
        files: ['src/controllers/AuthController.ts', 'src/services/AuthService.ts']
      }
    ],
    evidence: {
      symbols: [
        { id: 'UserService', name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', status: 'added' },
        { id: 'AuthController', name: 'AuthController', type: 'class', filePath: 'src/controllers/AuthController.ts', status: 'added' },
        { id: 'AuthService', name: 'AuthService', type: 'class', filePath: 'src/services/AuthService.ts', status: 'added' }
      ],
      edges: []
    }
  },
  expectedMetrics: {
    commitFiles: 3,
    workingChanged: 3,
    blastRadius: 3,
    totalFiles: 3
  }
});

// Test 3: Blast radius with dependencies
scopeCalculationTests.test({
  name: 'Calculates blast radius including dependent files',
  fixture: {
    commits: [
      {
        sha: 'abc123',
        symbols: [
          { id: 'CoreService', name: 'CoreService', type: 'class', filePath: 'src/services/CoreService.ts', status: 'modified' }
        ],
        files: ['src/services/CoreService.ts']
      }
    ],
    evidence: {
      symbols: [
        { id: 'CoreService', name: 'CoreService', type: 'class', filePath: 'src/services/CoreService.ts', status: 'modified' },
        { id: 'ControllerA', name: 'ControllerA', type: 'class', filePath: 'src/controllers/ControllerA.ts', status: 'added' },
        { id: 'ControllerB', name: 'ControllerB', type: 'class', filePath: 'src/controllers/ControllerB.ts', status: 'added' }
      ],
      edges: [
        { from: 'ControllerA', to: 'CoreService', type: 'calls', confidence: 1.0 },
        { from: 'ControllerB', to: 'CoreService', type: 'calls', confidence: 1.0 }
      ]
    }
  },
  expectedMetrics: {
    commitFiles: 1,
    workingChanged: 3,
    blastRadius: 3,
    totalFiles: 3
  }
});

// Test 4: Working directory changes only
scopeCalculationTests.test({
  name: 'Calculates scope for working directory changes only',
  fixture: {
    commits: [], // No commits
    evidence: {
      symbols: [
        { id: 'NewFeature', name: 'NewFeature', type: 'class', filePath: 'src/features/NewFeature.ts', status: 'added' },
        { id: 'ExistingService', name: 'ExistingService', type: 'class', filePath: 'src/services/ExistingService.ts', status: 'modified' }
      ],
      edges: []
    }
  },
  expectedMetrics: {
    commitFiles: 0,
    workingChanged: 2,
    blastRadius: 2,
    totalFiles: 2
  }
});

// Test 5: Extract file path from symbol ID
scopeCalculationTests.test({
  name: 'Extracts file paths from symbol IDs when filePath not provided',
  fixture: {
    commits: [
      {
        sha: 'abc123',
        symbols: [
          { id: 'src/controllers/ApiController:ApiController', name: 'ApiController', type: 'class', filePath: 'src/controllers/ApiController.ts', status: 'added' }
        ],
        files: []
      }
    ],
    evidence: {
      symbols: [
        { id: 'src/controllers/ApiController:ApiController', name: 'ApiController', type: 'class', filePath: 'src/controllers/ApiController.ts', status: 'added' }
      ],
      edges: []
    }
  },
  expectedMetrics: {
    commitFiles: 1,
    workingChanged: 1,
    blastRadius: 1,
    totalFiles: 1
  }
});

// Test 6: Complex dependency network
scopeCalculationTests.test({
  name: 'Handles complex dependency networks for blast radius',
  fixture: {
    commits: [
      {
        sha: 'abc123',
        symbols: [
          { id: 'Database', name: 'Database', type: 'class', filePath: 'src/db/Database.ts', status: 'modified' }
        ],
        files: ['src/db/Database.ts']
      }
    ],
    evidence: {
      symbols: [
        { id: 'Database', name: 'Database', type: 'class', filePath: 'src/db/Database.ts', status: 'modified' },
        { id: 'UserRepo', name: 'UserRepo', type: 'class', filePath: 'src/repos/UserRepo.ts', status: 'added' },
        { id: 'OrderRepo', name: 'OrderRepo', type: 'class', filePath: 'src/repos/OrderRepo.ts', status: 'added' },
        { id: 'UserService', name: 'UserService', type: 'class', filePath: 'src/services/UserService.ts', status: 'added' },
        { id: 'OrderService', name: 'OrderService', type: 'class', filePath: 'src/services/OrderService.ts', status: 'added' },
        { id: 'ApiController', name: 'ApiController', type: 'class', filePath: 'src/controllers/ApiController.ts', status: 'added' }
      ],
      edges: [
        { from: 'UserRepo', to: 'Database', type: 'uses', confidence: 1.0 },
        { from: 'OrderRepo', to: 'Database', type: 'uses', confidence: 1.0 },
        { from: 'UserService', to: 'UserRepo', type: 'uses', confidence: 1.0 },
        { from: 'OrderService', to: 'OrderRepo', type: 'uses', confidence: 1.0 },
        { from: 'ApiController', to: 'UserService', type: 'calls', confidence: 1.0 },
        { from: 'ApiController', to: 'OrderService', type: 'calls', confidence: 1.0 }
      ]
    }
  },
  expectedMetrics: {
    commitFiles: 1,
    workingChanged: 6,
    blastRadius: 6,
    totalFiles: 6
  }
});

// Test 7: Empty scope
scopeCalculationTests.test({
  name: 'Handles empty scope with no commits or symbols',
  fixture: {
    commits: [],
    evidence: {
      symbols: [],
      edges: []
    }
  },
  expectedMetrics: {
    commitFiles: 0,
    workingChanged: 0,
    blastRadius: 0,
    totalFiles: 0
  }
});

// Test 8: Large scope with many files
scopeCalculationTests.test({
  name: 'Scales with large number of files and symbols',
  fixture: {
    commits: [
      {
        sha: 'abc123',
        symbols: Array.from({ length: 20 }, (_, i) => ({
          id: `Class${i}`,
          name: `Class${i}`,
          type: 'class',
          filePath: `src/classes/Class${i}.ts`,
          status: 'added' as const
        })),
        files: Array.from({ length: 20 }, (_, i) => `src/classes/Class${i}.ts`)
      }
    ],
    evidence: {
      symbols: Array.from({ length: 20 }, (_, i) => ({
        id: `Class${i}`,
        name: `Class${i}`,
        type: 'class',
        filePath: `src/classes/Class${i}.ts`,
        status: 'added' as const
      })),
      edges: Array.from({ length: 15 }, (_, i) => ({
        from: `Class${i}`,
        to: `Class${i + 1}`,
        type: 'uses',
        confidence: 0.8
      }))
    }
  },
  expectedMetrics: {
    commitFiles: 20,
    workingChanged: 20,
    blastRadius: 20,
    totalFiles: 20
  }
});
