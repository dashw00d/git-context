import { MockScenario, MockDataFactory } from '../dataFactory';

/**
 * Incomplete Refactor Scenario
 *
 * Refactor started but not finished - old code still exists
 */
export const incompleteRefactor: MockScenario = MockDataFactory.createScenario(
  "Incomplete Refactor",
  "Refactor started but not finished - old code still exists",
  [
    MockDataFactory.createCommit(
      "def456",
      "refactor: Start migrating to new auth system",
      {
        author: "developer@example.com",
        date: "2024-01-16T14:20:00Z",
        files: [
          MockDataFactory.createFileChange("src/auth/AuthV2.ts", "added", { additions: 40 }),
          MockDataFactory.createFileChange("src/controllers/UserController.ts", "modified", { additions: 8, deletions: 2 }),
          MockDataFactory.createFileChange("src/controllers/AdminController.ts", "modified", { additions: 3 })
        ],
        symbols: [
          // New auth system - fully implemented
          MockDataFactory.createSymbol("AuthV2.login", "method", "added", {
            filePath: "src/auth/AuthV2.ts",
            lineNumber: 10,
            blastRadius: 15
          }),
          MockDataFactory.createSymbol("AuthV2.logout", "method", "added", {
            filePath: "src/auth/AuthV2.ts",
            lineNumber: 25,
            blastRadius: 15
          }),
          MockDataFactory.createSymbol("AuthV2", "class", "added", {
            filePath: "src/auth/AuthV2.ts",
            lineNumber: 1,
            blastRadius: 20
          }),
          // Old auth still exists (zombie!)
          MockDataFactory.createSymbol("LegacyAuth.login", "method", "modified", {
            filePath: "src/auth/LegacyAuth.ts",
            lineNumber: 15,
            blastRadius: 8
          }),
          MockDataFactory.createSymbol("LegacyAuth.logout", "method", "modified", {
            filePath: "src/auth/LegacyAuth.ts",
            lineNumber: 30,
            blastRadius: 8
          })
        ],
        edges: [
          // UserController now uses new auth
          MockDataFactory.createEdge("UserController.register", "AuthV2.login", "calls"),
          MockDataFactory.createEdge("UserController.logout", "AuthV2.logout", "calls"),
          // AdminController still uses old auth (mixed usage!)
          MockDataFactory.createEdge("AdminController.authenticate", "LegacyAuth.login", "calls"),
          // Old auth system still referenced
          MockDataFactory.createEdge("LegacyAuth", "LegacyAuth.login", "references"),
          MockDataFactory.createEdge("LegacyAuth", "LegacyAuth.logout", "references")
        ],
        risks: ["refactor", "breaking-api"],
        blastRadius: 15
      }
    )
  ],
  MockDataFactory.createExpectedInsights(
    {
      incompleteness: { missing: 0, zombies: 2 },  // LegacyAuth.login, LegacyAuth.logout
      patternDrift: { mixedTargets: 1 }  // AdminController still uses old auth
    },
    {
      healthScoreRange: [40, 60],
      minConfidence: 0.8,
      requiredClaims: [
        "incomplete migration",
        "legacy code still in use",
        "mixed auth patterns"
      ],
      forbiddenClaims: ["clean refactor", "no issues"]
    }
  ),
  // Workspace snapshot showing mixed usage
  MockDataFactory.createWorkspace(
    ["src/auth/AuthV2.ts", "src/auth/LegacyAuth.ts", "src/controllers/UserController.ts", "src/controllers/AdminController.ts"],
    [
      // New auth system
      MockDataFactory.createSymbol("AuthV2", "class", "added", {
        filePath: "src/auth/AuthV2.ts",
        blastRadius: 20
      }),
      MockDataFactory.createSymbol("AuthV2.login", "method", "added", {
        filePath: "src/auth/AuthV2.ts",
        blastRadius: 15
      }),
      MockDataFactory.createSymbol("AuthV2.logout", "method", "added", {
        filePath: "src/auth/AuthV2.ts",
        blastRadius: 15
      }),
      // Legacy system still present (zombies)
      MockDataFactory.createSymbol("LegacyAuth", "class", "modified", {
        filePath: "src/auth/LegacyAuth.ts",
        blastRadius: 8
      }),
      MockDataFactory.createSymbol("LegacyAuth.login", "method", "modified", {
        filePath: "src/auth/LegacyAuth.ts",
        blastRadius: 8
      }),
      MockDataFactory.createSymbol("LegacyAuth.logout", "method", "modified", {
        filePath: "src/auth/LegacyAuth.ts",
        blastRadius: 8
      })
    ],
    [
      // New auth usage
      MockDataFactory.createEdge("UserController.register", "AuthV2.login", "calls"),
      MockDataFactory.createEdge("UserController.logout", "AuthV2.logout", "calls"),
      // Legacy auth still in use (problem!)
      MockDataFactory.createEdge("AdminController.authenticate", "LegacyAuth.login", "calls"),
      MockDataFactory.createEdge("LegacyAuth", "LegacyAuth.login", "references"),
      MockDataFactory.createEdge("LegacyAuth", "LegacyAuth.logout", "references")
    ],
    20
  )
);
