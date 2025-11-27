/**
 * Edge Counting Tests
 *
 * Tests edge counting logic (added/removed, types, confidence)
 *
 * TESTING PHILOSOPHY:
 * - DO NOT modify test expectations to make tests pass
 * - If a test fails, fix the pipeline logic in src/analysis/commitIndexer.ts or src/metrics/edgeCounter.ts
 * - Uses extracted edgeCounter which mirrors the real logic in commitIndexer.ts
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { countEdges, compareEdgeSets, EdgeMetrics } from '../../../src/metrics/edgeCounter';
import { EdgeFixtures } from '../fixtures/edges';

export const edgeCountingTests = new MetricTestSuite({
  name: 'Edge Counting',
  description: 'Tests edge counting and classification logic',
  validator: {
    calculate: async (bundleFacts) => {
      const edges = bundleFacts.evidence.edges || [];
      return countEdges(edges);
    }
  }
});

// Test 1: Empty edges
edgeCountingTests.test({
  name: 'Handles empty edge sets',
  fixture: {
    evidence: {
      edges: []
    }
  },
  expectedMetrics: {
    edgesAdded: 0,
    edgesRemoved: 0,
    totalEdges: 0,
    edgesByType: {},
    edgesByConfidence: {
      high: 0,
      medium: 0,
      low: 0
    }
  }
});

// Test 2: Single call edge
edgeCountingTests.test({
  name: 'Counts single call edge',
  fixture: {
    evidence: {
      edges: [
        EdgeFixtures.calls('ServiceA', 'ServiceB')
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 1,
    edgesRemoved: 0,
    totalEdges: 1,
    edgesByType: { calls: 1 },
    edgesByConfidence: {
      high: 1, // Default confidence is 1.0 (high)
      medium: 0,
      low: 0
    }
  }
});

// Test 3: Multiple edge types
edgeCountingTests.test({
  name: 'Counts mixed edge types',
  fixture: {
    evidence: {
      edges: [
        EdgeFixtures.calls('Controller', 'Service'),
        EdgeFixtures.implements('Service', 'Interface'),
        EdgeFixtures.inherits('Service', 'BaseClass'),
        EdgeFixtures.references('Service', 'Utility')
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 4,
    edgesRemoved: 0,
    totalEdges: 4,
    edgesByType: {
      calls: 1,
      implements: 1,
      inherits: 1,
      references: 1
    },
    edgesByConfidence: {
      high: 4,
      medium: 0,
      low: 0
    }
  }
});

// Test 4: Confidence levels
edgeCountingTests.test({
  name: 'Classifies confidence levels correctly',
  fixture: {
    evidence: {
      edges: [
        { from: 'A', to: 'B', type: 'calls', confidence: 0.9 }, // High
        { from: 'B', to: 'C', type: 'calls', confidence: 0.7 }, // Medium
        { from: 'C', to: 'D', type: 'calls', confidence: 0.3 }  // Low
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 3,
    edgesRemoved: 0,
    totalEdges: 3,
    edgesByType: { calls: 3 },
    edgesByConfidence: {
      high: 1,
      medium: 1,
      low: 1
    }
  }
});

// Test 5: Large edge set
edgeCountingTests.test({
  name: 'Handles large edge sets efficiently',
  fixture: {
    evidence: {
      edges: Array.from({ length: 50 }, (_, i) => ({
        from: `Class${i}`,
        to: `Dependency${i}`,
        type: 'calls' as const,
        confidence: 0.8
      }))
    }
  },
  expectedMetrics: {
    edgesAdded: 50,
    edgesRemoved: 0,
    totalEdges: 50,
    edgesByType: { calls: 50 },
    edgesByConfidence: {
      high: 50,
      medium: 0,
      low: 0
    }
  }
});

// Test 6: Duplicate edges
edgeCountingTests.test({
  name: 'Handles duplicate edges',
  fixture: {
    evidence: {
      edges: [
        EdgeFixtures.calls('A', 'B'),
        EdgeFixtures.calls('A', 'B'), // Duplicate
        EdgeFixtures.calls('A', 'C')
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 3,
    edgesRemoved: 0,
    totalEdges: 3,
    edgesByType: { calls: 3 },
    edgesByConfidence: {
      high: 3,
      medium: 0,
      low: 0
    }
  }
});

// Test 7: Complex dependency graph
edgeCountingTests.test({
  name: 'Counts complex dependency patterns',
  fixture: {
    evidence: {
      edges: [
        // Controller layer
        EdgeFixtures.calls('UserController', 'UserService'),
        EdgeFixtures.calls('OrderController', 'OrderService'),

        // Service layer
        EdgeFixtures.calls('UserService', 'UserRepository'),
        EdgeFixtures.calls('UserService', 'EmailService'),
        EdgeFixtures.calls('OrderService', 'OrderRepository'),
        EdgeFixtures.calls('OrderService', 'PaymentService'),

        // Repository layer
        EdgeFixtures.implements('UserRepository', 'IUserRepository'),
        EdgeFixtures.implements('OrderRepository', 'IOrderRepository'),

        // Utility dependencies
        EdgeFixtures.references('EmailService', 'Logger'),
        EdgeFixtures.references('PaymentService', 'Validator')
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 10,
    edgesRemoved: 0,
    totalEdges: 10,
    edgesByType: {
      calls: 6,
      implements: 2,
      references: 2
    },
    edgesByConfidence: {
      high: 10,
      medium: 0,
      low: 0
    }
  }
});

// Test 8: Mixed confidence levels
edgeCountingTests.test({
  name: 'Distributes confidence levels accurately',
  fixture: {
    evidence: {
      edges: [
        { from: 'A', to: 'B', type: 'calls', confidence: 1.0 }, // High
        { from: 'B', to: 'C', type: 'calls', confidence: 0.95 }, // High
        { from: 'C', to: 'D', type: 'calls', confidence: 0.85 }, // High
        { from: 'D', to: 'E', type: 'calls', confidence: 0.75 }, // Medium
        { from: 'E', to: 'F', type: 'calls', confidence: 0.65 }, // Medium
        { from: 'F', to: 'G', type: 'calls', confidence: 0.45 }, // Low
        { from: 'G', to: 'H', type: 'calls', confidence: 0.25 }  // Low
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 7,
    edgesRemoved: 0,
    totalEdges: 7,
    edgesByType: { calls: 7 },
    edgesByConfidence: {
      high: 3,    // >= 0.8
      medium: 2,  // 0.5-0.8
      low: 2      // < 0.5
    }
  }
});

// Test 9: Zero confidence edges
edgeCountingTests.test({
  name: 'Handles zero confidence edges',
  fixture: {
    evidence: {
      edges: [
        { from: 'A', to: 'B', type: 'calls', confidence: 0.0 },
        { from: 'B', to: 'C', type: 'calls', confidence: 0.1 },
        { from: 'C', to: 'D', type: 'calls', confidence: 0.0 }
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 3,
    edgesRemoved: 0,
    totalEdges: 3,
    edgesByType: { calls: 3 },
    edgesByConfidence: {
      high: 0,
      medium: 0,
      low: 3 // All < 0.5
    }
  }
});

// Test 10: Edge type distribution analysis
edgeCountingTests.test({
  name: 'Analyzes edge type distribution',
  fixture: {
    evidence: {
      edges: [
        // Many calls
        ...Array.from({ length: 5 }, (_, i) => EdgeFixtures.calls(`Caller${i}`, `Callee${i}`)),
        // Some implements
        ...Array.from({ length: 3 }, (_, i) => EdgeFixtures.implements(`Class${i}`, `Interface${i}`)),
        // Few inherits
        ...Array.from({ length: 2 }, (_, i) => EdgeFixtures.inherits(`Child${i}`, `Parent${i}`)),
        // One reference
        EdgeFixtures.references('Util', 'Helper')
      ]
    }
  },
  expectedMetrics: {
    edgesAdded: 11,
    edgesRemoved: 0,
    totalEdges: 11,
    edgesByType: {
      calls: 5,
      implements: 3,
      inherits: 2,
      references: 1
    },
    edgesByConfidence: {
      high: 11,
      medium: 0,
      low: 0
    }
  }
});
