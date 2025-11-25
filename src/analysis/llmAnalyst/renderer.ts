import { LlmAnalysis, AnalysisBlock, AnalysisBlockUtils, EvidenceLink } from './blocks';
import { RefactorBundleFacts } from '../../facts/types';

/**
 * Resolve evidence JSON path to file location
 */
export function resolveEvidencePath(
  evidencePath: string,
  facts: RefactorBundleFacts
): { filePath: string; lineNumber?: number; description: string } | null {
  // Parse JSON path like "findings.incompleteness.missing[0]"
  const pathParts = evidencePath.split('.');
  const arrayMatch = pathParts[pathParts.length - 1].match(/^(\w+)\[(\d+)\]$/);

  if (arrayMatch) {
    const [_, arrayName, index] = arrayMatch;
    const arrayPath = pathParts.slice(0, -1).join('.');

    // Navigate to the array in facts
    let current: any = facts;
    for (const part of arrayPath.split('.')) {
      current = current[part];
      if (!current) return null;
    }

    const item = current[parseInt(index)];
    if (item && item.symbol_id) {
      const filePath = item.symbol_id.split(':')[0];
      // Try to extract line number from location data
      let lineNumber: number | undefined;
      if (item.loc_pre?.start?.line) {
        lineNumber = item.loc_pre.start.line;
      } else if (item.loc_post?.start?.line) {
        lineNumber = item.loc_post.start.line;
      } else if (item.expected?.lastPath) {
        // Try to get from expected state
        lineNumber = undefined;
      }

      return {
        filePath,
        lineNumber,
        description: evidencePath
      };
    }

    // Also check evidence object directly
    if (facts.evidence && facts.evidence[arrayName]) {
      const evidenceArray = facts.evidence[arrayName];
      if (Array.isArray(evidenceArray) && evidenceArray[parseInt(index)]) {
        const evidenceItem = evidenceArray[parseInt(index)];
        if (evidenceItem.symbol_id) {
          const filePath = evidenceItem.symbol_id.split(':')[0];
          return {
            filePath,
            lineNumber: evidenceItem.loc_pre?.start?.line || evidenceItem.loc_post?.start?.line,
            description: evidencePath
          };
        }
      }
    }
  }

  // Try direct path access (e.g., "bundle.shas")
  let current: any = facts;
  for (const part of evidencePath.split('.')) {
    if (current && typeof current === 'object') {
      current = current[part];
    } else {
      return null;
    }
  }

  // If we found something but it's not a symbol, return path info
  if (current !== undefined && current !== null) {
    return {
      filePath: evidencePath, // Use path as file path for non-symbol evidence
      description: evidencePath
    };
  }

  return null;
}

/**
 * Renderer for LLM analysis results
 * Generates interwoven markdown with clickable evidence links
 */
export class AnalysisRenderer {

  /**
   * Render complete analysis to markdown
   */
  renderAnalysis(analysis: LlmAnalysis, facts: RefactorBundleFacts): string {
    let markdown = this.renderHeader(analysis, facts);

    // Add findings sections with stable anchors for navigation
    markdown += this.renderFindingsSections(facts);

    // Filter low-value content before sorting
    const filteredBlocks = this.filterLowValueContent(analysis.blocks);

    // Sort blocks by value score (high-value first)
    const sortedBlocks = this.sortBlocks(filteredBlocks);

    for (const block of sortedBlocks) {
      markdown += this.renderBlock(block, facts);
    }

    markdown += this.renderFooter(analysis);
    return markdown;
  }

  /**
   * Filter out low-value content from blocks
   */
  private filterLowValueContent(blocks: AnalysisBlock[]): AnalysisBlock[] {
    return blocks.map(block => ({
      ...block,
      claims: block.claims.filter(c => 
        c.severity !== 'low' || c.confidence >= 0.8
      ),
      actions: block.actions.filter(a =>
        a.priority !== 'low' || (a.effort === 'xs' && a.risk === 'low')
      )
    })).filter(block => 
      block.claims.length > 0 || block.actions.length > 0
    );
  }

