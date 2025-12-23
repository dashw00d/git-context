import { getQdrantClient } from '../src/storage/qdrantClient';
import { logInfo, logError } from '../src/utils/logger';

async function clearQdrantEmbeddings() {
  try {
    const qdrant = getQdrantClient();
    if (await qdrant.isEnabled()) {
      const client = await qdrant.getClient();
      if (client) {
        const collections = await client.getCollections();
        for (const collection of collections.collections) {
          await client.deleteCollection(collection.name);
          logInfo(`[Reset] Deleted vector collection: ${collection.name}`);
        }
        console.log(`✅ Cleared ${collections.collections.length} Qdrant collections`);
      } else {
        console.log('❌ Qdrant client not available');
      }
    } else {
      console.log('❌ Qdrant is not enabled');
    }
  } catch (e) {
    logError('Failed to clear vectors', e);
    console.error('❌ Failed to clear Qdrant embeddings:', e);
  }
}

clearQdrantEmbeddings().catch(console.error);
