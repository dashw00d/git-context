import { MockScenario, MockDataFactory } from '../dataFactory';

/**
 * Clean Refactor Scenario
 *
 * Perfect refactor with no issues - baseline for comparison
 */
export const cleanRefactor: MockScenario = MockDataFactory.createScenario(
  "Clean Refactor",
  "Perfect refactor with no issues - baseline for comparison",
  [
    MockDataFactory.createCommit(
      "abc123",
      "refactor: Extract user validation logic",
      {
        author: "developer@example.com",
        date: "2024-01-15T10:30:00Z",
        files: [
          MockDataFactory.createFileChange("src/userController.ts", "modified", { additions: 5, deletions: 10 }),
          MockDataFactory.createFileChange("src/validation/userValidator.ts", "added", { additions: 25 }),
          MockDataFactory.createFileChange("src/validation/index.ts", "added", { additions: 5 })
        ],
        symbols: [
          // New validation logic
          MockDataFactory.createSymbol("validateUser", "function", "added", {
            filePath: "src/validation/userValidator.ts",
            lineNumber: 1,
            blastRadius: 5
          }),
          MockDataFactory.createSymbol("UserValidator", "class", "added", {
            filePath: "src/validation/userValidator.ts",
            lineNumber: 10,
            blastRadius: 5
          }),
          // Removed from old location
          MockDataFactory.createSymbol("UserController.validateUser", "method", "removed", {
            filePath: "src/userController.ts",
            lineNumber: 25,
            blastRadius: 3
          })
        ],
        edges: [
          // UserController now uses the new validator
          MockDataFactory.createEdge("UserController.register", "validateUser", "calls"),
          MockDataFactory.createEdge("UserController.login", "validateUser", "calls"),
          // New validator exports
          MockDataFactory.createEdge("UserValidator", "validateUser", "references")
        ],
        risks: ["refactor"],
        blastRadius: 5
      }
    )
  ],
  MockDataFactory.createExpectedInsights(
    {
      incompleteness: { missing: 0, zombies: 0 },
      refactorPatterns: ["extraction"]
    },
    {
      healthScoreRange: [95, 100],
      minConfidence: 0.9,
      requiredClaims: ["clean refactor", "no breaking changes"],
      forbiddenClaims: ["incompleteness", "zombies", "missing"]
    }
  ),
  // Workspace snapshot
  MockDataFactory.createWorkspace(
    ["src/userController.ts", "src/validation/userValidator.ts", "src/validation/index.ts"],
    [
      MockDataFactory.createSymbol("UserController", "class", "modified", {
        filePath: "src/userController.ts",
        blastRadius: 8
      }),
      MockDataFactory.createSymbol("validateUser", "function", "added", {
        filePath: "src/validation/userValidator.ts",
        blastRadius: 5
      }),
      MockDataFactory.createSymbol("UserValidator", "class", "added", {
        filePath: "src/validation/userValidator.ts",
        blastRadius: 5
      })
    ],
    [
      MockDataFactory.createEdge("UserController.register", "validateUser", "calls"),
      MockDataFactory.createEdge("UserController.login", "validateUser", "calls")
    ],
    8
  )
);
