export interface EvidenceLink {
  path: string;

  description: string;

  symbolId?: string;

  filePath?: string;

  lineNumber?: number;

  origin?: string;
}

export interface Claim {
  text: string;

  confidence: number;

  evidence: EvidenceLink[];

  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface Action {
  description: string;

  priority: 'low' | 'medium' | 'high' | 'urgent';

  evidence: EvidenceLink[];

  effort: 'xs' | 's' | 'm' | 'l' | 'xl';

  risk: 'low' | 'medium' | 'high';

  dependsOn?: string[];
}

export interface AnalysisBlock {
  id: string;

  title: string;

  type: 'intent' | 'drift' | 'cleanup' | 'summary' | 'discovery';

  claims: Claim[];

  actions: Action[];

  confidence: number;

  timestamp: string;
}

export interface LlmAnalysis {
  summary: string;

  blocks: AnalysisBlock[];

  metadata: {
    totalCalls: number;

    totalTokens: number;

    durationMs?: number;

    model: string;

    timestamp: string;

    healthScore?: number;

    validatedEvidenceCount?: number;

    skipped?: boolean;

    reason?: string;
  };

  markdown: string;
}

export class AnalysisBlockUtils {
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
      confidence: 0.8,
      timestamp: new Date().toISOString(),
    };
  }

  static addClaim(block: AnalysisBlock, claim: Claim): void {
    block.claims.push(claim);
  }

  static addAction(block: AnalysisBlock, action: Action): void {
    block.actions.push(action);
  }

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
      lineNumber,
    };
  }

  static createEvidenceAuto(
    path: string,
    context?: string,
    knownFiles?: Set<string> | string[]
  ): EvidenceLink {
    const description = this.parseEvidencePathToDescription(path, context);
    const parsed = this.parseEvidencePath(path);

    const evidence: EvidenceLink = {
      path,
      description,
      symbolId: parsed.symbolId,
      filePath: parsed.filePath,
      lineNumber: parsed.lineNumber,
    };

    if (parsed.filePath && knownFiles) {
      const knownFilesSet = knownFiles instanceof Set ? knownFiles : new Set(knownFiles);
      if (!knownFilesSet.has(parsed.filePath)) {
        return {
          path,
          description: `${description} (validate existence)`,
          symbolId: parsed.symbolId,
          filePath: undefined,
          lineNumber: parsed.lineNumber,
        };
      }
    }

    return evidence;
  }

  static parseEvidencePathToDescription(path: string, context?: string): string {
    if (!path) return context || 'Evidence';

    const diffMatch = path.match(/^diff\[([^\]]+)\]\s*(?:\(([^)]+)\))?/);
    if (diffMatch) {
      const file = diffMatch[1].split('/').pop() || diffMatch[1];
      const snippet = diffMatch[2];
      if (snippet) {
        const cleanSnippet = snippet.replace(/\s+/g, ' ').trim();
        return `Diff: ${file} - "${cleanSnippet.substring(0, 40)}${cleanSnippet.length > 40 ? '...' : ''}"`;
      }
      return `Diff: ${file}`;
    }

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

    const edgeMatch = path.match(/^graph\.edges\[([^\]]+)\]/);
    if (edgeMatch) {
      const edge = edgeMatch[1];
      return `Graph edge: ${edge.replace(/ -> /g, ' → ')}`;
    }

    const jsonPathMatch = path.match(/^(findings|intended|working|scope|bundle|evidence)\.(.+)/);
    if (jsonPathMatch) {
      const section = jsonPathMatch[1];
      const subpath = jsonPathMatch[2];

      const sectionGroups: Record<string, string[]> = {
        findings: ['incompleteness', 'legacy', 'drift'],
        intended: ['symbols', 'edges'],
        working: ['symbols', 'edges'],
        scope: ['files', 'paths'],
        bundle: ['commits', 'shas'],
        evidence: ['claims', 'actions'],
      };

      if (!Object.keys(sectionGroups).includes(section)) {
        return `Unknown section: ${section}`;
      }

      const parts = subpath.split('.');
      const lastPart = parts[parts.length - 1].replace(/\[\d+\]$/, '');

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
        blastRadius: 'Blast radius',
        symbols: 'Working symbols',
        edges: 'Symbol relationships',
        files: 'Changed files',
        shas: 'Commit SHAs',
        present: 'Symbols expected present',
        absent: 'Symbols expected absent',
      };

      const readableName =
        readableNames[subpath] ||
        readableNames[parts.slice(-2).join('.')] ||
        lastPart.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');

      return `${readableName}`;
    }

    if (context) {
      return context;
    }

    return path
      .replace(/\[/g, ': ')
      .replace(/\]/g, '')
      .replace(/_/g, ' ')
      .replace(/\./g, ' > ')
      .replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  static parseEvidencePath(path: string): {
    filePath?: string;
    symbolId?: string;
    lineNumber?: number;
  } {
    const result: { filePath?: string; symbolId?: string; lineNumber?: number } = {};

    const filePatterns = [
      /diff\[([^\]]+)\]/,
      /ast\[([^\]]+)\]/,
      /^([^:]+\.(?:php|ts|js|tsx|jsx)):/,
    ];

    for (const pattern of filePatterns) {
      const match = path.match(pattern);
      if (match) {
        result.filePath = match[1];
        break;
      }
    }

    const symbolPatterns = [/graph\.nodes\[([^\]]+)\]/, /([^:]+):(\w+)$/];

    for (const pattern of symbolPatterns) {
      const match = path.match(pattern);
      if (match) {
        result.symbolId = match[1];
        break;
      }
    }

    return result;
  }

  static extractFilePath(symbolId: string): string {
    return symbolId.split(':')[0];
  }

  static extractSymbolName(symbolId: string): string {
    const parts = symbolId.split(':');
    return parts.length > 1 ? parts[parts.length - 1] : symbolId;
  }

  static sortActions(actions: Action[]): Action[] {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    return actions.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const effortOrder = { xs: 0, s: 1, m: 2, l: 3, xl: 4 };
      return effortOrder[a.effort] - effortOrder[b.effort];
    });
  }

  static filterByType(blocks: AnalysisBlock[], type: AnalysisBlock['type']): AnalysisBlock[] {
    return blocks.filter(block => block.type === type);
  }

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
