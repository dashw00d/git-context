import { QdrantClient } from '@qdrant/js-client-rest';
import { getExtensionConfig } from '../utils/config';
import { getEmbeddingDimension } from './embeddings';
import { logInfo, logWarn } from '../utils/logger';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
}

export class QdrantClientWrapper {
  private client: QdrantClient | null = null;
  private isAvailable: boolean = false;
  private config: QdrantConfig | null = null;
  private embeddingDimension: number = 1536;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start initialization but don't wait for it
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    const config = getExtensionConfig();
    // qdrantUrl should have default from package.json via getExtensionConfig
    const url = config.qdrantUrl?.trim() || 'http://localhost:6333';

    // Get embedding dimension from model
    // embeddingModel should have default from package.json via getExtensionConfig
    const model = config.embeddingModel || 'openai/text-embedding-3-small'; // Fallback to package.json default
    this.embeddingDimension = getEmbeddingDimension(model);

    if (!url) {
      this.isAvailable = false;
      return;
    }

    try {
      this.config = {
        url,
        apiKey: config.qdrantApiKey?.trim() || undefined
      };

      this.client = new QdrantClient({
        url: this.config.url,
        apiKey: this.config.apiKey,
        checkCompatibility: false  // Suppress version mismatch warnings
      });

      // Test connection
      await this.client.getCollections();
      this.isAvailable = true;
      console.log(`[Qdrant] Connected to ${url} (embedding dim: ${this.embeddingDimension})`);
    } catch (error) {
      console.warn(`[Qdrant] Connection failed, falling back to SQLite search:`, error);
      this.isAvailable = false;
      this.client = null;
    }
  }

  async isEnabled(): Promise<boolean> {
    // Wait for initialization to complete
    if (this.initPromise) {
      await this.initPromise;
    }
    return this.isAvailable && this.client !== null;
  }

  async getClient(): Promise<QdrantClient | null> {
    // Wait for initialization to complete
    if (this.initPromise) {
      await this.initPromise;
    }
    return this.client;
  }

  getEmbeddingDimension(): number {
    return this.embeddingDimension;
  }

  async ensureCollections(): Promise<void> {
    if (!(await this.isEnabled())) return;

    const collections = ['symbols', 'commits', 'patterns'];

    for (const collectionName of collections) {
      try {
        await this.client!.getCollection(collectionName);
      } catch {
        // Collection doesn't exist, create it
        await this.client!.createCollection(collectionName, {
          vectors: {
            size: this.embeddingDimension,
            distance: 'Cosine'
          }
        });
        logInfo(`[Qdrant] Created collection: ${collectionName} (dim: ${this.embeddingDimension})`);
      }

      // Add keyword index on project_id for fast filtering (idempotent - will skip if exists)
      try {
        await this.client!.createPayloadIndex(collectionName, {
          field_name: 'project_id',
          field_schema: { type: 'keyword' }
        });

        // Add indexes for new semantic memory features
        if (collectionName.includes('commits') || collectionName.includes('symbols')) {
          await this.client!.createPayloadIndex(collectionName, {
            field_name: 'date',
            field_schema: { type: 'keyword' } // ISO dates sortable as strings
          });
        }

        if (collectionName.includes('patterns')) {
          await this.client!.createPayloadIndex(collectionName, {
            field_name: 'theme_id',
            field_schema: { type: 'keyword' }
          });
        }

        // Tags are useful everywhere
        await this.client!.createPayloadIndex(collectionName, {
          field_name: 'tags',
          field_schema: { type: 'keyword' } // Array of keywords
        });

        logInfo(`[Qdrant] Indexed fields on ${collectionName}`);
      } catch (error: any) {
        // Index may already exist, ignore error if so
        const errorMsg = error?.message || String(error);
        if (!errorMsg.includes('already exists') && !errorMsg.includes('already exist')) {
          logWarn(`[Qdrant] Failed to create indexes on ${collectionName}: ${errorMsg}`);
        }
      }
    }
  }

  /**
   * Get collection name for a given base type and project ID
   * Supports per-project collections for stronger isolation
   */
  getCollectionName(base: 'commits' | 'symbols' | 'patterns', projectId?: string): string {
    const config = getExtensionConfig();
    if (config.perProjectQdrantCollections && projectId) {
      // Use project ID directly (already hashed and sanitized)
      return `${base}_${projectId}`;
    }
    return base;
  }
}

// Singleton instance
let qdrantClient: QdrantClientWrapper | null = null;

export function getQdrantClient(): QdrantClientWrapper {
  if (!qdrantClient) {
    qdrantClient = new QdrantClientWrapper();
  }
  return qdrantClient;
}