  /**
   * Render findings sections with stable anchors for tree navigation
   * These anchors correspond to bundle category nodes in the tree view
   */
  private renderFindingsSections(facts: RefactorBundleFacts): string {
    let content = `## 🔍 Findings Overview\n\n`;
    content += `This section provides structured findings data for navigation from the Commit Tracker sidebar.\n\n`;

    // Incompleteness section
    if (facts.findings.incompleteness.missing > 0 || facts.findings.incompleteness.zombies > 0) {
      content += `### {#incompleteness} Incompleteness Analysis\n\n`;
      
      if (facts.findings.incompleteness.missing > 0) {
        content += `#### {#incompleteness-missing} Missing Additions (${facts.findings.incompleteness.missing})\n\n`;
        content += `Symbols added in commits but not found in working tree.\n\n`;
        const missing = facts.evidence?.['findings.incompleteness.missing'] || [];
        if (missing.length > 0) {
          content += `**Top ${Math.min(10, missing.length)} missing symbols:**\n\n`;
          missing.slice(0, 10).forEach((item: any, idx: number) => {
            const symbolName = item.symbol_id?.split(':')[1] || item.symbol_id;
            content += `${idx + 1}. \`${symbolName}\` - Expected: ${item.expected?.expect || 'present'}\n`;
          });
          content += `\n`;
        }
      }

      if (facts.findings.incompleteness.zombies > 0) {
        content += `#### {#incompleteness-zombies} Zombie Removals (${facts.findings.incompleteness.zombies})\n\n`;
        content += `Symbols removed in commits but still exist in working tree.\n\n`;
        const zombies = facts.evidence?.['findings.incompleteness.zombies'] || [];
        if (zombies.length > 0) {
          content += `**Top ${Math.min(10, zombies.length)} zombie symbols:**\n\n`;
          zombies.slice(0, 10).forEach((item: any, idx: number) => {
            const symbolName = item.found?.name || item.symbol_id?.split(':')[1] || item.symbol_id;
            content += `${idx + 1}. \`${symbolName}\` - Should be removed\n`;
          });
          content += `\n`;
        }
      }
      content += `\n`;
    }

    // Drift section
    if (facts.findings.patternDrift.mixedTargets > 0 || facts.findings.patternDrift.oldNamespaces > 0) {
      content += `### {#drift} Pattern Drift Analysis\n\n`;
      
      const hotspots = facts.evidence?.['findings.drift.hotspots'] || [];
      if (hotspots.length > 0) {
        content += `#### {#drift-hotspots} Drift Hotspots (${hotspots.length})\n\n`;
        content += `Files with multiple drift issues.\n\n`;
        hotspots.slice(0, 10).forEach((h: any, idx: number) => {
          content += `${idx + 1}. \`${h.path}\` - ${h.drift_count} drift issues\n`;
        });
        content += `\n`;
      }

      if (facts.findings.patternDrift.mixedTargets > 0) {
        content += `#### Mixed Targets (${facts.findings.patternDrift.mixedTargets})\n\n`;
        content += `Inconsistent target usage patterns detected.\n\n`;
      }

      if (facts.findings.patternDrift.oldNamespaces > 0) {
        content += `#### Old Namespaces (${facts.findings.patternDrift.oldNamespaces})\n\n`;
        content += `Using outdated namespace patterns.\n\n`;
      }
      content += `\n`;
    }

    // Convention drift section
    if (facts.findings.patternDrift.conventionDrift) {
      content += this.renderConventionDriftSection(facts);
    }

    // Legacy section
    if (facts.findings.legacyAudit.dead > 0 || facts.findings.legacyAudit.replacedLeftovers.length > 0) {
      content += `### {#legacy} Legacy Audit\n\n`;
      
      if (facts.findings.legacyAudit.dead > 0) {
        content += `#### {#legacy-dead} Dead Code (${facts.findings.legacyAudit.dead})\n\n`;
        content += `Symbols no longer used.\n\n`;
        const dead = facts.evidence?.['findings.legacyAudit.dead'] || [];
        if (dead.length > 0) {
          content += `**Top ${Math.min(20, dead.length)} dead symbols:**\n\n`;
          dead.slice(0, 20).forEach((item: any, idx: number) => {
            const symbolName = item.name || item.symbol_id?.split(':')[1] || item.symbol_id;
            content += `${idx + 1}. \`${symbolName}\` - ${item.kind || 'unknown'}\n`;
          });
          content += `\n`;
        }
      }

      if (facts.findings.legacyAudit.replacedLeftovers.length > 0) {
        content += `#### Replaced Leftovers (${facts.findings.legacyAudit.replacedLeftovers.length})\n\n`;
        content += `Old symbols that should have been removed.\n\n`;
      }
      content += `\n`;
    }

    // Timeline section (if we have commit data)
    if (facts.bundle.shas.length > 0) {
      content += `### {#timeline} Timeline Rewind\n\n`;
      content += `Evolution of changes across ${facts.bundle.shas.length} commit(s).\n\n`;
      content += `**Commits in bundle:**\n\n`;
      facts.bundle.shas.forEach((sha: string, idx: number) => {
        content += `${idx + 1}. \`${sha.substring(0, 8)}\`\n`;
      });
      content += `\n`;
    }

    content += `---\n\n`;
    return content;
  }

