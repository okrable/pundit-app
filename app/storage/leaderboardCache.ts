import type {
  CacheEnvelope,
  FriendsLeaderboardResponse,
  GlobalLeaderboardResponse,
  LeaderboardPeriod,
  LeaderboardScope,
} from '../types';
import { clearCachedResource, getCachedResource, setCachedResource } from './resourceCache';
import { getQuizDate } from '../utils/quizDate';
import {
  getLeaderboardCachePartitionKey,
  getLeaderboardDateWindow,
} from '../../shared/leaderboard';

const GLOBAL_CACHE_STALE_MS = 5 * 60 * 1000;
const GLOBAL_CACHE_EXPIRY_MS = 8 * 24 * 60 * 60 * 1000;
const FRIENDS_CACHE_STALE_MS = 2 * 60 * 1000;
const FRIENDS_CACHE_EXPIRY_MS = 8 * 24 * 60 * 60 * 1000;
const LEADERBOARD_CACHE_SCHEMA_VERSION = 4;

export function getLeaderboardCacheKey(
  scope: LeaderboardScope,
  period: LeaderboardPeriod,
  anchor: string,
  userId?: string
): string {
  return getLeaderboardCachePartitionKey(scope, period, anchor, userId);
}

function getCurrentAnchor(period: LeaderboardPeriod): string {
  return getLeaderboardDateWindow(getQuizDate(), period).periodStart;
}

export async function getCachedGlobalLeaderboard(
  period: LeaderboardPeriod = 'daily'
): Promise<CacheEnvelope<GlobalLeaderboardResponse> | null> {
  return getCachedResource<GlobalLeaderboardResponse>(
    getLeaderboardCacheKey('global', period, getCurrentAnchor(period)),
    { schemaVersion: LEADERBOARD_CACHE_SCHEMA_VERSION }
  );
}

export async function setCachedGlobalLeaderboard(data: GlobalLeaderboardResponse): Promise<void> {
  await setCachedResource(
    getLeaderboardCacheKey('global', data.period, data.periodStart),
    data,
    {
      staleInMs: GLOBAL_CACHE_STALE_MS,
      expiresInMs: GLOBAL_CACHE_EXPIRY_MS,
      scopeKey: `global_${data.period}_${data.periodStart}`,
      schemaVersion: LEADERBOARD_CACHE_SCHEMA_VERSION,
    }
  );
}

export async function clearCachedGlobalLeaderboard(period: LeaderboardPeriod): Promise<void> {
  await clearCachedResource(
    getLeaderboardCacheKey('global', period, getCurrentAnchor(period))
  );
}

export async function getCachedFriendsLeaderboard(
  userId: string,
  period: LeaderboardPeriod = 'daily'
): Promise<CacheEnvelope<FriendsLeaderboardResponse> | null> {
  return getCachedResource<FriendsLeaderboardResponse>(
    getLeaderboardCacheKey('friends', period, getCurrentAnchor(period), userId),
    { schemaVersion: LEADERBOARD_CACHE_SCHEMA_VERSION }
  );
}

export async function setCachedFriendsLeaderboard(
  userId: string,
  data: FriendsLeaderboardResponse
): Promise<void> {
  await setCachedResource(
    getLeaderboardCacheKey('friends', data.period, data.periodStart, userId),
    data,
    {
      staleInMs: FRIENDS_CACHE_STALE_MS,
      expiresInMs: FRIENDS_CACHE_EXPIRY_MS,
      scopeKey: `${userId}_${data.period}_${data.periodStart}`,
      schemaVersion: LEADERBOARD_CACHE_SCHEMA_VERSION,
    }
  );
}

export async function clearCachedFriendsLeaderboards(userId: string): Promise<void> {
  await Promise.all(
    (['daily', 'weekly'] as const).map((period) =>
      clearCachedResource(
        getLeaderboardCacheKey('friends', period, getCurrentAnchor(period), userId)
      )
    )
  );
}
