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
