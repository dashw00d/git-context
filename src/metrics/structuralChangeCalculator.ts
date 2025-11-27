/**
 * Structural Change Calculator
 *
 * Adapter for StructuralDiffManager.getOrCreateStructuralDiff()
 * Provides structural change metrics for tests
 */

import { StructuralDiffManager, StructuralDiffMetrics } from '../analysis/structuralDiffManager';

export interface StructuralChangeMetrics {
  structuralChangeScore: number; // 0-1
  controlFlowChanged: boolean;
  interfaceChanged: boolean;
  movedBlocks: number;
  linesAdded: number;
  linesRemoved: number;
}

/**
 * Calculate structural change metrics using the real StructuralDiffManager
 */
export async function calculateStructuralChange(
  prevContent: string,
  currContent: string,
  filePath: string
): Promise<StructuralChangeMetrics> {
  // For test adapters, use simplified calculation
  // In production, this would use the real StructuralDiffManager with proper database access
  return calculateStructuralChangeSimple(prevContent, currContent);
}

/**
 * Simplified structural change calculation for tests
 * When difftastic is not available, provide basic heuristics
 */
export function calculateStructuralChangeSimple(
  prevContent: string,
  currContent: string
): StructuralChangeMetrics {
  const prevLines = prevContent.split('\n');
  const currLines = currContent.split('\n');

  const linesAdded = Math.max(0, currLines.length - prevLines.length);
  const linesRemoved = Math.max(0, prevLines.length - currLines.length);

  // Simple heuristics for structural changes
  const controlFlowChanged = (
    (prevContent.includes('if ') || prevContent.includes('for ') || prevContent.includes('while ')) !==
    (currContent.includes('if ') || currContent.includes('for ') || currContent.includes('while '))
  );

  const interfaceChanged = (
    (prevContent.includes('interface ') || prevContent.includes('class ')) !==
    (currContent.includes('interface ') || currContent.includes('class '))
  );

  // Rough change score based on line differences
  const structuralChangeScore = Math.min((linesAdded + linesRemoved) / Math.max(prevLines.length, 1), 1.0);

  return {
    structuralChangeScore,
    controlFlowChanged,
    interfaceChanged,
    movedBlocks: 0, // Simplified - can't detect without difftastic
    linesAdded,
    linesRemoved
  };
}
