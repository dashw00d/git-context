import { QdrantClient } from '@qdrant/js-client-rest';
import { getExtensionConfig } from '../utils/config';
import { getEmbeddingDimension } from './embeddings';

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
    const url = config.qdrantUrl?.trim() || 'http://localhost:6333';
    
    // Get embedding dimension from model
    this.embeddingDimension = getEmbeddingDimension(config.embeddingModel || 'text-embedding-3-small');
    
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
        console.log(`[Qdrant] Created collection: ${collectionName} (dim: ${this.embeddingDimension})`);
      }
    }
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

