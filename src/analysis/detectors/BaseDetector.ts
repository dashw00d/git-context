import { LRUCache } from 'lru-cache';
import { getExtensionConfig } from '../../utils/config';
import { computeFingerprint } from '../../utils/fingerprint';
import { logDebug, logInfo, logWarn } from '../../utils/logger';

/**
 * Logger interface for dependency injection
 */
export interface DetectorLogger {
  debug: (message: string) => void;
  warn: (message: string) => void;
  info: (message: string) => void;
}

/**
 * Configuration for detector thresholds and caching
 */
export interface DetectorConfig {
  thresholds?: Partial<ThresholdConfig>;
  enableCaching?: boolean;
  cacheTTL?: number;
  maxCacheSize?: number;
  logger?: DetectorLogger;
}

/**
 * Threshold configuration for detector algorithms
 */
export interface ThresholdConfig {
  similarityMin: number;
  confidenceMin: number;
  changeThreshold: number;
  maxGroupSize: number;
  scoreWeight: number;
}

/**
 * Default threshold configuration
 */
export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  similarityMin: 0.7,
  confidenceMin: 0.5,
  changeThreshold: 3,
  maxGroupSize: 1000,
  scoreWeight: 1.0,
};

/**
 * Abstract base class for all detectors
 * Provides shared utilities for grouping, deduplication, scoring, and caching
 *
 * ## Configuration Injection
 *
 * Thresholds are automatically loaded from `ExtensionConfig.detectorThresholds` (VS Code settings
 * or `.git-context.config.json`). Per-instance overrides can be provided via constructor:
 *
 * ```typescript
 * const detector = new MyDetector({
 *   thresholds: { similarityMin: 0.8 },
 *   enableCaching: false
 * });
 * ```
 *
 * ## Pipeline Integration
 *
 * Detectors can be used in pipeline steps (`src/analysis/runner/steps/`):
 *
 * ```typescript
 * export function createMyStep(): PipelineStep {
 *   return {
 *     id: 'my_detection',
 *     async run(state: PipelineState) {
 *       const detector = new MyDetector();
 *       state.myResults = await detector.detect(state.input);
 *     }
 *   };
 * }
 * ```
 *
 * ## Caching Behavior
 *
 * Results are cached using content-addressed keys (via `computeFingerprint`).
 * Cache keys are namespaced by detector class name to avoid collisions.
 * Use `getCachedResult()` with `generateCacheKey()` for automatic caching:
 *
 * ```typescript
 * return this.getCachedResult(this.generateCacheKey(input), async () => {
 *
 * });
 * ```
 *
 * ## Utility Methods
 *
 * - `groupBy()` - Group items by key function (with null guards)
 * - `deduplicateByScore()` - Keep highest-scoring item per group
 * - `deduplicateByConfidence()` - Filter by confidence threshold
 * - `score()` - Calculate composite score (normalized 0-1)
 * - `postProcess()` - Override for output filtering/transformation
 *
 * @example
 * ```typescript
 * class MyDetector extends BaseDetector<MyInput, MyOutput> {
 *   async detect(input: MyInput): Promise<MyOutput> {
 *
 *
 *
 *     return this.getCachedResult(this.generateCacheKey(input), async () => {
 *       const groups = this.groupBy(input.items, item => item.category);
 *       const deduped = this.deduplicateByScore(groups);
 *       const result = deduped.map(item => ({ ...item, score: this.score(item.metrics) }));
 *       return this.postProcess(result, input);
 *     });
 *   }
 *
 *   protected async postProcess(output: MyOutput, input: MyInput): Promise<MyOutput> {
 *
 *     return output.filter(item => item.score > 0.5);
 *   }
 * }
 * ```
 */
export abstract class BaseDetector<TInput, TOutput> {
  protected config: DetectorConfig & { thresholds: ThresholdConfig; logger: DetectorLogger };
  protected cache?: LRUCache<string, any>;

