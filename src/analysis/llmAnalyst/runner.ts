import * as fs from 'fs';
import * as path from 'path';
import { RefactorBundleFacts } from '../../facts/types';
import { getLLMClient } from '../../llm/openrouter';
import {
  buildTimelineSummary,
  PROMPT_CLEANUP_PLAN,
  PROMPT_DISCOVER,
  PROMPT_DRIFT_VERIFICATION,
  PROMPT_INTENT_AND_STORY,
  PROMPT_PLAN,
  PROMPT_QUANTIFY,
  SYSTEM_PROMPT,
} from '../../llm/prompts';
import { getExtensionConfig, getGitRoot } from '../../utils/config';
import { logError, logInfo, logWarn } from '../../utils/logger';
import { Action, AnalysisBlock, AnalysisBlockUtils, Claim, LlmAnalysis } from './blocks';

/**
 * LLM Analyst - Runs sequential analysis passes over refactor bundle facts
 */
export class LlmAnalyst {
  private client = getLLMClient();
  private llmCallTracker?: (
    purpose: string,
    model?: string,
    tokens?: number,
    duration?: number
  ) => void;
  private maxInputChars: number = 1000000; // Default 1M chars

  setLLMCallTracker(
    tracker: (purpose: string, model?: string, tokens?: number, duration?: number) => void
  ) {
    this.llmCallTracker = tracker;
  }

  /**
   * Run complete analysis pipeline on facts JSON
   */
  async analyze(facts: RefactorBundleFacts, rawFeed?: any): Promise<LlmAnalysis> {
    const startTime = Date.now();
    let totalTokens = 0;
    let totalCalls = 0;

    // Track performance metrics
    const performanceMetrics = {
      startTime,
      endTime: 0,
      duration: 0,
      totalTokens,
      totalCalls,
    };

    // Get config for maxInputChars
    const config = getExtensionConfig();
    this.maxInputChars = (config as any).maxInputChars || 1000000;

    // Build a slimmed payload before size checks to keep prompts lean
    const slimFacts = this.buildSlimFacts(facts);

    // Summarize facts if too large (top 20 symbols by impact, aggregate edges)
    const factsJson = JSON.stringify(slimFacts);
    const factsSize = factsJson.length;
    let processedFacts = slimFacts;

    if (factsSize > this.maxInputChars) {
      logInfo(
        `LLM Analyst: Facts size (${factsSize} chars) exceeds max (${this.maxInputChars}), summarizing...`
      );
      processedFacts = this.summarizeFacts(slimFacts);

      // Check if still too large, apply deep summarization
      if (JSON.stringify(processedFacts).length > this.maxInputChars * 0.8) {
        logInfo('LLM Analyst: Still too large, applying deep summarization...');
        processedFacts = this.deepSummarize(processedFacts);
      }

      const summarizedSize = JSON.stringify(processedFacts).length;
      logInfo(
        `LLM Analyst: Summarized to ${summarizedSize} chars (${(
          (1 - summarizedSize / factsSize) *
          100
        ).toFixed(1)}% reduction)`
      );
    }

    try {
      // Pass 1: Intent & Story Analysis (use summarized facts)
      logInfo('LLM Analyst: Running intent analysis...');
      const intentBlock = await this.analyzeIntent(processedFacts);
      totalCalls++;
      totalTokens += this.estimateTokens(JSON.stringify(processedFacts) + PROMPT_INTENT_AND_STORY);

      // Pass 2: Drift Verification (use summarized facts)
      logInfo('LLM Analyst: Running drift verification...');
      const driftBlock = await this.analyzeDrift(processedFacts);
      totalCalls++;
      totalTokens += this.estimateTokens(
        JSON.stringify(processedFacts) + PROMPT_DRIFT_VERIFICATION
      );

      // Pass 3: Cleanup Plan (use summarized facts)
      logInfo('LLM Analyst: Generating cleanup plan...');
      const cleanupBlock = await this.analyzeCleanup(processedFacts);
      totalCalls++;
      totalTokens += this.estimateTokens(JSON.stringify(processedFacts) + PROMPT_CLEANUP_PLAN);

      // Pass 4: Pattern Discovery (if raw feed provided)
      let discoveryBlock: AnalysisBlock | undefined;
      if (rawFeed) {
        logInfo('LLM Analyst: Running pattern discovery...');
        const discoveryResult = await this.discoverPatterns(rawFeed, processedFacts);
        discoveryBlock = this.createDiscoveryBlock(discoveryResult, facts);
        totalCalls += 3; // Discover, Quantify, Plan
        totalTokens += discoveryResult.metadata.totalTokens;
      }

      // Combine results
      const blocks = [intentBlock, driftBlock, cleanupBlock];
      if (discoveryBlock) {
        blocks.push(discoveryBlock);
      }
      const summary = this.generateSummary(blocks, facts);
      const markdown = this.generateMarkdown(blocks, facts);

      // Calculate performance metrics
      performanceMetrics.endTime = Date.now();
      performanceMetrics.duration = performanceMetrics.endTime - performanceMetrics.startTime;
      performanceMetrics.totalTokens = totalTokens;
      performanceMetrics.totalCalls = totalCalls;

      // Log performance metrics
      logInfo(
        `[LLMAnalyst] Analysis completed in ${performanceMetrics.duration}ms (${totalCalls} calls, ~${totalTokens} tokens)`
      );

      // Calculate health score
      const healthScore = this.calculateHealthScore(facts);

      // Calculate validated evidence count (evidence with valid filePath in scope.files)
      const knownFiles = new Set((facts.evidence['scope.files'] as string[]) || []);
      const validatedEvidenceCount = blocks.reduce((acc, block) => {
        return (
          acc +
          block.claims.reduce((claimAcc, claim) => {
            return (
              claimAcc + claim.evidence.filter(e => e.filePath && knownFiles.has(e.filePath)).length
            );
          }, 0) +
          block.actions.reduce((actionAcc, action) => {
            return (
              actionAcc +
              action.evidence.filter(e => e.filePath && knownFiles.has(e.filePath)).length
            );
          }, 0)
        );
      }, 0);

      return {
        summary,
        blocks,
        markdown,
        metadata: {
          totalCalls,
          totalTokens,
          durationMs: performanceMetrics.duration,
          model: getExtensionConfig().openRouterModel,
          timestamp: new Date().toISOString(),
          healthScore,
          validatedEvidenceCount,
        },
      };
    } catch (error) {
      logError('LLM Analyst failed:', error);

      // Return minimal fallback analysis
      const fallbackBlock = AnalysisBlockUtils.createBlock(
        'error',
        'Analysis Error',
        'summary',
        [
          {
            text: `LLM analysis failed: ${error}`,
            confidence: 0,
            evidence: [],
            severity: 'high',
          },
        ],
        [
          {
            description: 'Retry analysis or check LLM configuration',
            priority: 'high',
            evidence: [],
            effort: 's',
            risk: 'low',
          },
        ]
      );

      // Calculate health score even for error case
      const healthScore = this.calculateHealthScore(facts);

      return {
        summary: `Analysis failed: ${error}`,
        blocks: [fallbackBlock],
        markdown: `# Analysis Error\n\n${error}`,
        metadata: {
          totalCalls: 1,
          totalTokens: 0,
          durationMs: Date.now() - startTime,
          model: 'unknown',
          timestamp: new Date().toISOString(),
          healthScore,
        },
      };
    }
  }

