import OpenAI from 'openai';
import { getExtensionConfig } from '../utils/config';
import { logError } from '../utils/logger';

/**
 * Generate embedding for text using configured embedding provider
 * Falls back to simple hash-based embedding if API unavailable
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const config = getExtensionConfig();

  // Try to use embedding API if API key available
  if (config.openRouterApiKey || !config.embeddingProvider?.includes('openrouter')) {
    try {
      // Determine if we need API key
      const needsApiKey =
        config.embeddingProvider?.includes('openrouter.ai') ||
        config.embeddingProvider?.includes('api.openai.com');

      const apiKey = needsApiKey ? config.openRouterApiKey : 'not-needed';

      if (needsApiKey && !apiKey) {
        logError('API key required for embedding provider');
        // Continue to fallback instead of throwing
      }

      // Create OpenAI client (works with OpenAI and OpenRouter)
      const client = new OpenAI({
        apiKey: apiKey || 'not-needed',
        baseURL: config.embeddingProvider || config.apiEndpoint,
      });

      const response = await client.embeddings.create({
        // embeddingModel should have default from package.json via getExtensionConfig
        model: config.embeddingModel || 'openai/text-embedding-3-small', // Fallback to package.json default
        input: text,
      });

      if (response.data && response.data.length > 0) {
        return response.data[0].embedding;
      }
    } catch (error) {
      logError('API call failed, using fallback', error);
    }
  }

  // Fallback: Simple hash-based embedding (not semantic, but consistent)
  return hashToVector(text);
}

/**
 * Get embedding dimension based on model
 */
export function getEmbeddingDimension(model: string): number {
  // OpenAI embedding models
  if (model.includes('text-embedding-3')) {
    // text-embedding-3-small: 1536, text-embedding-3-large: 3072
    return model.includes('large') ? 3072 : 1536;
  }
  if (model.includes('text-embedding-ada-002')) {
    return 1536;
  }
  // Default dimension
  return 1536;
}

function hashToVector(text: string, dimensions: number = 1536): number[] {
  // Simple hash-based vector (not semantic, but provides consistent indexing)
  const vector = new Array(dimensions).fill(0);
  let hash = 0;

  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash = hash & hash;
  }

  for (let i = 0; i < dimensions; i++) {
    vector[i] = Math.sin((hash + i) * 0.01) * 0.5 + 0.5;
  }

  return vector;
}

/**
 * Generate embedding text representation for a symbol
 */
export function symbolToEmbeddingText(symbol: {
  name: string;
  kind: string;
  signature?: string;
  path: string;
  diff_snippet_pre?: string;
  diff_snippet_post?: string;
  naming_convention?: string; // Optional convention metadata
}): string {
  const parts = [
    symbol.name,
    symbol.kind,
    symbol.signature || '',
    symbol.path.split('/').pop() || '', // filename
    symbol.diff_snippet_pre || '',
    symbol.diff_snippet_post || '',
    symbol.naming_convention || '', // Include convention for clustering
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Generate embedding text representation for a commit
 */
export function commitToEmbeddingText(commit: {
  message: string;
  summary_md?: string;
  risks?: string[];
}): string {
  const parts = [
    commit.message,
    commit.summary_md || '',
    commit.risks ? commit.risks.join(' ') : '',
  ].filter(Boolean);

  return parts.join(' ');
}

/**
 * Convert string to positive integer for Qdrant point IDs
 * Qdrant requires numeric IDs (or UUIDs), so we hash strings to integers
 */
export function stringToPointId(str: string): number {
  // Convert string to positive integer for Qdrant
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash >>> 0; // Convert to unsigned 32-bit
  }
  return hash || 1; // Ensure non-zero
}
