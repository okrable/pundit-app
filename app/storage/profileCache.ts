import { CacheEnvelope, UserStats } from '../types';
import { clearCachedResource, getCachedResource, setCachedResource } from './resourceCache';

const PROFILE_CACHE_STALE_MS = 5 * 60 * 1000;
const PROFILE_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const PROFILE_CACHE_SCHEMA_VERSION = 2;

function getProfileCacheKey(userId: string): string {
  return `profile_${userId}`;
}

export async function getCachedUserStats(userId: string): Promise<CacheEnvelope<UserStats> | null> {
  return getCachedResource<UserStats>(getProfileCacheKey(userId), {
    schemaVersion: PROFILE_CACHE_SCHEMA_VERSION,
  });
}

export async function setCachedUserStats(userId: string, stats: UserStats): Promise<void> {
  await setCachedResource(getProfileCacheKey(userId), stats, {
    staleInMs: PROFILE_CACHE_STALE_MS,
    expiresInMs: PROFILE_CACHE_EXPIRY_MS,
    scopeKey: userId,
    schemaVersion: PROFILE_CACHE_SCHEMA_VERSION,
  });
}

export async function clearCachedUserStats(userId: string): Promise<void> {
  await clearCachedResource(getProfileCacheKey(userId));
}