  /**
   * Run the "Churn" pipeline: Discover -> Quantify -> Plan
   * Uses raw AST/diff/graph feed to find emergent patterns
   */
  async discoverPatterns(rawFeed: any, facts: RefactorBundleFacts): Promise<any> {
    const startTime = Date.now();
    let totalTokens = 0;

    try {
      // Get known files from facts for grounding examples
      const knownFiles = (facts.evidence['scope.files'] as string[]) || [];
      const knownFilesList =
        knownFiles.length > 0
          ? `\n\nKNOWN FILES (ONLY use these in examples):\n${JSON.stringify(knownFiles)}\n\n`
          : '\n\n';

      // Turn 1: Discover Patterns
      logInfo('LLM Analyst: Discovering emergent patterns...');

      // Use curated discovery feed if available (efficient), otherwise fallback to raw feed (expensive)
      const discoveryInput = (facts as any).discoveryFeed
        ? `DISCOVERY FEED JSON:\n${JSON.stringify((facts as any).discoveryFeed)}`
        : `RAW FEED JSON:\n${JSON.stringify(rawFeed)}`;

      const discoverPromptTemplate = this.getPrompt('discover', PROMPT_DISCOVER);
      const discoverPrompt = `${SYSTEM_PROMPT}\n\n${discoveryInput}${knownFilesList}${discoverPromptTemplate}`;
      const discovery = await this.callLLM(discoverPrompt, 'discover');
      totalTokens += this.estimateTokens(discoverPrompt);

      // Turn 2: Quantify Impact
      logInfo('LLM Analyst: Quantifying patterns...');
      const quantifyPromptTemplate = this.getPrompt('quantify', PROMPT_QUANTIFY);
      const quantifyPrompt = `${SYSTEM_PROMPT}\n\nDISCOVERED PATTERNS:\n${JSON.stringify(
        discovery
      )}\n\n${quantifyPromptTemplate}`;
      const quantified = await this.callLLM(quantifyPrompt, 'quantify');
      totalTokens += this.estimateTokens(quantifyPrompt);

      // Turn 3: Plan Synthesis
      logInfo('LLM Analyst: Synthesizing fix plan...');
      const planPromptTemplate = this.getPrompt('plan', PROMPT_PLAN);
      const planPrompt = `${SYSTEM_PROMPT}\n\nQUANTIFIED PATTERNS:\n${JSON.stringify(
        quantified
      )}\n\n${planPromptTemplate}`;
      const plan = await this.callLLM(planPrompt, 'plan');
      totalTokens += this.estimateTokens(planPrompt);

      return {
        discovery,
        quantified,
        plan,
        metadata: {
          totalTokens,
          duration: Date.now() - startTime,
          model: getExtensionConfig().openRouterModel,
        },
      };
    } catch (error) {
      logError('Pattern discovery failed:', error);
      return { error: String(error) };
    }
  }

  /**
   * Pass 1: Analyze refactor intent and story
   */
  private async analyzeIntent(facts: RefactorBundleFacts): Promise<AnalysisBlock> {
    const promptTemplate = this.getPrompt('intent', PROMPT_INTENT_AND_STORY);
    const timelineInfo = buildTimelineSummary(facts.bundle.timeline);
    const promptWithTimeline = promptTemplate
      .replace('{timelineSummary}', timelineInfo.summary)
      .replace('{versionCount}', String(timelineInfo.count));
    const prompt = this.buildPrompt(promptWithTimeline, facts);
    const response = await this.callLLM(prompt, 'intent');

    const block = AnalysisBlockUtils.createBlock('intent', 'Refactor Intent & Story', 'intent');

    // Parse the LLM response and extract claims
    const claims = this.parseIntentResponse(response, facts);
    block.claims = claims;

    return block;
  }

