import { ContextFrame } from '../types/cockpit';
import { logDebug } from '../utils/logger';

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export type TierCache = Record<
  string,
  {
    tier1?: any;
    tier2?: any;
    tier3?: any;
    timestamp: number;
  }
>;

/**
 * Try to retrieve a frame from cache, respecting TTL.
 */
export function getCachedFrame(
  cache: TierCache | undefined,
  frameId: string,
  baseFrame: ContextFrame,
  ttl: number = DEFAULT_TTL
): { frame: ContextFrame; isHit: boolean; isStale: boolean } {
  const cachedData = cache?.[frameId];
  const now = Date.now();
  const isStale = !!(cachedData && now - cachedData.timestamp > ttl);

  if (!cachedData) {
    return { frame: baseFrame, isHit: false, isStale: false };
  }

  if (isStale) {
    logDebug(`[Cache] Stale entry for ${frameId} (age: ${now - cachedData.timestamp}ms)`);
    return { frame: baseFrame, isHit: true, isStale: true };
  }

  const frameWithCache: ContextFrame = {
    ...baseFrame,
    data: {
      ...baseFrame.data,
      ...cachedData.tier1,
      ...cachedData.tier2,
      ...cachedData.tier3,
    },
    status: 'ready',
    tier: cachedData.tier3
      ? 'semantics'
      : cachedData.tier2
        ? 'hybrid'
        : cachedData.tier1
          ? 'structure'
          : undefined,
  };

  return { frame: frameWithCache, isHit: true, isStale: false };
}

/**
 * Update the cache with new tier data.
 */
export function updateTierCache(
  cache: TierCache | undefined,
  frameId: string,
  tierNum: 1 | 2 | 3,
  data: any
): TierCache {
  const currentCache = cache || {};
  const existingEntry = currentCache[frameId] || { timestamp: Date.now() };
  const tierKey = `tier${tierNum}` as 'tier1' | 'tier2' | 'tier3';

  return {
    ...currentCache,
    [frameId]: {
      ...existingEntry,
      [tierKey]: data,
      timestamp: Date.now(),
    },
  };
}
