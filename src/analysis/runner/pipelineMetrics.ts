export interface EmbeddingMetrics {
  commitCount: number;
  commitShardCount: number;
  symbolShardCount: number;
  themeShardCount: number;
  durationMs: number;
  skipped?: boolean;
  reason?: string;
}

export interface HistoryMetrics {
  durationMs: number;
  similarCommits: number;
  similarSymbols: number;
  relatedRefactors: number;
  skipped?: boolean;
  reason?: string;
}

export interface LlmMetrics {
  durationMs: number;
  totalTokens: number;
  totalCalls: number;
  healthScore?: number;
  validatedEvidenceCount?: number;
  skipped?: boolean;
  reason?: string;
}