  constructor(config: Partial<DetectorConfig> = {}) {
    const extensionConfig = getExtensionConfig();
    const baseThresholds = extensionConfig.detectorThresholds
      ? {
          similarityMin:
            extensionConfig.detectorThresholds.similarityMin ?? DEFAULT_THRESHOLDS.similarityMin,
          confidenceMin:
            extensionConfig.detectorThresholds.confidenceMin ?? DEFAULT_THRESHOLDS.confidenceMin,
          changeThreshold:
            extensionConfig.detectorThresholds.changeThreshold ??
            DEFAULT_THRESHOLDS.changeThreshold,
          maxGroupSize:
            extensionConfig.detectorThresholds.maxGroupSize ?? DEFAULT_THRESHOLDS.maxGroupSize,
          scoreWeight:
            extensionConfig.detectorThresholds.scoreWeight ?? DEFAULT_THRESHOLDS.scoreWeight,
        }
      : DEFAULT_THRESHOLDS;

    const finalThresholds: ThresholdConfig = {
      ...baseThresholds,
      ...config.thresholds,
    };

    const logger: DetectorLogger = config.logger || {
      debug: logDebug,
      warn: logWarn,
      info: logInfo,
    };

    this.config = {
      thresholds: finalThresholds,
      enableCaching: config.enableCaching ?? true,
      cacheTTL: config.cacheTTL ?? 3600000,
      maxCacheSize: config.maxCacheSize ?? 100,
      logger,
    } as DetectorConfig & { thresholds: ThresholdConfig; logger: DetectorLogger };

    if (this.config.enableCaching) {
      this.cache = new LRUCache({
        max: this.config.maxCacheSize || 100,
        ttl: this.config.cacheTTL || 3600000,
        ttlAutopurge: true,
        updateAgeOnGet: true,
      });
    }

    this.config.logger.debug(
      `[BaseDetector:${this.constructor.name}] Initialized with thresholds: ${JSON.stringify(this.config.thresholds)}`
    );
  }

  /**
   * Abstract method that detectors must implement
   * Performs the core detection logic
   *
   * @param input - Input data for detection
   * @returns Detection results
   *
   * @example
   * ```typescript
   * async detect(input: MyInput): Promise<MyOutput> {
   *   return this.getCachedResult(this.generateCacheKey(input), async () => {
   *     const result = await this.performDetection(input);
   *     return this.postProcess(result, input);
   *   });
   * }
   * ```
   */
  abstract detect(input: TInput): Promise<TOutput>;

  /**
   * Post-process detection output (optional hook for filtering/transforming)
   * Override this method to add custom filtering, validation, or transformation
   *
   * @param output - The detection output
   * @param input - The original input (for context)
   * @returns Processed output (default: returns output unchanged)
   *
   * @example
   * ```typescript
   * protected async postProcess(output: MyOutput, input: MyInput): Promise<MyOutput> {
   *
   *   return output.filter(item => item.confidence > 0.5);
   * }
   * ```
   */
  protected async postProcess(output: TOutput, _input: TInput): Promise<TOutput> {
    return output;
  }

