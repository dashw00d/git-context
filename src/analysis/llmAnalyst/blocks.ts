/**
 * Typed structures for LLM analyst output
 * Evidence-linked blocks that can be rendered with clickable references
 */

export interface EvidenceLink {
  /** JSON path in facts (e.g., "findings.legacyAudit.dead[2]") */
  path: string;
  /** Human-readable description */
  description: string;
  /** Optional symbol/file reference for UI linking */
  symbolId?: string;
  /** Optional file path for opening */
  filePath?: string;
  /** Optional line number */
  lineNumber?: number;
}

export interface Claim {
  /** The claim or finding */
  text: string;
  /** Confidence level (0.0-1.0) */
  confidence: number;
  /** Evidence supporting this claim */
  evidence: EvidenceLink[];
  /** Severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Action {
  /** Actionable task description */
  description: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'urgent';
  /** Evidence this action addresses */
  evidence: EvidenceLink[];
  /** Estimated effort (story points or time) */
  effort: 'xs' | 's' | 'm' | 'l' | 'xl';
  /** Risk level of implementing this action */
  risk: 'low' | 'medium' | 'high';
  /** Dependencies on other actions */
  dependsOn?: string[];
}

export interface AnalysisBlock {
  /** Unique identifier for this block */
  id: string;
  /** Human-readable title */
  title: string;
  /** Block type */
  type: 'intent' | 'drift' | 'cleanup' | 'summary' | 'discovery';
  /** Claims made in this block */
  claims: Claim[];
  /** Recommended actions */
  actions: Action[];
  /** Overall confidence in this analysis */
  confidence: number;
  /** When this analysis was generated */
  timestamp: string;
}

export interface LlmAnalysis {
  /** Overall analysis summary */
  summary: string;
  /** Structured analysis blocks */
  blocks: AnalysisBlock[];
  /** Generation metadata */
  metadata: {
    /** Total LLM calls made */
    totalCalls: number;
    /** Total tokens used */
    totalTokens: number;
    /** Model used */
    model: string;
    /** Generation timestamp */
    timestamp: string;
    /** Refactor health score (0-100) */
    healthScore?: number;
    /** Number of validated evidence items */
    validatedEvidenceCount?: number;
  };
  /** Rendered markdown version */
  markdown: string;
}

/**
 * Utility functions for working with analysis blocks
 */
export class AnalysisBlockUtils {
  /**
   * Create a new analysis block
   */
  static createBlock(
    id: string,
    title: string,
    type: AnalysisBlock['type'],
    claims: Claim[] = [],
    actions: Action[] = []
  ): AnalysisBlock {
    return {
      id,
      title,
      type,
      claims,
      actions,
      confidence: 0.8, // Default confidence
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Add a claim to a block
   */
  static addClaim(block: AnalysisBlock, claim: Claim): void {
    block.claims.push(claim);
  }

  /**
   * Add an action to a block
   */
  static addAction(block: AnalysisBlock, action: Action): void {
    block.actions.push(action);
  }

  /**
   * Create an evidence link
   */
  static createEvidence(
    path: string,
    description: string,
    symbolId?: string,
    filePath?: string,
    lineNumber?: number
  ): EvidenceLink {
    return {
      path,
      description,
      symbolId,
      filePath,
      lineNumber
    };
  }

  /**
   * Create an evidence link with auto-generated readable description
   * Parses the evidence path to generate human-readable text
   * @param knownFiles Optional set of known file paths to validate against (prevents hallucinated files)
   */
  static createEvidenceAuto(path: string, context?: string, knownFiles?: Set<string> | string[]): EvidenceLink {
    const description = this.parseEvidencePathToDescription(path, context);
    const parsed = this.parseEvidencePath(path);

    const evidence: EvidenceLink = {
      path,
      description,
      symbolId: parsed.symbolId,
      filePath: parsed.filePath,
      lineNumber: parsed.lineNumber
    };

    // Validate filePath against known files if provided
    if (parsed.filePath && knownFiles) {
      const knownFilesSet = knownFiles instanceof Set ? knownFiles : new Set(knownFiles);
      if (!knownFilesSet.has(parsed.filePath)) {
        // File path not in known files - potentially hallucinated
        return {
          path,
          description: `${description} (validate existence)`,
          symbolId: parsed.symbolId,
          filePath: undefined, // Remove invalid file path
          lineNumber: parsed.lineNumber
        };
      }
    }

    return evidence;
  }

  /**
   * Parse evidence path into human-readable description
   * Handles various path formats:
   * - diff[file.php] (code snippet)
   * - ast[file.php].method_name
   * - graph.nodes[symbol_id]
   * - graph.edges[from -> to]
   * - findings.incompleteness.missing[0]
   */
  static parseEvidencePathToDescription(path: string, context?: string): string {
    if (!path) return context || 'Evidence';

    // Handle diff paths: diff[file.php] (code snippet)
    const diffMatch = path.match(/^diff\[([^\]]+)\]\s*(?:\(([^)]+)\))?/);
    if (diffMatch) {
      const file = diffMatch[1].split('/').pop() || diffMatch[1];
      const snippet = diffMatch[2];
      if (snippet) {
        // Clean up the snippet - show first meaningful part
        const cleanSnippet = snippet.replace(/\s+/g, ' ').trim();
        return `Diff: ${file} - "${cleanSnippet.substring(0, 40)}${cleanSnippet.length > 40 ? '...' : ''}"`;
      }
      return `Diff: ${file}`;
    }

    // Handle AST paths: ast[file.php].method_name
    const astMatch = path.match(/^ast\[([^\]]+)\]\.?(\w+)?/);
    if (astMatch) {
      const file = astMatch[1].split('/').pop() || astMatch[1];
      const symbol = astMatch[2];
      if (symbol) {
        const cleanSymbol = symbol.replace(/^(method_|property_|class_|function_)/, '');
        return `AST: ${cleanSymbol}() in ${file}`;
      }
      return `AST: ${file}`;
    }

