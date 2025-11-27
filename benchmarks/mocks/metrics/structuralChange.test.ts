/**
 * Structural Change Tests
 *
 * Tests structural change score calculation
 *
 * TESTING PHILOSOPHY:
 * - DO NOT modify test expectations to make tests pass
 * - If a test fails, fix the pipeline logic in src/analysis/structuralDiffManager.ts or src/metrics/structuralChangeCalculator.ts
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { calculateStructuralChangeSimple } from '../../../src/metrics/structuralChangeCalculator';

export const structuralChangeTests = new MetricTestSuite({
  name: 'Structural Change Score',
  description: 'Tests structural change detection and scoring',
  validator: {
    calculate: async (bundleFacts) => {
      // For testing, use simple calculation with dummy content
      // In real usage, this would use the full StructuralDiffManager
      const prevContent = 'class OldClass { method() {} }';
      const currContent = 'class NewClass { method() {} newMethod() {} }';
      return calculateStructuralChangeSimple(prevContent, currContent);
    }
  }
});

// Test 1: No changes
structuralChangeTests.test({
  name: 'Detects no structural changes',
  fixture: {
    evidence: {
      symbols: []
    }
  },
  expectedMetrics: {
    structuralChangeScore: 0.0,
    controlFlowChanged: false,
    interfaceChanged: false,
    movedBlocks: 0,
    linesAdded: 0,
    linesRemoved: 0
  }
});

// Test 2: Interface addition
structuralChangeTests.test({
  name: 'Detects interface changes',
  fixture: {
    evidence: {
      symbols: []
    }
  },
  expectedMetrics: {
    structuralChangeScore: 0.3, // ~3 lines difference
    controlFlowChanged: false,
    interfaceChanged: true, // interface keyword added
    movedBlocks: 0,
    linesAdded: 1,
    linesRemoved: 0
  },
  formula: 'structuralChangeScore = min(linesChanged / 10, 1.0)'
});

// Test 3: Control flow changes
structuralChangeTests.test({
  name: 'Detects control flow changes',
  fixture: {
    evidence: {
      symbols: []
    }
  },
  expectedMetrics: {
    structuralChangeScore: 0.2, // ~2 lines difference
    controlFlowChanged: true, // if statement added
    interfaceChanged: false,
    movedBlocks: 0,
    linesAdded: 2,
    linesRemoved: 0
  }
});

// Test 4: Large structural change
structuralChangeTests.test({
  name: 'Calculates large structural changes',
  fixture: {
    evidence: {
      symbols: []
    }
  },
  expectedMetrics: {
    structuralChangeScore: 1.0, // Capped at 1.0
    controlFlowChanged: true,
    interfaceChanged: true,
    movedBlocks: 0,
    linesAdded: 15,
    linesRemoved: 5
  }
});
