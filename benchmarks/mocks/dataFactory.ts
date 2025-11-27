/**
 * Mock Data Factory for LLM Insight Tuning
 *
 * Creates synthetic but realistic commit/symbol data for testing LLM analysis capabilities
 */

export interface MockSymbol {
  id: string;
  type: 'function' | 'method' | 'class' | 'interface' | 'variable' | 'constant' | 'type';
  status: 'added' | 'removed' | 'modified';
  filePath?: string;
  lineNumber?: number;
  blastRadius?: number;
}

export interface MockEdge {
  from: string;
  to: string;
  type: 'calls' | 'inherits' | 'implements' | 'references' | 'imports';
  confidence?: number;
}

export interface MockFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  additions?: number;
  deletions?: number;
}

export interface MockCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
  files: MockFileChange[];
  symbols: MockSymbol[];
  edges: MockEdge[];
  risks: string[];
  blastRadius: number;
}

export interface MockWorkspace {
  files: string[];
  symbols: MockSymbol[];
  edges: MockEdge[];
  blastRadius: number;
}

export interface ExpectedInsights {
  // What we expect the LLM to detect
  shouldDetect: {
    incompleteness?: { missing: number; zombies: number };
    patternDrift?: { mixedTargets: number };
    legacyAudit?: { dead: number };
    securityRisks?: string[];
    refactorPatterns?: string[];
  };
  // Assertions on LLM output
  assertions: {
    healthScoreRange?: [number, number];
    minConfidence?: number;
    requiredClaims?: string[];  // Claims that must appear
    forbiddenClaims?: string[];  // Claims that should NOT appear
  };
}

export interface MockScenario {
  name: string;
  description: string;
  commits: MockCommit[];
  workspace: MockWorkspace | null;
  expectedInsights: ExpectedInsights;
}

/**
 * Factory functions for creating realistic test data
 */
export class MockDataFactory {

  /**
   * Create a basic commit with customizable properties
   */
  static createCommit(
    sha: string,
    message: string,
    options: {
      author?: string;
      date?: string;
      files?: MockFileChange[];
      symbols?: MockSymbol[];
      edges?: MockEdge[];
      risks?: string[];
      blastRadius?: number;
    } = {}
  ): MockCommit {
    return {
      sha,
      message,
      author: options.author || 'test@example.com',
      date: options.date || new Date().toISOString(),
      files: options.files || [],
      symbols: options.symbols || [],
      edges: options.edges || [],
      risks: options.risks || [],
      blastRadius: options.blastRadius || 0
    };
  }

  /**
   * Create a symbol with standard properties
   */
  static createSymbol(
    id: string,
    type: MockSymbol['type'],
    status: MockSymbol['status'],
    options: {
      filePath?: string;
      lineNumber?: number;
      blastRadius?: number;
    } = {}
  ): MockSymbol {
    return {
      id,
      type,
      status,
      filePath: options.filePath,
      lineNumber: options.lineNumber,
      blastRadius: options.blastRadius
    };
  }

  /**
   * Create an edge between symbols
   */
  static createEdge(
    from: string,
    to: string,
    type: MockEdge['type'],
    confidence: number = 1.0
  ): MockEdge {
    return {
      from,
      to,
      type,
      confidence
    };
  }

  /**
   * Create a file change
   */
  static createFileChange(
    path: string,
    status: MockFileChange['status'],
    options: {
      oldPath?: string;
      additions?: number;
      deletions?: number;
    } = {}
  ): MockFileChange {
    return {
      path,
      status,
      oldPath: options.oldPath,
      additions: options.additions,
      deletions: options.deletions
    };
  }

  /**
   * Create a workspace snapshot
   */
  static createWorkspace(
    files: string[],
    symbols: MockSymbol[] = [],
    edges: MockEdge[] = [],
    blastRadius: number = 0
  ): MockWorkspace {
    return {
      files,
      symbols,
      edges,
      blastRadius
    };
  }

  /**
   * Create expected insights for validation
   */
  static createExpectedInsights(
    shouldDetect: ExpectedInsights['shouldDetect'] = {},
    assertions: ExpectedInsights['assertions'] = {}
  ): ExpectedInsights {
    return {
      shouldDetect,
      assertions
    };
  }

  /**
   * Create a complete scenario
   */
  static createScenario(
    name: string,
    description: string,
    commits: MockCommit[],
    expectedInsights: ExpectedInsights,
    workspace: MockWorkspace | null = null
  ): MockScenario {
    return {
      name,
      description,
      commits,
      workspace,
      expectedInsights
    };
  }
}