  /**
   * Group items by a key function
   * Commonly used for grouping by name, path, or other identifiers
   */
  protected groupBy<T>(
    items: T[] | null | undefined,
    keyFn: (item: T) => string
  ): Map<string, T[]> {
    if (!items?.length) return new Map();

    const groups = new Map<string, T[]>();
    for (const item of items) {
      if (!item) continue;

      try {
        const key = keyFn(item);
        if (!key) continue;

        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(item);
      } catch (e) {
        this.config.logger.warn(
          `[BaseDetector] GroupBy error for item: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    return groups;
  }

  /**
   * Group items by multiple keys
   * Useful for hierarchical grouping (e.g., by file then by symbol)
   */
  protected groupByMultiple<T>(items: T[], keyFns: ((item: T) => string)[]): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = keyFns.map(fn => fn(item)).join('|');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }
    return groups;
  }

  /**
   * Deduplicate items within groups based on score
   * Keeps the highest-scoring item from each group
   */
  protected deduplicateByScore<T extends { score?: number; id?: string }>(
    groups: Map<string, T[]> | null | undefined
  ): T[] {
    if (!groups) return [];

    const deduped: T[] = [];
    for (const [groupKey, group] of groups) {
      if (!group?.length) continue;

      if (group.length <= 1) {
        deduped.push(...group);
        continue;
      }

      const validItems = group.filter(item => {
        const score = item.score;
        return typeof score === 'number' && !isNaN(score) && isFinite(score);
      });

      if (validItems.length === 0) {
        deduped.push(group[0]!);
        continue;
      }

      const best = validItems.reduce((prev, curr) =>
        (curr.score ?? 0) > (prev.score ?? 0) ? curr : prev
      );

      const bestScore = best.score ?? 0;
      if (bestScore >= this.config.thresholds.similarityMin) {
        deduped.push(best);
      } else {
        this.config.logger.debug(
          `[BaseDetector] Skipped low-score group ${groupKey}: ${bestScore}`
        );
      }
    }
    return deduped;
  }

  /**
   * Deduplicate items within groups based on confidence
   * Keeps items above confidence threshold
   */
  protected deduplicateByConfidence<T extends { confidence?: number }>(
    groups: Map<string, T[]> | null | undefined
  ): T[] {
    if (!groups) return [];

    const deduped: T[] = [];
    for (const group of groups.values()) {
      if (!group?.length) continue;

      const validItems = group.filter(item => {
        const confidence = item.confidence;
        if (typeof confidence !== 'number' || isNaN(confidence) || !isFinite(confidence)) {
          return false;
        }
        return confidence >= this.config.thresholds.confidenceMin;
      });
      deduped.push(...validItems);
    }
    return deduped;
  }

  /**
   * Calculate a composite score from multiple metrics
   * Applies weight and normalizes the result (clamped to 0-1 range)
   */
  protected score(metrics: Record<string, number> | null | undefined): number {
    if (!metrics || Object.keys(metrics).length === 0) return 0;

    const values = Object.values(metrics).filter(
      v => typeof v === 'number' && !isNaN(v) && isFinite(v)
    );

    if (values.length === 0) return 0;

    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    const weighted = average * this.config.thresholds.scoreWeight;

    return Math.min(1.0, Math.max(0.0, weighted));
  }

  /**
   * Calculate weighted score with custom weights
   */
  protected weightedScore(
    metrics: Record<string, number>,
    weights: Record<string, number>
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, value] of Object.entries(metrics)) {
      const weight = weights[key] || 1.0;
      totalScore += value * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Filter items by change significance
   * Only keeps items that have changed enough to be significant
   */
  protected filterByChangeSignificance<T extends { changeCount?: number }>(items: T[]): T[] {
    return items.filter(item => (item.changeCount || 0) >= this.config.thresholds.changeThreshold);
  }

  /**
   * Limit group sizes to prevent performance issues
   */
  protected limitGroupSizes<T>(
    groups: Map<string, T[]>,
    maxSize = this.config.thresholds.maxGroupSize
  ): Map<string, T[]> {
    const limited = new Map<string, T[]>();
    for (const [key, group] of groups) {
      if (group.length <= maxSize) {
        limited.set(key, group);
      } else {
        limited.set(key, group.slice(0, maxSize));
      }
    }
    return limited;
  }

  /**
   * Sort groups by size (largest first)
   * Useful for prioritizing processing of larger groups
   */
  protected sortGroupsBySize<T>(groups: Map<string, T[]>, descending = true): Array<[string, T[]]> {
    return Array.from(groups.entries()).sort((a, b) => {
      const comparison = a[1].length - b[1].length;
      return descending ? -comparison : comparison;
    });
  }

  /**
   * Get cached result or compute new one
   * Note: Key should already include namespace prefix (use generateCacheKey)
   * Future: Could integrate with global cache (snapshotManager) for cross-detector caching
   */
  protected getCachedResult<TCompute>(
    key: string,
    computeFn: () => Promise<TCompute> | TCompute
  ): Promise<TCompute> {
    if (this.cache?.has(key)) {
      this.config.logger.debug(
        `[BaseDetector:${this.constructor.name}] Cache hit: ${key.substring(0, 50)}...`
      );
      return Promise.resolve(this.cache.get(key) as TCompute);
    }

    return Promise.resolve(computeFn()).then(result => {
      this.cache?.set(key, result as any);
      this.config.logger.debug(
        `[BaseDetector:${this.constructor.name}] Cache miss, stored: ${key.substring(0, 50)}...`
      );
      return result;
    });
  }

  /**
   * Generate cache key from input parameters
   * Uses fingerprint for stable, collision-resistant hashing of objects
   * Adds namespace prefix to avoid collisions between detectors
   */
  protected generateCacheKey(...params: any[]): string {
    const keyParts = params.map(p => {
      if (p === null) return 'null';
      if (p === undefined) return 'undefined';
      if (typeof p === 'object') {
        return computeFingerprint(p, 'sha256');
      }
      return String(p);
    });

    const baseKey = keyParts.join('_');

    return `detector:${this.constructor.name}:${baseKey}`;
  }

  /**
   * Clear cache (useful for testing or memory management)
   * @param scope - 'local' clears only local LRU cache, 'global' would clear global cache namespace (if integrated)
   */
  protected clearCache(scope?: 'local' | 'global'): void {
    if (scope === 'global' || !scope) {
      this.config.logger.debug(
        `[BaseDetector:${this.constructor.name}] Global cache clear requested (not yet integrated)`
      );
    }

    if (scope !== 'global') {
      this.cache?.clear();
      this.config.logger.debug(`[BaseDetector:${this.constructor.name}] Local cache cleared`);
    }
  }
}
