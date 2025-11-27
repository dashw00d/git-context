/**
 * Symbol Count Tests
 *
 * Tests symbol counting logic (added/modified/removed)
 *
 * TESTING PHILOSOPHY:
 * - DO NOT modify test expectations to make tests pass
 * - If a test fails, fix the pipeline logic in src/analysis/commitIndexer.ts or src/metrics/symbolCounter.ts
 * - Uses extracted symbolCounter which mirrors the real logic in commitIndexer.ts
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { countSymbols } from '../../../src/metrics/symbolCounter';
import { SymbolFixtures } from '../fixtures/symbols';

export const symbolCountTests = new MetricTestSuite({
  name: 'Symbol Counts',
  description: 'Tests symbol added/modified/removed counting logic',
  validator: {
    calculate: async (bundleFacts) => {
      return countSymbols(bundleFacts.evidence.symbols);
    }
  }
});

// Test 1: Basic counting
symbolCountTests.test({
  name: 'Counts symbols correctly in single commit',
  fixture: {
    commits: [
      {
        sha: 'abc123',
        symbols: [
          SymbolFixtures.added('foo', 'function'),
          SymbolFixtures.added('bar', 'function'),
          SymbolFixtures.modified('baz', 'class'),
          SymbolFixtures.removed('old', 'function')
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 2,
    symbolsModified: 1,
    symbolsRemoved: 1,
    totalSymbols: 4
  },
  formula: 'symbolsAdded = count(status === "added")'
});

// Test 2: Empty commit
symbolCountTests.test({
  name: 'Handles commits with no symbols',
  fixture: {
    commits: [{ sha: 'empty', symbols: [] }]
  },
  expectedMetrics: {
    symbolsAdded: 0,
    symbolsModified: 0,
    symbolsRemoved: 0,
    totalSymbols: 0
  }
});

// Test 3: Multiple commits
symbolCountTests.test({
  name: 'Aggregates symbols across multiple commits',
  fixture: {
    commits: [
      {
        sha: 'commit1',
        symbols: [
          SymbolFixtures.added('func1', 'function'),
          SymbolFixtures.modified('class1', 'class')
        ]
      },
      {
        sha: 'commit2',
        symbols: [
          SymbolFixtures.added('func2', 'function'),
          SymbolFixtures.removed('oldFunc', 'function')
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 2,
    symbolsModified: 1,
    symbolsRemoved: 1,
    totalSymbols: 4
  }
});

// Test 4: Workspace overlay
symbolCountTests.test({
  name: 'Combines commit and workspace symbols',
  fixture: {
    commits: [
      {
        sha: 'abc',
        symbols: [SymbolFixtures.added('foo', 'function')]
      }
    ],
    workspace: {
      symbols: [SymbolFixtures.added('bar', 'function')]
    }
  },
  expectedMetrics: {
    symbolsAdded: 2,
    symbolsModified: 0,
    symbolsRemoved: 0,
    totalSymbols: 2
  }
});

// Test 5: Symbol types distribution
symbolCountTests.test({
  name: 'Tracks symbols by type',
  fixture: {
    commits: [
      {
        sha: 'types',
        symbols: [
          SymbolFixtures.added('func', 'function'),
          SymbolFixtures.added('MyClass', 'class'),
          SymbolFixtures.added('MyInterface', 'interface'),
          SymbolFixtures.added('CONSTANT', 'constant'),
          SymbolFixtures.added('variable', 'variable')
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 5,
    symbolsModified: 0,
    symbolsRemoved: 0,
    totalSymbols: 5,
    symbolsByType: {
      function: 1,
      class: 1,
      interface: 1,
      constant: 1,
      variable: 1
    }
  }
});

// Test 6: Status distribution
symbolCountTests.test({
  name: 'Tracks symbols by status',
  fixture: {
    commits: [
      {
        sha: 'status',
        symbols: [
          SymbolFixtures.added('a1', 'function'),
          SymbolFixtures.added('a2', 'function'),
          SymbolFixtures.modified('m1', 'class'),
          SymbolFixtures.modified('m2', 'class'),
          SymbolFixtures.modified('m3', 'class'),
          SymbolFixtures.removed('r1', 'function'),
          SymbolFixtures.removed('r2', 'function'),
          SymbolFixtures.removed('r3', 'function'),
          SymbolFixtures.removed('r4', 'function')
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 2,
    symbolsModified: 3,
    symbolsRemoved: 4,
    totalSymbols: 9,
    symbolsByStatus: {
      added: 2,
      modified: 3,
      removed: 4
    }
  }
});

// Test 7: Large-scale changes
symbolCountTests.test({
  name: 'Handles large-scale refactoring',
  fixture: {
    commits: [
      {
        sha: 'large-refactor',
        symbols: [
          ...Array.from({ length: 10 }, (_, i) => SymbolFixtures.added(`NewClass${i}`, 'class')),
          ...Array.from({ length: 5 }, (_, i) => SymbolFixtures.modified(`OldClass${i}`, 'class')),
          ...Array.from({ length: 3 }, (_, i) => SymbolFixtures.removed(`DeprecatedClass${i}`, 'class'))
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 10,
    symbolsModified: 5,
    symbolsRemoved: 3,
    totalSymbols: 18
  }
});

// Test 8: Mixed symbol types in single commit
symbolCountTests.test({
  name: 'Counts mixed symbol types correctly',
  fixture: {
    commits: [
      {
        sha: 'mixed',
        symbols: [
          SymbolFixtures.added('UserService', 'class'),
          SymbolFixtures.added('UserService.create', 'method'),
          SymbolFixtures.added('UserService.get', 'method'),
          SymbolFixtures.modified('AuthService', 'class'),
          SymbolFixtures.removed('LegacyService', 'class')
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 3,
    symbolsModified: 1,
    symbolsRemoved: 1,
    totalSymbols: 5,
    symbolsByType: {
      class: 3,
      method: 2
    }
  }
});

// Test 9: Only removals
symbolCountTests.test({
  name: 'Handles commit with only removals',
  fixture: {
    commits: [
      {
        sha: 'cleanup',
        symbols: [
          SymbolFixtures.removed('OldAPI', 'class'),
          SymbolFixtures.removed('DeprecatedUtil', 'function'),
          SymbolFixtures.removed('LegacyHelper', 'function')
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 0,
    symbolsModified: 0,
    symbolsRemoved: 3,
    totalSymbols: 3
  }
});

// Test 10: Only additions
symbolCountTests.test({
  name: 'Handles commit with only additions',
  fixture: {
    commits: [
      {
        sha: 'new-feature',
        symbols: [
          SymbolFixtures.added('NewFeature', 'class'),
          SymbolFixtures.added('NewFeature.init', 'method'),
          SymbolFixtures.added('NewFeature.process', 'method')
        ]
      }
    ]
  },
  expectedMetrics: {
    symbolsAdded: 3,
    symbolsModified: 0,
    symbolsRemoved: 0,
    totalSymbols: 3
  }
});
