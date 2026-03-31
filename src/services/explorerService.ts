import { BundleFactsDTO, ExplorerNode } from '../types/cockpit';
import { logInfo } from '../utils/logger';
import { getPathService } from './pathService';

export class ExplorerService {
  private static instance: ExplorerService;

  private constructor() {
    //empty
  }

  static getInstance(): ExplorerService {
    if (!ExplorerService.instance) {
      ExplorerService.instance = new ExplorerService();
    }
    return ExplorerService.instance;
  }

  /**
   * Generates the full explorer tree, injecting static nodes (Reports, Bundle)
   * and merging with dynamic content (Files, Symbols).
   */
  getExplorerTree(
    bundleFacts: BundleFactsDTO | null,
    skeleton: { files: string[] } | null,
    bundles: any[] = [],
    activeBundleId?: string | null
  ): ExplorerNode[] {
    const bundleNodes: ExplorerNode[] = bundles.map(b => {
      const fileCount = b.config?.files?.length || 0;
      return {
        id: `bundle-${b.id}`,
        name: b.name,
        description: `${fileCount} files`,
        type: 'folder',
        status: 'ready',
        children: [],
      };
    });

    const newBundleNode: ExplorerNode = {
      id: 'new-bundle',
      name: 'New Bundle',
      type: 'folder',
      status: 'ready',
      children: [],
    };

    let fileNodes: ExplorerNode[] = [];

    if (skeleton && skeleton.files.length > 0) {
      fileNodes = this.buildFileTree(skeleton.files, 'scanning');
      if (bundleFacts) {
        this.hydrateSymbols(fileNodes, bundleFacts);
      }
    } else if (bundleFacts) {
      const files = (bundleFacts.evidence as any)?.['scope.files'] || [];
      fileNodes = this.buildFileTree(files, 'ready');
      this.hydrateSymbols(fileNodes, bundleFacts);
    }

    if (bundles.length > 0) {
      const activeNode = activeBundleId
        ? bundleNodes.find(n => n.id === `bundle-${activeBundleId}`)
        : bundleNodes[0];

      if (activeNode) {
        activeNode.children = fileNodes;
      } else if (bundleNodes.length > 0) {
        bundleNodes[0].children = fileNodes;
      }

      return [newBundleNode, ...bundleNodes];
    } else {
      const bundleNode: ExplorerNode = {
        id: 'bundle-root',
        name: 'Bundle Overview',
        description: `${fileNodes.length} files`,
        type: 'folder',
        status: 'ready',
        children: fileNodes,
      };
      return [newBundleNode, bundleNode];
    }
  }

  private buildFileTree(files: string[], defaultStatus: 'scanning' | 'ready'): ExplorerNode[] {
    logInfo(`Building tree for ${files.length} files (status=${defaultStatus})`);
    const root: ExplorerNode = {
      id: 'root',
      name: 'src',
      type: 'folder',
      status: 'ready',
      children: [],
    };
    const map = new Map<string, ExplorerNode>();
    map.set('', root);

    for (const file of files) {
      const parts = getPathService().toRelative(file).split('/');
      let currentPath = '';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const parentPath = currentPath;
        currentPath = currentPath ? `${currentPath}/${part}` : part;

        if (!map.has(currentPath)) {
          const node: ExplorerNode = {
            id: currentPath,
            name: part,
            type: isFile ? 'file' : 'folder',
            status: isFile ? defaultStatus : 'ready',
            children: [],
          };
          map.set(currentPath, node);

          const parent = map.get(parentPath);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(node);
          }
        }
      }
    }

    return root.children || [];
  }

  private hydrateSymbols(nodes: ExplorerNode[], bundleFacts: BundleFactsDTO) {
    const fileSymbols = new Map<string, any[]>();
    const workingSymbols = (bundleFacts?.evidence as any)?.['working.symbols'] || [];

    for (const symbol of workingSymbols) {
      let filePath: string;
      let symbolId: string;
      let symbolName: string;

      if (typeof symbol === 'string') {
        const parts = symbol.split(':');
        if (parts.length < 3) continue;
        symbolId = parts.pop()!;
        symbolName = parts.pop()!;
        filePath = parts.join(':');
      } else if (symbol && typeof symbol === 'object') {
        filePath = symbol.filePath;
        symbolId = symbol.id;
        symbolName = symbol.name;
      } else {
        continue;
      }

      if (!filePath || !symbolId || !symbolName) continue;

      const normalizedPath = getPathService().toRelative(filePath);
      if (!fileSymbols.has(normalizedPath)) {
        fileSymbols.set(normalizedPath, []);
      }
      fileSymbols.get(normalizedPath)?.push({ id: symbolId, name: symbolName });
    }

    logInfo(`[ExplorerService] Hydrating symbols for ${fileSymbols.size} files`);

    const visit = (node: ExplorerNode) => {
      if (node.type === 'file') {
        const normalizedId = getPathService().toRelative(node.id);
        const symbols = fileSymbols.get(normalizedId);
        if (symbols && symbols.length > 0) {
          node.children = symbols.map(s => ({
            id: `${node.id}::${s.id}`,
            name: s.name,
            type: 'symbol',
            status: 'ready',
          }));
        }
      } else if (node.children) {
        node.children.forEach(visit);
      }
    };

    nodes.forEach(visit);
  }
}

export function getExplorerService(): ExplorerService {
  return ExplorerService.getInstance();
}
