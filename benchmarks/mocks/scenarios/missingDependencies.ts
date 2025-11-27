import { MockScenario, MockDataFactory } from '../dataFactory';

/**
 * Missing Dependencies Scenario
 *
 * Code references symbols that don't exist
 */
export const missingDependencies: MockScenario = MockDataFactory.createScenario(
  "Missing Dependencies",
  "Code references symbols that don't exist",
  [
    MockDataFactory.createCommit(
      "ghi789",
      "feat: Add payment processing",
      {
        author: "developer@example.com",
        date: "2024-01-17T09:15:00Z",
        files: [
          MockDataFactory.createFileChange("src/controllers/PaymentController.ts", "added", { additions: 35 })
        ],
        symbols: [
          MockDataFactory.createSymbol("PaymentController.process", "method", "added", {
            filePath: "src/controllers/PaymentController.ts",
            lineNumber: 1,
            blastRadius: 10
          })
        ],
        edges: [
          // References to non-existent symbols (missing dependencies!)
          MockDataFactory.createEdge("PaymentController.process", "StripeService.charge", "calls"),
          MockDataFactory.createEdge("PaymentController.process", "EmailService.sendReceipt", "calls"),
          MockDataFactory.createEdge("PaymentController.process", "PaymentValidator.validate", "calls")
        ],
        risks: ["payment", "breaking-api"],
        blastRadius: 10
      }
    )
  ],
  MockDataFactory.createExpectedInsights(
    {
      incompleteness: { missing: 3, zombies: 0 },  // StripeService, EmailService, PaymentValidator
      securityRisks: ["payment"]
    },
    {
      healthScoreRange: [20, 40],
      minConfidence: 0.9,
      requiredClaims: [
        "missing dependencies",
        "StripeService.charge",
        "EmailService.sendReceipt",
        "PaymentValidator.validate"
      ]
    }
  ),
  // Workspace snapshot - only PaymentController exists
  MockDataFactory.createWorkspace(
    ["src/controllers/PaymentController.ts"],
    [
      MockDataFactory.createSymbol("PaymentController", "class", "added", {
        filePath: "src/controllers/PaymentController.ts",
        blastRadius: 10
      }),
      MockDataFactory.createSymbol("PaymentController.process", "method", "added", {
        filePath: "src/controllers/PaymentController.ts",
        blastRadius: 10
      })
    ],
    [
      // All these edges point to non-existent symbols (missing dependencies)
      MockDataFactory.createEdge("PaymentController.process", "StripeService.charge", "calls"),
      MockDataFactory.createEdge("PaymentController.process", "EmailService.sendReceipt", "calls"),
      MockDataFactory.createEdge("PaymentController.process", "PaymentValidator.validate", "calls")
    ],
    10
  )
);
