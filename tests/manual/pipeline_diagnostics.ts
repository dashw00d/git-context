import * as fs from 'fs';
import * as path from 'path';

import { BundleStoryEngine } from '../../src/analysis/bundleStoryEngine';
import { CommitIndexer } from '../../src/analysis/commitIndexer';
import { DependencyExtractor } from '../../src/analysis/dependencies';
import { EmbeddingIndexer } from '../../src/analysis/embeddingIndexer';
import { GitOperations } from '../../src/analysis/git';
import { RiskDetector } from '../../src/analysis/heuristics';
import { HotspotDetectorV2 } from '../../src/analysis/hotspotDetector';
import { LlmAnalysis } from '../../src/analysis/llmAnalyst/blocks';
import { LlmAnalyst } from '../../src/analysis/llmAnalyst/runner';
import { MovedBlockDetectorV2 } from '../../src/analysis/movedBlockDetector';
import { runPipeline } from '../../src/analysis/runner/pipelineRunner';
import { PipelineStep } from '../../src/analysis/runner/pipelineTypes';
import { SnapshotManager } from '../../src/analysis/snapshotManager';
import { StructuralDiffManager } from '../../src/analysis/structuralDiffManager';
import { SymbolExtractor } from '../../src/analysis/symbols';
import { WorkspaceIndexer } from '../../src/analysis/workspaceIndexer';
import { RefactorBundleFacts } from '../../src/facts/types';
import { ensureDatabaseInitialized, getDatabaseManager } from '../../src/storage/database';

import { getCstTimelineManager } from '../../src/analysis/cstTimeline';
import { createBundleFactsStep } from '../../src/analysis/runner/steps/bundleFactsStep';
import { createDriftStep } from '../../src/analysis/runner/steps/driftStep';
import { createEmbeddingStep } from '../../src/analysis/runner/steps/embeddingStep';
import { createHistoryRetrievalStep } from '../../src/analysis/runner/steps/historyStep';
import { createHotspotStep } from '../../src/analysis/runner/steps/hotspotStep';
import { createIndexCommitsStep } from '../../src/analysis/runner/steps/indexCommitsStep';
import { createIntendedStep } from '../../src/analysis/runner/steps/intendedStep';
import { createLegacyStep } from '../../src/analysis/runner/steps/legacyStep';
import { createMovedBlockStep } from '../../src/analysis/runner/steps/movedBlockStep';
import { createScopeStep } from '../../src/analysis/runner/steps/scopeStep';
import { createStoryStep } from '../../src/analysis/runner/steps/storyStep';
import { createWorkingStep } from '../../src/analysis/runner/steps/workingStep';
import { createWorkspaceOverlayStep } from '../../src/analysis/runner/steps/workspaceStep';

import {
  applySnapshotToState,
  deepSerializeStepState,
  loadStepSnapshot,
  saveStepSnapshot,
  serializeStepState,
  stableHash,
} from './mocks/framework/snapshot';

import { Command } from 'commander';

type CliOptions = {
  commitCount: number;
  includeWorkspace: boolean;
  resetDb: boolean;
  snapshotDir: string;
  freeze: boolean;
  replayStep?: string;
  replayFrom?: string;
  validateTimeline?: boolean;
  noIsolate?: boolean;
  realLlm?: boolean;
  program?: any;
  noSnapshotCache?: boolean;
  noEmbeddings?: boolean;
  enableCst?: boolean;
  enableAugment?: boolean;
  testHybrid?: boolean;
  fullReport?: boolean;
  focusSteps?: Set<string>;
};

function parseArgs(args: string[]): CliOptions {
  const program = new Command();
  program
    .option('-c, --commit-count <number>', 'Number of commits to analyze', '3')
    .option('-w, --include-workspace', 'Include workspace changes', true)
    .option('-r, --reset-db', 'Reset database before run', false)
    .option(
      '-s, --snapshot-dir <path>',
      'Directory to save/load snapshots',
      './benchmarks/snapshots'
    )
    .option('-f, --freeze', 'Freeze intermediate states to disk', false)
    .option('--replay-step <stepId>', 'Replay a specific step from frozen state')
    .option('--replay-from <stepId>', 'Replay pipeline starting from a specific step')
    .option('--validate-timeline', 'Validate hybrid facts database consistency')
    .option('--no-isolate', 'Do not isolate analysis to /src (analyze all files)')
    .option('--real-llm', 'Use real LLM calls instead of capturing prompts (costs money!)')
    .option('--no-snapshot-cache', 'Disable snapshot caching')
    .option('--no-embeddings', 'Disable embedding generation')
    .option('--no-cst', 'Disable CST')
    .option('--no-augment', 'Disable augmentation')
    .option('--test-hybrid', 'Test hybrid mode')
    .option('--full-report', 'Generate full report');

  program.parse(process.argv);
  const opts = program.opts();

  return {
    commitCount: parseInt(opts.commitCount),
    includeWorkspace: opts.includeWorkspace !== false,
    resetDb: opts.resetDb || false,
    snapshotDir: opts.snapshotDir,
    freeze: opts.freeze || false,
    replayStep: opts.replayStep,
    replayFrom: opts.replayFrom,
    validateTimeline: opts.validateTimeline || false,
    noIsolate: opts.isolate === false,
    realLlm: opts.realLlm || false,
    noSnapshotCache: opts.snapshotCache === false,
    noEmbeddings: opts.embeddings === false,
    enableCst: opts.cst !== false,
    enableAugment: opts.augment !== false,
    testHybrid: opts.testHybrid || false,
    fullReport: opts.fullReport || false,
    program,
  };
}

function summarizeStep(stepId: string, data: any): string {
  if (!data) return '';
  switch (stepId) {
    case 'scope':
      return `files=${(data.commitFiles || []).length}, working=${
        (data.workingChanged || []).length
      }, blast=${(data.blastRadius || []).length}`;
    case 'intended':
      return `symbols=${data.length}, present=${
        data.filter((i: any) => i.expect === 'present').length
      }, absent=${
        data.filter((i: any) => i.expect === 'absent').length
      }, renamed=${data.filter((i: any) => i.isRenamed).length}`;
    case 'working':
      return `symbols=${(data.symbols || []).length}, edges=${
        (data.edges || []).length
      }, paths=${(data.analyzedPaths || []).length}`;
    case 'drift':
      const hybridCount = data.hybridDrifts?.length || 0;
      return `missing=${data.missing_symbols?.length || 0}, zombies=${
        data.zombie_symbols?.length || 0
      }, divergent=${data.divergent_symbols?.length || 0}, hybrid=${hybridCount}`;
    case 'legacy':
      return `dead=${data.dead?.length || 0}, legacyUsed=${
        data.legacyUsed?.length || 0
      }, leftovers=${data.replacedLeftovers?.length || 0}`;
    case 'workspace_overlay':
      if (data && typeof data === 'object' && ('staged' in data || 'unstaged' in data)) {
        const staged = data.staged || {};
        const unstaged = data.unstaged || {};

        return `staged: files=${staged.filesChanged || 0}, symbols=${
          (staged.symbolsAdded || 0) + (staged.symbolsModified || 0) + (staged.symbolsRemoved || 0)
        } | unstaged: files=${unstaged.filesChanged || 0}, symbols=${
          (unstaged.symbolsAdded || 0) +
          (unstaged.symbolsModified || 0) +
          (unstaged.symbolsRemoved || 0)
        }`;
      }

      return `files=${data.filesChanged || 0}, symbols=${
        (data.symbolsAdded || 0) + (data.symbolsModified || 0) + (data.symbolsRemoved || 0)
      }`;
    case 'index_commits':
      return `commits=${data.length || 0}`;
    case 'bundle_facts':
      const hybridFactsCount = data.hybridFacts
        ? Object.keys(data.hybridFacts).reduce(
            (sum, key) => sum + (data.hybridFacts[key]?.length || 0),
            0
          )
        : 0;
      const hybridFilesCount = data.hybridFacts ? Object.keys(data.hybridFacts).length : 0;
      return `intended.present=${data.intended?.present || 0}, absent=${
        data.intended?.absent || 0
      }, renamed=${
        data.intended?.renamed || 0
      }, hybridFacts=${hybridFactsCount} (${hybridFilesCount} files)`;
    case 'embedding_index':
      if (!data) return '';
      return data.skipped
        ? `skipped (${data.reason || 'n/a'})`
        : `commits=${data.commitCount || 0}, commitShards=${
            data.commitShardCount || 0
          }, symbolShards=${data.symbolShardCount || 0}, themeShards=${data.themeShardCount || 0}`;
    case 'hotspots':
      if (Array.isArray(data)) {
        const totalChurn = data.reduce(
          (sum: number, h: any) => sum + (h.hotspotScore || h.churnScore || h.dnaChurn || 0),
          0
        );
        return `topHotspots=${data.length}, totalChurn=${totalChurn.toFixed(1)}`;
      }
      return 'topHotspots=0, totalChurn=0';
    case 'moved_blocks':
      if (Array.isArray(data)) {
        return `totalMoves=${data.length}`;
      }
      return 'totalMoves=0';
    case 'retrieve_history':
      if (!data) return '';
      return data.skipped
        ? `skipped (${data.reason || 'n/a'})`
        : `similarCommits=${data.similarCommits || 0}, similarSymbols=${
            data.similarSymbols || 0
          }, relatedRefactors=${data.relatedRefactors || 0}`;
    case 'llm_story':
      if (!data) return '';
      return data.skipped
        ? `skipped (${data.reason || 'n/a'})`
        : `tokens=${data.totalTokens || 0}, calls=${
            data.totalCalls || 0
          }, health=${data.healthScore ?? 'n/a'}`;
    default:
      return '';
  }
}

