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
import { StructuralDiffManager } from '../../../src/analysis/structuralDiffManager';
import { Database } from 'sql.js';

export const structuralChangeTests = new MetricTestSuite({
  name: 'Structural Change Score',
  description: 'Tests structural change detection and scoring using real StructuralDiffManager',
  validator: {
    calculate: async (bundleFacts) => {
      // Create mock difftastic output for testing real extractMetrics logic
      const mockDifftasticOutput = createMockDifftasticOutput(bundleFacts);

      // Create a mock StructuralDiffManager to test extractMetrics
      const mockDb = null as any; // Not needed for extractMetrics
      const manager = new StructuralDiffManager(mockDb);

      // Test the real extractMetrics function
      return (manager as any).extractMetrics(mockDifftasticOutput);
    }
  }
});

/**
 * Create mock difftastic output based on test fixture data
 */
function createMockDifftasticOutput(bundleFacts: any) {
  // Create realistic difftastic output for testing
  const linesAdded = bundleFacts.evidence?.linesAdded || 0;
  const linesRemoved = bundleFacts.evidence?.linesRemoved || 0;

  // Create mock hunks
  const hunks = [];
  if (linesAdded > 0 || linesRemoved > 0) {
    hunks.push({
      oldStart: 1,
      oldCount: linesRemoved > 0 ? Math.max(1, linesRemoved) : 1,
      newStart: 1,
      newCount: linesAdded > 0 ? Math.max(1, linesAdded) : 1,
      lines: generateMockHunkLines(linesAdded, linesRemoved),
      linesAdded,
      linesRemoved
    });
  }

  // Create mock highlights with control-flow and interface detection
  const highlights = [];
  const tags = new Map<number, string[]>();

  if (bundleFacts.evidence?.hasControlFlow) {
    highlights.push('if (condition) {');
    tags.set(highlights.length, ['control-flow']);
  }

  if (bundleFacts.evidence?.hasInterface) {
    highlights.push('export class NewClass');
    tags.set(highlights.length, ['interface']);
  }

  return {
    highlights,
    morphs: [],
    hasStructuralChanges: linesAdded > 0 || linesRemoved > 0,
    hunks,
    tags
  };
}

/**
 * Generate mock hunk lines for testing
 */
function generateMockHunkLines(linesAdded: number, linesRemoved: number): string[] {
  const lines: string[] = [];

  // Add removed lines (prefixed with -)
  for (let i = 0; i < linesRemoved; i++) {
    lines.push(`-old line ${i + 1}`);
  }

  // Add added lines (prefixed with +)
  for (let i = 0; i < linesAdded; i++) {
    lines.push(`+new line ${i + 1}`);
  }

  return lines;
}

// Test 1: No changes
structuralChangeTests.test({
  name: 'Detects no structural changes',
  fixture: {
    evidence: {
      linesAdded: 0,
      linesRemoved: 0,
      hasControlFlow: false,
      hasInterface: false,
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
      linesAdded: 1,
      linesRemoved: 0,
      hasControlFlow: false,
      hasInterface: true,
      symbols: []
    }
  },
  expectedMetrics: {
    structuralChangeScore: 0.1, // 1/10 = 0.1
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
      linesAdded: 2,
      linesRemoved: 0,
      hasControlFlow: true,
      hasInterface: false,
      symbols: []
    }
  },
  expectedMetrics: {
    structuralChangeScore: 0.2, // 2/10 = 0.2
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
      linesAdded: 15,
      linesRemoved: 5,
      hasControlFlow: true,
      hasInterface: true,
      symbols: []
    }
  },
  expectedMetrics: {
    structuralChangeScore: 1.0, // min(20/10, 1.0) = 1.0
    controlFlowChanged: true,
    interfaceChanged: true,
    movedBlocks: 0,
    linesAdded: 15,
    linesRemoved: 5
  }
});