  /**
   * Render analysis header with health score
   */
  private renderHeader(analysis: LlmAnalysis, facts: RefactorBundleFacts): string {
    const healthScore = this.calculateHealthScore(facts);
    const healthIndicator = healthScore >= 80 ? '✅' : healthScore >= 60 ? '⚠️' : '🔴';
    
    let header = `# 🤖 LLM Analysis Report\n\n`;
    header += `**Generated:** ${new Date(analysis.metadata.timestamp).toLocaleString()}\n`;
    header += `**Bundle:** ${facts.bundle.shas.length} commits (${facts.bundle.oldestSha.substring(0, 8)}...)\n`;
    header += `**Symbols:** ${facts.working.symbols} analyzed, ${facts.working.edges} relationships\n`;
    header += `**Refactor Health:** ${healthScore.toFixed(0)}/100 ${healthIndicator}\n`;
    header += `**Model:** ${analysis.metadata.model}\n`;
    header += `**Analysis Time:** ${this.formatDuration(analysis.metadata.totalCalls)}\n\n`;

    if (analysis.summary) {
      header += `${analysis.summary}\n\n`;
    }

    return header;
  }

  /**
   * Render analysis footer
   */
  private renderFooter(analysis: LlmAnalysis): string {
    let footer = `---\n\n`;
    footer += `**Analysis Details:** ${analysis.metadata.totalCalls} LLM calls, `;
    footer += `~${analysis.metadata.totalTokens.toLocaleString()} tokens\n`;
    
    // Include health score in footer if available
    if (analysis.metadata.healthScore !== undefined) {
      const healthIndicator = analysis.metadata.healthScore >= 80 ? '✅' : 
                             analysis.metadata.healthScore >= 60 ? '⚠️' : '🔴';
      footer += `**Refactor Health:** ${analysis.metadata.healthScore.toFixed(0)}/100 ${healthIndicator}\n`;
    }
    
    footer += `*Generated by Git Context v2 LLM Analyst*\n`;

    return footer;
  }

  /**
   * Calculate value score for a block based on claims and actions
   * Higher score = higher value/importance
   */
  private calculateBlockValue(block: AnalysisBlock): number {
    let score = 0;

    // Claims value: severity-weighted by confidence
    const severityWeight = { critical: 10, high: 5, medium: 2, low: 1 };
    block.claims.forEach(claim => {
      score += severityWeight[claim.severity] * claim.confidence;
    });

    // Actions value: priority + impact/effort ratio
    const priorityWeight = { urgent: 10, high: 5, medium: 2, low: 1 };
    const effortWeight = { xs: 5, s: 4, m: 3, l: 2, xl: 1 };
    
    block.actions.forEach(action => {
      const impactScore = priorityWeight[action.priority] * effortWeight[action.effort];
      // Prefer low-risk actions (multiply by 1.5 for low risk)
      const riskMultiplier = action.risk === 'low' ? 1.5 : action.risk === 'medium' ? 1.0 : 0.7;
      score += impactScore * riskMultiplier;
    });

    // Bonus for actionable items (has evidence paths)
    const hasActionableClaims = block.claims.some(c => c.evidence.length > 0);
    const hasActionableActions = block.actions.some(a => a.evidence.length > 0);
    if (hasActionableClaims || hasActionableActions) {
      score *= 1.2;
    }

    return score;
  }

  /**
   * Calculate refactor health score (0-100)
   * Higher score = healthier refactor (fewer issues)
   */
  private calculateHealthScore(facts: RefactorBundleFacts): number {
    const totalIssues = 
      facts.findings.incompleteness.missing +
      facts.findings.incompleteness.zombies +
      facts.findings.legacyAudit.dead;
    
    const totalSymbols = facts.working.symbols;
    const issueRate = totalSymbols > 0 ? totalIssues / totalSymbols : 0;
    
    // Base score: 100 = perfect, 0 = terrible
    // Lower issue rate = higher score
    const baseScore = Math.max(0, 100 - (issueRate * 100));
    
    // Penalties for critical issues (missing symbols are most critical)
    const criticalPenalty = facts.findings.incompleteness.missing * 2;
    
    // Additional penalty for high zombie count (indicates incomplete cleanup)
    const zombiePenalty = facts.findings.incompleteness.zombies * 0.5;
    
    return Math.max(0, Math.min(100, baseScore - criticalPenalty - zombiePenalty));
  }