/**
 * Extract structured metrics from deep-serialized step data
 */
function extractStepMetrics(stepId: string, data: any): Record<string, any> {
  if (!data) return {};

  switch (stepId) {
    case 'index_commits':
      if (Array.isArray(data)) {
        const metrics = {
          commitCount: data.length,
          totalSymbols: data.reduce(
            (sum: number, c: any) =>
              sum + ((c.symbolsAdded || 0) + (c.symbolsModified || 0) + (c.symbolsRemoved || 0)),
            0
          ),
          totalEdges: data.reduce(
            (sum: number, c: any) => sum + ((c.edgesAdded || 0) + (c.edgesRemoved || 0)),
            0
          ),
        };

        if (metrics.commitCount > 0 && metrics.totalSymbols === 0) {
          console.warn(
            `[Metrics] WARNING: ${metrics.commitCount} commits indexed but 0 symbols found. Check path filtering or parsing.`
          );
        }
        return metrics;
      }
      return { commitCount: 0, totalSymbols: 0, totalEdges: 0 };

    case 'scope':
      return {
        commitFiles: (data.commitFiles || []).length,
        workingChanged: (data.workingChanged || []).length,
        blastRadiusFiles: (data.blastRadius || []).length,
        allPaths: (data.allPaths || []).length,
      };

    case 'intended':
      if (Array.isArray(data)) {
        return {
          totalSymbols: data.length,
          present: data.filter((i: any) => i.expect === 'present').length,
          absent: data.filter((i: any) => i.expect === 'absent').length,
          renamed: data.filter((i: any) => i.isRenamed).length,
        };
      }
      return { totalSymbols: 0, present: 0, absent: 0, renamed: 0 };

    case 'working':
      return {
        symbols: (data.symbols || []).length,
        edges: (data.edges || []).length,
        analyzedPaths: (data.analyzedPaths || []).length,
      };

    case 'drift':
      return {
        missing_symbols: data.missing_symbols?.length || 0,
        zombie_symbols: data.zombie_symbols?.length || 0,
        divergent_symbols: data.divergent_symbols?.length || 0,
        missing_edges: data.missing_edges?.length || 0,
        zombie_edges: data.zombie_edges?.length || 0,
        unresolved_callers: data.unresolved_callers?.length || 0,
        hybridDrifts: data.hybridDrifts?.length || 0,
        conventionDrift: data.conventionDrift ? data.conventionDrift.driftSymbols?.length || 0 : 0,
        mixedConventionFiles: data.mixedConventionFiles?.length || 0,
      };

    case 'legacy':
      return {
        dead: data.dead?.length || 0,
        legacyUsed: data.legacyUsed?.length || 0,
        replacedLeftovers: data.replacedLeftovers?.length || 0,
      };

    case 'hotspots':
      if (Array.isArray(data)) {
        return {
          topHotspots: data.length,
          totalChurn: data.reduce(
            (sum: number, h: any) => sum + (h.hotspotScore || h.churnScore || h.dnaChurn || 0),
            0
          ),
          withVersionTracking: data.filter((h: any) => h.touchedInVersions).length,
          versionDescriptions: data
            .filter((h: any) => h.touchedInVersionsDescription)
            .map((h: any) => h.touchedInVersionsDescription),
        };
      }
      return {
        topHotspots: 0,
        totalChurn: 0,
        withVersionTracking: 0,
        versionDescriptions: [],
      };

    case 'moved_blocks':
      if (Array.isArray(data)) {
        return {
          totalMoves: data.length,
          withVersionDescription: data.filter((m: any) => m.versionDescription).length,
          moveTypes: {
            rename: data.filter((m: any) => m.moveType === 'rename').length,
            relocate: data.filter((m: any) => m.moveType === 'relocate').length,
            refactor: data.filter((m: any) => m.moveType === 'refactor').length,
          },
        };
      }
      return {
        totalMoves: 0,
        withVersionDescription: 0,
        moveTypes: { rename: 0, relocate: 0, refactor: 0 },
      };

    case 'bundle_facts':
      const hybridFactsCount = data.hybridFacts
        ? Object.values(data.hybridFacts).reduce(
            (sum: number, f: any) => sum + (Array.isArray(f) ? f.length : 0),
            0
          )
        : 0;
      return {
        incompleteness: data.findings?.incompleteness
          ? (data.findings.incompleteness.missing || 0) +
            (data.findings.incompleteness.zombies || 0) +
            (data.findings.incompleteness.divergent || 0)
          : 0,
        patternDrift: data.findings?.patternDrift
          ? (data.findings.patternDrift.mixedTargets?.length || 0) +
            (data.findings.patternDrift.oldNamespaces?.length || 0) +
            (data.findings.patternDrift.conventionDrift ? 1 : 0) +
            (data.findings.patternDrift.mixedConventionFiles || 0)
          : 0,
        legacySummary: data.findings?.legacyAudit?.dead || 0,
        intended: {
          present: data.intended?.present || 0,
          absent: data.intended?.absent || 0,
          renamed: data.intended?.renamed || 0,
        },
        hybridFactsCount,
        hybridFilesCount: data.hybridFacts ? Object.keys(data.hybridFacts).length : 0,
      };

    case 'embedding_index':
      return {
        commitCount: data.commitCount || 0,
        commitShardCount: data.commitShardCount || 0,
        symbolShardCount: data.symbolShardCount || 0,
        themeShardCount: data.themeShardCount || 0,
        durationMs: data.durationMs || 0,
        skipped: !!data.skipped,
        reason: data.reason || undefined,
      };

    case 'llm_story':
      if (data.metrics) {
        return {
          storyLength: 1,
          totalHealthScore: data.metrics.healthScore || 0,
          totalTokens: data.metrics.totalTokens || 0,
          totalCalls: data.metrics.totalCalls || 0,
          blocksCount: data.llmAnalysis?.blocks?.length || 0,
          durationMs: data.metrics.durationMs || 0,
          validatedEvidenceCount: data.metrics.validatedEvidenceCount || 0,
        };
      }
      return { storyLength: 0, totalHealthScore: 0 };

    case 'retrieve_history':
      if (data.metrics) {
        return {
          similarCommits: data.metrics.similarCommits || 0,
          similarSymbols: data.metrics.similarSymbols || 0,
          relatedRefactors: data.metrics.relatedRefactors || 0,
          durationMs: data.metrics.durationMs || 0,
          skipped: !!data.metrics.skipped,
          reason: data.metrics.reason || undefined,
        };
      }
      return { similarCommits: 0, similarSymbols: 0, relatedRefactors: 0 };

    case 'workspace_overlay':
      if (data && typeof data === 'object' && ('staged' in data || 'unstaged' in data)) {
        const staged = data.staged || {};
        const unstaged = data.unstaged || {};
        return {
          stagedFiles: staged.filesChanged || 0,
          stagedSymbols:
            (staged.symbolsAdded || 0) +
            (staged.symbolsModified || 0) +
            (staged.symbolsRemoved || 0),
          unstagedFiles: unstaged.filesChanged || 0,
          unstagedSymbols:
            (unstaged.symbolsAdded || 0) +
            (unstaged.symbolsModified || 0) +
            (unstaged.symbolsRemoved || 0),
        };
      }
      return {
        filesChanged: data.filesChanged || 0,
        symbolsChanged:
          (data.symbolsAdded || 0) + (data.symbolsModified || 0) + (data.symbolsRemoved || 0),
      };

    default:
      return {};
  }
}

/**
 * Build explicit timeline chain from UI selections
 * Returns array sorted newest → oldest for optimal cache warming
 */
