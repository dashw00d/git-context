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
      console.log(`[Qdrant] Connected to ${url} (embedding dim: ${this.embeddingDimension}, model: ${model})`);
    } catch (error: any) {
      console.warn(`[Qdrant] Connection failed to ${url}, falling back to SQLite search:`, error?.message || error);
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

    const collections: Array<'symbols' | 'commits' | 'patterns'> = ['symbols', 'commits', 'patterns'];

    for (const collectionName of collections) {
      await this.ensureCollection(collectionName);
    }
  }

  /**
   * Ensure a specific collection exists (handles both base and project-specific collections)
   * @param base - Base collection name ('commits', 'symbols', or 'patterns')
   * @param projectId - Optional project ID for project-specific collections
   */
  async ensureCollection(base: 'commits' | 'symbols' | 'patterns', projectId?: string): Promise<void> {
    if (!(await this.isEnabled())) return;

    const collectionName = this.getCollectionName(base, projectId);
    let collectionCreated = false;

    try {
      await this.client!.getCollection(collectionName);
      // Collection exists, ensure indexes are added (idempotent - will skip if exists)
    } catch {
      // Collection doesn't exist, create it
      await this.client!.createCollection(collectionName, {
        vectors: {
          size: this.embeddingDimension,
          distance: 'Cosine'
        }
      });
      logInfo(`[Qdrant] Created collection: ${collectionName} (dim: ${this.embeddingDimension})`);
      collectionCreated = true;
    }
    
    // Always ensure indexes exist (idempotent - safe to call multiple times)
    // This ensures existing collections get new indexes added if they're missing
    await this.ensureCollectionIndexes(collectionName);
  }

  /**
   * Ensure indexes exist on a collection (idempotent)
   */
  private async ensureCollectionIndexes(collectionName: string): Promise<void> {
    if (!(await this.isEnabled()) || !this.client) return;

    try {
      // Add keyword index on project_id for fast filtering (idempotent - will skip if exists)
      await this.client.createPayloadIndex(collectionName, {
        field_name: 'project_id',
        field_schema: { type: 'keyword' }
      });

      // Add indexes for new semantic memory features
      if (collectionName.includes('commits') || collectionName.includes('symbols')) {
        await this.client.createPayloadIndex(collectionName, {
          field_name: 'date',
          field_schema: { type: 'keyword' } // ISO dates sortable as strings
        });
        
        // Add numeric index for structural_change_score to enable range queries
        if (collectionName.includes('commits')) {
          await this.client.createPayloadIndex(collectionName, {
            field_name: 'structural_change_score',
            field_schema: { type: 'float' } // Numeric type for range queries
          });
        }
      }

      if (collectionName.includes('patterns')) {
        await this.client.createPayloadIndex(collectionName, {
          field_name: 'theme_id',
          field_schema: { type: 'keyword' }
        });
      }

      // Tags are useful everywhere
      await this.client.createPayloadIndex(collectionName, {
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