  /**
   * Sort blocks by value score (descending)
   * High-value blocks appear first
   */
  private sortBlocks(blocks: AnalysisBlock[]): AnalysisBlock[] {
    return blocks.sort((a, b) => {
      const valueA = this.calculateBlockValue(a);
      const valueB = this.calculateBlockValue(b);
      
      // Sort by value score (descending)
      if (valueB !== valueA) {
        return valueB - valueA;
      }
      
      // Fallback to confidence within same value tier
      return b.confidence - a.confidence;
    });
  }

  /**
   * Render a single analysis block with value-based prioritization
   */
  private renderBlock(block: AnalysisBlock, facts: RefactorBundleFacts): string {
    const icon = this.getBlockIcon(block.type);
    const valueScore = this.calculateBlockValue(block);
    
    // Show value indicator for high-value blocks
    let content = `## ${icon} ${block.title}`;
    if (valueScore > 20) {
      content += ` ⭐ High Value`;
    }
    content += `\n\n`;

    // Separate critical/high claims from others
    const criticalClaims = block.claims.filter(c => 
      c.severity === 'critical' || c.severity === 'high'
    );
    const otherClaims = block.claims.filter(c => 
      c.severity !== 'critical' && c.severity !== 'high'
    );

    // Render critical findings first
    if (criticalClaims.length > 0) {
      content += `### 🚨 Critical Findings\n\n`;
      content += this.renderClaims(criticalClaims, facts);
    }

    // Render other findings
    if (otherClaims.length > 0) {
      content += `### Other Findings\n\n`;
      content += this.renderClaims(otherClaims, facts);
    }

    // Separate urgent/high actions from others
    const urgentActions = block.actions.filter(a => 
      a.priority === 'urgent' || a.priority === 'high'
    );
    const otherActions = block.actions.filter(a => 
      a.priority !== 'urgent' && a.priority !== 'high'
    );

    // Render immediate actions first
    if (urgentActions.length > 0) {
      content += `### ⚡ Immediate Actions\n\n`;
      content += this.renderActions(urgentActions, facts);
    }

    // Render additional actions
    if (otherActions.length > 0) {
      content += `### 📋 Additional Actions\n\n`;
      content += this.renderActions(otherActions, facts);
    }

    // Add confidence indicator
    if (block.confidence < 0.8) {
      content += `\n⚠️ **Low Confidence:** This analysis has ${(block.confidence * 100).toFixed(0)}% confidence. Verify manually.\n`;
    }

    content += `\n`;
    return content;
  }

  /**
   * Get icon for block type
   */
  private getBlockIcon(type: AnalysisBlock['type']): string {
    switch (type) {
      case 'intent': return '🎯';
      case 'discovery': return '💡';
      case 'drift': return '🔍';
      case 'cleanup': return '🧹';
      case 'summary': return '📊';
      default: return '📝';
    }
  }