function buildExplicitTimeline(options: {
  includeUnstaged: boolean;
  includeStaged: boolean;
  selectedCommitShas: string[];
}): string[] {
  const timeline: string[] = [];

  if (options.includeUnstaged) {
    timeline.push('workspace-unstaged');
  }
  if (options.includeStaged) {
    timeline.push('workspace-staged');
  }

  if (options.selectedCommitShas.length > 0) {
    timeline.push('HEAD');
  }

  timeline.push(...options.selectedCommitShas);

  return timeline;
}

function deleteDatabaseIfRequested(reset: boolean) {
  if (!reset) return;
  try {
    const config = require('../../src/utils/config');
    const gitRoot = config.getGitRoot?.();
    if (!gitRoot) return;
    const dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.db');

    const { getDatabaseManager } = require('../../src/storage/database');
    const dbManager = getDatabaseManager();
    if (dbManager) {
      try {
        dbManager.close();
        console.log(`🧹 Closed existing database connection`);
      } catch (error: any) {
        console.log(`🧹 Database connection already closed or not initialized`);
      }
    }

    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log(`🧹 Deleted existing database file at ${dbPath}`);
    }

    const journalPath = `${dbPath}-journal`;
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(journalPath)) {
      fs.unlinkSync(journalPath);
      console.log(`🧹 Deleted journal file`);
    }
    if (fs.existsSync(walPath)) {
      fs.unlinkSync(walPath);
      console.log(`🧹 Deleted WAL file`);
    }
  } catch (error: any) {
    console.warn(`⚠ Could not delete database: ${error?.message || error}`);
  }
}

/**
 * Captured LLM data structure
 */
interface CapturedLlmData {
  summarizedFacts: RefactorBundleFacts | null;
  prompts: {
    intent: string | null;
    drift: string | null;
    cleanup: string | null;
    discover: string | null;
    quantify: string | null;
    plan: string | null;
  };
}

/**
 * Wrapper class to capture LLM prompts and summarized facts without making actual API calls
 * This extends LlmAnalyst and completely reimplements analyze() to capture prompts
 */
class PromptCaptureLlmAnalyst extends LlmAnalyst {
  private capturedData: CapturedLlmData = {
    summarizedFacts: null,
    prompts: {
      intent: null,
      drift: null,
      cleanup: null,
      discover: null,
      quantify: null,
      plan: null,
    },
  };

  getCapturedData(): CapturedLlmData {
    return this.capturedData;
  }

