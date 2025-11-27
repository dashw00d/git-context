/**
 * Incompleteness Detection Tests
 *
 * Tests detection of missing symbols, zombies, and divergent code
 *
 * TESTING PHILOSOPHY:
 * - DO NOT modify test expectations to make tests pass
 * - If a test fails, fix the pipeline logic in src/facts/driftDetector.ts
 * - Tests use REAL pipeline functions (detectDrift), not mocks
 */

import { MetricTestSuite } from '../framework/metricTestSuite';
import { detectDrift } from '../../../src/facts/driftDetector';
import { IntendedState } from '../../../src/facts/intendedMap';
import { WorkingSnapshot } from '../../../src/facts/workingSnapshot';
import { SymbolContext, EdgeContext } from '../../../src/contracts/llmContext';
import { SymbolFixtures } from '../fixtures/symbols';
import { EdgeFixtures } from '../fixtures/edges';

export const incompletenessTests = new MetricTestSuite({
  name: 'Incompleteness Detection',
  description: 'Tests detection of missing symbols, zombies, and divergent code',
  validator: {
    calculate: async (bundleFacts) => {
      // Transform test data to detectDrift format
      const symbols = bundleFacts.evidence.symbols || [];
      const edges = bundleFacts.evidence.edges || [];
      
      // Build intended map from test expectations
      const intended = new Map<string, IntendedState>();
      const workingSymbols = new Map<string, SymbolContext>();
      const workingSymbolsByFile = new Map<string, SymbolContext[]>();
      
      // Add symbols that should be present (added/modified)
      symbols.filter((s: any) => s.status === 'added' || s.status === 'modified').forEach((s: any) => {
        const key = s.id;
        const symbolContext: SymbolContext = {
          id: 0, // Test ID
          symbol_id: key,
          name: s.id.split('.').pop() || s.id,
          kind: s.type || 'function',
          signature: '',
          loc_pre: s.status === 'modified' ? { start: { line: s.lineNumber || 0, column: 0 }, end: { line: s.lineNumber || 0, column: 0 } } : undefined,
          loc_post: { start: { line: s.lineNumber || 0, column: 0 }, end: { line: s.lineNumber || 0, column: 0 } }
        };
        
        intended.set(key, {
          expect: 'present',
          lastName: s.id.split('.').pop() || s.id,
          lastPath: s.filePath || 'test.ts',
          lastSha: 'test-sha'
        });
        workingSymbols.set(key, symbolContext);
        
        // Add to symbolsByFile
        const filePath = s.filePath || 'test.ts';
        if (!workingSymbolsByFile.has(filePath)) {
          workingSymbolsByFile.set(filePath, []);
        }
        workingSymbolsByFile.get(filePath)!.push(symbolContext);
      });
      
      // Add symbols that should be absent (zombies - removed but still exist)
      symbols.filter((s: any) => s.zombie === true).forEach((s: any) => {
        const key = s.id;
        const symbolContext: SymbolContext = {
          id: 0,
          symbol_id: key,
          name: s.id.split('.').pop() || s.id,
          kind: s.type || 'function',
          signature: '',
          loc_post: { start: { line: s.lineNumber || 0, column: 0 }, end: { line: s.lineNumber || 0, column: 0 } }
        };
        
        intended.set(key, {
          expect: 'absent',
          lastSha: 'test-sha'
        });
        workingSymbols.set(key, symbolContext);
        
        const filePath = s.filePath || 'test.ts';
        if (!workingSymbolsByFile.has(filePath)) {
          workingSymbolsByFile.set(filePath, []);
        }
        workingSymbolsByFile.get(filePath)!.push(symbolContext);
      });
      
      // Build working snapshot
      const working: WorkingSnapshot = {
        symbolsById: workingSymbols,
        symbolsByFile: workingSymbolsByFile,
        edges: edges.map((e: any) => ({
          from: e.from,
          to: e.to,
          type: e.type || 'calls',
          confidence: e.confidence || 1.0
        })) as EdgeContext[],
        analyzedPaths: new Set(Array.from(workingSymbolsByFile.keys()))
      };
      
      // USE REAL PIPELINE FUNCTION
      // Note: detectDrift requires commitShas for edge checking, but we can still use symbol findings
      const driftFindings = detectDrift(intended, working);
      
      // Use real pipeline outputs where available
      const missingSymbolsFromPipeline = driftFindings.missing_symbols.length;
      const divergentSymbolsFromPipeline = driftFindings.divergent_symbols.length;
      
      // For missing dependencies (edges pointing to non-existent symbols), we need custom logic
      // because detectDrift's missing_edges requires database queries with commit SHAs
      const knownSymbolIds = new Set(symbols.map((s: any) => s.id));
      const missingDependencies = new Set<string>();
      for (const edge of edges) {
        if (!knownSymbolIds.has(edge.to)) {
          missingDependencies.add(edge.to);
        }
      }
      
      // Combine pipeline missing_symbols with missing dependencies
      // Pipeline finds symbols expected but not found, we find dependencies that don't exist
      const totalMissingSymbols = missingSymbolsFromPipeline + missingDependencies.size;
      
      // Test-specific metrics (not provided by pipeline)
      const incompleteMigrations = detectIncompleteMigrations(symbols, edges);
      const migrationProgress = symbols.filter((s: any) => s.status === 'added').length / Math.max(1, symbols.length);
      
      const referencedSymbols = new Set<string>();
      edges.forEach((e: any) => referencedSymbols.add(e.to));
      const deadSymbols = symbols.filter((s: any) => !referencedSymbols.has(s.id)).length;
      
      return {
        missingSymbols: totalMissingSymbols,
        zombieSymbols: driftFindings.zombie_symbols.length, // ✅ From pipeline
        divergentSymbols: divergentSymbolsFromPipeline, // ✅ From pipeline
        incompleteMigrations, // Test-specific: migration pattern detection
        migrationProgress, // Test-specific: progress calculation
        deadSymbols, // Test-specific: unreferenced symbols
        suggestedConsolidations: detectSuggestedConsolidations(symbols) // Test-specific: duplicate detection
      };
    }
  }
});

