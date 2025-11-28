/**
 * Structural Change Calculator
 *
 * Adapter for StructuralDiffManager.getOrCreateStructuralDiff()
 * Provides structural change metrics for tests
 * 
 * NOTE: This intentionally uses simplified calculation for test adapters.
 * In production, use StructuralDiffManager.getOrCreateStructuralDiff() directly
 * which requires database access and difftastic integration.
 */

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

  // Diff line arrays to count actual added/removed lines
  const prevLineSet = new Set(prevLines);
  const currLineSet = new Set(currLines);

  let linesAdded = 0;
  let linesRemoved = 0;

  // Count lines that exist in curr but not in prev
  for (const line of currLines) {
    if (!prevLineSet.has(line)) {
      linesAdded++;
    }
  }

  // Count lines that exist in prev but not in curr
  for (const line of prevLines) {
    if (!currLineSet.has(line)) {
      linesRemoved++;
    }
  }

  // Detect control-flow changes from line content analysis
  const controlFlowKeywords = /\b(if|while|for|switch|return|throw|catch|try|else|do|break|continue)\b/;
  const prevControlFlowLines = prevLines.filter(line => controlFlowKeywords.test(line)).length;
  const currControlFlowLines = currLines.filter(line => controlFlowKeywords.test(line)).length;
  const controlFlowChanged = prevControlFlowLines !== currControlFlowLines;

  // Detect interface changes from line content analysis
  const interfaceKeywords = /\b(function|class|interface|type|export|import|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)\b/;
  const prevInterfaceLines = prevLines.filter(line => interfaceKeywords.test(line)).length;
  const currInterfaceLines = currLines.filter(line => interfaceKeywords.test(line)).length;
  const interfaceChanged = prevInterfaceLines !== currInterfaceLines;

  // Calculate structural change score: min(linesChanged / 10, 1.0)
  const linesChanged = linesAdded + linesRemoved;
  const structuralChangeScore = Math.min(linesChanged / 10, 1.0);

  return {
    structuralChangeScore,
    controlFlowChanged,
    interfaceChanged,
    movedBlocks: 0, // Simplified - can't detect without difftastic
    linesAdded,
    linesRemoved
  };
}