    // Handle graph node paths: graph.nodes[symbol_id]
    const nodeMatch = path.match(/^graph\.nodes\[([^\]]+)\]/);
    if (nodeMatch) {
      const symbolId = nodeMatch[1];
      const parts = symbolId.split(':');
      if (parts.length > 1) {
        const file = parts[0].split('/').pop() || parts[0];
        const symbol = parts[1].replace(/^(method_|property_|class_|function_)/, '');
        return `Graph node: ${symbol} in ${file}`;
      }
      return `Graph node: ${symbolId}`;
    }

    // Handle graph edge paths: graph.edges[from -> to]
    const edgeMatch = path.match(/^graph\.edges\[([^\]]+)\]/);
    if (edgeMatch) {
      const edge = edgeMatch[1];
      return `Graph edge: ${edge.replace(/ -> /g, ' → ')}`;
    }

    // Handle JSON paths: findings.incompleteness.missing
    const jsonPathMatch = path.match(/^(findings|intended|working|scope|bundle|evidence)\.(.+)/);
    if (jsonPathMatch) {
      const section = jsonPathMatch[1];
      const subpath = jsonPathMatch[2];

      // Clean up the subpath for display
      const parts = subpath.split('.');
      const lastPart = parts[parts.length - 1].replace(/\[\d+\]$/, '');

      // Generate human-readable names
      const readableNames: Record<string, string> = {
        'incompleteness.missing': 'Missing symbols',
        'incompleteness.zombies': 'Zombie symbols',
        'incompleteness.divergent': 'Divergent symbols',
        'legacyAudit.dead': 'Dead code',
        'legacyAudit.legacyUsed': 'Legacy code still in use',
        'legacyAudit.replacedLeftovers': 'Replaced leftovers',
        'patternDrift.mixedTargets': 'Mixed patterns',
        'patternDrift.oldNamespaces': 'Old namespaces',
        'patternDrift.conventionDrift': 'Naming convention drift',
        'patternDrift.mixedConventionFiles': 'Files with mixed conventions',
        'blastRadius': 'Blast radius',
        'symbols': 'Working symbols',
        'edges': 'Symbol relationships',
        'files': 'Changed files',
        'shas': 'Commit SHAs',
        'present': 'Symbols expected present',
        'absent': 'Symbols expected absent'
      };

      const readableName = readableNames[subpath] ||
        readableNames[parts.slice(-2).join('.')] ||
        lastPart.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');

      return `${readableName}`;
    }

    // Fallback: clean up raw path
    if (context) {
      return context;
    }

    // Try to make the path more readable
    return path
      .replace(/\[/g, ': ')
      .replace(/\]/g, '')
      .replace(/_/g, ' ')
      .replace(/\./g, ' > ')
      .replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  /**
   * Parse evidence path to extract file/symbol info
   */
  static parseEvidencePath(path: string): { filePath?: string; symbolId?: string; lineNumber?: number } {
    const result: { filePath?: string; symbolId?: string; lineNumber?: number } = {};

    // Extract file path from various formats
    const filePatterns = [
      /diff\[([^\]]+)\]/,           // diff[file.php]
      /ast\[([^\]]+)\]/,            // ast[file.php]
      /^([^:]+\.(?:php|ts|js|tsx|jsx)):/, // file.php:symbol
    ];

    for (const pattern of filePatterns) {
      const match = path.match(pattern);
      if (match) {
        result.filePath = match[1];
        break;
      }
    }

    // Extract symbol ID
    const symbolPatterns = [
      /graph\.nodes\[([^\]]+)\]/,   // graph.nodes[symbol_id]
      /([^:]+):(\w+)$/,              // file:symbol
    ];

    for (const pattern of symbolPatterns) {
      const match = path.match(pattern);
      if (match) {
        result.symbolId = match[1];
        break;
      }
    }

    return result;
  }

  /**
   * Extract file path from symbol ID
   */
  static extractFilePath(symbolId: string): string {
    return symbolId.split(':')[0];
  }

  /**
   * Extract symbol name from symbol ID
   */
  static extractSymbolName(symbolId: string): string {
    const parts = symbolId.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : symbolId;
  }

  /**
   * Sort actions by priority and dependencies
   */
  static sortActions(actions: Action[]): Action[] {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    return actions.sort((a, b) => {
      // Sort by priority first
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Then by effort (smaller first)
      const effortOrder = { xs: 0, s: 1, m: 2, l: 3, xl: 4 };
      return effortOrder[a.effort] - effortOrder[b.effort];
    });
  }

  /**
   * Filter blocks by type
   */
  static filterByType(blocks: AnalysisBlock[], type: AnalysisBlock['type']): AnalysisBlock[] {
    return blocks.filter(block => block.type === type);
  }

  /**
   * Get all evidence links from blocks
   */
  static getAllEvidence(blocks: AnalysisBlock[]): EvidenceLink[] {
    const evidence: EvidenceLink[] = [];
    for (const block of blocks) {
      for (const claim of block.claims) {
        evidence.push(...claim.evidence);
      }
      for (const action of block.actions) {
        evidence.push(...action.evidence);
      }
    }
    return evidence;
  }
}
