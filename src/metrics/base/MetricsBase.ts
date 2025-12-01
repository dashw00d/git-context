import {
  BaseDetector,
  DEFAULT_THRESHOLDS,
  DetectorConfig,
} from '../../analysis/detectors/BaseDetector';
import { getExtensionConfig } from '../../utils/config';

/**
 * Common interface for metric computation results
 */
export interface MetricResult {
  score: number;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Base class for all metric adapters
 * Extends BaseDetector to provide unified metric computation patterns
 */
export abstract class MetricsBase extends BaseDetector<any, MetricResult> {
  protected rerankingWeights = getExtensionConfig().rerankingWeights || {
    drift: 1.0,
    hotspot: 1.0,
    theme: 1.0,
  };

  constructor(config: Partial<DetectorConfig> = {}) {
    super({
      thresholds: { ...DEFAULT_THRESHOLDS, ...config.thresholds },
      enableCaching: true, // Metrics are often computed repeatedly
      cacheTTL: 1800000, // 30 minutes for metric results
      ...config,
    });
  }

  /**
   * Abstract method that metric adapters must implement
   * Computes metrics from input data and returns standardized result
   */
  abstract compute(input: any): Promise<MetricResult>;

  /**
   * Convenience method that calls detect() and returns just the score
   * For backward compatibility with existing metric functions
   */
  async computeScore(input: any): Promise<number> {
    const result = await this.compute(input);
    return result.score;
  }

  /**
   * Standard metric computation with common utilities
   */
  protected async computeWithCache<TInput>(
    input: TInput,
    computeFn: (input: TInput) => Promise<MetricResult>
  ): Promise<MetricResult> {
    return this.getCachedResult(this.generateCacheKey(input), () => computeFn(input));
  }

  /**
   * Normalize a score to 0-1 range using sigmoid function
   */
  protected normalizeScore(rawScore: number, midpoint = 0, steepness = 1): number {
    return 1 / (1 + Math.exp(-steepness * (rawScore - midpoint)));
  }

  /**
   * Apply reranking weights to a score
   */
  protected applyRerankingWeights(
    score: number,
    metricType: keyof typeof this.rerankingWeights
  ): number {
    const weight = this.rerankingWeights[metricType] || 1.0;
    return score * weight;
  }

  /**
   * Aggregate multiple scores with weights
   */
  protected aggregateScores(
    scores: Record<string, number>,
    weights: Record<string, number> = {}
  ): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, score] of Object.entries(scores)) {
      const weight = weights[key] || 1.0;
      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Calculate percentage-based metrics safely
   */
  protected safePercentage(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.min(100, Math.max(0, (numerator / denominator) * 100));
  }

  /**
   * Create a standardized metric result
   */
  protected createResult(
    score: number,
    details: Record<string, any> = {},
    metadata: Record<string, any> = {}
  ): MetricResult {
    return {
      score: Math.max(0, Math.min(1, score)), // Clamp to 0-1 range
      details,
      metadata: {
        computedAt: new Date().toISOString(),
        version: '1.0',
        ...metadata,
      },
    };
  }
}
