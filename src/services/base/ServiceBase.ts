import { LRUCache } from 'lru-cache';
import { getDatabaseManager } from '../../storage/database';
import { logDebug, logWarn } from '../../utils/logger';

export interface ServiceConfig {
  enableCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  enableTransactions?: boolean;
}

export abstract class ServiceBase {
  protected db: any;
  protected cache?: LRUCache<string, any>;
  protected config: ServiceConfig;

  constructor(config: ServiceConfig = {}) {
    this.config = {
      enableCache: true,
      cacheSize: 1000,
      cacheTTL: 3600000,
      enableTransactions: true,
      ...config,
    };

    // Ensure required values are set
    this.config.cacheSize = this.config.cacheSize ?? 1000;
    this.config.cacheTTL = this.config.cacheTTL ?? 3600000;
    this.db = getDatabaseManager();
    if (this.config.enableCache) {
      this.cache = new LRUCache({
        max: this.config.cacheSize,
        ttl: this.config.cacheTTL,
        ttlAutopurge: true,
        updateAgeOnGet: true,
      });
    }
  }

  protected async queryWithCache<T>(key: string, queryFn: () => Promise<T> | T): Promise<T> {
    if (this.cache?.has(key)) {
      return this.cache.get(key)!;
    }
    const result = await Promise.resolve(queryFn());
    this.cache?.set(key, result);
    return result;
  }

  protected handleDbError(error: any, context: string): void {
    if (error.message?.includes('duplicate') || error.message?.includes('UNIQUE')) {
      logDebug(`[${context}] Duplicate entry skipped: ${error.message}`);
      return;
    }
    if (error.message?.includes('locked')) {
      logWarn(`[${context}] Database locked, operation skipped`);
      return;
    }
    // eslint-disable-next-line no-restricted-syntax
    throw error;
  }

  protected async executeInTransaction<T>(fn: () => Promise<T> | T): Promise<T> {
    if (!this.config.enableTransactions) {
      return Promise.resolve(fn());
    }
    const db = this.db.getDatabase();
    return db.transaction(() => Promise.resolve(fn()))();
  }
}
