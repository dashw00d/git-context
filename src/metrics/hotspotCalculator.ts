/**
 * Hotspot Calculator
 *
 * Adapter for HotspotDetector hotspot score calculations
 * Provides hotspot metrics for tests
 */

import { HotspotDetector, HotspotMetrics } from '../analysis/hotspotDetector';

export interface HotspotCalculationMetrics {
  hotspotScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  commitFrequency: number; // 0-1
  recency: number; // 0-1
  authorDiversity: number; // 0-1
  changeIntensity: number; // 0-1
  temporalClustering: number; // 0-1
}

/**
 * Calculate hotspot score using HotspotDetector algorithm
 * Uses the same weighted calculation as HotspotDetector.calculateHotspotScore
 * Note: For full hotspot detection with database history, use HotspotDetector directly
 */
export function calculateHotspotMetrics(
  commitCount: number,
  totalChanges: number,
  uniqueAuthors: number,
  daysSinceLastChange: number,
  averageChangeSize: number = 1.0,
  temporalSpread: number = 0.5
): HotspotCalculationMetrics {
  // Normalize inputs to 0-1 ranges
  const commitFrequency = Math.min(commitCount / 20, 1.0); // Cap at 20 commits
  const recency = Math.max(0, 1 - (daysSinceLastChange / 365)); // Recent within a year
  const authorDiversity = Math.min(uniqueAuthors / 5, 1.0); // Cap at 5 authors
  const changeIntensity = Math.min(averageChangeSize / 10, 1.0); // Cap at 10 average changes
  const temporalClustering = temporalSpread; // Already 0-1

  const metrics: HotspotMetrics = {
    commitFrequency,
    recency,
    authorDiversity,
    changeIntensity,
    temporalClustering
  };

  // Use the same weighted calculation as HotspotDetector
  const hotspotScore = calculateHotspotScore(metrics);

  // Use the same risk level classification
  const riskLevel = classifyRiskLevel(hotspotScore);

  return {
    hotspotScore,
    riskLevel,
    commitFrequency,
    recency,
    authorDiversity,
    changeIntensity,
    temporalClustering
  };
}

/**
 * Calculate hotspot score using HotspotDetector's algorithm
 * Calls the real HotspotDetector.calculateHotspotScore method
 */
function calculateHotspotScore(metrics: HotspotMetrics): number {
  // Use the real HotspotDetector calculation
  const detector = new HotspotDetector();
  return detector.calculateHotspotScore(metrics);
}

/**
 * Classify risk level based on hotspot score
 * Uses HotspotDetector.classifyRiskLevel method
 */
function classifyRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  const detector = new HotspotDetector();
  return detector.classifyRiskLevel(score);
}

/**
 * Calculate file hotspot metrics from commit history
 */
export function calculateFileHotspotMetrics(
  fileCommits: number,
  totalChanges: number,
  uniqueAuthors: number,
  daysSinceLastChange: number
): HotspotCalculationMetrics {
  return calculateHotspotMetrics(
    fileCommits,
    totalChanges,
    uniqueAuthors,
    daysSinceLastChange,
    totalChanges / Math.max(fileCommits, 1), // Average changes per commit
    0.5 // Default temporal clustering
  );
}

/**
 * Calculate symbol hotspot metrics from commit history
 */
export function calculateSymbolHotspotMetrics(
  symbolCommits: number,
  totalChanges: number,
  uniqueAuthors: number,
  daysSinceLastChange: number
): HotspotCalculationMetrics {
  return calculateHotspotMetrics(
    symbolCommits,
    totalChanges,
    uniqueAuthors,
    daysSinceLastChange,
    totalChanges / Math.max(symbolCommits, 1), // Average changes per commit
    0.5 // Default temporal clustering
  );
}
