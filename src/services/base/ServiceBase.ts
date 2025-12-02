import { LRUCache } from 'lru-cache';
import pLimit = require('p-limit');
import { getDatabaseManager } from '../../storage/database';
import { logDebug, logWarn, logInfo } from '../../utils/logger';

export interface ServiceConfig {
  enableCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  enableTransactions?: boolean;
  enableWriteMutex?: boolean; // Enable write serialization
}

// Global write mutex for all database writes (singleton across all services)
const GLOBAL_WRITE_MUTEX = pLimit(1);
let writeWaitCount = 0;
let totalWaitTime = 0;

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
      enableWriteMutex: true, // Enable by default
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
    if (error.message?.includes('locked') || error.message?.includes('busy')) {
      logWarn(`[${context}] Database locked/busy, operation may retry`);
      return;
    }
    // eslint-disable-next-line no-restricted-syntax
    throw error;
  }

  protected async executeInTransaction<T>(fn: () => Promise<T> | T): Promise<T> {
    if (!this.config.enableTransactions) {
      return Promise.resolve(fn());
    }

    // Wrap in write mutex if enabled
    if (this.config.enableWriteMutex) {
      const startWait = Date.now();
      return GLOBAL_WRITE_MUTEX(async () => {
        const waitTime = Date.now() - startWait;
        if (waitTime > 5) {
          writeWaitCount++;
          totalWaitTime += waitTime;
          logDebug(
            `[ServiceBase] Write queued for ${waitTime}ms (total waits: ${writeWaitCount}, avg: ${(totalWaitTime / writeWaitCount).toFixed(0)}ms)`
          );
        }

        const db = this.db.getDatabase();
        return db.transaction(() => Promise.resolve(fn()))();
      });
    }

    const db = this.db.getDatabase();
    return db.transaction(() => Promise.resolve(fn()))();
  }

  /**
   * Get write mutex statistics for observability
   */
  static getWriteMutexStats() {
    return {
      writeWaitCount,
      totalWaitTime,
      avgWaitTime: writeWaitCount > 0 ? totalWaitTime / writeWaitCount : 0,
    };
  }

  /**
   * Reset write mutex statistics
   */
  static resetWriteMutexStats() {
    writeWaitCount = 0;
    totalWaitTime = 0;
    logInfo('[ServiceBase] Reset write mutex stats');
  }
}
