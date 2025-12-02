import * as vscode from 'vscode';
import { getStore } from '../../../state/store';
import { BundleView } from '../../../types/cockpit';
import { logDebug, logError, logInfo } from '../../../utils/logger';
import { PipelineDebugger } from '../../../utils/pipelineDebugger';

export class AnalysisController {
  public hotspotCache: Map<string, any[]> = new Map();
  public skeletonCache: { files: string[]; roots: string[]; mode: string } | null = null;
  private pipelineDebugger = new PipelineDebugger();
  private bundleViewVersion = 0;

  constructor(private readonly view?: vscode.WebviewView) {}

  public setSkeletonCache(skeleton: any) {
    this.skeletonCache = skeleton;
  }

  public clearHotspotCache() {
    this.hotspotCache.clear();
    logInfo('[AnalysisController] Cleared hotspot cache');
  }

  public clearSkeletonCache() {
    this.skeletonCache = null;
  }

  public resetBundleViewVersion() {
    this.bundleViewVersion = 0;
  }

  async analyzeFrame(frameId: string) {
    const gitRoot = (await import('../../../utils/config')).getGitRoot();
    if (!gitRoot || !this.view) return;

    // Symbol IDs use single colon separator (e.g., "file.php:method_name")
    // Detect symbols by checking if there's a colon after a file extension
    const symbolMatch = frameId.match(/^(.+\.\w+):(.+)$/);
    const level: 'file' | 'symbol' = symbolMatch ? 'symbol' : 'file';
    let targetPath = frameId;

    if (level === 'symbol' && symbolMatch) {
      targetPath = symbolMatch[1]; // Extract file path before the colon
    }

    // Navigation is handled by the webview before calling analyzeFrame.
    // We only enrich the frame with analysis data via tier completion actions.
    const { FrameAnalyzer } = await import('./FrameAnalyzer');
    const analyzer = new FrameAnalyzer(this.view);
    const state = getStore().getState();
    const facts = state.bundleFacts;
    const activeFrame = state.activeFrame.id;

    // TIER 1: Structure (Always succeeds)
    // Capture tier1Data to thread through to tier 3
    let tier1Data: any;
    this.pipelineDebugger.startTier(frameId, 1, activeFrame);
    try {
      tier1Data = await analyzer.analyzeTier1(frameId, targetPath, gitRoot);
      const currentState = getStore().getState();
      this.pipelineDebugger.completeTier(frameId, 1, tier1Data, currentState.activeFrame.id);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_1_COMPLETE',
        payload: { frameId, data: tier1Data },
      });
    } catch (error) {
      this.pipelineDebugger.failTier(frameId, 1, String(error));
      logError(`[Tier 1] Failed for ${frameId}`, error);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 1, error: String(error) },
      });
      return;
    }

    // TIER 2: Hybrid Metadata (Best effort)
    this.pipelineDebugger.startTier(frameId, 2, getStore().getState().activeFrame.id);
    try {
      const tier2Data = await analyzer.analyzeTier2(frameId, targetPath, facts);
      const currentState = getStore().getState();
      this.pipelineDebugger.completeTier(frameId, 2, tier2Data, currentState.activeFrame.id);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_2_COMPLETE',
        payload: { frameId, data: tier2Data },
      });
    } catch (error) {
      this.pipelineDebugger.failTier(frameId, 2, String(error));
      logError(`[Tier 2] Failed for ${frameId}`, error);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 2, error: String(error) },
      });
      // Continue to Tier 3 even if Tier 2 fails
    }

    // TIER 3: Semantics (Optional)
    // Use tier1Data.content directly to avoid race condition with reducer
    this.pipelineDebugger.startTier(frameId, 3, getStore().getState().activeFrame.id);
    try {
      const content = tier1Data?.content || '';
      const tier3Data = await analyzer.analyzeTier3(frameId, targetPath, content, facts);
      const currentState = getStore().getState();
      this.pipelineDebugger.completeTier(frameId, 3, tier3Data, currentState.activeFrame.id);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_3_COMPLETE',
        payload: { frameId, data: tier3Data },
      });
      logInfo(`[Cockpit] Analyzed frame ${frameId} (${level})`);
    } catch (error) {
      this.pipelineDebugger.failTier(frameId, 3, String(error));
      logError(`[Tier 3] Failed for ${frameId}`, error);
      getStore().dispatch({
        type: 'FRAME_ANALYSIS_TIER_FAILED',
        payload: { frameId, tier: 3, error: String(error) },
      });
    }
  }

  async updateSkeleton(config: any) {
    try {
      const { getRefactorPipeline } = await import('../../../services/pipelineFactory');
      const pipeline = await getRefactorPipeline();
      // Resolve the skeleton of files based on the configuration
      const skeleton = await pipeline.workspaceIndexer.getSkeleton(config);
      this.skeletonCache = skeleton;

      if (skeleton) {
        // Convert skeleton files to explorer nodes with 'scanning' status
        // This provides immediate visual feedback in the Explorer tree
        const nodes = skeleton.files.map((f: string) => ({
          id: f,
          name: f.split('/').slice(-1)[0] || f,
          type: 'file',
          status: 'scanning', // Visual feedback
          children: [],
        }));

        getStore().dispatch({ type: 'EXPLORER_UPDATED', payload: { nodes } });
        logInfo(`[Cockpit] Sent skeleton update (${nodes.length} files scanning)`);

        // NEW: Update Bundle View with Skeleton immediately
        // This populates the main Bundle Stage with "Scanning..." cards
        const pendingHotspots = skeleton.files.map((f: string) => ({
          path: f,
          name: f.split('/').slice(-1)[0] || f,
          score: 0,
          status: 'scanning',
        }));

        this.pushBundleView({
          tier: 'structure',
          hotspots: pendingHotspots,
          summary: {
            files: skeleton.files.length,
            commits: 0,
            symbols: 0,
          },
          skeleton: {
            mode: skeleton.mode,
            roots: skeleton.roots,
            files: skeleton.files.slice(0, 200),
          },
          isPartial: true,
        });
      }
    } catch (error) {
      logError('[Cockpit] Failed to update skeleton', error);
    }
  }

  async updateBundleData() {
    try {
      // Always fetch the latest state to avoid race conditions with async updates
      const state = getStore().getState();
      const facts = state.bundleFacts;

      // If we have no facts yet, check if we have a skeleton to at least show something
      if (!facts && this.skeletonCache) {
        // We are likely in the "scanning" phase, don't overwrite with empty data
        // unless we explicitly want to clear.
        // However, if we are called, it might be to refresh the view.
        // Let's proceed but be careful not to clear existing hotspots if we are just waiting.
      }

      // Fix: Use stable cache key (SHA set or bundle id) instead of just newestSha
      const cacheKey = facts?.bundle?.shas ? facts.bundle.shas.join(',') : 'workspace';
      let hotspots: any[] = [];
      if (facts) {
        if (this.hotspotCache.has(cacheKey)) {
          hotspots = this.hotspotCache.get(cacheKey)!;
        } else {
          hotspots =
            (facts as any)?.evidence?.hotspots ||
            (facts as any)?.findings?.hotspots ||
            (facts as any)?.hotspots ||
            [];

          hotspots = hotspots.map((h: any) => ({
            name: (h.path || h.filePath)?.split('/').slice(-1)[0] || h.path || h.filePath,
            path: h.path || h.filePath,
            score: h.drift_count || h.score || h.hotspotScore || h.count || 0,
            count: h.count || h.totalChanges,
            size: h.size,
            added: h.added,
            removed: h.removed,
          }));

          // If hotspots are missing in facts, fetch churn from git as a fallback
          if (!hotspots.length) {
            try {
              const { GitOperations } = await import('../../../analysis/git');
              const gitOps = new GitOperations();
              const churn = await gitOps.getHotspots(100);
              hotspots = churn.map((h: any) => ({
                path: h.path,
                name: h.path.split('/').pop(),
                score: h.count,
                count: h.count,
                size: h.size,
                added: h.added,
                removed: h.removed,
              }));
            } catch (err) {
              logDebug(`[Cockpit] Fallback hotspots failed: ${err}`);
            }
          }
          // Cache Management: LRU with max 10 entries
          if (this.hotspotCache.size >= 10) {
            const firstKey = this.hotspotCache.keys().next().value;
            if (firstKey) this.hotspotCache.delete(firstKey);
          }
          this.hotspotCache.set(cacheKey, hotspots);
        }
      } else {
        // If no cache and no facts, fetch churn to populate heatmap
        if (!hotspots.length) {
          try {
            const { GitOperations } = await import('../../../analysis/git');
            const gitOps = new GitOperations();
            const churn = await gitOps.getHotspots(100);

            // RACE CONDITION CHECK:
            // If facts arrived while we were awaiting gitOps, abort this fallback update
            // because the facts-based update (triggered by store change) should take precedence.
            const currentState = getStore().getState();
            if (currentState.bundleFacts) {
              logInfo('[Cockpit] Aborting fallback bundle update (facts arrived)');
              return;
            }

            hotspots = churn.map((h: any) => ({
              path: h.path,
              name: h.path.split('/').pop(),
              score: h.count,
              count: h.count,
              size: h.size,
              added: h.added,
              removed: h.removed,
            }));
          } catch (err) {
            logDebug(`[Cockpit] Fallback hotspots (no facts) failed: ${err}`);
          }
        }
      }

      // Basic risk summary for bundle inspector
      const driftSymbols =
        ((facts?.findings as any)?.patternDrift?.conventionDrift?.driftSymbols as any[]) || [];
      const topRisks = driftSymbols.slice(0, 5).map((d: any) => ({
        path: d.path,
        name: d.name,
        issue: 'Naming drift',
        detail: d.suggestedName ? `Suggested: ${d.suggestedName}` : '',
      }));

      const summary = facts
        ? {
            commits: facts.bundle?.shas?.length || 0,
            files: facts.scope?.files || 0,
            symbols: facts.working?.symbols || 0,
          }
        : { commits: 0, files: 0, symbols: 0 };

      const treemap = this.buildTreemap(hotspots);

      const tier: 'structure' | 'hybrid' | 'semantics' = facts ? 'semantics' : 'hybrid';
      const payload: BundleView = {
        hotspots,
        summary,
        risks: topRisks,
        treemap,
        tier,
      };

      this.pushBundleView(payload);
      logInfo(`[Cockpit] Sent bundle data (${hotspots.length} hotspots)`);
    } catch (error) {
      logError('[Cockpit] Failed to update bundle data', error);
      // Send empty data to stop loading state
      this.pushBundleView({ hotspots: [], error: String(error) });
    }
  }

  private pushBundleView(view: BundleView) {
    const store = getStore();
    // Increment version to ensure monotonic ordering
    this.bundleViewVersion++;
    // Only dispatch BUNDLE_VIEW_UPDATED - the reducer will update activeFrame.data for root
    store.dispatch({
      type: 'BUNDLE_VIEW_UPDATED',
      payload: { view, version: this.bundleViewVersion },
    });
  }

  private buildTreemap(hotspots: any[]) {
    try {
      // Guard against excessive size
      const MAX_HOTSPOTS = 1000;
      const MAX_DEPTH = 10;
      const limitedHotspots = hotspots.slice(0, MAX_HOTSPOTS);

      // Aggregate churn per folder/file for a simple treemap structure, weight by churn*log(size)
      const root: any = {};
      const scores: number[] = [];

      for (const h of limitedHotspots) {
        if (!h.path) continue;
        const parts = h.path.split('/').filter(Boolean);

        // Enforce depth limit
        if (parts.length > MAX_DEPTH) {
          logDebug(`[Treemap] Skipping deep path (${parts.length} levels): ${h.path}`);
          continue;
        }

        let cursor = root;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const isFile = i === parts.length - 1;
          if (!cursor[part]) {
            cursor[part] = {
              id: parts.slice(0, i + 1).join('/'),
              name: part,
              score: 0,
              added: 0,
              removed: 0,
              children: {},
            };
          }
          if (isFile) {
            const sizeWeight = h.size ? Math.log10(h.size + 1) : 1;
            const churn = h.score || h.count || 0;
            const changeWeight = (h.added || 0) + (h.removed || 0);
            cursor[part].score += (churn + changeWeight / 50) * sizeWeight;
            cursor[part].added += h.added || 0;
            cursor[part].removed += h.removed || 0;
          }
          cursor = cursor[part].children;
        }
      }

      const flatten = (nodeMap: any, depth = 0): any[] => {
        // Prevent runaway recursion
        if (depth > MAX_DEPTH) return [];

        return Object.values(nodeMap).map((node: any) => {
          const children = flatten(node.children, depth + 1);
          const childrenScore = children.reduce((sum: number, c: any) => sum + c.score, 0);
          const totalScore = Math.max(node.score, childrenScore);
          const totalAdded =
            (node.added || 0) + children.reduce((sum: number, c: any) => sum + (c.added || 0), 0);
          const totalRemoved =
            (node.removed || 0) +
            children.reduce((sum: number, c: any) => sum + (c.removed || 0), 0);
          scores.push(totalScore);
          return {
            id: node.id,
            name: node.name,
            value: totalScore, // Satisfy schema
            score: totalScore,
            added: totalAdded,
            removed: totalRemoved,
            children,
          };
        });
      };

      const tree = flatten(root);
      const max = scores.length ? Math.max(...scores) : 1;
      const normalize = (nodes: any[]): any[] =>
        nodes.map(n => ({
          ...n,
          weight: max > 0 ? Math.max(n.score / max, 0.05) : 0.05,
          children: n.children ? normalize(n.children) : [],
        }));

      return normalize(tree);
    } catch (error) {
      logError('[Treemap] Build failed', error);
      // Return empty treemap on error to prevent crashes
      return [];
    }
  }

  /**
   * Extract a focused snippet around a symbol name if possible.
   */
  public extractSnippet(content: string | undefined, symbolName: string): string | undefined {
    if (!content) return undefined;
    if (!symbolName) return content.slice(0, 1800);
    const idx = content.indexOf(symbolName);
    if (idx === -1) return content.slice(0, 1800);
    const lines = content.split('\n');
    let running = 0;
    let lineIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      running += lines[i].length + 1;
      if (running >= idx) {
        lineIndex = i;
        break;
      }
    }
    const start = Math.max(0, lineIndex - 5);
    const end = Math.min(lines.length, lineIndex + 15);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Load persisted bundle facts from disk (last-bundle-facts.json) so the bundle
   * view can render immediately after reload without re-running analysis.
   */
  async hydrateFromPersistedFacts() {
    const state = getStore().getState();
    if (state.bundleFacts) return;
    try {
      const { getGitRoot } = await import('../../../utils/config');
      const gitRoot = getGitRoot();
      if (!gitRoot) return;
      const path = await import('path');
      const fs = await import('fs');
      const factsPath = path.join(gitRoot, '.git/commit-tracker/last-bundle-facts.json');
      if (!fs.existsSync(factsPath)) return;
      const raw = fs.readFileSync(factsPath, 'utf8');
      const facts = JSON.parse(raw);
      const persistedTreemap = facts.treemap || undefined;
      const persistedHotspots = facts.hotspots || undefined;
      const summary = {
        id: facts.bundle?.newestSha || 'bundle',
        commitCount: facts.bundle?.shas?.length || 0,
        fileCount: facts.scope?.files || 0,
        symbolCount: facts.working?.symbols || 0,
        createdAt: facts.generated_at,
      };
      getStore().dispatch({
        type: 'BUNDLE_FACTS_UPDATED',
        payload: {
          facts,
          summary: {
            id: summary.id || 'bundle',
            commitCount: summary.id ? 1 : 0,
            fileCount: summary.fileCount || 0,
            symbolCount: summary.symbolCount || 0,
          },
        },
      });

      if (persistedHotspots) {
        this.hotspotCache.set(summary.id || 'bundle', persistedHotspots);
      }
      if (persistedTreemap) {
        this.pushBundleView({
          treemap: persistedTreemap,
          hotspots: persistedHotspots || [],
          summary: {
            commits: summary.id ? 1 : 0,
            files: summary.fileCount || 0,
            symbols: summary.symbolCount || 0,
          },
          tier: 'semantics',
        });
      }
      await this.updateBundleData();
      logInfo('[Cockpit] Hydrated bundle facts from persisted cache');
    } catch (error) {
      logDebug(`[Cockpit] hydrateFromPersistedFacts error: ${error}`);
    }
  }

  async sendSkeletonProgress() {
    const state = getStore().getState();
    const config = state.bundleConfig || {
      mode: 'repo',
      roots: [],
      includeConnected: false,
      exclusions: [],
    };
    try {
      const { ContextSkeletonService } = await import('../../../services/contextSkeleton');
      const skeletonService = new ContextSkeletonService();
      const skeleton = await skeletonService.resolveSkeleton(config as any);
      this.skeletonCache = skeleton;

      const nodes = skeleton.files.map((f: string) => ({
        id: f,
        name: f.split('/').slice(-1)[0] || f,
        type: 'file' as const,
        status: 'scanning' as const,
        children: [],
      }));
      getStore().dispatch({ type: 'EXPLORER_UPDATED', payload: { nodes } });

      this.pushBundleView({
        tier: 'structure',
        summary: {
          commits: state.selectedCommitShas.length,
          files: skeleton.files.length,
          symbols: state.bundleSummary?.symbolCount || 0,
        },
        skeleton: {
          mode: skeleton.mode,
          roots: skeleton.roots,
          files: skeleton.files.slice(0, 200), // cap to avoid huge payloads
        },
        hotspots: skeleton.files.slice(0, 200).map((path: string) => ({
          path,
          name: path.split('/').slice(-1)[0] || path,
          score: 0,
          status: 'scanning',
        })),
        isPartial: true,
      });

      logInfo(`[Cockpit] Sent skeleton progress (${skeleton.files.length} files scanning)`);
    } catch (error) {
      logDebug(`[Cockpit] Failed to send skeleton progress: ${error}`);
    }
  }

  /**
   * Send a fast "hybrid" update with virtual commit stats and quick churn while the full pipeline runs.
   */
  async sendHybridProgress() {
    try {
      if (!this.view) return;
      const state = getStore().getState();
      const { GitOperations } = await import('../../../analysis/git');
      const git = new GitOperations();
      const staged = await git.getStagedFiles().catch(() => []);
      const unstaged = await git.getUnstagedFiles().catch(() => []);
      const stagedDiff = await git.getDiffStats('staged').catch(() => ({ added: 0, removed: 0 }));
      const unstagedDiff = await git
        .getDiffStats('unstaged')
        .catch(() => ({ added: 0, removed: 0 }));
      const hybridHotspots = await git.getHotspots(50).catch(() => []);

      // Use cached hotspots/treemap if available for quick churn signal, otherwise fallback to fresh git churn
      let hotspots = this.hotspotCache.values().next().value || [];
      if (!hotspots.length) {
        hotspots = hybridHotspots.map((h: any) => ({
          path: h.path,
          name: h.path.split('/').pop(),
          score: h.count,
          count: h.count,
          size: h.size,
          added: h.added,
          removed: h.removed,
        }));
      }
      // Filter hotspots to skeleton scope if available
      if (this.skeletonCache) {
        const skeletonSet = new Set(this.skeletonCache.files);
        hotspots = hotspots.filter((h: any) => skeletonSet.has(h.path));
      }
      const treemap = this.buildTreemap(hotspots);

      this.pushBundleView({
        tier: 'hybrid',
        summary: {
          commits: state.selectedCommitShas.length,
          files: state.bundleSummary?.fileCount || 0,
          symbols: state.bundleSummary?.symbolCount || 0,
          staged: staged.length,
          unstaged: unstaged.length,
        },
        virtualCommits: {
          staged,
          unstaged,
          stats: {
            staged: stagedDiff,
            unstaged: unstagedDiff,
          },
        },
        treemap,
        hotspots,
      });
      logInfo(
        `[Cockpit] Sent hybrid progress (staged=${staged.length}, unstaged=${unstaged.length})`
      );
    } catch (error) {
      logDebug(`[Cockpit] Failed to send hybrid progress: ${error}`);
    }
  }
}