  /**
   * Completely override analyze to capture summarized facts and all prompts
   */
  async analyze(facts: RefactorBundleFacts, rawFeed?: any): Promise<LlmAnalysis> {
    const {
      PROMPT_INTENT_AND_STORY,
      PROMPT_DRIFT_VERIFICATION,
      PROMPT_CLEANUP_PLAN,
      PROMPT_DISCOVER,
      PROMPT_QUANTIFY,
      PROMPT_PLAN,
      SYSTEM_PROMPT,
      buildTimelineSummary,
    } = await import('../../src/llm/prompts');
    const { AnalysisBlockUtils } = await import('../../src/analysis/llmAnalyst/blocks');
    const { getExtensionConfig } = await import('../../src/utils/config');

    const startTime = Date.now();
    let totalTokens = 0;
    let totalCalls = 0;

    const estimateTokens = (text: string | null): number => {
      return text ? Math.ceil(text.length / 4) : 0;
    };

    const config = getExtensionConfig();
    const maxInputChars = (config as any).maxInputChars || 1000000;

    const slimFacts = (this as any).buildSlimFacts ? (this as any).buildSlimFacts(facts) : facts;
    const factsJson = JSON.stringify(slimFacts);
    const factsSize = factsJson.length;
    let processedFacts = slimFacts;

    if (factsSize > maxInputChars) {
      console.log(
        `LLM Analyst: Facts size (${factsSize} chars) exceeds max (${maxInputChars}), summarizing...`
      );
      processedFacts = this.summarizeFactsHelper(slimFacts);
      const summarizedSize = JSON.stringify(processedFacts).length;
      console.log(
        `LLM Analyst: Summarized to ${summarizedSize} chars (${(
          (1 - summarizedSize / factsSize) *
          100
        ).toFixed(1)}% reduction)`
      );
    }

    this.capturedData.summarizedFacts = processedFacts;

    try {
      console.log('LLM Analyst: Running intent analysis...');
      const promptTemplate = this.getPromptHelper('intent', PROMPT_INTENT_AND_STORY);
      const timelineInfo = buildTimelineSummary(processedFacts.bundle?.timeline);
      const promptWithTimeline = promptTemplate
        .replace('{timelineSummary}', timelineInfo.summary)
        .replace('{versionCount}', String(timelineInfo.count));
      const intentPrompt = this.buildPromptHelper(promptWithTimeline, processedFacts);
      this.capturedData.prompts.intent = intentPrompt;
      totalTokens += estimateTokens(intentPrompt);

      const intentBlock = AnalysisBlockUtils.createBlock(
        'intent',
        'Refactor Intent & Story',
        'intent'
      );
      intentBlock.claims = []; // Mock empty claims
      totalCalls++;

      console.log('LLM Analyst: Running drift verification...');
      const driftPromptTemplate = this.getPromptHelper('drift', PROMPT_DRIFT_VERIFICATION);
      const driftTimelineInfo = buildTimelineSummary(processedFacts.bundle?.timeline);
      const driftPromptWithTimeline = driftPromptTemplate
        .replace('{timelineSummary}', driftTimelineInfo.summary)
        .replace('{versionCount}', String(driftTimelineInfo.count));
      const driftPrompt = this.buildPromptHelper(driftPromptWithTimeline, processedFacts);
      this.capturedData.prompts.drift = driftPrompt;
      totalTokens += estimateTokens(driftPrompt);

      const driftBlock = AnalysisBlockUtils.createBlock('drift', 'Drift Verification', 'drift');
      driftBlock.claims = [];
      driftBlock.actions = [];
      totalCalls++;

      console.log('LLM Analyst: Generating cleanup plan...');
      const cleanupPromptTemplate = this.getPromptHelper('cleanup', PROMPT_CLEANUP_PLAN);
      const cleanupTimelineInfo = buildTimelineSummary(processedFacts.bundle?.timeline);
      const cleanupPromptWithTimeline = cleanupPromptTemplate
        .replace('{timelineSummary}', cleanupTimelineInfo.summary)
        .replace('{versionCount}', String(cleanupTimelineInfo.count));
      const cleanupPrompt = this.buildPromptHelper(cleanupPromptWithTimeline, processedFacts);
      this.capturedData.prompts.cleanup = cleanupPrompt;
      totalTokens += estimateTokens(cleanupPrompt);

      const cleanupBlock = AnalysisBlockUtils.createBlock('cleanup', 'Cleanup Plan', 'cleanup');
      cleanupBlock.claims = [];
      cleanupBlock.actions = [];
      totalCalls++;

      let discoveryBlock: any = undefined;
      if (rawFeed) {
        console.log('LLM Analyst: Running pattern discovery...');
        const discoveryResult = await this.discoverPatterns(rawFeed, facts);
        discoveryBlock = this.callParentMethod('createDiscoveryBlock', discoveryResult, facts);
        totalCalls += 3;

        totalTokens += discoveryResult.metadata.totalTokens;
      }

      const blocks = [intentBlock, driftBlock, cleanupBlock];
      if (discoveryBlock) {
        blocks.push(discoveryBlock);
      }
      const summary = this.callParentMethod('generateSummary', blocks, facts);
      const markdown = this.callParentMethod('generateMarkdown', blocks, facts);

      const healthScore = this.callParentMethod('calculateHealthScore', facts);

      const knownFiles = new Set((facts.evidence['scope.files'] as string[]) || []);
      const validatedEvidenceCount = blocks.reduce((acc, block) => {
        return (
          acc +
          block.claims.reduce((claimAcc: number, claim: any) => {
            return (
              claimAcc +
              claim.evidence.filter((e: any) => e.filePath && knownFiles.has(e.filePath)).length
            );
          }, 0) +
          block.actions.reduce((actionAcc: number, action: any) => {
            return (
              actionAcc +
              action.evidence.filter((e: any) => e.filePath && knownFiles.has(e.filePath)).length
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
          model: getExtensionConfig().openRouterModel,
          timestamp: new Date().toISOString(),
          healthScore,
          validatedEvidenceCount,
        },
      };
    } catch (error) {
      console.error('LLM Analyst failed:', error);
      const healthScore = this.callParentMethod('calculateHealthScore', facts);
      return {
        summary: `Analysis failed: ${error}`,
        blocks: [],
        markdown: `# Analysis Error\n\n${error}`,
        metadata: {
          totalCalls: 1,
          totalTokens: 0,
          model: 'unknown',
          timestamp: new Date().toISOString(),
          healthScore,
        },
      };
    }
  }

  /**
   * Override discoverPatterns to capture all three prompts
   */
  async discoverPatterns(rawFeed: any, facts: RefactorBundleFacts): Promise<any> {
    const { PROMPT_DISCOVER, PROMPT_QUANTIFY, PROMPT_PLAN, SYSTEM_PROMPT } =
      await import('../../src/llm/prompts');
    const knownFiles = (facts.evidence['scope.files'] as string[]) || [];
    const knownFilesList =
      knownFiles.length > 0
        ? `\n\nKNOWN FILES (ONLY use these in examples):\n${JSON.stringify(knownFiles)}\n\n`
        : '\n\n';

    const estimateTokens = (text: string): number => Math.ceil(text.length / 4);
    let totalTokens = 0;

    const discoverPromptTemplate = this.getPromptHelper('discover', PROMPT_DISCOVER);
    const discoverPrompt = `${SYSTEM_PROMPT}\n\nRAW FEED JSON:\n${JSON.stringify(
      rawFeed
    )}${knownFilesList}${discoverPromptTemplate}`;
    this.capturedData.prompts.discover = discoverPrompt;
    totalTokens += estimateTokens(discoverPrompt);

    const quantifyPromptTemplate = this.getPromptHelper('quantify', PROMPT_QUANTIFY);
    const quantifyPrompt = `${SYSTEM_PROMPT}\n\nDISCOVERED PATTERNS:\n${JSON.stringify({
      patterns: [],
    })}\n\n${quantifyPromptTemplate}`;
    this.capturedData.prompts.quantify = quantifyPrompt;
    totalTokens += estimateTokens(quantifyPrompt);

    const planPromptTemplate = this.getPromptHelper('plan', PROMPT_PLAN);
    const planPrompt = `${SYSTEM_PROMPT}\n\nQUANTIFIED PATTERNS:\n${JSON.stringify({
      quantified: [],
    })}\n\n${planPromptTemplate}`;
    this.capturedData.prompts.plan = planPrompt;
    totalTokens += estimateTokens(planPrompt);

    return {
      discovery: {},
      quantified: {},
      plan: {},
      metadata: {
        totalTokens,
        duration: 0,
        model: 'mock',
      },
    };
  }

  /**
   * Helper to get prompt (duplicated from base class, using different name to avoid conflict)
   */
  private getPromptHelper(key: string, defaultPrompt: string): string {
    const { getExtensionConfig } = require('../../src/utils/config');
    const config = getExtensionConfig();
    if (config.customPrompts && config.customPrompts[key]) {
      return config.customPrompts[key];
    }
    return defaultPrompt;
  }

  /**
   * Helper to build prompt (duplicated from base class, using different name to avoid conflict)
   */
  private buildPromptHelper(userPrompt: string, facts: RefactorBundleFacts): string {
    const { SYSTEM_PROMPT } = require('../../src/llm/prompts');
    const factsJson = JSON.stringify(facts, null, 2);
    return `${SYSTEM_PROMPT}\n\nFACTS JSON:\n${factsJson}\n\n${userPrompt}`;
  }

  /**
   * Helper to summarize facts (duplicated from base class, using different name to avoid conflict)
   */
  private summarizeFactsHelper(facts: RefactorBundleFacts): RefactorBundleFacts {
    const summarized = { ...facts };

    if (summarized.evidence && Array.isArray(summarized.evidence['working.symbols'])) {
      const symbols = summarized.evidence['working.symbols'] as string[];
      summarized.evidence['working.symbols'] = symbols.slice(0, 20);
    }

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

  /**
   * Access parent methods via any cast (these are private in base class)
   */
  private callParentMethod(methodName: string, ...args: any[]): any {
    return (this as any)[methodName](...args);
  }
}

function buildSteps(
  workspaceIndexer: WorkspaceIndexer,
  commitIndexer: CommitIndexer,
  embeddingIndexer: EmbeddingIndexer,
  storyEngine: BundleStoryEngine
): PipelineStep[] {
  return [
    createWorkspaceOverlayStep(workspaceIndexer),
    createScopeStep(),

    (() => {
      const step = createIndexCommitsStep(commitIndexer, 2);
      if (!step.deps) step.deps = [];
      step.deps.push('workspace_overlay');
      return step;
    })(),
    createWorkingStep(),

    createIntendedStep(),
    createHotspotStep(),
    createMovedBlockStep(),

    createDriftStep(),
    createLegacyStep(),

    createBundleFactsStep(),
    createEmbeddingStep(embeddingIndexer),
    createHistoryRetrievalStep(storyEngine),
    createStoryStep(storyEngine),
  ];
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log('🚀 Starting Pipeline Diagnostics...');
  console.log(`📂 Workspace: ${process.cwd()}`);
  console.log(`Commit count: ${options.commitCount}`);
  console.log(`Include workspace: ${options.includeWorkspace}`);
  console.log(`Reset DB: ${options.resetDb}`);
  console.log(`Isolate to /src: ${!options.noIsolate}`);
  console.log(`Real LLM: ${options.realLlm}`);

  deleteDatabaseIfRequested(options.resetDb);
  await ensureDatabaseInitialized();
  const dbManager = getDatabaseManager();
  const db = dbManager.getDatabase();

  const { auditAllModules, MODULE_SCHEMAS } = await import('../../src/storage/schema');
  const auditGaps = auditAllModules(db);
  console.log(
    `📊 Schema: ${Object.keys(MODULE_SCHEMAS).length} modules, audit gaps: ${auditGaps.length}`
  );
  if (auditGaps.length > 0) {
    console.warn(`⚠️  Schema issues detected:`, { auditGaps });
  }

  if (options.noSnapshotCache) {
    process.env.SNAPSHOT_CACHE_ENABLED = 'false';
    console.log('🔧 Snapshot cache: disabled (--no-snapshot-cache flag)');
  } else {
    process.env.SNAPSHOT_CACHE_SIZE = '500';
    console.log('🔧 Snapshot cache: size increased to 500 for diagnostics');
  }

  if (!options.noIsolate) {
    process.env.CUSTOM_IGNORE_PATHS =
      'backlog/*, benchmarks/*, resources/*, archive/*, .cursor/*, .examples/*, .vscode/*, .git/*';
    console.log('🔧 Ignore paths: isolating to src/** (all other top-level paths ignored)');
  } else {
    console.log('🔧 Ignore paths: standard .gitignore only (no extra isolation)');
  }

  const git = new GitOperations();

  try {
    console.log('🔍 Verifying commit content...');
    const recentCommits = await git.getRecentCommits(3);
    for (const commit of recentCommits) {
      const files = await git.getFileChanges(commit.sha);
      const filePaths = files.map(f => f.path).slice(0, 5);
      const more = files.length > 5 ? `... (+${files.length - 5} more)` : '';
      console.log(
        `  Commit ${commit.sha.substring(0, 7)}: ${
          files.length
        } files changed (${filePaths.join(', ')}${more})`
      );
    }
  } catch (e) {
    console.warn('  Could not verify commit content:', e);
  }

  const symbolExtractor = new SymbolExtractor(git);
  const dependencyExtractor = new DependencyExtractor();
  const snapshotManager = new SnapshotManager(db, symbolExtractor, dependencyExtractor);

  if (options.resetDb) {
    snapshotManager.clearCache();
  }
  const structuralDiffManager = new StructuralDiffManager(db);
  const riskDetector = new RiskDetector();
  const hotspotDetector = new HotspotDetectorV2();
  const movedBlockDetector = new MovedBlockDetectorV2();
  const llmAnalyst = new PromptCaptureLlmAnalyst();
  const storyEngine = new BundleStoryEngine(llmAnalyst);

  const commitIndexer = new CommitIndexer(
    db,
    git,
    snapshotManager,
    structuralDiffManager,
    riskDetector,
    dependencyExtractor,
    hotspotDetector,
    movedBlockDetector
  );

  const workspaceIndexer = new WorkspaceIndexer(db, git, snapshotManager, structuralDiffManager);

  const embeddingIndexer = new EmbeddingIndexer(dbManager);
  let steps = buildSteps(workspaceIndexer, commitIndexer, embeddingIndexer, storyEngine);

  if (options.noEmbeddings) {
    steps = steps.filter(s => s.id !== 'embedding_index');
    console.log('🔧 Embeddings: disabled (--no-embeddings flag)');
  }

  const commits = await git.getRecentCommits(options.commitCount);
  if (!commits.length) {
    throw new Error('No commits available to analyze');
  }

  if (options.enableCst || options.enableAugment || options.testHybrid) {
    console.log(
      `🔧 CST Tracking: ${
        options.enableCst ? 'enabled' : 'disabled'
      }, Augmentation: ${options.enableAugment ? 'enabled' : 'disabled'}`
    );
  }

  const headSha = await git.getHeadSha();
  const headIncluded = commits.some((c: any) => c.sha === headSha);
  if (!headIncluded) {
    const headCommit = await git.getCommitInfo(headSha);
    commits.unshift(headCommit);

    commits.splice(options.commitCount);
  }

  const { DatabaseHelpers } = await import('../../src/storage/database');

  console.log(`📝 Populating metadata for ${commits.length} commits...`);

  const commitsWithFiles = await Promise.all(
    commits.map(async c => {
      const files = await git.getFileChanges(c.sha);
      return { ...c, fileCount: files.length };
    })
  );

  db.transaction(() => {
    for (const commit of commitsWithFiles) {
      if (!commit.author) {
        console.warn(`⚠️ Missing author for ${commit.sha}, defaulting to 'Unknown'`);
      }
      DatabaseHelpers.insertCommitMetadata({
        sha: commit.sha,
        author: commit.author || 'Unknown',
        date: commit.date,
        message: commit.message,
        parent: commit.parent,
        filesChanged: commit.fileCount,
        loadedAt: new Date().toISOString(),
      });
    }
  })();

  const shas = commits.map(c => c.sha);
  console.log(`📋 Analyzing ${shas.length} commits (HEAD: ${shas[0].substring(0, 8)})`);

  const workspaceParts = options.includeWorkspace
    ? new Set<'staged' | 'unstaged'>(['staged', 'unstaged'])
    : undefined;

  const explicitTimeline = buildExplicitTimeline({
    includeUnstaged: options.includeWorkspace && (workspaceParts?.has('unstaged') ?? true),
    includeStaged: options.includeWorkspace && (workspaceParts?.has('staged') ?? true),
    selectedCommitShas: commits.map((c: any) => c.sha),
  });

  const initialState: any = {
    selectedCommitShas: commits.map((c: any) => c.sha),
    includeWorkspace: options.includeWorkspace,
    workspaceParts,
    explicitTimeline,
    completedSteps: new Set(),
    errors: [],
  };

  const replayAnchor = options.replayFrom || options.replayStep || '';
  let replayIndex = replayAnchor ? steps.findIndex(s => s.id === replayAnchor) : -1;
  if (replayAnchor && replayIndex === -1) {
    console.warn(`⚠ Replay target '${replayAnchor}' not found; running full pipeline`);
  } else if (replayIndex >= 0) {
    const snap = loadStepSnapshot(replayAnchor, options.snapshotDir);
    if (!snap) {
      throw new Error(`Snapshot for '${replayAnchor}' not found at ${options.snapshotDir}`);
    }
    applySnapshotToState(initialState, snap as any);
    for (let i = 0; i < replayIndex; i++) {
      const original = steps[i];
      steps[i] = {
        ...original,
        run: async () => {
          console.log(`⏭  Skipping ${original.id} (replayed state)`);
        },
      };
    }
  }

  const diagnostics: any = {
    startTime: new Date().toISOString(),
    steps: [],
    errors: [],
    llm_summaries: [],
    hybridFacts: {
      total: 0,
      cstOnly: 0,
      augmented: 0,
      filesWithFacts: 0,
    },
    hybridDrifts: {
      total: 0,
      missing: 0,
      zombies: 0,
      divergent: 0,
      modified: 0,
    },
    performance: {
      driftDetectionTime: 0,
      batchRetrievalTime: 0,
      speedup: 1,
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: 0,
      },
    },
  };

  const stepStartTimes = new Map<string, number>();

  const onEvent = (event: any) => {
    if (event.type === 'start') {
      console.log(`▶️  ${event.step.label}`);
      stepStartTimes.set(event.step.id, Date.now());
    } else if (event.type === 'complete') {
      const stepId = event.step.id;
      const stepStartTime = stepStartTimes.get(stepId) || Date.now();

      if (options.focusSteps && !options.focusSteps.has(stepId)) {
        console.log(`✅ ${event.step.label} (not focused)`);
        return;
      }

      const fullData = options.fullReport
        ? deepSerializeStepState(stepId, event.state)
        : serializeStepState(stepId, event.state);

      const metrics = options.fullReport ? extractStepMetrics(stepId, fullData) : {};

      const data = serializeStepState(stepId, event.state);

      let hash = data ? stableHash(data) : 'n/a';
      if (stepId === 'embedding_index' || stepId === 'llm_story' || stepId === 'retrieve_history') {
        hash = 'n/a (external/complex)';
      }

      const loadStart = Date.now();
      const baseline = loadStepSnapshot(stepId, options.snapshotDir);
      const loadTime = Date.now() - loadStart;
      if (loadTime > 10) {
        console.warn(`[Diagnostics] Slow snapshot load for ${stepId}: ${loadTime}ms`);
      }

      const summary = summarizeStep(stepId, data);

      const cacheStats = snapshotManager.getCacheStats();
      if (cacheStats.cacheHits + cacheStats.cacheMisses > 0) {
        diagnostics.performance.cacheStats = cacheStats;
      }

      let llmSummary: any = null;
      if (stepId === 'llm_story') {
        const capturedData = (llmAnalyst as PromptCaptureLlmAnalyst).getCapturedData();

        if (capturedData.summarizedFacts) {
          const outDir = path.join(process.cwd(), 'benchmarks', 'output');
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }
          const factsPath = path.join(outDir, 'llm_summarized_facts.json');
          fs.writeFileSync(factsPath, JSON.stringify(capturedData.summarizedFacts, null, 2));
          console.log(
            `💾 Saved summarized facts (${
              JSON.stringify(capturedData.summarizedFacts).length
            } chars) to ${factsPath}`
          );
        }

        const outDir = path.join(process.cwd(), 'benchmarks', 'output');
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        const promptFiles: Array<{
          phase: string;
          path: string;
          size: number;
        }> = [];

        if (capturedData.prompts.intent) {
          const intentPath = path.join(outDir, 'llm_prompt_intent.txt');
          fs.writeFileSync(intentPath, capturedData.prompts.intent);
          promptFiles.push({
            phase: 'intent',
            path: intentPath,
            size: capturedData.prompts.intent.length,
          });
        }
        if (capturedData.prompts.drift) {
          const driftPath = path.join(outDir, 'llm_prompt_drift.txt');
          fs.writeFileSync(driftPath, capturedData.prompts.drift);
          promptFiles.push({
            phase: 'drift',
            path: driftPath,
            size: capturedData.prompts.drift.length,
          });
        }
        if (capturedData.prompts.cleanup) {
          const cleanupPath = path.join(outDir, 'llm_prompt_cleanup.txt');
          fs.writeFileSync(cleanupPath, capturedData.prompts.cleanup);
          promptFiles.push({
            phase: 'cleanup',
            path: cleanupPath,
            size: capturedData.prompts.cleanup.length,
          });
        }
        if (capturedData.prompts.discover) {
          const discoverPath = path.join(outDir, 'llm_prompt_discover.txt');
          fs.writeFileSync(discoverPath, capturedData.prompts.discover);
          promptFiles.push({
            phase: 'discover',
            path: discoverPath,
            size: capturedData.prompts.discover.length,
          });
        }
        if (capturedData.prompts.quantify) {
          const quantifyPath = path.join(outDir, 'llm_prompt_quantify.txt');
          fs.writeFileSync(quantifyPath, capturedData.prompts.quantify);
          promptFiles.push({
            phase: 'quantify',
            path: quantifyPath,
            size: capturedData.prompts.quantify.length,
          });
        }
        if (capturedData.prompts.plan) {
          const planPath = path.join(outDir, 'llm_prompt_plan.txt');
          fs.writeFileSync(planPath, capturedData.prompts.plan);
          promptFiles.push({
            phase: 'plan',
            path: planPath,
            size: capturedData.prompts.plan.length,
          });
        }

        if (promptFiles.length > 0) {
          console.log(`💾 Saved ${promptFiles.length} LLM prompts:`);
          promptFiles.forEach(({ phase, path, size }) => {
            console.log(`   ${phase}: ${(size / 1024).toFixed(1)}KB -> ${path}`);
          });
        }

        if (event.state.llmOutputs) {
          const llmAnalysis = event.state.llmOutputs.llmAnalysis;
          if (llmAnalysis) {
            llmSummary = {
              summary_md: llmAnalysis.markdown
                ? llmAnalysis.markdown.length > 1000
                  ? llmAnalysis.markdown.substring(0, 1000) + '... [truncated]'
                  : llmAnalysis.markdown
                : undefined,
              summary_text: llmAnalysis.summary
                ? llmAnalysis.summary.length > 500
                  ? llmAnalysis.summary.substring(0, 500) + '...'
                  : llmAnalysis.summary
                : undefined,
              healthScore: llmAnalysis.metadata?.healthScore,
              totalTokens: llmAnalysis.metadata?.totalTokens,
              totalCalls: llmAnalysis.metadata?.totalCalls,
              model: llmAnalysis.metadata?.model,
              validatedEvidenceCount: llmAnalysis.metadata?.validatedEvidenceCount,
              blocksCount: llmAnalysis.blocks?.length || 0,
              timestamp: llmAnalysis.metadata?.timestamp,
              prompts: {
                intent: capturedData.prompts.intent
                  ? { size: capturedData.prompts.intent.length }
                  : null,
                drift: capturedData.prompts.drift
                  ? { size: capturedData.prompts.drift.length }
                  : null,
                cleanup: capturedData.prompts.cleanup
                  ? { size: capturedData.prompts.cleanup.length }
                  : null,
                discover: capturedData.prompts.discover
                  ? { size: capturedData.prompts.discover.length }
                  : null,
                quantify: capturedData.prompts.quantify
                  ? { size: capturedData.prompts.quantify.length }
                  : null,
                plan: capturedData.prompts.plan ? { size: capturedData.prompts.plan.length } : null,
              },
              summarizedFactsSize: capturedData.summarizedFacts
                ? JSON.stringify(capturedData.summarizedFacts).length
                : 0,
            };
            diagnostics.llm_summaries.push(llmSummary);
          }
        }
      }

      let note = '';
      if (baseline && baseline.hash !== hash) {
        note = `Δ baseline (expected ${baseline.hash.substring(0, 8)})`;
      } else if (baseline) {
        note = 'matches baseline';
      } else if (!options.freeze) {
        note = 'no baseline';
      }

      const stepEndTime = Date.now();
      const stepDuration = stepEndTime - stepStartTime;

      if (options.fullReport) {
        console.log(
          `✅ ${event.step.label} :: hash=${hash.toString().substring(0, 8)} ${note} ${
            summary ? `:: ${summary}` : ''
          } | Metrics: ${JSON.stringify(metrics).substring(0, 100)}...`
        );
      } else {
        console.log(
          `✅ ${event.step.label} :: hash=${hash
            .toString()
            .substring(0, 8)} ${note} ${summary ? `:: ${summary}` : ''}`
        );
      }

      if (options.freeze && data) {
        saveStepSnapshot(stepId, event.state, options.snapshotDir);
      }

      const stepEntry: any = {
        stepId,
        hash,
        note,
        summary,
        timestamp: new Date().toISOString(),
        durationMs: stepDuration,
      };

      if (options.fullReport) {
        stepEntry.metrics = metrics;
        if (llmSummary) {
          stepEntry.llmSummary = llmSummary;
        }
      }

      diagnostics.steps.push(stepEntry);
    } else if (event.type === 'error') {
      console.error(`❌ ${event.step.label}: ${event.error}`);
      diagnostics.errors.push({
        stepId: event.step.id,
        error: String(event.error),
      });
    }
  };

  const startTime = Date.now();
  let driftStartTime = 0;
  let driftEndTime = 0;

  if (options.testHybrid) {
    const driftIndex = steps.findIndex(s => s.id === 'drift');
    if (driftIndex >= 0) {
      const originalDriftStep = steps[driftIndex];
      steps[driftIndex] = {
        ...originalDriftStep,
        run: async (state: any) => {
          driftStartTime = Date.now();
          await originalDriftStep.run(state);
          driftEndTime = Date.now();
          diagnostics.performance.driftDetectionTime = driftEndTime - driftStartTime;
        },
      };
    }
  }

  const finalState = await runPipeline(steps, initialState, onEvent);
  const totalTime = Date.now() - startTime;

  diagnostics.endTime = new Date().toISOString();
  diagnostics.totalTimeMs = totalTime;
  diagnostics.completedSteps = Array.from(finalState.completedSteps);
  diagnostics.errorCount = finalState.errors.length;

  if (finalState.bundleFacts?.hybridFacts) {
    const hybridFacts = finalState.bundleFacts.hybridFacts;
    let totalFacts = 0;
    let cstOnlyCount = 0;
    let augmentedCount = 0;

    for (const [filePath, facts] of Object.entries(hybridFacts)) {
      const factArray = facts as any[];
      totalFacts += factArray.length;

      const hasSemanticSymbols = factArray.some(
        (f: any) => f.kind && !['cst_node', 'heading', 'property', 'doc_comment'].includes(f.kind)
      );
      if (hasSemanticSymbols) {
        augmentedCount += factArray.length;
      } else {
        cstOnlyCount += factArray.length;
      }
    }

    diagnostics.hybridFacts = {
      total: totalFacts,
      cstOnly: cstOnlyCount,
      augmented: augmentedCount,
      filesWithFacts: Object.keys(hybridFacts).length,
    };
  }

  if (finalState.drift?.hybridDrifts) {
    const drifts = finalState.drift.hybridDrifts;
    diagnostics.hybridDrifts = {
      total: drifts.length,
      missing: drifts.filter((d: any) => d.type === 'missing').length,
      zombies: drifts.filter((d: any) => d.type === 'zombie').length,
      divergent: drifts.filter((d: any) => d.type === 'divergent').length,
      modified: drifts.filter((d: any) => d.type === 'modified').length,
    };
  }

  if (options.fullReport) {
    const indexCommitsStep = diagnostics.steps.find((s: any) => s.stepId === 'index_commits');
    const workingStep = diagnostics.steps.find((s: any) => s.stepId === 'working');
    const intendedStep = diagnostics.steps.find((s: any) => s.stepId === 'intended');
    const driftStep = diagnostics.steps.find((s: any) => s.stepId === 'drift');
    const hotspotsStep = diagnostics.steps.find((s: any) => s.stepId === 'hotspots');
    const bundleFactsStep = diagnostics.steps.find((s: any) => s.stepId === 'bundle_facts');
    const legacyStep = diagnostics.steps.find((s: any) => s.stepId === 'legacy');
    const embeddingStep = diagnostics.steps.find((s: any) => s.stepId === 'embedding_index');
    const historyStep = diagnostics.steps.find((s: any) => s.stepId === 'retrieve_history');
    const llmStep = diagnostics.steps.find((s: any) => s.stepId === 'llm_story');

    diagnostics.aggregatedMetrics = {
      totalCommits: indexCommitsStep?.metrics?.commitCount || 0,
      totalSymbols:
        (workingStep?.metrics?.symbols || 0) + (intendedStep?.metrics?.totalSymbols || 0),
      totalEdges: workingStep?.metrics?.edges || 0,
      totalDriftIssues:
        (driftStep?.metrics?.missing_symbols || 0) +
        (driftStep?.metrics?.zombie_symbols || 0) +
        (driftStep?.metrics?.divergent_symbols || 0),
      unresolvedCallers: driftStep?.metrics?.unresolved_callers || 0,
      totalHotspots: hotspotsStep?.metrics?.topHotspots || 0,
      bundleIncompleteness: bundleFactsStep?.metrics?.incompleteness || 0,
      patternDrift: bundleFactsStep?.metrics?.patternDrift || 0,
      totalLegacyDead: legacyStep?.metrics?.dead || 0,
      embeddingShards: embeddingStep
        ? (embeddingStep.metrics.commitShardCount || 0) +
          (embeddingStep.metrics.symbolShardCount || 0) +
          (embeddingStep.metrics.themeShardCount || 0)
        : 0,
      historySimilarCommits: historyStep?.metrics?.similarCommits || 0,
      historySimilarSymbols: historyStep?.metrics?.similarSymbols || 0,
      historyRelatedRefactors: historyStep?.metrics?.relatedRefactors || 0,
      llmDurationMs: llmStep?.metrics?.durationMs || 0,
      embeddingDurationMs: embeddingStep?.metrics?.durationMs || 0,
      historyDurationMs: historyStep?.metrics?.durationMs || 0,
      llmTotalCalls:
        diagnostics.llm_summaries?.reduce((sum: number, l: any) => sum + (l.totalCalls || 0), 0) ||
        0,
      llmTotalTokens:
        diagnostics.llm_summaries?.reduce((sum: number, l: any) => sum + (l.totalTokens || 0), 0) ||
        0,
      overallHealthScore:
        diagnostics.llm_summaries?.length > 0
          ? diagnostics.llm_summaries.reduce(
              (sum: number, l: any) => sum + (l.healthScore || 0),
              0
            ) / diagnostics.llm_summaries.length
          : undefined,
    };

    diagnostics.finalStates = {};

    if (finalState.bundleFacts) {
      diagnostics.finalStates.bundleFacts = {
        ...finalState.bundleFacts,
        hybridFacts: '[Omitted: Large object]',
      };
    }

    if (finalState.drift) {
      diagnostics.finalStates.drift = {
        missing_symbols:
          finalState.drift.missing_symbols?.slice(0, 10).map((s: any) => ({
            symbol_id: s.symbol_id,
            introducedAtVersion: s.introducedAtVersion,
            resolvedAtVersion: s.resolvedAtVersion,
            versionDescription: s.versionDescription,
            expected: s.expected
              ? {
                  expect: s.expected.expect,
                  lastName: s.expected.lastName,
                  lastPath: s.expected.lastPath,
                }
              : undefined,
          })) || [],
        zombie_symbols:
          finalState.drift.zombie_symbols?.slice(0, 10).map((s: any) => ({
            symbol_id: s.symbol_id,
            introducedAtVersion: s.introducedAtVersion,
            resolvedAtVersion: s.resolvedAtVersion,
            versionDescription: s.versionDescription,
            expected: s.expected
              ? {
                  expect: s.expected.expect,
                  lastName: s.expected.lastName,
                }
              : undefined,
            found: s.found
              ? {
                  name: s.found.name,
                  path: s.found.path,
                }
              : undefined,
          })) || [],
        divergent_symbols:
          finalState.drift.divergent_symbols?.slice(0, 10).map((s: any) => ({
            symbol_id: s.symbol_id,
            introducedAtVersion: s.introducedAtVersion,
            resolvedAtVersion: s.resolvedAtVersion,
            versionDescription: s.versionDescription,
            expected: s.expected
              ? {
                  expect: s.expected.expect,
                  lastName: s.expected.lastName,
                }
              : undefined,
            found: s.found
              ? {
                  name: s.found.name,
                  path: s.found.path,
                }
              : undefined,
          })) || [],
        missing_edges:
          finalState.drift.missing_edges?.slice(0, 10).map((e: any) => ({
            from: e.from,
            to: e.to,
            type: e.type,
            introducedAtVersion: e.introducedAtVersion,
            versionDescription: e.versionDescription,
          })) || [],
        zombie_edges:
          finalState.drift.zombie_edges?.slice(0, 10).map((e: any) => ({
            from: e.from,
            to: e.to,
            type: e.type,
            introducedAtVersion: e.introducedAtVersion,
            versionDescription: e.versionDescription,
          })) || [],
        unresolved_callers:
          finalState.drift.unresolved_callers?.slice(0, 10).map((c: any) => ({
            caller_name: c.caller_name,
            caller_path: c.caller_path,
            callee_name: c.callee_name,
            occurrence_count: c.occurrence_count,
            severity: c.severity,
          })) || [],
        hybridDrifts: finalState.drift.hybridDrifts?.length || 0,
        conventionDrift: finalState.drift.conventionDrift
          ? {
              dominantConvention: finalState.drift.conventionDrift.dominantConvention,
              driftPercent: finalState.drift.conventionDrift.driftPercent,
              driftSymbolCount: finalState.drift.conventionDrift.driftSymbols?.length || 0,
            }
          : undefined,
      };
    }

    diagnostics.finalStates.llmOutputs = diagnostics.llm_summaries;
  }

  const outDir = path.join(process.cwd(), 'benchmarks', 'output');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const diagPath = path.join(outDir, 'pipeline_diagnostics.json');
  fs.writeFileSync(diagPath, JSON.stringify(diagnostics, null, 2));

  console.log('\n📊 Summary');
  console.log('='.repeat(30));
  console.log(`Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Steps completed: ${finalState.completedSteps.size}/${steps.length}`);
  console.log(`Errors: ${finalState.errors.length}`);

  if (diagnostics.hybridFacts.total > 0) {
    console.log(
      `\n🔷 Hybrid Facts: total=${diagnostics.hybridFacts.total}, cstOnly=${diagnostics.hybridFacts.cstOnly}, augmented=${diagnostics.hybridFacts.augmented}, files=${diagnostics.hybridFacts.filesWithFacts}`
    );
  }

  if (diagnostics.hybridDrifts.total > 0) {
    console.log(
      `🔷 Hybrid Drifts: total=${diagnostics.hybridDrifts.total}, missing=${diagnostics.hybridDrifts.missing}, divergent=${diagnostics.hybridDrifts.divergent}, modified=${diagnostics.hybridDrifts.modified}`
    );
  }

  if (diagnostics.performance.driftDetectionTime > 0) {
    const speedup =
      diagnostics.performance.speedup > 1
        ? ` (${diagnostics.performance.speedup.toFixed(1)}x faster with batching)`
        : '';
    console.log(
      `⚡ Performance: driftDetection=${diagnostics.performance.driftDetectionTime}ms${speedup}`
    );
  }

  console.log(`Diagnostics saved to ${diagPath}`);

  if (options.fullReport) {
    const reportPath = path.join(outDir, 'pipeline_report.md');
    let reportMd = `# Pipeline Diagnostics Report\n\n`;

    reportMd += `**Run Time:** ${diagnostics.startTime} to ${
      diagnostics.endTime
    } (${(diagnostics.totalTimeMs / 1000).toFixed(2)}s)\n`;
    if (diagnostics.aggregatedMetrics?.overallHealthScore !== undefined) {
      reportMd += `**Overall Health Score:** ${diagnostics.aggregatedMetrics.overallHealthScore.toFixed(
        2
      )}/100\n`;
    }
    reportMd += `\n`;

    if (diagnostics.aggregatedMetrics) {
      reportMd += `## Key Metrics\n\n`;
      Object.entries(diagnostics.aggregatedMetrics).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          const displayVal =
            typeof val === 'number'
              ? key.includes('Score') || key.includes('Percent')
                ? val.toFixed(2)
                : val.toString()
              : JSON.stringify(val).substring(0, 100);
          reportMd += `- **${key}**: ${displayVal}\n`;
        }
      });
      reportMd += `\n`;
    }

    reportMd += `## Step Details\n\n`;
    diagnostics.steps.forEach((step: any) => {
      reportMd += `### ${step.stepId}\n\n`;
      reportMd += `- **Hash:** ${step.hash}\n`;
      reportMd += `- **Status:** ${step.note || 'completed'}\n`;
      if (step.summary) {
        reportMd += `- **Summary:** ${step.summary}\n`;
      }
      if (step.timestamp) {
        reportMd += `- **Timestamp:** ${step.timestamp}\n`;
      }
      if (step.durationMs !== undefined) {
        reportMd += `- **Duration:** ${step.durationMs}ms\n`;
      }
      if (step.metrics && Object.keys(step.metrics).length > 0) {
        reportMd += `- **Metrics:**\n`;
        Object.entries(step.metrics).forEach(([key, val]) => {
          reportMd += `  - ${key}: ${
            typeof val === 'object' ? JSON.stringify(val).substring(0, 100) : val
          }\n`;
        });
      }
      if (step.llmSummary) {
        reportMd += `- **LLM Summary:**\n`;
        if (step.llmSummary.summary_text) {
          reportMd += `  - Summary: ${step.llmSummary.summary_text.substring(0, 200)}...\n`;
        }
        if (step.llmSummary.healthScore !== undefined) {
          reportMd += `  - Health Score: ${step.llmSummary.healthScore}/100\n`;
        }
        if (step.llmSummary.totalTokens) {
          reportMd += `  - Tokens: ${step.llmSummary.totalTokens}\n`;
        }
        if (step.llmSummary.blocksCount) {
          reportMd += `  - Blocks: ${step.llmSummary.blocksCount}\n`;
        }
      }
      reportMd += `\n`;
    });

    if (diagnostics.llm_summaries?.length > 0) {
      reportMd += `## LLM Analysis Summaries\n\n`;
      diagnostics.llm_summaries.forEach((summary: any, i: number) => {
        reportMd += `### Summary ${i + 1}\n\n`;
        if (summary.summary_text) {
          reportMd += `${summary.summary_text}\n\n`;
        }
        if (summary.summary_md) {
          reportMd += `#### Full Markdown Output\n\n`;
          reportMd += `${summary.summary_md}\n\n`;
        }
        reportMd += `**Metadata:**\n`;
        if (summary.healthScore !== undefined) {
          reportMd += `- Health Score: ${summary.healthScore}/100\n`;
        }
        if (summary.totalTokens) {
          reportMd += `- Total Tokens: ${summary.totalTokens}\n`;
        }
        if (summary.totalCalls) {
          reportMd += `- LLM Calls: ${summary.totalCalls}\n`;
        }
        if (summary.model) {
          reportMd += `- Model: ${summary.model}\n`;
        }
        if (summary.validatedEvidenceCount !== undefined) {
          reportMd += `- Validated Evidence: ${summary.validatedEvidenceCount}\n`;
        }
        if (summary.blocksCount) {
          reportMd += `- Analysis Blocks: ${summary.blocksCount}\n`;
        }
        if (summary.timestamp) {
          reportMd += `- Generated: ${summary.timestamp}\n`;
        }
        reportMd += `\n`;
      });
    }

    const hotspots =
      diagnostics.steps.find((s: any) => s.stepId === 'hotspots')?.metrics?.topHotspots || 0;
    const driftIssues = diagnostics.aggregatedMetrics?.totalDriftIssues || 0;
    if (hotspots > 0 || driftIssues > 0) {
      reportMd += `## Visualization\n\n`;
      reportMd += `\`\`\`mermaid\ngraph TD\n`;
      if (hotspots > 0) {
        reportMd += `  A[High Churn Files] --> B[Top ${hotspots} Hotspots]\n`;
      }
      if (driftIssues > 0) {
        reportMd += `  C[Drift Detection] --> D[${driftIssues} Issues Found]\n`;
        const driftStep = diagnostics.steps.find((s: any) => s.stepId === 'drift');
        if (driftStep?.metrics) {
          if (driftStep.metrics.missing_symbols > 0) {
            reportMd += `  D --> E[${driftStep.metrics.missing_symbols} Missing]\n`;
          }
          if (driftStep.metrics.zombie_symbols > 0) {
            reportMd += `  D --> F[${driftStep.metrics.zombie_symbols} Zombies]\n`;
          }
          if (driftStep.metrics.divergent_symbols > 0) {
            reportMd += `  D --> G[${driftStep.metrics.divergent_symbols} Divergent]\n`;
          }
        }
      }
      reportMd += `\`\`\`\n\n`;
    }

    reportMd += `## Summary\n\n`;
    reportMd += `- **Total Steps:** ${diagnostics.completedSteps?.length || 0}\n`;
    reportMd += `- **Errors:** ${diagnostics.errorCount || 0}\n`;
    if (diagnostics.aggregatedMetrics) {
      reportMd += `- **Total Symbols:** ${diagnostics.aggregatedMetrics.totalSymbols || 0}\n`;
      reportMd += `- **Total Edges:** ${diagnostics.aggregatedMetrics.totalEdges || 0}\n`;
      reportMd += `- **Drift Issues:** ${diagnostics.aggregatedMetrics.totalDriftIssues || 0}\n`;
    }
    reportMd += `\n`;
    reportMd += `*Generated by pipeline diagnostics at ${new Date().toISOString()}*\n`;

    fs.writeFileSync(reportPath, reportMd);
    console.log(`📄 Sample report saved to ${reportPath}`);
  }

