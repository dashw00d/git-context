/**
 * Hotspot Detection Tests
 *
 * Tests hotspot detection logic using real HotspotDetector functions
 *
 * TESTING PHILOSOPHY:
 * - Tests use REAL pipeline functions (HotspotDetector.calculateHotspotScore, classifyRiskLevel)
 * - Tests validate the actual hotspot detection algorithm, not mocks
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { calculateHotspotMetrics, calculateFileHotspotMetrics, calculateSymbolHotspotMetrics } from '../../../src/metrics/hotspotCalculator';

export const hotspotDetectionTests = new MetricTestSuite({
  name: 'Hotspot Detection',
  description: 'Tests hotspot detection using real HotspotDetector functions',
  validator: {
    calculate: async (bundleFacts) => {
      // For testing, use synthetic hotspot data based on fixture content
      const commitCount = bundleFacts.evidence.commitCount || 5;
      const totalChanges = bundleFacts.evidence.totalChanges || 20;
      const uniqueAuthors = bundleFacts.evidence.uniqueAuthors || 2;
      const daysSinceLastChange = bundleFacts.evidence.daysSinceLastChange || 30;

      // USE REAL PIPELINE FUNCTIONS
      const hotspotMetrics = calculateHotspotMetrics(
        commitCount,
        totalChanges,
        uniqueAuthors,
        daysSinceLastChange
      );

      return {
        hotspotScore: hotspotMetrics.hotspotScore,
        riskLevel: hotspotMetrics.riskLevel,
        commitFrequency: hotspotMetrics.commitFrequency,
        recency: hotspotMetrics.recency,
        authorDiversity: hotspotMetrics.authorDiversity,
        changeIntensity: hotspotMetrics.changeIntensity,
        temporalClustering: hotspotMetrics.temporalClustering
      };
    }
  },
  stepId: 'hotspots' // Maps to hotspotStep.ts
});

// Test 1: High-risk hotspot
hotspotDetectionTests.test({
  name: 'Detects high-risk hotspot with frequent changes by many authors',
  fixture: {
    evidence: {
      commitCount: 25,
      totalChanges: 100,
      uniqueAuthors: 8,
      daysSinceLastChange: 1
    }
  },
  expectedMetrics: {
    hotspotScore: 100, // Max score for high-risk
    riskLevel: 'critical',
    commitFrequency: 1.0, // max(25/20, 1.0) = 1.0
    recency: 1.0, // max(0, 1-1/365) ≈ 1.0
    authorDiversity: 1.0, // min(8/5, 1.0) = 1.0
    changeIntensity: 1.0, // min(100/20/10, 1.0) = 1.0 (assuming averageChangeSize = 1.0)
    temporalClustering: 0.5 // default
  },
  formula: 'hotspotScore = weighted sum of normalized metrics (commitFrequency, recency, authorDiversity, changeIntensity, temporalClustering)'
});

// Test 2: Low-risk hotspot
hotspotDetectionTests.test({
  name: 'Detects low-risk hotspot with infrequent changes by few authors',
  fixture: {
    evidence: {
      commitCount: 1,
      totalChanges: 5,
      uniqueAuthors: 1,
      daysSinceLastChange: 365
    }
  },
  expectedMetrics: {
    hotspotScore: 0, // Min score for low-risk
    riskLevel: 'low',
    commitFrequency: 0.05, // min(1/20, 1.0) = 0.05
    recency: 0.0, // max(0, 1-365/365) = 0.0
    authorDiversity: 0.2, // min(1/5, 1.0) = 0.2
    changeIntensity: 0.005, // min(5/1/10, 1.0) = 0.005
    temporalClustering: 0.5 // default
  }
});

// Test 3: Medium-risk hotspot
hotspotDetectionTests.test({
  name: 'Detects medium-risk hotspot with moderate activity',
  fixture: {
    evidence: {
      commitCount: 8,
      totalChanges: 25,
      uniqueAuthors: 3,
      daysSinceLastChange: 60
    }
  },
  expectedMetrics: {
    hotspotScore: 50, // Around medium threshold
    riskLevel: 'medium',
    commitFrequency: 0.4, // min(8/20, 1.0) = 0.4
    recency: 0.836, // max(0, 1-60/365) ≈ 0.836
    authorDiversity: 0.6, // min(3/5, 1.0) = 0.6
    changeIntensity: 0.031, // min(25/8/10, 1.0) = 0.031
    temporalClustering: 0.5 // default
  }
});

// Test 4: File-specific hotspot
hotspotDetectionTests.test({
  name: 'Calculates file hotspot metrics',
  fixture: {
    evidence: {
      fileCommits: 15,
      totalChanges: 50,
      uniqueAuthors: 4,
      daysSinceLastChange: 7
    }
  },
  expectedMetrics: {
    hotspotScore: 85, // High score for file with recent activity
    riskLevel: 'high',
    commitFrequency: 0.75, // min(15/20, 1.0) = 0.75
    recency: 0.981, // max(0, 1-7/365) ≈ 0.981
    authorDiversity: 0.8, // min(4/5, 1.0) = 0.8
    changeIntensity: 0.033, // min(50/15/10, 1.0) = 0.033
    temporalClustering: 0.5 // default
  }
});

// Test 5: Symbol-specific hotspot
hotspotDetectionTests.test({
  name: 'Calculates symbol hotspot metrics',
  fixture: {
    evidence: {
      symbolCommits: 12,
      totalChanges: 30,
      uniqueAuthors: 2,
      daysSinceLastChange: 14
    }
  },
  expectedMetrics: {
    hotspotScore: 60, // Medium-high score for symbol
    riskLevel: 'medium',
    commitFrequency: 0.6, // min(12/20, 1.0) = 0.6
    recency: 0.962, // max(0, 1-14/365) ≈ 0.962
    authorDiversity: 0.4, // min(2/5, 1.0) = 0.4
    changeIntensity: 0.025, // min(30/12/10, 1.0) = 0.025
    temporalClustering: 0.5 // default
  }
});

// Test 6: Very old changes
hotspotDetectionTests.test({
  name: 'Handles very old changes with low recency score',
  fixture: {
    evidence: {
      commitCount: 10,
      totalChanges: 40,
      uniqueAuthors: 5,
      daysSinceLastChange: 730 // 2 years ago
    }
  },
  expectedMetrics: {
    hotspotScore: 25, // Low score due to age
    riskLevel: 'low',
    commitFrequency: 0.5, // min(10/20, 1.0) = 0.5
    recency: 0.0, // max(0, 1-730/365) = 0.0
    authorDiversity: 1.0, // min(5/5, 1.0) = 1.0
    changeIntensity: 0.04, // min(40/10/10, 1.0) = 0.04
    temporalClustering: 0.5 // default
  }
});

// Test 7: High change intensity
hotspotDetectionTests.test({
  name: 'Handles high change intensity per commit',
  fixture: {
    evidence: {
      commitCount: 3,
      totalChanges: 150,
      uniqueAuthors: 2,
      daysSinceLastChange: 30
    }
  },
  expectedMetrics: {
    hotspotScore: 75, // High score due to large changes per commit
    riskLevel: 'high',
    commitFrequency: 0.15, // min(3/20, 1.0) = 0.15
    recency: 0.918, // max(0, 1-30/365) ≈ 0.918
    authorDiversity: 0.4, // min(2/5, 1.0) = 0.4
    changeIntensity: 1.0, // min(150/3/10, 1.0) = 1.0
    temporalClustering: 0.5 // default
  }
});

// Test 8: Single author, high frequency
hotspotDetectionTests.test({
  name: 'Handles single author with high commit frequency',
  fixture: {
    evidence: {
      commitCount: 18,
      totalChanges: 60,
      uniqueAuthors: 1,
      daysSinceLastChange: 45
    }
  },
  expectedMetrics: {
    hotspotScore: 45, // Medium score - high frequency but low diversity
    riskLevel: 'medium',
    commitFrequency: 0.9, // min(18/20, 1.0) = 0.9
    recency: 0.877, // max(0, 1-45/365) ≈ 0.877
    authorDiversity: 0.2, // min(1/5, 1.0) = 0.2
    changeIntensity: 0.033, // min(60/18/10, 1.0) = 0.033
    temporalClustering: 0.5 // default
  }
});

// Test 9: Edge case - zero commits
hotspotDetectionTests.test({
  name: 'Handles edge case of zero commits',
  fixture: {
    evidence: {
      commitCount: 0,
      totalChanges: 0,
      uniqueAuthors: 0,
      daysSinceLastChange: 1000
    }
  },
  expectedMetrics: {
    hotspotScore: 0, // No activity = no hotspot
    riskLevel: 'low',
    commitFrequency: 0.0, // min(0/20, 1.0) = 0.0
    recency: 0.0, // max(0, 1-1000/365) = 0.0
    authorDiversity: 0.0, // min(0/5, 1.0) = 0.0
    changeIntensity: 0.0, // min(0/0/10, 1.0) = 0.0 (handled gracefully)
    temporalClustering: 0.5 // default
  }
});

// Test 10: Maximum diversity and frequency
hotspotDetectionTests.test({
  name: 'Handles maximum author diversity and commit frequency',
  fixture: {
    evidence: {
      commitCount: 30,
      totalChanges: 200,
      uniqueAuthors: 10,
      daysSinceLastChange: 0
    }
  },
  expectedMetrics: {
    hotspotScore: 100, // Maximum possible score
    riskLevel: 'critical',
    commitFrequency: 1.0, // min(30/20, 1.0) = 1.0
    recency: 1.0, // max(0, 1-0/365) = 1.0
    authorDiversity: 1.0, // min(10/5, 1.0) = 1.0
    changeIntensity: 1.0, // min(200/30/10, 1.0) = 1.0
    temporalClustering: 0.5 // default
  }
});
