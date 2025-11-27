/**
 * Workspace Facts Tests
 *
 * Tests workspace facts calculation logic for unstaged/staged changes
 *
 * TESTING PHILOSOPHY:
 * - Tests simplified workspace facts calculation logic for test fixtures
 * - Real workspace facts calculation requires git/filesystem access (see WorkspaceIndexer.analyzeWorkspace())
 * - Tests validate the test-only adapter, not the real pipeline function
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { calculateWorkspaceFactsFromSymbols, createWorkspaceFacts } from '../../../src/metrics/workspaceFactsAdapter';
import { SymbolFixtures } from '../fixtures/symbols';
import { EdgeFixtures } from '../fixtures/edges';

export const workspaceFactsTests = new MetricTestSuite({
  name: 'Workspace Facts',
  description: 'Tests simplified workspace facts calculation for unstaged/staged changes',
  validator: {
    calculate: async (bundleFacts) => {
      // Transform test data to workspace facts format
      const symbols = bundleFacts.evidence.symbols?.map((s: any) => ({
        ...s,
        status: s.status || 'added' // Ensure status field exists
      })) || [];

      const edges = bundleFacts.evidence.edges || [];
      const filesChanged = bundleFacts.evidence.filesChanged || symbols.length;

      // USE TEST-ONLY ADAPTER (simplified calculation)
      const workspaceMetrics = calculateWorkspaceFactsFromSymbols(symbols, edges, filesChanged);

      return {
        symbolsAdded: workspaceMetrics.symbolsAdded,
        symbolsModified: workspaceMetrics.symbolsModified,
        symbolsRemoved: workspaceMetrics.symbolsRemoved,
        edgesAdded: workspaceMetrics.edgesAdded,
        edgesRemoved: workspaceMetrics.edgesRemoved,
        totalSymbols: workspaceMetrics.totalSymbols,
        totalEdges: workspaceMetrics.totalEdges,
        filesChanged: workspaceMetrics.filesChanged,
        blastRadius: workspaceMetrics.blastRadius,
        structuralChangeScore: workspaceMetrics.structuralChangeScore,
        workspaceFacts: createWorkspaceFacts(workspaceMetrics)
      };
    }
  },
  stepId: 'workspace' // Maps to workspaceStep.ts
});

// Test 1: Workspace with new symbols only
workspaceFactsTests.test({
  name: 'Calculates workspace facts for new symbols only',
  fixture: {
    evidence: {
      symbols: [
        { id: 'NewService', name: 'NewService', type: 'class', filePath: 'src/services/NewService.ts', status: 'added' as const },
        { id: 'NewController', name: 'NewController', type: 'class', filePath: 'src/controllers/NewController.ts', status: 'added' as const },
        { id: 'NewUtil', name: 'NewUtil', type: 'function', filePath: 'src/utils/NewUtil.ts', status: 'added' as const }
      ],
      edges: [
        EdgeFixtures.calls('NewController', 'NewService'),
        EdgeFixtures.calls('NewService', 'NewUtil')
      ],
      filesChanged: 3
    }
  },
  expectedMetrics: {
    symbolsAdded: 3,
    symbolsModified: 0,
    symbolsRemoved: 0,
    edgesAdded: 2,
    edgesRemoved: 0,
    totalSymbols: 3,
    totalEdges: 2,
    filesChanged: 3,
    blastRadius: 6,
    structuralChangeScore: 0.1
  },
  formula: 'blastRadius = totalSymbols * 2, structuralChangeScore = min(totalSymbols/10, 1.0), edgesAdded = count(edges), symbolsAdded = count(symbols with status added)'
});

// Test 2: Mixed workspace changes
workspaceFactsTests.test({
  name: 'Calculates workspace facts for mixed symbol changes',
  fixture: {
    evidence: {
      symbols: [
        { id: 'NewFeature', name: 'NewFeature', type: 'class', filePath: 'src/features/NewFeature.ts', status: 'added' as const },
        { id: 'ExistingService', name: 'ExistingService', type: 'class', filePath: 'src/services/ExistingService.ts', status: 'modified' as const },
        { id: 'OldUtil', name: 'OldUtil', type: 'function', filePath: 'src/utils/OldUtil.ts', status: 'removed' as const }
      ],
      edges: [
        EdgeFixtures.calls('NewFeature', 'ExistingService')
      ],
      filesChanged: 3
    }
  },
  expectedMetrics: {
    symbolsAdded: 1,
    symbolsModified: 1,
    symbolsRemoved: 1,
    edgesAdded: 1,
    edgesRemoved: 0,
    totalSymbols: 3,
    totalEdges: 1,
    filesChanged: 3,
    blastRadius: 6,
    structuralChangeScore: 0.1
  }
});

// Test 3: Large workspace with many symbols
workspaceFactsTests.test({
  name: 'Scales with large workspace changes',
  fixture: {
    evidence: {
      symbols: Array.from({ length: 50 }, (_, i) => ({
        id: `Component${i}`,
        name: `Component${i}`,
        type: 'class' as const,
        filePath: `src/components/Component${i}.ts`,
        status: (i % 3 === 0 ? 'modified' : i % 3 === 1 ? 'removed' : 'added')
      })),
      edges: Array.from({ length: 30 }, (_, i) =>
        EdgeFixtures.calls(`Component${i}`, `Component${i + 1}`)
      ),
      filesChanged: 50
    }
  },
  expectedMetrics: {
    symbolsAdded: Math.floor(50 / 3) + (50 % 3 >= 1 ? 1 : 0), // ~17
    symbolsModified: Math.floor(50 / 3), // ~17
    symbolsRemoved: Math.floor(50 / 3), // ~17
    edgesAdded: 30,
    edgesRemoved: 0,
    totalSymbols: 50,
    totalEdges: 30,
    filesChanged: 50,
    blastRadius: 100,
    structuralChangeScore: 1.0 // min(50/10, 1.0) = 1.0
  }
});

// Test 4: Workspace with no changes
workspaceFactsTests.test({
  name: 'Handles empty workspace with no changes',
  fixture: {
    evidence: {
      symbols: [],
      edges: [],
      filesChanged: 0
    }
  },
  expectedMetrics: {
    symbolsAdded: 0,
    symbolsModified: 0,
    symbolsRemoved: 0,
    edgesAdded: 0,
    edgesRemoved: 0,
    totalSymbols: 0,
    totalEdges: 0,
    filesChanged: 0,
    blastRadius: 0,
    structuralChangeScore: 0
  }
});

// Test 5: High structural change score
workspaceFactsTests.test({
  name: 'Calculates high structural change score for large refactors',
  fixture: {
    evidence: {
      symbols: Array.from({ length: 25 }, (_, i) => ({
        id: `NewClass${i}`,
        name: `NewClass${i}`,
        type: 'class' as const,
        filePath: `src/classes/NewClass${i}.ts`,
        status: 'added' as const
      })),
      edges: Array.from({ length: 20 }, (_, i) =>
        EdgeFixtures.calls(`NewClass${i}`, `NewClass${(i + 1) % 25}`)
      ),
      filesChanged: 25
    }
  },
  expectedMetrics: {
    symbolsAdded: 25,
    symbolsModified: 0,
    symbolsRemoved: 0,
    edgesAdded: 20,
    edgesRemoved: 0,
    totalSymbols: 25,
    totalEdges: 20,
    filesChanged: 25,
    blastRadius: 50,
    structuralChangeScore: 1.0 // min(25/10, 1.0) = 1.0
  }
});

// Test 6: Low structural change score
workspaceFactsTests.test({
  name: 'Calculates low structural change score for small changes',
  fixture: {
    evidence: {
      symbols: [
        { id: 'SmallChange', name: 'SmallChange', type: 'function', filePath: 'src/utils/SmallChange.ts', status: 'added' as const }
      ],
      edges: [],
      filesChanged: 1
    }
  },
  expectedMetrics: {
    symbolsAdded: 1,
    symbolsModified: 0,
    symbolsRemoved: 0,
    edgesAdded: 0,
    edgesRemoved: 0,
    totalSymbols: 1,
    totalEdges: 0,
    filesChanged: 1,
    blastRadius: 2,
    structuralChangeScore: 0.1 // min(1/10, 1.0) = 0.1
  }
});

// Test 7: Complex dependency network
workspaceFactsTests.test({
  name: 'Handles complex dependency networks in workspace',
  fixture: {
    evidence: {
      symbols: [
        { id: 'ApiService', name: 'ApiService', type: 'class', filePath: 'src/services/ApiService.ts', status: 'added' as const },
        { id: 'DatabaseService', name: 'DatabaseService', type: 'class', filePath: 'src/services/DatabaseService.ts', status: 'added' as const },
        { id: 'CacheService', name: 'CacheService', type: 'class', filePath: 'src/services/CacheService.ts', status: 'added' as const },
        { id: 'AuthService', name: 'AuthService', type: 'class', filePath: 'src/services/AuthService.ts', status: 'added' as const },
        { id: 'UserController', name: 'UserController', type: 'class', filePath: 'src/controllers/UserController.ts', status: 'added' as const },
        { id: 'AdminController', name: 'AdminController', type: 'class', filePath: 'src/controllers/AdminController.ts', status: 'added' as const }
      ],
      edges: [
        EdgeFixtures.calls('UserController', 'ApiService'),
        EdgeFixtures.calls('AdminController', 'ApiService'),
        EdgeFixtures.calls('ApiService', 'AuthService'),
        EdgeFixtures.calls('ApiService', 'CacheService'),
        EdgeFixtures.calls('CacheService', 'DatabaseService'),
        EdgeFixtures.calls('AuthService', 'DatabaseService')
      ],
      filesChanged: 6
    }
  },
  expectedMetrics: {
    symbolsAdded: 6,
    symbolsModified: 0,
    symbolsRemoved: 0,
    edgesAdded: 6,
    edgesRemoved: 0,
    totalSymbols: 6,
    totalEdges: 6,
    filesChanged: 6,
    blastRadius: 12,
    structuralChangeScore: 0.6 // min(6/10, 1.0) = 0.6
  }
});

// Test 8: Workspace with removed symbols only
workspaceFactsTests.test({
  name: 'Handles workspace with only removed symbols',
  fixture: {
    evidence: {
      symbols: [
        { id: 'OldClass', name: 'OldClass', type: 'class', filePath: 'src/OldClass.ts', status: 'removed' as const },
        { id: 'LegacyUtil', name: 'LegacyUtil', type: 'function', filePath: 'src/utils/LegacyUtil.ts', status: 'removed' as const }
      ],
      edges: [],
      filesChanged: 2
    }
  },
  expectedMetrics: {
    symbolsAdded: 0,
    symbolsModified: 0,
    symbolsRemoved: 2,
    edgesAdded: 0,
    edgesRemoved: 0,
    totalSymbols: 2,
    totalEdges: 0,
    filesChanged: 2,
    blastRadius: 4,
    structuralChangeScore: 0.2 // min(2/10, 1.0) = 0.2
  }
});
