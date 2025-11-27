/**
 * Validation Engine for LLM Analysis Testing
 *
 * Validates LLM outputs against expected results for mock scenarios
 */

import { LlmAnalysis } from '../../src/analysis/llmAnalyst/blocks';
import { ExpectedInsights } from './dataFactory';

export interface ValidationResult {
  passed: boolean;
  issues: string[];
  metrics: {
    healthScore: number;
    confidenceAvg: number;
    claimsFound: string[];
    claimsMissing: string[];
    claimsUnexpected: string[];
  };
}

/**
 * Calculate average confidence from analysis blocks
 */
function calculateAvgConfidence(analysis: LlmAnalysis): number {
  const blocks = analysis.blocks;
  if (blocks.length === 0) return 0;

  const totalConfidence = blocks.reduce((sum, block) => sum + block.confidence, 0);
  return totalConfidence / blocks.length;
}

/**
 * Extract claims from analysis for validation
 */
function extractClaims(analysis: LlmAnalysis): string[] {
  const claims: string[] = [];

  // Add summary claims
  claims.push(...extractClaimsFromText(analysis.summary));

  // Add claims from blocks
  for (const block of analysis.blocks) {
    for (const claim of block.claims) {
      claims.push(claim.text.toLowerCase());
    }
  }

  return [...new Set(claims)]; // Remove duplicates
}

/**
 * Extract individual claims from text (simple sentence splitting)
 */
function extractClaimsFromText(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * Extract incompleteness findings from analysis
 */
function extractIncompletenessFromAnalysis(analysis: LlmAnalysis): { missing: number; zombies: number } {
  let missing = 0;
  let zombies = 0;

  const summary = analysis.summary.toLowerCase();

  // Look for explicit mentions of missing dependencies
  if (summary.includes('missing') || summary.includes('dependencies')) {
    // Try to count from claims
    for (const block of analysis.blocks) {
      for (const claim of block.claims) {
        const text = claim.text.toLowerCase();
        if (text.includes('missing') && text.includes('dependencies')) {
          // Extract number if possible
          const match = text.match(/(\d+)/);
          if (match) {
            missing = parseInt(match[1]);
          }
        }
        if (text.includes('zombie') || text.includes('dead code')) {
          const match = text.match(/(\d+)/);
          if (match) {
            zombies = parseInt(match[1]);
          }
        }
      }
    }
  }

  return { missing, zombies };
}

/**
 * Validate LLM analysis against expected insights
 */
export function validateInsights(
  analysis: LlmAnalysis,
  expected: ExpectedInsights
): ValidationResult {
  const issues: string[] = [];
  const claimsText = analysis.summary.toLowerCase() + ' ' +
    analysis.blocks.map(b => b.claims.map(c => c.text).join(' ')).join(' ').toLowerCase();

  // Check health score
  if (expected.assertions.healthScoreRange) {
    const [min, max] = expected.assertions.healthScoreRange;
    const healthScore = analysis.metadata.healthScore || 0;
    if (healthScore < min || healthScore > max) {
      issues.push(
        `Health score ${healthScore} outside expected range [${min}, ${max}]`
      );
    }
  }

  // Check minimum confidence
  if (expected.assertions.minConfidence !== undefined) {
    const avgConfidence = calculateAvgConfidence(analysis);
    if (avgConfidence < expected.assertions.minConfidence) {
      issues.push(
        `Average confidence ${avgConfidence.toFixed(2)} below minimum ${expected.assertions.minConfidence}`
      );
    }
  }

  // Check required claims
  if (expected.assertions.requiredClaims) {
    for (const requiredClaim of expected.assertions.requiredClaims) {
      if (!claimsText.includes(requiredClaim.toLowerCase())) {
        issues.push(`Missing required claim: "${requiredClaim}"`);
      }
    }
  }

  // Check forbidden claims
  if (expected.assertions.forbiddenClaims) {
    for (const forbiddenClaim of expected.assertions.forbiddenClaims) {
      if (claimsText.includes(forbiddenClaim.toLowerCase())) {
        issues.push(`Found forbidden claim: "${forbiddenClaim}"`);
      }
    }
  }

  // Check detected incompleteness
  if (expected.shouldDetect.incompleteness) {
    const detected = extractIncompletenessFromAnalysis(analysis);

    if (expected.shouldDetect.incompleteness.missing !== undefined &&
        detected.missing !== expected.shouldDetect.incompleteness.missing) {
      issues.push(
        `Expected ${expected.shouldDetect.incompleteness.missing} missing dependencies, ` +
        `but LLM detected ${detected.missing}`
      );
    }

    if (expected.shouldDetect.incompleteness.zombies !== undefined &&
        detected.zombies !== expected.shouldDetect.incompleteness.zombies) {
      issues.push(
        `Expected ${expected.shouldDetect.incompleteness.zombies} zombies, ` +
        `but LLM detected ${detected.zombies}`
      );
    }
  }

  // Check pattern drift detection
  if (expected.shouldDetect.patternDrift?.mixedTargets) {
    const hasMixedTargets = claimsText.includes('mixed') && claimsText.includes('pattern');
    if (!hasMixedTargets) {
      issues.push('Expected detection of mixed targets in pattern drift');
    }
  }

  // Check security risks detection
  if (expected.shouldDetect.securityRisks) {
    const hasSecurity = claimsText.includes('security') || claimsText.includes('risk');
    if (!hasSecurity) {
      issues.push('Expected detection of security risks');
    }
  }

  // Check refactor patterns detection
  if (expected.shouldDetect.refactorPatterns) {
    let foundPatterns = 0;
    for (const pattern of expected.shouldDetect.refactorPatterns) {
      if (claimsText.includes(pattern.toLowerCase())) {
        foundPatterns++;
      }
    }
    if (foundPatterns === 0) {
      issues.push(`Expected detection of refactor patterns: ${expected.shouldDetect.refactorPatterns.join(', ')}`);
    }
  }

  // Extract metrics
  const allClaims = extractClaims(analysis);
  const requiredClaims = expected.assertions.requiredClaims || [];
  const forbiddenClaims = expected.assertions.forbiddenClaims || [];

  const claimsMissing = requiredClaims.filter(claim =>
    !claimsText.includes(claim.toLowerCase())
  );

  const claimsUnexpected = forbiddenClaims.filter(claim =>
    claimsText.includes(claim.toLowerCase())
  );

  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      healthScore: analysis.metadata.healthScore || 0,
      confidenceAvg: calculateAvgConfidence(analysis),
      claimsFound: allClaims,
      claimsMissing,
      claimsUnexpected
    }
  };
}

/**
 * Validate multiple scenarios and return aggregated results
 */
export function validateScenarios(
  results: Array<{ scenario: string; analysis: LlmAnalysis | null; expected: ExpectedInsights }>
): Array<{ scenario: string; validation: ValidationResult }> {
  return results.map(result => ({
    scenario: result.scenario,
    validation: result.analysis ? validateInsights(result.analysis, result.expected) : {
      passed: false,
      issues: ['No analysis generated'],
      metrics: {
        healthScore: 0,
        confidenceAvg: 0,
        claimsFound: [],
        claimsMissing: [],
        claimsUnexpected: []
      }
    }
  }));
}
