/**
 * Risk Detection Tests
 *
 * Tests risk detection logic based on symbol changes and patterns
 *
 * TESTING PHILOSOPHY:
 * - DO NOT modify test expectations to make tests pass
 * - If a test fails, fix the pipeline logic in src/analysis/heuristics.ts
 * - Tests use REAL pipeline functions (RiskDetector), not mocks
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { RiskDetector } from '../../../src/analysis/heuristics';
import { FileChange, SymbolInfo, EdgeInfo } from '../../../src/types';
import { SymbolFixtures } from '../fixtures/symbols';

export const riskDetectionTests = new MetricTestSuite({
  name: 'Risk Detection',
  description: 'Tests risk detection rules based on symbol patterns',
  validator: {
    calculate: async (bundleFacts) => {
      const riskDetector = new RiskDetector();
      
      // Transform test data to pipeline format
      const symbols = bundleFacts.evidence.symbols || [];
      const edges = bundleFacts.evidence.edges || [];
      
      // Convert to FileChange[] (minimal - risk detection doesn't need full file info)
      const files: FileChange[] = [];
      
      // Convert symbols to pipeline format
      const symbolsByStatus = {
        added: symbols.filter((s: any) => s.status === 'added').map(convertToSymbolInfo),
        removed: symbols.filter((s: any) => s.status === 'removed').map(convertToSymbolInfo),
        modified: symbols.filter((s: any) => s.status === 'modified').map((s: any) => ({
          symbol: convertToSymbolInfo(s),
          changeType: 'modified' as const
        }))
      };
      
      // Convert edges to EdgeInfo[]
      const edgesByStatus = {
        added: edges.map(convertToEdgeInfo),
        removed: []
      };
      
      // USE REAL PIPELINE FUNCTION
      const detectedRisks = riskDetector.detectRisks(files, symbolsByStatus, edgesByStatus);
      
      // Transform output to test format
      const riskCategories: Record<string, number> = {};
      detectedRisks.forEach(risk => {
        riskCategories[risk] = (riskCategories[risk] || 0) + 1;
      });
      
      // Test-specific metrics (not provided by pipeline)
      // These are additional metrics for test validation, not part of RiskDetector output
      const highRiskPatterns = ['auth', 'payment', 'security', 'database'];
      const criticalPatterns = ['password', 'token', 'encryption', 'billing'];
      
      return {
        totalRisks: detectedRisks.length, // ✅ From pipeline
        riskCategories, // ✅ Derived from pipeline output
        riskFactors: detectedRisks, // ✅ From pipeline
        highRiskSymbols: symbols.filter((s: any) => // Test-specific: pattern matching
          highRiskPatterns.some(type => s.id.toLowerCase().includes(type))
        ).length,
        criticalRiskSymbols: symbols.filter((s: any) => // Test-specific: pattern matching
          criticalPatterns.some(pattern => s.id.toLowerCase().includes(pattern))
        ).length,
        riskScore: calculateRiskScore(detectedRisks, symbols.length) // Test-specific: scoring algorithm
      };
    }
  }
});

function convertToSymbolInfo(s: any): SymbolInfo {
  return {
    id: s.id,
    dnaId: s.id, // Use id as dnaId for tests
    name: s.id.split('.').pop() || s.id,
    kind: (s.type || 'function') as SymbolInfo['kind'],
    signature: '',
    location: { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } }
  };
}

function convertToEdgeInfo(e: any): EdgeInfo {
  return {
    from: e.from,
    to: e.to,
    type: (e.type || 'calls') as EdgeInfo['type'],
    confidence: e.confidence || 1.0
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
    performance: 4
  };

  let totalWeight = 0;
  for (const risk of risks) {
    totalWeight += riskWeights[risk] || 1;
  }

  // Normalize by symbol count (more symbols = potentially higher risk)
  return Math.min(10, (totalWeight / Math.max(1, totalSymbols / 5)));
}

// Test 1: Auth-related changes
riskDetectionTests.test({
  name: 'Detects authentication risks',
  fixture: {
    commits: [
      {
        sha: 'auth-change',
        symbols: [
          SymbolFixtures.authFunction('login', 'V2'),
          SymbolFixtures.authFunction('logout', 'V2'),
          SymbolFixtures.authFunction('register', 'V2')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.authFunction('login', 'V2'),
        SymbolFixtures.authFunction('logout', 'V2'),
        SymbolFixtures.authFunction('register', 'V2')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 1,
    riskCategories: { auth: 1 },
    riskFactors: ['auth']
  }
});

// Test 2: Payment-related changes
riskDetectionTests.test({
  name: 'Detects payment processing risks',
  fixture: {
    commits: [
      {
        sha: 'payment',
        symbols: [
          SymbolFixtures.serviceMethod('PaymentService', 'charge'),
          SymbolFixtures.serviceMethod('PaymentService', 'refund'),
          SymbolFixtures.validatorFunction('validatePayment')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.serviceMethod('PaymentService', 'charge'),
        SymbolFixtures.serviceMethod('PaymentService', 'refund'),
        SymbolFixtures.validatorFunction('validatePayment')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 1,
    riskCategories: { payment: 1 },
    riskFactors: ['payment']
  }
});

// Test 3: Breaking API changes
riskDetectionTests.test({
  name: 'Detects breaking API changes',
  fixture: {
    commits: [
      {
        sha: 'breaking',
        symbols: [
          SymbolFixtures.removed('OldAPI.method1', 'method'),
          SymbolFixtures.removed('OldAPI.method2', 'method'),
          SymbolFixtures.removed('OldAPI.method3', 'method'),
          SymbolFixtures.removed('OldAPI.method4', 'method')  // More than threshold
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.removed('OldAPI.method1', 'method'),
        SymbolFixtures.removed('OldAPI.method2', 'method'),
        SymbolFixtures.removed('OldAPI.method3', 'method'),
        SymbolFixtures.removed('OldAPI.method4', 'method')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 1,
    riskCategories: { 'breaking-api': 1 },
    riskFactors: ['breaking-api']
  }
});

// Test 4: Security-sensitive changes
riskDetectionTests.test({
  name: 'Detects security-sensitive changes',
  fixture: {
    commits: [
      {
        sha: 'security',
        symbols: [
          SymbolFixtures.added('EncryptionService.encrypt', 'method'),
          SymbolFixtures.added('EncryptionService.decrypt', 'method'),
          SymbolFixtures.modified('TokenManager.validate', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('EncryptionService.encrypt', 'method'),
        SymbolFixtures.added('EncryptionService.decrypt', 'method'),
        SymbolFixtures.modified('TokenManager.validate', 'method')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 1,
    riskCategories: { security: 1 },
    riskFactors: ['security']
  }
});

// Test 5: Multiple risk categories
riskDetectionTests.test({
  name: 'Detects multiple risk categories',
  fixture: {
    commits: [
      {
        sha: 'multi-risk',
        symbols: [
          SymbolFixtures.authFunction('login'),      // auth risk
          SymbolFixtures.serviceMethod('PaymentService', 'charge'),  // payment risk
          SymbolFixtures.added('Database.migrate', 'method'),        // database risk
          SymbolFixtures.added('User.extractProfile', 'method')      // refactor risk
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.authFunction('login'),
        SymbolFixtures.serviceMethod('PaymentService', 'charge'),
        SymbolFixtures.added('Database.migrate', 'method'),
        SymbolFixtures.added('User.extractProfile', 'method')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 4,
    riskCategories: {
      auth: 1,
      payment: 1,
      database: 1,
      refactor: 1
    },
    riskFactors: ['auth', 'payment', 'database', 'refactor']
  }
});

// Test 6: No risks detected
riskDetectionTests.test({
  name: 'Handles low-risk changes',
  fixture: {
    commits: [
      {
        sha: 'low-risk',
        symbols: [
          SymbolFixtures.added('Logger.info', 'method'),
          SymbolFixtures.added('Utils.formatDate', 'function'),
          SymbolFixtures.modified('Config.settings', 'variable')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('Logger.info', 'method'),
        SymbolFixtures.added('Utils.formatDate', 'function'),
        SymbolFixtures.modified('Config.settings', 'variable')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 0,
    riskCategories: {},
    riskFactors: []
  }
});

// Test 7: Critical risk symbols
riskDetectionTests.test({
  name: 'Counts critical risk symbols',
  fixture: {
    commits: [
      {
        sha: 'critical',
        symbols: [
          SymbolFixtures.added('PasswordHasher.hash', 'method'),
          SymbolFixtures.added('TokenGenerator.create', 'method'),
          SymbolFixtures.added('Encryption.aesEncrypt', 'method'),
          SymbolFixtures.added('BillingService.charge', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('PasswordHasher.hash', 'method'),
        SymbolFixtures.added('TokenGenerator.create', 'method'),
        SymbolFixtures.added('Encryption.aesEncrypt', 'method'),
        SymbolFixtures.added('BillingService.charge', 'method')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 3,  // auth (password), security (encryption, token), payment (billing)
    riskCategories: {
      auth: 1,
      security: 1,
      payment: 1
    },
    highRiskSymbols: 4,  // All symbols match high-risk patterns
    criticalRiskSymbols: 3,  // password, token, encryption (but not billing)
    riskScore: 10,  // High risk score due to critical patterns (capped at 10)
    riskFactors: ['auth', 'security', 'payment']
  },
  tolerance: 0.5  // Allow some variation in risk score calculation
});

// Test 8: Database migration risk
riskDetectionTests.test({
  name: 'Detects database migration risks',
  fixture: {
    commits: [
      {
        sha: 'migration',
        symbols: [
          SymbolFixtures.added('Migration001', 'class'),
          SymbolFixtures.added('Migration001.up', 'method'),
          SymbolFixtures.added('Migration001.down', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('Migration001', 'class'),
        SymbolFixtures.added('Migration001.up', 'method'),
        SymbolFixtures.added('Migration001.down', 'method')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 1,
    riskCategories: { 'schema-migration': 1 },
    riskFactors: ['schema-migration']
  }
});

// Test 9: Performance-related changes
riskDetectionTests.test({
  name: 'Detects performance-related changes',
  fixture: {
    commits: [
      {
        sha: 'performance',
        symbols: [
          SymbolFixtures.modified('CacheService', 'class'),
          SymbolFixtures.added('CacheService.optimize', 'method'),
          SymbolFixtures.modified('QueryOptimizer', 'class')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.modified('CacheService', 'class'),
        SymbolFixtures.added('CacheService.optimize', 'method'),
        SymbolFixtures.modified('QueryOptimizer', 'class')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 1,
    riskCategories: { performance: 1 },
    riskFactors: ['performance']
  }
});

// Test 10: Refactor pattern detection
riskDetectionTests.test({
  name: 'Detects refactor patterns',
  fixture: {
    commits: [
      {
        sha: 'refactor',
        symbols: [
          SymbolFixtures.added('UserService.extractValidation', 'method'),
          SymbolFixtures.added('UserService.extractAuth', 'method'),
          SymbolFixtures.removed('UserService.validateAndAuth', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('UserService.extractValidation', 'method'),
        SymbolFixtures.added('UserService.extractAuth', 'method'),
        SymbolFixtures.removed('UserService.validateAndAuth', 'method')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 1,
    riskCategories: { refactor: 1 },
    riskFactors: ['refactor']
  }
});

// Test 11: Mixed low and high risk
riskDetectionTests.test({
  name: 'Distinguishes between low and high risk changes',
  fixture: {
    commits: [
      {
        sha: 'mixed-risk',
        symbols: [
          SymbolFixtures.added('Logger.debug', 'method'),  // Low risk
          SymbolFixtures.added('Utils.helper', 'function'),  // Low risk
          SymbolFixtures.modified('AuthService.login', 'method'),  // High risk
          SymbolFixtures.added('PaymentProcessor.charge', 'method')  // High risk
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('Logger.debug', 'method'),
        SymbolFixtures.added('Utils.helper', 'function'),
        SymbolFixtures.modified('AuthService.login', 'method'),
        SymbolFixtures.added('PaymentProcessor.charge', 'method')
      ]
    }
  },
  expectedMetrics: {
    totalRisks: 2,  // auth, payment
    riskCategories: {
      auth: 1,
      payment: 1
    },
    highRiskSymbols: 2,  // AuthService, PaymentProcessor
    riskFactors: ['auth', 'payment']
  }
});
