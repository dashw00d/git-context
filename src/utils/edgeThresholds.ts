/**
 * Shared utilities for edge confidence thresholds
 * Centralizes threshold logic used across multiple modules
 */

/**
 * Get dynamic confidence threshold based on edge count
 * Lower threshold for smaller graphs, higher for larger graphs
 */
export function getDynamicThreshold(edgeCount: number): number {
  return edgeCount < 50 ? 0.4 : 0.7;
}

/**
 * Get default confidence threshold for edge filtering
 */
export function getDefaultThreshold(): number {
  return 0.5;
}