function detectIncompleteMigrations(
  symbols: Array<{ id: string; zombie?: boolean; status: string }>,
  edges: Array<{ from: string; to: string }>
): number {
  const migrationPatterns = [
    { old: 'V1', new: 'V2' },
    { old: 'Legacy', new: 'New' },
    { old: 'Old', new: 'New' }
  ];

  let incompleteCount = 0;

  for (const pattern of migrationPatterns) {
    const oldSymbols = symbols.filter(s =>
      s.id.includes(pattern.old) && s.status === 'modified'
    );
    const newSymbols = symbols.filter(s =>
      s.id.includes(pattern.new) && s.status === 'added'
    );

    if (oldSymbols.length > 0 && newSymbols.length > 0) {
      const stillUsed = oldSymbols.some(oldSym =>
        edges.some((edge: any) => edge.to === oldSym.id)
      );

      if (stillUsed) {
        incompleteCount++;
      }
    }
  }

  return incompleteCount;
}

function detectSuggestedConsolidations(symbols: Array<{ id: string; zombie?: boolean; status: string }>): number {
  const nameGroups = new Map<string, any[]>();

  for (const symbol of symbols) {
    const baseName = symbol.id.toLowerCase().replace(/\d+$/, '').replace(/v\d+$/, '');
    if (!nameGroups.has(baseName)) {
      nameGroups.set(baseName, []);
    }
    nameGroups.get(baseName)!.push(symbol);
  }

  let consolidationCount = 0;
  for (const group of nameGroups.values()) {
    if (group.length > 1) {
      consolidationCount++;
    }
  }

  return consolidationCount;
}