  if (options.validateTimeline) {
    await validateHybridFactsDatabase(
      db,
      commits.map((c: any) => c.sha),
      finalState.explicitTimeline || []
    );
  }

  if (finalState.errors.length > 0) {
    finalState.errors.forEach(err => console.error(`[${err.stepId}] ${err.error}`));
    process.exitCode = 1;
  }
}

async function validateHybridFactsDatabase(
  db: any,
  commitShas: string[],
  explicitTimeline: string[]
): Promise<void> {
  console.log('\n🔍 Validating Hybrid Facts Database...');

  try {
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='hybrid_facts'
    `);
    const tableExists = tableCheck.get();

    if (!tableExists) {
      console.warn('⚠️  hybrid_facts table does not exist');
      return;
    }

    const factsStmt = db.prepare(`
      SELECT version, COUNT(*) as count
      FROM hybrid_facts
      WHERE version IN (${commitShas.map(() => '?').join(',')})
      GROUP BY version
    `);
    const factsByCommit = factsStmt.all(...commitShas) as any[];

    console.log(`✅ hybrid_facts table exists`);
    console.log(`📊 Facts by commit:`);
    factsByCommit.forEach(row => {
      console.log(`   ${row.version.substring(0, 8)}: ${row.count} facts`);
    });

    const unstagedCount = db
      .prepare('SELECT COUNT(*) as count FROM hybrid_facts WHERE version="workspace-unstaged"')
      .get() as any;
    const stagedCount = db
      .prepare('SELECT COUNT(*) as count FROM hybrid_facts WHERE version="workspace-staged"')
      .get() as any;
    const workspaceCount = db
      .prepare('SELECT COUNT(*) as count FROM hybrid_facts WHERE version="workspace"')
      .get() as any;
    const headCount = db
      .prepare('SELECT COUNT(*) as count FROM hybrid_facts WHERE version="HEAD"')
      .get() as any;

    console.log(`📊 Timeline versions:`);
    console.log(`   workspace-unstaged: ${unstagedCount.count} facts`);
    console.log(`   workspace-staged: ${stagedCount.count} facts`);
    if (workspaceCount.count > 0) {
      console.log(
        `   ⚠️  workspace (legacy): ${workspaceCount.count} facts - consider running migration`
      );
    }
    console.log(`   HEAD: ${headCount.count} facts`);

    if (commitShas.length > 0) {
      console.log(`🔗 Timeline chain coverage:`);
      const versions = ['workspace-unstaged', 'workspace-staged', 'HEAD', ...commitShas];
      for (const version of versions) {
        const count = db
          .prepare('SELECT COUNT(*) as count FROM hybrid_facts WHERE version=?')
          .get(version) as any;
        const versionLabel = version.length > 8 ? version.substring(0, 8) : version;
        console.log(`   ${versionLabel}: ${count.count} facts`);
      }
    }

    const timelineStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM hybrid_facts
      WHERE timeline_json IS NOT NULL AND timeline_json != '[]'
    `);
    const timelineCount = timelineStmt.get() as any;
    console.log(`📈 Timeline entries: ${timelineCount.count}`);

    const hashStmt = db.prepare(`
      SELECT COUNT(DISTINCT hash) as unique_hashes, COUNT(*) as total_facts
      FROM hybrid_facts
    `);
    const hashStats = hashStmt.get() as any;
    console.log(
      `🔐 File hashes: ${hashStats.unique_hashes} unique, ${hashStats.total_facts} total facts`
    );

    if (explicitTimeline.length > 0) {
      console.log(`\n🔬 Testing Timeline Manager Retrieval...`);
      const timelineManager = getCstTimelineManager();

      const filesStmt = db.prepare(`
        SELECT DISTINCT file_path
        FROM hybrid_facts
        LIMIT 10
      `);
      const sampleFiles = filesStmt.all() as Array<{ file_path: string }>;

      if (sampleFiles.length > 0) {
        console.log(
          `   Testing ${sampleFiles.length} sample files across ${explicitTimeline.length} versions`
        );

        let successCount = 0;
        let failureCount = 0;

        for (const { file_path } of sampleFiles) {
          for (const version of explicitTimeline) {
            try {
              const facts = await timelineManager.getPriorFacts(file_path, version);
              if (facts && facts.length > 0) {
                successCount++;
              }
            } catch (error: any) {
              failureCount++;
              console.warn(
                `   ⚠️  Failed to retrieve facts for ${file_path}@${version.substring(
                  0,
                  8
                )}: ${error.message}`
              );
            }
          }
        }

        console.log(`   ✅ Successful retrievals: ${successCount}`);
        if (failureCount > 0) {
          console.log(`   ⚠️  Failed retrievals: ${failureCount}`);
        }

        if (sampleFiles.length > 0 && explicitTimeline.length > 0) {
          console.log(`\n🔬 Testing Batch Retrieval...`);
          const testVersion = explicitTimeline[0];
          const testFiles = sampleFiles.slice(0, 5).map(f => f.file_path);

          try {
            const batchFacts = await timelineManager.getPriorFactsBatch(testFiles, testVersion);
            console.log(
              `   ✅ Batch retrieval: ${batchFacts.size} files, ${Array.from(
                batchFacts.values()
              ).reduce((sum, facts) => sum + facts.length, 0)} total facts`
            );
          } catch (error: any) {
            console.warn(`   ⚠️  Batch retrieval failed: ${error.message}`);
          }
        }
      } else {
        console.log(`   ℹ️  No files with hybrid facts found for testing`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Database validation failed: ${error.message}`);
  }
}

main().catch(err => {
  console.error('💥 Pipeline diagnostics failed:', err);
  process.exitCode = 1;
});
