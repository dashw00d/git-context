import { getDatabaseService } from '../../../services/databaseService';
import { logInfo, logError } from '../../../utils/logger';
import { BundleConfig } from '../../../types/cockpit';

export class BundleManager {
    private readonly db = getDatabaseService();
    private activeBundleId: string | null = null;

    constructor() { }

    async createBundle(name: string, config: BundleConfig): Promise<string> {
        try {
            const id = await this.db.createBundle(name, config);
            logInfo(`[BundleManager] Created bundle: ${name} (${id})`);
            return id;
        } catch (error) {
            logError('[BundleManager] Failed to create bundle', error);
            throw error;
        }
    }

    async getBundles(): Promise<any[]> {
        return await this.db.getBundles();
    }

    async deleteBundle(id: string): Promise<void> {
        await this.db.deleteBundle(id);
        if (this.activeBundleId === id) {
            this.activeBundleId = null;
        }
    }

    async setActiveBundle(id: string): Promise<void> {
        this.activeBundleId = id;
    }

    getActiveBundleId(): string | null {
        return this.activeBundleId;
    }
}
