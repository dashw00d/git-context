/**
 * Risk Detector Adapter
 *
 * Adapter for the real RiskDetector from heuristics.ts
 * Converts output to test-friendly format.
 */

export interface RiskMetrics {
  totalRisks: number;
  riskCategories: Record<string, number>;
  highRiskSymbols: number;
  criticalRiskSymbols: number;
  riskScore: number;
  riskFactors: string[];
}

/**
 * Detect risks from symbol data using simplified pattern matching
 * Based on the logic from RiskDetector but adapted for test data
 */
export function detectRisksFromFacts(
  symbols: Array<{ id: string; status: string }>,
  edges: Array<{ from: string; to: string }>
): RiskMetrics {
  const risks: string[] = [];

  // Check for auth-related changes
  const authSymbols = symbols.filter(
    s =>
      s.id.toLowerCase().includes('auth') ||
      s.id.toLowerCase().includes('login') ||
      s.id.toLowerCase().includes('password')
  );
  if (authSymbols.length > 0) {
    risks.push('auth');
  }

  // Check for payment-related changes
  const paymentSymbols = symbols.filter(
    s =>
      s.id.toLowerCase().includes('payment') ||
      s.id.toLowerCase().includes('charge') ||
      s.id.toLowerCase().includes('billing')
  );
  if (paymentSymbols.length > 0) {
    risks.push('payment');
  }

  // Check for breaking API changes (simplified)
  const breakingChanges = symbols.filter(s => s.status === 'removed');
  if (breakingChanges.length > 3) {
    // Arbitrary threshold
    risks.push('breaking-api');
  }

  // Check for security-related changes
  const securitySymbols = symbols.filter(
    s =>
      s.id.toLowerCase().includes('encrypt') ||
      s.id.toLowerCase().includes('decrypt') ||
      s.id.toLowerCase().includes('security') ||
      s.id.toLowerCase().includes('token')
  );
  if (securitySymbols.length > 0) {
    risks.push('security');
  }

  // Check for database changes
  const dbSymbols = symbols.filter(
    s =>
      s.id.toLowerCase().includes('database') ||
      s.id.toLowerCase().includes('db') ||
      s.id.toLowerCase().includes('sql') ||
      s.id.toLowerCase().includes('migration')
  );
  if (dbSymbols.length > 0) {
    risks.push('database');
  }

  // Check for refactors
  const refactorIndicators = symbols.filter(
    s =>
      s.id.toLowerCase().includes('extract') ||
      s.id.toLowerCase().includes('refactor') ||
      s.id.toLowerCase().includes('migrate')
  );
  if (refactorIndicators.length > 0) {
    risks.push('refactor');
  }

  // Calculate metrics
  const riskCategories: Record<string, number> = {};
  risks.forEach(risk => {
    riskCategories[risk] = (riskCategories[risk] || 0) + 1;
  });

  // Count patterns for high-risk and critical-risk symbols
  const highRiskPatterns = ['auth', 'payment', 'security', 'database'];
  const criticalPatterns = ['password', 'token', 'encryption', 'billing'];

  const highRiskSymbols = symbols.filter(s =>
    highRiskPatterns.some(type => s.id.toLowerCase().includes(type))
  ).length;

  const criticalRiskSymbols = symbols.filter(s =>
    criticalPatterns.some(pattern => s.id.toLowerCase().includes(pattern))
  ).length;

  // Calculate risk score
  const riskScore = calculateRiskScore(risks, symbols.length);

  return {
    totalRisks: risks.length,
    riskCategories,
    highRiskSymbols,
    criticalRiskSymbols,
    riskScore,
    riskFactors: risks,
  };
}

function calculateRiskScore(risks: string[], totalSymbols: number): number {
  if (totalSymbols === 0) return 0;

  // Base score from risk categories
  const riskWeights: Record<string, number> = {
    auth: 8,
    payment: 9,
    security: 10,
    database: 7,
    'breaking-api': 6,
    'schema-migration': 7,
    refactor: 3,
    performance: 4,
  };

  let totalWeight = 0;
  for (const risk of risks) {
    totalWeight += riskWeights[risk] || 1;
  }

  // Normalize by symbol count (more symbols = potentially higher risk)
  return Math.min(10, totalWeight / Math.max(1, totalSymbols / 5));
}
