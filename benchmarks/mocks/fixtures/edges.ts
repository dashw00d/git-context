/**
 * Edge Fixtures for Metric Testing
 *
 * Reusable edge/dependency test data builders
 */

import { MockEdge } from '../dataFactory';

export class EdgeFixtures {

  static calls(from: string, to: string, confidence = 1.0): MockEdge {
    return { from, to, type: 'calls', confidence };
  }

  static implements(from: string, to: string, confidence = 1.0): MockEdge {
    return { from, to, type: 'implements', confidence };
  }

  static inherits(from: string, to: string, confidence = 1.0): MockEdge {
    return { from, to, type: 'inherits', confidence };
  }

  static references(from: string, to: string, confidence = 1.0): MockEdge {
    return { from, to, type: 'references', confidence };
  }

  static imports(from: string, to: string, confidence = 1.0): MockEdge {
    return { from, to, type: 'imports', confidence };
  }

  // Complex dependency patterns
  static dependencyChain(symbols: string[]): MockEdge[] {
    const edges: MockEdge[] = [];
    for (let i = 0; i < symbols.length - 1; i++) {
      edges.push(this.calls(symbols[i], symbols[i + 1]));
    }
    return edges;
  }

  static circularDependency(symbols: string[]): MockEdge[] {
    const edges: MockEdge[] = [];
    for (let i = 0; i < symbols.length; i++) {
      const next = symbols[(i + 1) % symbols.length];
      edges.push(this.calls(symbols[i], next));
    }
    return edges;
  }

  static starPattern(center: string, dependents: string[]): MockEdge[] {
    return dependents.map(dep => this.calls(dep, center));
  }

  static treePattern(root: string, branches: { [parent: string]: string[] }): MockEdge[] {
    const edges: MockEdge[] = [];

    function buildTree(node: string) {
      if (branches[node]) {
        for (const child of branches[node]) {
          edges.push(EdgeFixtures.calls(child, node));
          buildTree(child);
        }
      }
    }

    buildTree(root);
    return edges;
  }

  // Domain-specific patterns
  static authControllerToService(): MockEdge[] {
    return [
      this.calls('UserController.register', 'AuthService.register'),
      this.calls('UserController.login', 'AuthService.authenticate'),
      this.calls('UserController.logout', 'AuthService.logout'),
      this.calls('AdminController.authenticate', 'AuthService.authenticate')
    ];
  }

  static mixedAuthUsage(): MockEdge[] {
    return [
      // New auth system usage
      this.calls('UserController.register', 'AuthV2.register'),
      this.calls('UserController.login', 'AuthV2.authenticate'),
      // Old auth system still used
      this.calls('AdminController.authenticate', 'AuthV1.authenticate'), // Mixed usage!
      this.calls('LegacyController.login', 'AuthV1.authenticate')
    ];
  }

  static paymentProcessing(): MockEdge[] {
    return [
      this.calls('PaymentController.process', 'StripeService.charge'),
      this.calls('PaymentController.process', 'EmailService.sendReceipt'),
      this.calls('PaymentController.process', 'PaymentValidator.validate')
    ];
  }

  // Missing dependencies (edges to non-existent symbols)
  static withMissingDependencies(): MockEdge[] {
    return [
      this.calls('PaymentController.process', 'NonExistentStripeService.charge'),
      this.calls('PaymentController.process', 'MissingEmailService.sendReceipt'),
      this.calls('PaymentController.process', 'AbsentValidator.validate')
    ];
  }
}