  /**
   * Pass 2: Verify drift findings
   */
  private async analyzeDrift(facts: RefactorBundleFacts): Promise<AnalysisBlock> {
    const promptTemplate = this.getPrompt('drift', PROMPT_DRIFT_VERIFICATION);
    const timelineInfo = buildTimelineSummary(facts.bundle.timeline);
    const promptWithTimeline = promptTemplate
      .replace('{timelineSummary}', timelineInfo.summary)
      .replace('{versionCount}', String(timelineInfo.count));
    const prompt = this.buildPrompt(promptWithTimeline, facts);
    const response = await this.callLLM(prompt, 'drift');

    const block = AnalysisBlockUtils.createBlock('drift', 'Drift Verification', 'drift');

    // Parse drift verification response
    const { claims, actions } = this.parseDriftResponse(response, facts);
    block.claims = claims;
    block.actions = actions;

    return block;
  }

  /**
   * Pass 3: Generate cleanup plan
   */
  private async analyzeCleanup(facts: RefactorBundleFacts): Promise<AnalysisBlock> {
    const promptTemplate = this.getPrompt('cleanup', PROMPT_CLEANUP_PLAN);
    const timelineInfo = buildTimelineSummary(facts.bundle.timeline);
    const promptWithTimeline = promptTemplate
      .replace('{timelineSummary}', timelineInfo.summary)
      .replace('{versionCount}', String(timelineInfo.count));
    const prompt = this.buildPrompt(promptWithTimeline, facts);
    const response = await this.callLLM(prompt, 'cleanup');

    const block = AnalysisBlockUtils.createBlock('cleanup', 'Cleanup Plan', 'cleanup');

    // Parse cleanup plan response
    const { claims, actions } = this.parseCleanupResponse(response, facts);
    block.claims = claims;
    block.actions = actions;

    return block;
  }

  /**
   * Convert discovery results into an AnalysisBlock
   */
  private createDiscoveryBlock(discoveryResult: any, facts: RefactorBundleFacts): AnalysisBlock {
    const block = AnalysisBlockUtils.createBlock(
      'discovery',
      'LLM-Driven Pattern Discovery',
      'discovery'
    );

    // Get known files for validation
    const knownFiles = new Set((facts.evidence['scope.files'] as string[]) || []);

    if (discoveryResult.quantified && discoveryResult.quantified.quantified) {
      const patterns = discoveryResult.quantified.quantified;
      block.claims = patterns.map((p: any) => ({
        text: `${p.name}: ${p.desc} (Impact: ${p.impact}, Coverage: ${p.coverage_pct}%)`,
        confidence: 0.9,
        severity: p.impact === 'high' ? 'high' : 'medium',
        evidence: (p.examples || []).map((ex: string) =>
          AnalysisBlockUtils.createEvidenceAuto(ex, `${p.name} example`, knownFiles)
        ),
      }));
    }

    if (discoveryResult.plan && discoveryResult.plan.plan) {
      const plans = discoveryResult.plan.plan;
      block.actions = plans.map((p: any) => ({
        description: `Fix ${p.pattern}: ${p.fixes.length} fixes identified`,
        priority: 'high',
        effort: 'medium',
        risk: 'medium',
        evidence: (p.fixes || [])
          .slice(0, 3)
          .map((fix: any) =>
            AnalysisBlockUtils.createEvidenceAuto(
              fix.file || p.pattern,
              `${fix.before ? `Change: ${fix.before.substring(0, 30)}...` : p.pattern}`
            )
          ),
        dependsOn: [],
      }));
    }

    return block;
  }

  /**
   * Build a complete prompt with system message and facts
   */
  private buildPrompt(userPrompt: string, facts: RefactorBundleFacts): string {
    const factsJson = JSON.stringify(facts, null, 2);
    return `${SYSTEM_PROMPT}\n\nFACTS JSON:\n${factsJson}\n\n${userPrompt}`;
  }

  /**
   * Get prompt from config or fallback to default
   */
  private getPrompt(key: string, defaultPrompt: string): string {
    const config = getExtensionConfig();
    if (config.customPrompts && config.customPrompts[key]) {
      return config.customPrompts[key];
    }
    return defaultPrompt;
  }

  /**
   * Get max tokens from config or fallback to default
   */
  private getMaxTokens(key: string, defaultTokens: number = 4000): number {
    const config = getExtensionConfig();
    if (config.tokensPerStep && config.tokensPerStep[key]) {
      return config.tokensPerStep[key];
    }
    return defaultTokens;
  }

  /**
   * Call the LLM with the prompt
   */
  private async callLLM(prompt: string, stepKey: string = 'default'): Promise<any> {
    const messages = [
      {
        role: 'user' as const,
        content: prompt,
      },
    ];

    const maxTokens = this.getMaxTokens(stepKey);

    // Track LLM call
    const callStart = Date.now();
    const config = getExtensionConfig();
    const model = config.openRouterModel;

    const response = await this.client.complete(messages, {
      temperature: 0.1,
      maxTokens,
    });

    // Track completion
    const duration = Date.now() - callStart;
    if (this.llmCallTracker) {
      this.llmCallTracker(`report-${stepKey}`, model, undefined, duration);
    }

    // Try to parse as JSON first
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response.trim();

      // Try to find JSON object in the response
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const extractedJson = jsonStr.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(extractedJson);
      }

