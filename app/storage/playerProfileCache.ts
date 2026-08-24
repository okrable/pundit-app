import type { CacheEnvelope, PublicPlayerProfile } from '../types';
import { clearCachedResource, getCachedResource, setCachedResource } from './resourceCache';

const PROFILE_CACHE_SCHEMA_VERSION = 1;
const PROFILE_CACHE_STALE_MS = 5 * 60 * 1000;
const PROFILE_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

function key(playerId: string): string {
  return `player_profile_public_${playerId}`;
}

export async function getCachedPlayerProfile(
  playerId: string
): Promise<CacheEnvelope<PublicPlayerProfile> | null> {
  const cached = await getCachedResource<PublicPlayerProfile>(key(playerId), {
    schemaVersion: PROFILE_CACHE_SCHEMA_VERSION,
  });
  if (cached && cached.data.userId !== playerId) {
    await clearCachedResource(key(playerId));
    return null;
  }
  return cached;
}

export async function setCachedPlayerProfile(profile: PublicPlayerProfile): Promise<void> {
  await setCachedResource(key(profile.userId), profile, {
    staleInMs: PROFILE_CACHE_STALE_MS,
    expiresInMs: PROFILE_CACHE_EXPIRY_MS,
    scopeKey: profile.userId,
    schemaVersion: PROFILE_CACHE_SCHEMA_VERSION,
  });
}