  /**
   * Render claims section (sorted by severity, limited evidence)
   */
  private renderClaims(claims: any[], facts: RefactorBundleFacts): string {
    // Sort by severity (critical > high > medium > low) then confidence
    const severityOrder: Record<'critical' | 'high' | 'medium' | 'low', number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const sortedClaims = [...claims].sort((a: any, b: any) => {
      const aSeverity = a.severity as 'critical' | 'high' | 'medium' | 'low';
      const bSeverity = b.severity as 'critical' | 'high' | 'medium' | 'low';
      const severityDiff = severityOrder[bSeverity] - severityOrder[aSeverity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    let content = '';

    for (const claim of sortedClaims) {
      const severityIcon = this.getSeverityIcon(claim.severity);
      content += `- ${severityIcon} **${claim.severity.toUpperCase()}:** ${claim.text}\n`;

      if (claim.confidence < 0.9) {
        content += `  *(confidence: ${(claim.confidence * 100).toFixed(0)}%)*\n`;
      }

      // Render evidence links (limit to top 5)
      if (claim.evidence && claim.evidence.length > 0) {
        const evidenceToShow = claim.evidence.slice(0, 5);
        content += `  **Evidence:**\n`;
        for (const evidence of evidenceToShow) {
          content += `  - ${this.renderEvidenceLink(evidence, facts)}\n`;
        }
        if (claim.evidence.length > 5) {
          content += `  - *...and ${claim.evidence.length - 5} more*\n`;
        }
      }

      content += `\n`;
    }

    return content;
  }

  /**
   * Render actions section (sorted by priority, limited evidence)
   */
  private renderActions(actions: any[], facts: RefactorBundleFacts): string {
    // Sort actions by priority (already sorted by AnalysisBlockUtils.sortActions)
    const sortedActions = AnalysisBlockUtils.sortActions(actions);

    let content = '';

    for (const action of sortedActions) {
      const priorityIcon = this.getPriorityIcon(action.priority);
      const riskIcon = this.getRiskIcon(action.risk);

      content += `- ${priorityIcon} **[${action.priority.toUpperCase()}]** `;
      content += `[${action.effort.toUpperCase()}] ${action.description}\n`;

      if (action.risk !== 'low') {
        content += `  ${riskIcon} **Risk:** ${action.risk}\n`;
      }

      // Show dependencies
      if (action.dependsOn && action.dependsOn.length > 0) {
        content += `  ⏳ **Depends on:** ${action.dependsOn.join(', ')}\n`;
      }

      // Render evidence links (limit to top 5)
      if (action.evidence && action.evidence.length > 0) {
        const evidenceToShow = action.evidence.slice(0, 5);
        content += `  **Evidence:**\n`;
        for (const evidence of evidenceToShow) {
          content += `  - ${this.renderEvidenceLink(evidence, facts)}\n`;
        }
        if (action.evidence.length > 5) {
          content += `  - *...and ${action.evidence.length - 5} more*\n`;
        }
      }

      content += `\n`;
    }

    return content;
  }

  /**
   * Render evidence link with clickable reference
   */
  private renderEvidenceLink(evidence: EvidenceLink, facts: RefactorBundleFacts): string {
    // Create a clickable link format that triggers the openEvidence command
    // Format: [description](command:git-context.openEvidence?encodedArgs)

    const args = {
      path: evidence.path,
      description: evidence.description,
      filePath: evidence.filePath,
      lineNumber: evidence.lineNumber,
      symbolId: evidence.symbolId
    };

    // If we have symbolId but no filePath, try to resolve it
    if (!args.filePath && args.symbolId) {
      args.filePath = AnalysisBlockUtils.extractFilePath(args.symbolId);
    }

    // Try to extract file path from evidence path if not already set
    if (!args.filePath) {
      const parsed = AnalysisBlockUtils.parseEvidencePath(evidence.path);
      if (parsed.filePath) args.filePath = parsed.filePath;
      if (parsed.symbolId && !args.symbolId) args.symbolId = parsed.symbolId;
    }

    // VS Code command URIs require arguments to be a JSON array, URI encoded
    const encodedArgs = encodeURIComponent(JSON.stringify([args]));
    
    // Generate smart link text
    let linkText = evidence.description;
    
    // If description looks like a raw path, generate a better one
    if (this.looksLikeRawPath(evidence.description)) {
      linkText = AnalysisBlockUtils.parseEvidencePathToDescription(evidence.path);
    }

    // Build additional context info
    let extraInfo = '';
    
    // Try to resolve count from facts
    const count = this.resolveEvidenceCount(evidence.path, facts);
    if (count !== null) {
      extraInfo = ` (${count} items)`;
    } else if (evidence.filePath && !linkText.includes(evidence.filePath)) {
      // Only add file info if not already in the link text
      const shortFile = evidence.filePath.split('/').pop() || evidence.filePath;
      extraInfo = ` in ${shortFile}`;
      if (evidence.lineNumber) {
        extraInfo += `:${evidence.lineNumber}`;
      }
    }

    return `[${linkText}${extraInfo}](command:git-context.openEvidence?${encodedArgs})`;
  }

  /**
   * Check if a string looks like a raw JSON path rather than a description
   */
  private looksLikeRawPath(text: string): boolean {
    if (!text) return true;
    // Looks like path if it contains dots with no spaces, or starts with common path prefixes
    return (
      text === 'Example' ||
      /^(findings|intended|working|scope|bundle|evidence|diff|ast|graph)\./.test(text) ||
      /^diff\[/.test(text) ||
      /^ast\[/.test(text) ||
      /^graph\.(nodes|edges)\[/.test(text) ||
      (text.includes('.') && !text.includes(' '))
    );
  }

  /**
   * Resolve evidence count from facts JSON path
   */
  private resolveEvidenceCount(path: string, facts: RefactorBundleFacts): number | null {
    try {
      const parts = path.split('.');
      let current: any = facts;

      for (const part of parts) {
        if (part.includes('[')) {
          // Handle array access like findings.incompleteness.missing
          const arrayMatch = part.match(/^([^[]+)/);
          if (arrayMatch) {
            current = current[arrayMatch[1]];
          }
        } else {
          current = current[part];
        }
      }

      if (Array.isArray(current)) {
        return current.length;
      } else if (typeof current === 'number') {
        return current;
      }
    } catch (error) {
      // Ignore errors in path resolution
    }

    return null;
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get priority icon
   */
  private getPriorityIcon(priority: string): string {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Get risk icon
   */
  private getRiskIcon(risk: string): string {
    switch (risk) {
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '✅';
      default: return '❓';
    }
  }

  /**
   * Format duration (placeholder for now)
   */
  private formatDuration(callCount: number): string {
    // This is a placeholder - in a real implementation we'd track actual timing
    return `~${callCount * 30}s`;
  }

  /**
   * Generate quick stats summary
   */
  static generateQuickStats(analysis: LlmAnalysis, facts: RefactorBundleFacts): string {
    const totalActions = analysis.blocks.reduce((sum, block) => sum + block.actions.length, 0);
    const highPriorityActions = analysis.blocks.reduce((sum, block) =>
      sum + block.actions.filter(a => a.priority === 'high' || a.priority === 'urgent').length, 0);

    let stats = `📊 **Analysis Results:** `;
    stats += `${analysis.blocks.length} analysis sections, `;
    stats += `${totalActions} actions recommended`;

    if (highPriorityActions > 0) {
      stats += ` (${highPriorityActions} high priority)`;
    }

    return stats;
  }

  /**
   * Render convention drift section
   */
  private renderConventionDriftSection(facts: RefactorBundleFacts): string {
    const conventionDrift = facts.findings.patternDrift.conventionDrift;
    if (!conventionDrift) {
      return '';
    }

    let content = `### {#convention-drift} Naming Convention Analysis\n\n`;
    
    content += `**Dominant Convention:** \`${conventionDrift.dominantConvention}\`\n`;
    content += `**Drift:** ${conventionDrift.driftPercent.toFixed(1)}% of symbols use different conventions\n\n`;

    // Show drift symbols with suggestions
    const driftSymbols = facts.evidence?.['findings.patternDrift.conventionDrift']?.driftSymbols || [];
    if (driftSymbols.length > 0) {
      content += `#### Symbols to Migrate (${driftSymbols.length})\n\n`;
      content += `| Current Name | Convention | Suggested Name | Path |\n`;
      content += `|-------------|------------|----------------|------|\n`;
      
      for (const ds of driftSymbols.slice(0, 30)) {
        content += `| \`${ds.name}\` | ${ds.convention} | \`${ds.suggestedName}\` | \`${ds.path}\` |\n`;
      }
      
      if (driftSymbols.length > 30) {
        content += `\n*... and ${driftSymbols.length - 30} more symbols*\n`;
      }
      content += `\n`;
    }

    // Show files with mixed conventions
    const mixedFiles = facts.findings.patternDrift.mixedConventionFiles || 0;
    if (mixedFiles > 0) {
      const mixedFilesList = facts.evidence?.['findings.patternDrift.mixedConventionFiles'] || [];
      content += `#### Files with Mixed Conventions (${mixedFiles})\n\n`;
      content += `Files containing symbols using multiple naming conventions:\n\n`;
      
      for (const file of (mixedFilesList as any[]).slice(0, 15)) {
        const conventions = file.conventions?.join(', ') || 'unknown';
        content += `- \`${file.path}\` - ${conventions} (${file.symbolCount} symbols, ${file.driftPercent.toFixed(1)}% drift)\n`;
      }
      
      if (mixedFilesList.length > 15) {
        content += `\n*... and ${mixedFilesList.length - 15} more files*\n`;
      }
      content += `\n`;
    }

    return content;
  }
}