      // If no braces found, try parsing the whole string
      return JSON.parse(jsonStr);
    } catch (error) {
      logWarn(`Failed to parse LLM response as JSON, falling back to string parsing: ${error}`);
      return { raw: response };
    }
  }

  /**
   * Parse intent analysis response
   */
  private parseIntentResponse(response: any, facts: RefactorBundleFacts): any[] {
    const claims = [];

    // If response is parsed JSON
    if (response.claims && Array.isArray(response.claims)) {
      return response.claims.map((claim: any) => ({
        text: claim.text,
        confidence: claim.confidence || 0.8,
        severity: claim.severity || 'medium',
        evidence: (claim.evidence || []).map((path: string) =>
          AnalysisBlockUtils.createEvidenceAuto(path)
        ),
      }));
    }

    // Fallback to existing string matching logic
    if (response.raw) {
      const rawResponse = response.raw.toLowerCase();

      // Look for problem identification
      if (
        rawResponse.includes('problem') ||
        rawResponse.includes('issue') ||
        rawResponse.includes('trying to solve')
      ) {
        claims.push({
          text: 'Refactor addresses specific architectural problems',
          confidence: 0.9,
          evidence: [
            AnalysisBlockUtils.createEvidence(
              'bundle.shas',
              'Bundle contains multiple related commits'
            ),
          ],
          severity: 'medium',
        });
      }

      // Look for scope assessment
      const totalChanges = facts.intended.present + facts.intended.absent;
      if (totalChanges > 50) {
        claims.push({
          text: 'Large-scale refactor affecting many symbols',
          confidence: 0.95,
          evidence: [
            AnalysisBlockUtils.createEvidence('intended', `${totalChanges} symbols affected`),
          ],
          severity: 'high',
        });
      }
    }

    return claims;
  }

  /**
   * Parse drift verification response
   */
  private parseDriftResponse(
    response: any,
    facts: RefactorBundleFacts
  ): { claims: any[]; actions: any[] } {
    const claims = [];
    const actions = [];

    // If response is parsed JSON
    if (response.claims && Array.isArray(response.claims)) {
      claims.push(
        ...response.claims.map((claim: any) => ({
          text: claim.text,
          confidence: claim.confidence || 0.8,
          severity: claim.severity || 'medium',
          evidence: (claim.evidence || []).map((path: string) =>
            AnalysisBlockUtils.createEvidenceAuto(path)
          ),
        }))
      );
    }

    if (response.actions && Array.isArray(response.actions)) {
      actions.push(
        ...response.actions.map((action: any) => ({
          description: action.description,
          priority: action.priority || 'medium',
          effort: action.effort || 'medium',
          risk: action.risk || 'low',
          evidence: (action.evidence || []).map((path: string) =>
            AnalysisBlockUtils.createEvidenceAuto(path)
          ),
          dependsOn: action.dependsOn || [],
        }))
      );
    }

    // Fallback to existing logic if no structured data
    if (claims.length === 0 && actions.length === 0 && response.raw) {
      const rawResponse = response.raw.toLowerCase();

      // Check for incompleteness validation
      if (facts.findings.incompleteness.missing > 0) {
        if (
          rawResponse.includes('real') ||
          rawResponse.includes('valid') ||
          rawResponse.includes('confirmed')
        ) {
          claims.push({
            text: 'Missing symbols are real issues requiring completion',
            confidence: 0.8,
            evidence: [
              AnalysisBlockUtils.createEvidence(
                'findings.incompleteness.missing',
                `${facts.findings.incompleteness.missing} symbols missing`
              ),
            ],
            severity: 'high',
          });

          actions.push({
            description: 'Complete missing symbol implementations',
            priority: 'high',
            evidence: [
              AnalysisBlockUtils.createEvidence(
                'findings.incompleteness.missing',
                'Missing symbols list'
              ),
            ],
            effort: 'l',
            risk: 'medium',
          });
        }
      }

      // Check for zombie validation
      if (facts.findings.incompleteness.zombies > 0) {
        if (rawResponse.includes('should be removed') || rawResponse.includes('obsolete')) {
          actions.push({
            description: 'Remove zombie symbols that are no longer needed',
            priority: 'medium',
            evidence: [
              AnalysisBlockUtils.createEvidence(
                'findings.incompleteness.zombies',
                'Zombie symbols list'
              ),
            ],
            effort: 'm',
            risk: 'low',
          });
        }
      }
    }

    return { claims, actions };
  }

  /**
   * Parse cleanup plan response
   */
  private parseCleanupResponse(
    response: any,
    _facts: RefactorBundleFacts
  ): { claims: any[]; actions: any[] } {
    const claims: any[] = [];
    const actions: any[] = [];

    // If response is parsed JSON
    if (response.actions && Array.isArray(response.actions)) {
      actions.push(
        ...response.actions.map((action: any) => ({
          description: action.description,
          priority: action.priority || 'medium',
          effort: action.effort || 'medium',
          risk: action.risk || 'low',
          evidence: (action.evidence || []).map((path: string) =>
            AnalysisBlockUtils.createEvidenceAuto(path)
          ),
          dependsOn: action.dependsOn || [],
        }))
      );
    }

    // Fallback to existing numbered list parsing
    if (actions.length === 0 && response.raw) {
      const lines = response.raw.split('\n');
      let currentAction: any = null;

      for (const line of lines) {
        // Look for numbered items (1., 2., etc.)
        const numberedMatch = line.match(/^(\d+)\.\s*(.+)/);
        if (numberedMatch) {
          if (currentAction) {
            actions.push(currentAction);
          }

          currentAction = {
            description: numberedMatch[2],
            priority: this.inferPriority(numberedMatch[2]),
            evidence: [],
            effort: this.inferEffort(numberedMatch[2]),
            risk: this.inferRisk(numberedMatch[2]),
          };
        }
        // Look for evidence citations
        else if (currentAction && (line.includes('findings.') || line.includes('legacyAudit.'))) {
          // Extract evidence paths
          const evidenceMatch = line.match(/findings\.[^.]+(?:\[[^\]]+\])?/g);
          if (evidenceMatch) {
            for (const path of evidenceMatch) {
              currentAction.evidence.push(
                AnalysisBlockUtils.createEvidence(path, `Referenced in cleanup plan`)
              );
            }
          }
        }
      }

      if (currentAction) {
        actions.push(currentAction);
      }
    }

    return { claims, actions };
  }

  /**
   * Extract top N claims by severity and confidence
   */
  private extractTopClaims(blocks: AnalysisBlock[], limit: number = 3): Claim[] {
    const allClaims: Claim[] = [];
    blocks.forEach(block => {
      allClaims.push(...block.claims);
    });

    // Filter to critical/high severity or high confidence (>=0.8)
    const valuableClaims = allClaims.filter(
      c => c.severity === 'critical' || c.severity === 'high' || c.confidence >= 0.8
    );

    // Sort by severity (critical > high > medium > low) then confidence
    const severityOrder: Record<'critical' | 'high' | 'medium' | 'low', number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };
    valuableClaims.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    return valuableClaims.slice(0, limit);
  }

  /**
   * Extract top N actions by priority/effort ratio
   */
  private extractTopActions(blocks: AnalysisBlock[], limit: number = 5): Action[] {
    const allActions: Action[] = [];
    blocks.forEach(block => {
      allActions.push(...block.actions);
    });

    // Calculate value score for each action
    const priorityWeight: Record<'urgent' | 'high' | 'medium' | 'low', number> = {
      urgent: 10,
      high: 5,
      medium: 2,
      low: 1,
    };
    const effortWeight: Record<'xs' | 's' | 'm' | 'l' | 'xl', number> = {
      xs: 5,
      s: 4,
      m: 3,
      l: 2,
      xl: 1,
    };

    const scoredActions = allActions.map(action => ({
      action,
      score:
        priorityWeight[action.priority] *
        effortWeight[action.effort] *
        (action.risk === 'low' ? 1.5 : action.risk === 'medium' ? 1.0 : 0.7),
    }));

    // Sort by score (descending)
    scoredActions.sort((a, b) => b.score - a.score);

    return scoredActions.slice(0, limit).map(item => item.action);
  }

  /**
   * Calculate refactor health score (0-100)
   */
  private calculateHealthScore(facts: RefactorBundleFacts): number {
    const totalIssues =
      facts.findings.incompleteness.missing +
      facts.findings.incompleteness.zombies +
      facts.findings.legacyAudit.dead;

    const totalSymbols = facts.working.symbols;
    const issueRate = totalSymbols > 0 ? totalIssues / totalSymbols : 0;

    // Base score: 100 = perfect, 0 = terrible
    const baseScore = Math.max(0, 100 - issueRate * 100);

    // Penalties for critical issues
    const criticalPenalty = facts.findings.incompleteness.missing * 2;
    const zombiePenalty = facts.findings.incompleteness.zombies * 0.5;

    return Math.max(0, Math.min(100, baseScore - criticalPenalty - zombiePenalty));
  }

  /**
   * Generate enhanced executive summary with key insights
   */
  private generateSummary(blocks: AnalysisBlock[], facts: RefactorBundleFacts): string {
    const totalIssues =
      facts.findings.incompleteness.missing +
      facts.findings.incompleteness.zombies +
      facts.findings.incompleteness.divergent +
      facts.findings.legacyAudit.dead;

    // Extract top insights
    const topClaims = this.extractTopClaims(blocks, 3);
    const topActions = this.extractTopActions(blocks, 5);
    const healthScore = this.calculateHealthScore(facts);

    // Calculate high-priority action count
    const highPriorityActions = blocks.reduce(
      (sum, block) =>
        sum + block.actions.filter(a => a.priority === 'high' || a.priority === 'urgent').length,
      0
    );

    let summary = `## Key Insights\n\n`;

    // Most critical finding
    if (topClaims.length > 0) {
      const criticalClaim = topClaims[0];
      summary += `**Most Critical:** ${criticalClaim.text} `;
      summary += `(${criticalClaim.severity} severity, ${(criticalClaim.confidence * 100).toFixed(
        0
      )}% confidence)\n\n`;
    }

    // Top actionable items
    if (topActions.length > 0) {
      summary += `**Immediate Actions:**\n`;
      topActions.forEach((action, i) => {
        summary += `${i + 1}. ${action.description} `;
        summary += `[${action.priority} priority, ${action.effort} effort]\n`;
      });
      summary += `\n`;
    }

    // Refactor health score
    const healthIndicator = healthScore >= 80 ? '✅' : healthScore >= 60 ? '⚠️' : '🔴';
    summary += `**Refactor Health:** ${healthScore.toFixed(0)}/100 ${healthIndicator}\n\n`;

    // Quick stats
    summary += `**Quick Stats:** `;
    summary += `${facts.bundle.shas.length} commits, `;
    summary += `${facts.working.symbols} symbols analyzed, `;
    if (totalIssues === 0) {
      summary += `no issues found`;
    } else {
      summary += `${totalIssues} issues (${highPriorityActions} high-priority actions)`;
    }
    summary += `\n`;

    return summary;
  }

  /**
   * Generate markdown representation
   */
  private generateMarkdown(blocks: AnalysisBlock[], facts: RefactorBundleFacts): string {
    let markdown = `# LLM Analysis Report\n\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    markdown += `**Bundle:** ${facts.bundle.shas.length} commits\n\n`;

    for (const block of blocks) {
      markdown += `## ${block.title}\n\n`;

      if (block.claims.length > 0) {
        markdown += `### Findings\n\n`;
        for (const claim of block.claims) {
          markdown += `- **${claim.severity.toUpperCase()}:** ${
            claim.text
          } (confidence: ${(claim.confidence * 100).toFixed(0)}%)\n`;
          for (const evidence of claim.evidence) {
            markdown += `  - Evidence: \`${evidence.path}\`\n`;
          }
        }
        markdown += `\n`;
      }

      if (block.actions.length > 0) {
        markdown += `### Actions\n\n`;
        const sortedActions = AnalysisBlockUtils.sortActions(block.actions);
        for (const action of sortedActions) {
          markdown += `- **${action.priority.toUpperCase()}** [${action.effort.toUpperCase()}] ${
            action.description
          } (risk: ${action.risk})\n`;
          for (const evidence of action.evidence) {
            markdown += `  - Evidence: \`${evidence.path}\`\n`;
          }
        }
        markdown += `\n`;
      }
    }

    return markdown;
  }

  /**
   * Infer priority from action description
   */
  private inferPriority(description: string): 'low' | 'medium' | 'high' | 'urgent' {
    const lower = description.toLowerCase();
    if (lower.includes('urgent') || lower.includes('critical') || lower.includes('breaking')) {
      return 'urgent';
    }
    if (lower.includes('high') || lower.includes('important') || lower.includes('missing')) {
      return 'high';
    }
    if (lower.includes('medium') || lower.includes('moderate')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Infer effort from action description
   */
  private inferEffort(description: string): 'xs' | 's' | 'm' | 'l' | 'xl' {
    const lower = description.toLowerCase();
    if (lower.includes('complex') || lower.includes('large') || lower.includes('architectural')) {
      return 'xl';
    }
    if (lower.includes('significant') || lower.includes('multiple')) {
      return 'l';
    }
    if (lower.includes('moderate') || lower.includes('several')) {
      return 'm';
    }
    if (lower.includes('simple') || lower.includes('single')) {
      return 's';
    }
    return 'xs';
  }

  /**
   * Infer risk from action description
   */
  private inferRisk(description: string): 'low' | 'medium' | 'high' {
    const lower = description.toLowerCase();
    if (lower.includes('high risk') || lower.includes('dangerous') || lower.includes('breaking')) {
      return 'high';
    }
    if (lower.includes('medium risk') || lower.includes('careful') || lower.includes('complex')) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Summarize facts: top 20 symbols by impact, aggregate edges
   */
  private buildSlimFacts(facts: RefactorBundleFacts): RefactorBundleFacts {
    const caps = {
      hotspots: 50,
      hybridDrifts: 50,
      missing: 50,
      zombies: 50,
      divergent: 50,
      moved: 50,
      hybridFiles: 50,
      discoveryTotal: 30,
    };

    const clone: any = JSON.parse(JSON.stringify(facts));

    const hybridUnstaged = clone.evidence?.['hybrid.unstaged']?.files || [];
    const hybridStaged = clone.evidence?.['hybrid.staged']?.files || [];

    const detectOrigin = (file?: string): string | undefined => {
      if (!file) return undefined;
      if (hybridUnstaged.includes(file)) return 'workspace-unstaged';
      if (hybridStaged.includes(file)) return 'workspace-staged';
      return 'commit';
    };

    const getSnippet = (file?: string, line?: number): string | undefined => {
      if (!file) return undefined;
      try {
        const root = getGitRoot();
        if (!root) return undefined;
        const full = path.join(root, file);
        const content = fs.readFileSync(full, 'utf8');
        const lines = content.split(/\r?\n/);
        const start = Math.max(0, line ? line - 3 : 0);
        const end = Math.min(lines.length, line ? line + 2 : 8);
        return lines.slice(start, end).join('\n').trim();
      } catch {
        return undefined;
      }
    };

    // Remove heavy working evidence
    if (clone.evidence) {
      delete clone.evidence['working.symbols'];
      delete clone.evidence['working.edges'];
    }

    const parseSymbolId = (symbolId?: string) => {
      if (!symbolId) return { file: undefined, symbol: undefined };
      const [file, ...rest] = symbolId.split(':');
      return { file, symbol: rest.join(':') || undefined };
    };

    const normalizeList = (items?: any[], limit?: number) => {
      if (!Array.isArray(items)) return [];
      const seen = new Set<string>();
      const normalized: any[] = [];
      for (const item of items) {
        const parsed = parseSymbolId(item.symbol_id || item.symbolId);
        const key = `${parsed.file}:${parsed.symbol}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const line =
          item.line ||
          item.loc?.start?.line ||
          item.loc_pre?.start?.line ||
          item.loc_post?.start?.line;
        normalized.push({
          ...item,
          file: parsed.file,
          symbol: parsed.symbol,
          origin: item.origin || detectOrigin(parsed.file) || item.origin,
          snippet: getSnippet(parsed.file, line),
          line,
        });
      }
      normalized.sort((a, b) => {
        const fa = a.file || '';
        const fb = b.file || '';
        if (fa === fb) return (a.symbol || '').localeCompare(b.symbol || '');
        return fa.localeCompare(fb);
      });
      return typeof limit === 'number' ? normalized.slice(0, limit) : normalized;
    };

    // Capture hybrid facts summary and drop raw facts (include sample names)
    if (facts.hybridFacts) {
      const hybridFacts = facts.hybridFacts as Record<string, any[]>;
      const fileCounts = Object.entries(hybridFacts).map(([file, list]) => ({
        file,
        count: list.length,
      }));
      fileCounts.sort((a, b) => b.count - a.count);

      const topFiles = fileCounts.slice(0, caps.hybridFiles);
      const totalFacts = fileCounts.reduce((sum, f) => sum + f.count, 0);
      const sampleFacts = topFiles.map(({ file }) => {
        const sample = (hybridFacts[file] || [])
          .slice(0, 3)
          .map((f: any) => f?.name || f?.id || 'unknown');
        return { file, sample };
      });

      clone.hybridSummary = {
        totalFacts,
        fileCount: fileCounts.length,
        topFiles,
        sampleFacts,
      };
      delete clone.hybridFacts;
    }

    // Cap incompleteness evidence arrays
    if (clone.evidence) {
      clone.evidence['findings.incompleteness.missing'] = normalizeList(
        clone.evidence['findings.incompleteness.missing'],
        caps.missing
      );
      clone.evidence['findings.incompleteness.zombies'] = normalizeList(
        clone.evidence['findings.incompleteness.zombies'],
        caps.zombies
      );
      clone.evidence['findings.incompleteness.divergent'] = normalizeList(
        clone.evidence['findings.incompleteness.divergent'],
        caps.divergent
      );
    }

    // Targeted evidence summary for the LLM (keeps only concise lists)
    const evidenceSummary: Record<string, any> = {};
    const take = (key: string, limit: number) =>
      Array.isArray(clone.evidence?.[key]) ? clone.evidence[key].slice(0, limit) : undefined;

    const missing = take('findings.incompleteness.missing', caps.missing);
    const zombies = take('findings.incompleteness.zombies', caps.zombies);
    const divergent = take('findings.incompleteness.divergent', caps.divergent);

    // Process hybrid drifts with snippets
    const hybridDrifts = Array.isArray(clone.findings?.hybridDrifts)
      ? clone.findings.hybridDrifts.slice(0, caps.hybridDrifts).map((d: any) => {
          const file = d.fact?.filePath || d.fact?.path || d.file;
          const line = d.fact?.line || d.line || 0;
          return {
            ...d,
            file,
            name: d.fact?.name || d.fact?.id || d.name,
            origin: detectOrigin(file),
            snippet: getSnippet(file, line),
          };
        })
      : undefined;

    const addDisplayNames = (items?: any[]) =>
      items?.map(item => {
        const parsed = parseSymbolId(item.symbol_id);
        return { ...item, file: parsed.file, symbol: parsed.symbol };
      });

    if (missing?.length) evidenceSummary.missing = addDisplayNames(missing);
    if (zombies?.length) evidenceSummary.zombies = addDisplayNames(zombies);
    if (divergent?.length) evidenceSummary.divergent = addDisplayNames(divergent);
    if (hybridDrifts?.length) {
      evidenceSummary.hybridDrifts = hybridDrifts;
    }
    if (clone.bundle?.movedLineage?.length) {
      evidenceSummary.movedLineage = clone.bundle.movedLineage.map((m: any) => ({
        ...m,
        sourceName: parseSymbolId(m.previousSymbolId).symbol,
        destName: parseSymbolId(m.symbolId).symbol,
      }));
    }
    if (clone.hybridSummary) {
      evidenceSummary.hybridSummary = clone.hybridSummary;
    }

    // Hotspot summaries with snippets
    const hotspotEvidence = (clone.evidence && clone.evidence.hotspots) || [];
    let hotspots: any[] | undefined;
    if (Array.isArray(hotspotEvidence) && hotspotEvidence.length > 0) {
      hotspots = hotspotEvidence.slice(0, caps.hotspots).map((h: any) => {
        const file = h.file || h.path || h.filePath;
        // Try to get a relevant line, e.g. from touchedInVersions or default to 0
        return {
          file,
          hotspotScore: h.hotspotScore || h.churnScore || h.score,
          summary: h.summary || h.note,
          snippet: getSnippet(file, 0),
        };
      });
      evidenceSummary.hotspots = hotspots;
    }

    // Counts for quick triage
    evidenceSummary.counts = {
      missing: missing?.length || 0,
      zombies: zombies?.length || 0,
      divergent: divergent?.length || 0,
      hybridDrifts: hybridDrifts?.length || 0,
      hotspots: hotspots?.length || 0,
      moved: Array.isArray(evidenceSummary.movedLineage) ? evidenceSummary.movedLineage.length : 0,
    };

    if (Object.keys(evidenceSummary).length > 0) {
      clone.evidenceSummary = evidenceSummary;
    }

    // Cap moved lineage if present
    if (Array.isArray(clone.bundle?.movedLineage)) {
      clone.bundle.movedLineage = clone.bundle.movedLineage.slice(0, caps.moved);
    }

    // Record caps applied for transparency in prompts
    clone.llmCapsApplied = caps;

    // Build a curated discovery feed (top items with snippets)
    const discoveryFeed: any[] = [];
    const pushLimited = (items: any[], type: string) => {
      for (const item of items) {
        if (discoveryFeed.length >= caps.discoveryTotal) break;
        discoveryFeed.push({ type, ...item });
      }
    };

    if (missing?.length) pushLimited(missing, 'missing');
    if (zombies?.length) pushLimited(zombies, 'zombie');
    if (divergent?.length) pushLimited(divergent, 'divergent');
    if (hybridDrifts?.length) pushLimited(hybridDrifts, 'hybridDrift');
    if (hotspots?.length) pushLimited(hotspots, 'hotspot');
    if (Array.isArray(evidenceSummary.movedLineage))
      pushLimited(evidenceSummary.movedLineage, 'moved');

    clone.discoveryFeed = discoveryFeed.slice(0, caps.discoveryTotal);

    // Drop raw hybridFacts to keep payload lean
    if (clone.hybridFacts) {
      delete clone.hybridFacts;
    }

    return clone as RefactorBundleFacts;
  }

  /**
   * Summarize facts: top 20 symbols by impact, aggregate edges
   */
  private summarizeFacts(facts: RefactorBundleFacts): RefactorBundleFacts {
    const summarized = { ...facts };

    // Summarize evidence: top 20 symbols by impact
    if (summarized.evidence && Array.isArray(summarized.evidence['working.symbols'])) {
      const symbols = summarized.evidence['working.symbols'] as string[];
      // Take top 20 (or all if less than 20)
      summarized.evidence['working.symbols'] = symbols.slice(0, 20);
    }

    // Aggregate edges: count by type instead of listing all
    if (summarized.evidence && Array.isArray(summarized.evidence['working.edges'])) {
      const edges = summarized.evidence['working.edges'] as string[];
      const edgeCounts = new Map<string, number>();
      for (const edge of edges) {
        const match = edge.match(/\((\w+)\)/);
        const type = match ? match[1] : 'unknown';
        edgeCounts.set(type, (edgeCounts.get(type) || 0) + 1);
      }
      summarized.evidence['working.edges'] = Array.from(edgeCounts.entries()).map(
        ([type, count]) => `${type}: ${count}`
      );
    }

    // Prioritize drifts: Sort by type/severity, keep top 5 per category
    if (summarized.findings.incompleteness) {
      // Note: Using findings instead of drift (refactorBundleFacts structure uses findings.incompleteness)
      // Mapping to the structure expected by the LLM prompts which might look for summarized.drift
      // For now, we modify the arrays in place if they are in evidence or findings

      // We need to handle both 'drift' object if it exists or findings.incompleteness
      const _inc = summarized.findings.incompleteness;
      // We can't easily sort here without more data, but we can slice
      // Assuming the input arrays are already somewhat ordered or we just take first few
    }

    // Enhance Hybrid Facts Preservation
    if (facts.hybridFacts && (facts as any).drift?.hybridDrifts) {
      const drift = (facts as any).drift;
      const hybridDrifts = drift.hybridDrifts.slice(0, 5).map((d: any) => ({
        type: d.type,
        file: d.file?.slice(-30),
        description: d.description?.slice(0, 100) + '...',
      }));

      if (!summarized.hybridSummary) {
        summarized.hybridSummary = {
          totalFacts: 0,
          fileCount: 0,
          topFiles: [],
          sampleFacts: [],
        };
      }
      (summarized.hybridSummary as any).hybridDriftSamples = hybridDrifts;
    }

    // Add Semantic Aggregates and Evidence Snippets
    const evidenceSnippets = {
      drift: this.extractSnippets(
        (facts as any).drift?.unresolved_callers || [],
        3,
        'caller: {name} in {path}:{line}'
      ),
      legacy: this.extractSnippets(
        facts.evidence['findings.legacyAudit']?.dead || [],
        3,
        'Dead: {name} in {path}'
      ),
      hotspots: (facts.evidence.hotspots as any[])
        ?.slice(0, 3)
        .map(h => `Hotspot: ${h.path || h.file} (score: ${h.hotspotScore})`),
    };
    (summarized as any).evidenceSnippets = evidenceSnippets;

    // Truncate large evidence arrays
    const maxEvidenceItems = 50;
    for (const key in summarized.evidence) {
      if (
        Array.isArray(summarized.evidence[key]) &&
        summarized.evidence[key].length > maxEvidenceItems
      ) {
        summarized.evidence[key] = summarized.evidence[key].slice(0, maxEvidenceItems);
      }
    }

    return summarized;
  }

  // Helper: Extract snippets
  private extractSnippets(items: any[], max: number, template: string): string[] {
    if (!items || !Array.isArray(items)) return [];
    return items.slice(0, max).map(item => {
      let str = template;
      Object.keys(item).forEach(key => (str = str.replace(`{${key}}`, item[key] || '')));
      return str.slice(0, 80); // Cap per snippet
    });
  }

  /**
   * Improved token estimation
   * Uses better approximation: ~3.5 chars per token for code, ~4 for text
   */
  private estimateTokens(text: string): number {
    // Count code-like patterns (more tokens per char)
    const codePattern = /[{}();=<>[\]]/g;
    const codeMatches = (text.match(codePattern) || []).length;
    const codeRatio = codeMatches / Math.max(text.length, 1);

    // Adjust chars per token based on code density
    const charsPerToken = codeRatio > 0.1 ? 3.5 : 4.0;
    return Math.ceil(text.length / charsPerToken);
  }

  /**
   * Deep summarization: Keep only summaries + examples, drop arrays
   */
  private deepSummarize(facts: RefactorBundleFacts): RefactorBundleFacts {
    const deep = { ...facts };

    // Keep metrics and summaries, drop raw evidence arrays
    if (deep.evidence) {
      deep.evidence = {
        risks: deep.evidence.risks,
        structuralChangeScore: deep.evidence.structuralChangeScore,
        // Keep only essential arrays capped very low
        'findings.incompleteness': deep.evidence['findings.incompleteness']
          ? (deep.evidence['findings.incompleteness'] as any).slice(0, 10)
          : undefined,
        hotspots: (deep.evidence.hotspots as any[])?.slice(0, 5),
      };
    }

    return deep;
  }
}
