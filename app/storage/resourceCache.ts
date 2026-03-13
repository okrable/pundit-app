import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheEnvelope } from '../types';

const RESOURCE_CACHE_PREFIX = '@pundit_resource_';
const CACHE_VERSION = 1;

interface CacheWriteOptions {
  staleInMs: number;
  expiresInMs?: number;
  scopeKey?: string;
}

function getCacheKey(key: string): string {
  return `${RESOURCE_CACHE_PREFIX}${key}`;
}

export async function getCachedResource<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(getCacheKey(key));
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as CacheEnvelope<T>;
    if (cached.version !== CACHE_VERSION) {
      await AsyncStorage.removeItem(getCacheKey(key));
      return null;
    }

    if (cached.expiresAt && Date.now() >= new Date(cached.expiresAt).getTime()) {
      await AsyncStorage.removeItem(getCacheKey(key));
      return null;
    }

    return cached;
  } catch (error) {
    console.error(`Error reading cached resource "${key}":`, error);
    return null;
  }
}

export async function setCachedResource<T>(
  key: string,
  data: T,
  options: CacheWriteOptions
): Promise<CacheEnvelope<T> | null> {
  try {
    const now = Date.now();
    const payload: CacheEnvelope<T> = {
      data,
      cachedAt: new Date(now).toISOString(),
      staleAt: new Date(now + options.staleInMs).toISOString(),
      expiresAt: options.expiresInMs ? new Date(now + options.expiresInMs).toISOString() : null,
      version: CACHE_VERSION,
      scopeKey: options.scopeKey,
    };

    await AsyncStorage.setItem(getCacheKey(key), JSON.stringify(payload));
    return payload;
  } catch (error) {
    console.error(`Error writing cached resource "${key}":`, error);
    return null;
  }
}

export async function clearCachedResource(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(getCacheKey(key));
  } catch (error) {
    console.error(`Error clearing cached resource "${key}":`, error);
  }
}

export function isResourceStale<T>(resource: CacheEnvelope<T> | null): boolean {
  if (!resource) {
    return true;
  }

  return Date.now() >= new Date(resource.staleAt).getTime();
}