// Test 1: Missing symbol dependencies
incompletenessTests.test({
  name: 'Detects missing symbol dependencies',
  fixture: {
    commits: [
      {
        sha: 'missing-deps',
        symbols: [
          SymbolFixtures.added('PaymentController.process', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('PaymentController.process', 'method')
      ],
      edges: [
        EdgeFixtures.calls('PaymentController.process', 'StripeService.charge'),  // Missing!
        EdgeFixtures.calls('PaymentController.process', 'EmailService.sendReceipt')  // Missing!
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 2,
    zombieSymbols: 0,
    divergentSymbols: 0,
    incompleteMigrations: 0,
    deadSymbols: 1  // PaymentController.process is not referenced by anything
  }
});

// Test 2: Zombie code detection
incompletenessTests.test({
  name: 'Detects zombie code (legacy implementation still exists)',
  fixture: {
    commits: [
      {
        sha: 'zombies',
        symbols: [
          SymbolFixtures.modified('LegacyAuth.login', 'method'),  // Zombie!
          SymbolFixtures.modified('LegacyAuth.logout', 'method'), // Zombie!
          SymbolFixtures.added('AuthV2.login', 'method'),         // New implementation
          SymbolFixtures.added('AuthV2.logout', 'method')         // New implementation
        ]
      }
    ],
    evidence: {
      symbols: [
        { ...SymbolFixtures.modified('LegacyAuth.login', 'method'), zombie: true },
        { ...SymbolFixtures.modified('LegacyAuth.logout', 'method'), zombie: true },
        SymbolFixtures.added('AuthV2.login', 'method'),
        SymbolFixtures.added('AuthV2.logout', 'method')
      ],
      edges: [
        EdgeFixtures.calls('UserController', 'AuthV2.login'),      // Using new
        EdgeFixtures.calls('AdminController', 'LegacyAuth.login')  // Still using old!
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 2,  // LegacyAuth methods marked as zombies
    divergentSymbols: 0,
    incompleteMigrations: 0,
    deadSymbols: 2   // AuthV2 methods not referenced as targets
  }
});

// Test 3: Divergent implementations
incompletenessTests.test({
  name: 'Detects divergent implementations',
  fixture: {
    commits: [
      {
        sha: 'divergent',
        symbols: [
          SymbolFixtures.added('validateUserEmail', 'function'),
          SymbolFixtures.added('checkEmailValid', 'function'),    // Similar functionality!
          SymbolFixtures.added('isEmailOk', 'function')           // Another one!
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('validateUserEmail', 'function'),
        SymbolFixtures.added('checkEmailValid', 'function'),
        SymbolFixtures.added('isEmailOk', 'function')
      ],
      edges: []
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 0,
    divergentSymbols: 3,  // All three email validation functions
    incompleteMigrations: 0,
    deadSymbols: 3,       // None are referenced
    suggestedConsolidations: 1  // One group of similar functions
  }
});

// Test 4: Incomplete migration
incompletenessTests.test({
  name: 'Detects incomplete migrations',
  fixture: {
    commits: [
      {
        sha: 'incomplete-migration',
        symbols: [
          SymbolFixtures.added('AuthV2.login', 'method'),      // New
          SymbolFixtures.added('AuthV2.logout', 'method'),     // New
          SymbolFixtures.modified('AuthV1.login', 'method'),   // Old still exists
          SymbolFixtures.modified('AuthV1.logout', 'method')   // Old still exists
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('AuthV2.login', 'method'),
        SymbolFixtures.added('AuthV2.logout', 'method'),
        SymbolFixtures.modified('AuthV1.login', 'method'),
        SymbolFixtures.modified('AuthV1.logout', 'method')
      ],
      edges: [
        EdgeFixtures.calls('UserController', 'AuthV2.login'),   // Using new
        EdgeFixtures.calls('AdminController', 'AuthV1.login')   // Still using old!
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 0,
    divergentSymbols: 4,  // All auth methods (grouped by base name)
    incompleteMigrations: 1,  // V1 -> V2 migration incomplete
    migrationProgress: 0.5,   // 50% migrated (2 new out of 4 total)
    deadSymbols: 2   // AuthV2 methods not referenced as targets
  }
});

// Test 5: Clean implementation (no incompleteness)
incompletenessTests.test({
  name: 'Handles clean implementations with no issues',
  fixture: {
    commits: [
      {
        sha: 'clean',
        symbols: [
          SymbolFixtures.added('UserService.create', 'method'),
          SymbolFixtures.added('UserService.get', 'method'),
          SymbolFixtures.added('UserService.update', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('UserService.create', 'method'),
        SymbolFixtures.added('UserService.get', 'method'),
        SymbolFixtures.added('UserService.update', 'method')
      ],
      edges: [
        EdgeFixtures.calls('UserController', 'UserService.create'),
        EdgeFixtures.calls('UserController', 'UserService.get'),
        EdgeFixtures.calls('UserController', 'UserService.update')
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 0,
    divergentSymbols: 0,  // No version patterns, no duplicate validation functions
    incompleteMigrations: 0,
    migrationProgress: 1.0,  // All symbols are "new" (added)
    deadSymbols: 0   // All symbols are referenced
  }
});

// Test 6: Dead symbols detection
incompletenessTests.test({
  name: 'Detects dead symbols (defined but never used)',
  fixture: {
    commits: [
      {
        sha: 'dead-code',
        symbols: [
          SymbolFixtures.added('UsedService.doSomething', 'method'),
          SymbolFixtures.added('DeadService.doNothing', 'method'),  // Never used!
          SymbolFixtures.added('OrphanUtil.helper', 'function')      // Never used!
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('UsedService.doSomething', 'method'),
        SymbolFixtures.added('DeadService.doNothing', 'method'),
        SymbolFixtures.added('OrphanUtil.helper', 'function')
      ],
      edges: [
        EdgeFixtures.calls('Controller', 'UsedService.doSomething')  // Only this one used
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 0,
    divergentSymbols: 0,  // Different enough names
    incompleteMigrations: 0,
    deadSymbols: 2,  // DeadService and OrphanUtil not referenced
    suggestedConsolidations: 0
  }
});

// Test 7: Partial migration (some old, some new)
incompletenessTests.test({
  name: 'Detects partial migration progress',
  fixture: {
    commits: [
      {
        sha: 'partial',
        symbols: [
          SymbolFixtures.added('NewSystem.init', 'method'),
          SymbolFixtures.added('NewSystem.process', 'method'),
          SymbolFixtures.modified('OldSystem.init', 'method'),  // Still exists
          SymbolFixtures.modified('OldSystem.process', 'method')  // Still exists
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('NewSystem.init', 'method'),
        SymbolFixtures.added('NewSystem.process', 'method'),
        { ...SymbolFixtures.modified('OldSystem.init', 'method'), zombie: true },
        { ...SymbolFixtures.modified('OldSystem.process', 'method'), zombie: true }
      ],
      edges: [
        EdgeFixtures.calls('Controller1', 'NewSystem.init'),  // Using new
        EdgeFixtures.calls('Controller2', 'OldSystem.init')   // Still using old
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 2,  // OldSystem methods
    divergentSymbols: 0,
    incompleteMigrations: 1,  // Old -> New migration incomplete
    migrationProgress: 0.5,  // 50% migrated (2 new, 2 old)
    deadSymbols: 2  // NewSystem methods not referenced as targets
  }
});

// Test 8: Multiple missing dependencies
incompletenessTests.test({
  name: 'Detects multiple missing dependencies',
  fixture: {
    commits: [
      {
        sha: 'many-missing',
        symbols: [
          SymbolFixtures.added('Service.process', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('Service.process', 'method')
      ],
      edges: [
        EdgeFixtures.calls('Service.process', 'MissingDep1'),
        EdgeFixtures.calls('Service.process', 'MissingDep2'),
        EdgeFixtures.calls('Service.process', 'MissingDep3'),
        EdgeFixtures.calls('Service.process', 'MissingDep4')
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 4,  // All 4 dependencies missing
    zombieSymbols: 0,
    divergentSymbols: 0,
    incompleteMigrations: 0,
    deadSymbols: 1  // Service.process not referenced
  }
});

// Test 9: Complete migration (all new, no old)
incompletenessTests.test({
  name: 'Recognizes complete migration',
  fixture: {
    commits: [
      {
        sha: 'complete',
        symbols: [
          SymbolFixtures.added('NewAuth.login', 'method'),
          SymbolFixtures.added('NewAuth.logout', 'method'),
          SymbolFixtures.added('NewAuth.register', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('NewAuth.login', 'method'),
        SymbolFixtures.added('NewAuth.logout', 'method'),
        SymbolFixtures.added('NewAuth.register', 'method')
      ],
      edges: [
        EdgeFixtures.calls('Controller', 'NewAuth.login'),
        EdgeFixtures.calls('Controller', 'NewAuth.logout'),
        EdgeFixtures.calls('Controller', 'NewAuth.register')
      ]
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 0,
    divergentSymbols: 0,
    incompleteMigrations: 0,
    migrationProgress: 1.0,  // 100% new
    deadSymbols: 0  // All referenced
  }
});

// Test 10: Versioned symbols (V1, V2 pattern)
incompletenessTests.test({
  name: 'Detects versioned symbol patterns',
  fixture: {
    commits: [
      {
        sha: 'versioned',
        symbols: [
          SymbolFixtures.added('APIv1.endpoint', 'method'),
          SymbolFixtures.added('APIv2.endpoint', 'method'),
          SymbolFixtures.added('APIv3.endpoint', 'method')
        ]
      }
    ],
    evidence: {
      symbols: [
        SymbolFixtures.added('APIv1.endpoint', 'method'),
        SymbolFixtures.added('APIv2.endpoint', 'method'),
        SymbolFixtures.added('APIv3.endpoint', 'method')
      ],
      edges: []
    }
  },
  expectedMetrics: {
    missingSymbols: 0,
    zombieSymbols: 0,
    divergentSymbols: 3,  // All have version patterns
    incompleteMigrations: 0,
    deadSymbols: 3,  // None referenced
    suggestedConsolidations: 1  // All grouped together
  }
});
