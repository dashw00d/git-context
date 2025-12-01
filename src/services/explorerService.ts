import { ExplorerNode, BundleFactsDTO, ContextFrame } from '../types/cockpit';
import { logInfo } from '../utils/logger';

export class ExplorerService {
  private static instance: ExplorerService;

  private constructor() {
    // Singleton
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
    bundles: any[] = []
  ): ExplorerNode[] {
    const bundleNodes: ExplorerNode[] = bundles.map(b => {
      const fileCount = b.config?.files?.length || 0;
      return {
        id: `bundle-${b.id}`,
        name: b.name,
        description: `${fileCount} files`,
        type: 'folder',
        status: 'ready',
        children: [], // We'll populate the active bundle's children below
      };
    });

    // Add "New Bundle" node
    const newBundleNode: ExplorerNode = {
      id: 'new-bundle',
      name: 'New Bundle',
      type: 'folder',
      status: 'ready',
      children: [],
    };

    // If no bundles exist, create a default "New Bundle" placeholder or similar?
    // For now, let's assume we always have at least one or we show an empty list.

    // Logic to populate the *active* bundle's children
    // TODO: We need to know WHICH bundle is active to populate it.
    // For this refactor step, we'll assume the first one or a specific one is active if we have facts.

    let fileNodes: ExplorerNode[] = [];

    if (skeleton && skeleton.files.length > 0) {
      fileNodes = this.buildFileTree(skeleton.files, 'scanning');
    } else if (bundleFacts) {
      const files = (bundleFacts.evidence as any)?.['scope.files'] || [];
      fileNodes = this.buildFileTree(files, 'ready');
      this.hydrateSymbols(fileNodes, bundleFacts);
    }

    // If we have bundles, we should probably attach the fileNodes to the ACTIVE bundle.
    // If we don't have a concept of "active bundle" passed in yet, we might need to adjust.
    // For now, let's append the "Bundle Overview" (legacy) if no bundles are passed,
    // OR if bundles are passed, put the files in the first one?

    if (bundles.length > 0) {
      // Attach files to the first bundle for now (MVP)
      // TODO: Logic to attach to *active* bundle
      bundleNodes[0].children = fileNodes;
      return [newBundleNode, ...bundleNodes];
    } else {
      // Legacy fallback
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
    if (files.length > 0) {
      logInfo(`Sample files: ${files.slice(0, 3).join(', ')}`);
    }
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
      const parts = file.split('/');
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

          // Attach to parent
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
    // Build map of file -> symbols
    const fileSymbols = new Map<string, any[]>();
    const workingSymbols = (bundleFacts?.evidence as any)?.['working.symbols'] || [];

    for (const symbolId of workingSymbols) {
      const [filePath, symbolName] = symbolId.split(':');
      if (!fileSymbols.has(filePath)) {
        fileSymbols.set(filePath, []);
      }
      fileSymbols.get(filePath)?.push({ id: symbolId, name: symbolName });
    }

    // Recursively find file nodes and add symbol children
    const visit = (node: ExplorerNode) => {
      if (node.type === 'file') {
        const symbols = fileSymbols.get(node.id);
        if (symbols && symbols.length > 0) {
          node.children = symbols.map(s => ({
            id: s.id,
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
