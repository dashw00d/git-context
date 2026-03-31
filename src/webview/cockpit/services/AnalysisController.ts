import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GitOperations } from '../../../analysis/git';
import { RefactorBundleFacts } from '../../../facts/types';
import { getAnalysisService } from '../../../services/analysisService';
import { getRefactorPipeline } from '../../../services/pipelineFactory';
import { getDatabase } from '../../../storage/database';
import { BundleSummaryDTO } from '../../../types/cockpit';
import { withTimeout } from '../../../utils/async';
import { getGitRoot } from '../../../utils/config';
import { logDebug, logError, logInfo, logWarn } from '../../../utils/logger';

export class AnalysisController {
  public hotspotCache: Map<string, any[]> = new Map();
  public skeletonCache: { files: string[]; roots: string[]; mode: string } | null = null;

  constructor(private readonly view?: vscode.WebviewView) {}

  public clearHotspotCache() {
    this.hotspotCache.clear();
    logInfo('[AnalysisController] Cleared hotspot cache');
  }

  public clearSkeletonCache() {
    this.skeletonCache = null;
  }

  public async hydrateFromPersistedFacts(): Promise<{
    facts: RefactorBundleFacts;
    summary: BundleSummaryDTO;
  } | null> {
    try {
      const gitRoot = getGitRoot();
      if (!gitRoot) return null;

      const factsPath = path.join(gitRoot, '.git/commit-tracker/last-bundle-facts.json');
      if (!fs.existsSync(factsPath)) return null;

      const raw = fs.readFileSync(factsPath, 'utf8');
      const facts = JSON.parse(raw);
      const summary: BundleSummaryDTO = {
        id: facts.bundle?.newestSha || 'bundle',
        commitCount: facts.bundle?.shas?.length || 0,
        fileCount: facts.scope?.files || 0,
        symbolCount: facts.working?.symbols || 0,
        createdAt: facts.generated_at,
      };

      logInfo('[AnalysisController] Hydrated bundle facts from persisted cache');
      return { facts, summary };
    } catch (error) {
      logDebug(`[AnalysisController] hydrateFromPersistedFacts error: ${error}`);
      return null;
    }
  }

  public async resolveSkeleton(
    config: any
  ): Promise<{ files: string[]; roots: string[]; mode: string } | null> {
    try {
      const pipeline = await getRefactorPipeline();

      // Increase timeout for large repos and handle gracefully
      const skeleton = await withTimeout(
        pipeline.workspaceIndexer.getSkeleton(config),
        120000, // 2 minutes for large repos
        'Skeleton resolution'
      ).catch(error => {
        logWarn(
          `[AnalysisController] Skeleton resolution failed or timed out, using empty skeleton: ${error}`
        );
        return { files: [], roots: [], mode: config.mode || 'repo' };
      });

      this.skeletonCache = skeleton;
      return skeleton;
    } catch (error) {
      logError('[AnalysisController] Failed to resolve skeleton', error);
      return null;
    }
  }

  public async generatePartialFacts(skeleton: {
    files: string[];
    roots: string[];
    mode: string;
  }): Promise<RefactorBundleFacts> {
    const pipeline = await getRefactorPipeline();

    // Check if full scan has already completed before running quick scan
    let shouldSkipQuickScan = false;
    try {
      const gitOps = new GitOperations();
      const headSha = await gitOps.getHeadSha();

      if (getDatabase() !== null) {
        // Check if HEAD has full scan symbols (change_type != 'quick_scan')
        const fullScanCheck = getDatabase()
          ?.prepare(
            `SELECT COUNT(*) as count FROM symbols WHERE sha = ? AND change_type != 'quick_scan'`
          )
          .get([headSha]) as { count: number } | null;
        if (fullScanCheck && fullScanCheck.count > 0) {
          logInfo(
            `[AnalysisController] Full scan already completed for HEAD (${fullScanCheck.count} symbols found), skipping quick scan`
          );
          shouldSkipQuickScan = true;
        }
      }
    } catch (e) {
      logDebug(`[AnalysisController] Could not check full scan status: ${e}`);
      // Continue with quick scan if check fails
    }

    // Perform Quick Scan for symbols (only if full scan hasn't completed)
    let quickSymbols: any[] = [];
    if (!shouldSkipQuickScan) {
      try {
        logInfo(`[AnalysisController] Starting Quick Scan for ${skeleton.files.length} files...`);
        // Enable persistence for quick scan to populate DB immediately
        // Use low priority (background workers) for the massive initial scan
        quickSymbols = await pipeline.workspaceIndexer.quickScanSymbols(skeleton.files, {
          persist: true,
          priority: false,
        });
        logInfo(`[AnalysisController] Quick Scan complete. Found ${quickSymbols.length} symbols.`);
      } catch (e) {
        logWarn(`[AnalysisController] Quick Scan failed: ${e}`);
      }
    } else {
      logInfo(`[AnalysisController] Skipping Quick Scan - full scan already completed`);
    }

    // Count total commits for optimistic time travel
    let totalCommits = 0;
    try {
      const gitOps = new GitOperations();
      // Use git rev-list to count all commits
      const { stdout } = await gitOps.spawnGit(['rev-list', '--all', '--count']);
      totalCommits = parseInt(stdout.trim(), 10) || 0;
      logInfo(`[AnalysisController] Total commits: ${totalCommits}`);
    } catch (e) {
      logWarn(`[AnalysisController] Failed to count commits: ${e}`);
    }

    // Use actual HEAD SHA if available, otherwise fallback to 'HEAD'
    let headSha = 'HEAD';
    try {
      const gitOps = new GitOperations();
      headSha = await gitOps.getHeadSha();
    } catch (e) {
      logWarn(`[AnalysisController] Failed to get HEAD SHA: ${e}`);
    }

    // Create temporary facts for symbol hydration and partial view
    const partialFacts: any = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      confidence: 1.0,
      bundle: {
        oldestSha: headSha,
        newestSha: headSha,
        shas: [headSha],
        totalCommits,
      },
      intended: {
        present: skeleton.files.length,
        absent: 0,
        renamed: 0,
      },
      scope: {
        files: skeleton.files.length,
        blastRadius: 0,
      },
      working: {
        symbols: quickSymbols.length,
        edges: 0,
      },
      evidence: {
        'scope.files': skeleton.files,
        'working.symbols': quickSymbols,
        'working.edges': [],
      },
    };

    return partialFacts;
  }

  public async startBackgroundAnalysis(
    config: any,
    files: string[],
    _onProgress: (event: any) => void
  ): Promise<void> {
    logInfo(`[AnalysisController] Starting background analysis for ${files.length} files...`);
    const { GitOperations } = await import('../../../analysis/git');
    const git = new GitOperations();

    // Fetch recent commits for the scope to seed the bundle
    // Use configured default commit count or fallback to 5
    const defaultCommitCount = vscode.workspace
      .getConfiguration('git-context')
      .get<number>('defaultCommitCount', 5);

    const history = await git.getRecentCommits(defaultCommitCount);
    const shas = history.map(c => c.sha);

    if (shas.length > 0) {
      // Use AnalysisCoordinator instead of calling pipeline directly
      const { getAnalysisCoordinator } = await import('../../../services/analysisCoordinator');
      const coordinator = getAnalysisCoordinator();
      await coordinator.requestBackgroundAnalysis(shas);

      logInfo('[AnalysisController] Background analysis complete.');
    }
  }

  public async analyzeFrame(
    frameId: string,
    callback: (tier: number, frameId: string) => void
  ): Promise<void> {
    const service = await getAnalysisService();
    await service.analyzeFrame(frameId, this.view, callback);
  }
}
