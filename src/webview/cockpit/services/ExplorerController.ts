import * as vscode from 'vscode';
import { ExplorerService } from '../../../services/explorerService';
import { getCockpitOrchestrator } from '../../../state/cockpitOrchestrator';
import { getStore } from '../../../state/store';
import { logInfo, logError } from '../../../utils/logger';
import { BundleManager } from './BundleManager';

export class ExplorerController {
    private readonly orchestrator = getCockpitOrchestrator();

    constructor(
        private readonly view: vscode.WebviewView,
        private readonly bundleManager: BundleManager
    ) { }

    async updateExplorerTree() {
        try {
            const state = this.orchestrator.getState();
            const facts = state.bundleFacts;
            const bundles = await this.bundleManager.getBundles();

            // Pass bundles to ExplorerService (which we'll update next)
            // For now, we'll just pass the current facts/skeleton logic but wrapped
            const nodes = ExplorerService.getInstance().getExplorerTree(facts, null, bundles);

            // Sync with store
            getStore().dispatch({ type: 'EXPLORER_UPDATED', payload: { nodes } });

            logInfo(`[ExplorerController] Updated explorer tree with ${nodes.length} root nodes`);
        } catch (error) {
            logError('[ExplorerController] Failed to update explorer tree', error);
        }
    }
}
