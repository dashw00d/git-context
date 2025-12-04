import * as vscode from 'vscode';
import { RefactorBundleFacts } from '../../../facts/types';
import { ExplorerService } from '../../../services/explorerService';
import { BundleView, ContextFrame, ExplorerNode } from '../../../types/cockpit';
import { logError, logInfo } from '../../../utils/logger';
import { BundleManager } from './BundleManager';

export class ExplorerController {
  private _explorerData: ExplorerNode[] = [];

  constructor(
    private readonly view: vscode.WebviewView | undefined,
    private readonly bundleManager: BundleManager
  ) {}

  public get explorerData(): ExplorerNode[] {
    return this._explorerData;
  }

  public async updateExplorerTree(
    facts: RefactorBundleFacts | null,
    skeleton: { files: string[]; roots: string[]; mode: string } | null
  ): Promise<ExplorerNode[]> {
    try {
      const bundles = await this.bundleManager.getBundles();
      const activeBundleId = this.bundleManager.getActiveBundleId();

      const nodes = ExplorerService.getInstance().getExplorerTree(
        facts,
        skeleton,
        bundles,
        activeBundleId
      );

      this._explorerData = nodes;
      logInfo(`[ExplorerController] Updated explorer tree (${nodes.length} root nodes)`);
      return nodes;
    } catch (error) {
      logError('[ExplorerController] Failed to update explorer tree', error);
      this._explorerData = [];
      return [];
    }
  }

  public updateNodeStatus(
    nodeId: string,
    status: 'scanning' | 'analyzing' | 'ready' | 'error'
  ): ExplorerNode[] {
    const updateNode = (nodes: ExplorerNode[]): ExplorerNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, status };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    this._explorerData = updateNode(this._explorerData);
    return this._explorerData;
  }

  public populateFolderFrame(frame: ContextFrame, bundleView: BundleView | null): ContextFrame {
    // Helper to find node in tree
    const findNode = (nodes: ExplorerNode[], id: string): ExplorerNode | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return undefined;
    };

    const node = findNode(this._explorerData, frame.id);
    if (!node) return frame;

    // Collect all descendant files
    const files: ExplorerNode[] = [];
    const collectFiles = (n: ExplorerNode) => {
      if (n.type === 'file') {
        files.push(n);
      } else if (n.children) {
        n.children.forEach(collectFiles);
      }
    };
    collectFiles(node);

    // Aggregate metrics
    let symbolCount = 0;
    let totalScore = 0;
    const hotspots: any[] = [];

    files.forEach(file => {
      // Count symbols (children of file node)
      if (file.children) {
        symbolCount += file.children.length;
      }

      // Check for hotspots/metrics
      if (bundleView?.hotspots) {
        const hotspot = bundleView.hotspots.find(h => h.path === file.id);
        if (hotspot) {
          hotspots.push(hotspot);
          totalScore += hotspot.score;
        }
      }
    });

    // Sort hotspots by score
    hotspots.sort((a, b) => b.score - a.score);

    return {
      ...frame,
      data: {
        fileCount: files.length,
        symbolCount,
        avgScore: files.length > 0 ? totalScore / files.length : 0,
        hotspots: hotspots.slice(0, 10), // Top 10
        files: files.map(f => ({ id: f.id, name: f.name, status: f.status })),
      },
    };
  }
}
