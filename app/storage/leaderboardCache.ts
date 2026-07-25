import {
  CacheEnvelope,
  FriendsLeaderboardResponse,
  GlobalLeaderboardResponse,
} from '../types';
import { clearCachedResource, getCachedResource, setCachedResource } from './resourceCache';
import { getQuizDate } from '../utils/quizDate';

const GLOBAL_CACHE_STALE_MS = 5 * 60 * 1000;
const GLOBAL_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const FRIENDS_CACHE_STALE_MS = 2 * 60 * 1000;
const FRIENDS_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const SOCIAL_CACHE_SCHEMA_VERSION = 2;

function getGlobalLeaderboardKey(date: string): string {
  return `leaderboard_global_daily_${date}`;
}

function getFriendsLeaderboardKey(userId: string, date: string): string {
  return `leaderboard_friends_daily_${date}_${userId}`;
}

export async function getCachedGlobalLeaderboard(): Promise<CacheEnvelope<GlobalLeaderboardResponse> | null> {
  return getCachedResource<GlobalLeaderboardResponse>(
    getGlobalLeaderboardKey(getQuizDate()),
    { schemaVersion: SOCIAL_CACHE_SCHEMA_VERSION }
  );
}

export async function setCachedGlobalLeaderboard(data: GlobalLeaderboardResponse): Promise<void> {
  await setCachedResource(getGlobalLeaderboardKey(data.quizDate), data, {
    staleInMs: GLOBAL_CACHE_STALE_MS,
    expiresInMs: GLOBAL_CACHE_EXPIRY_MS,
    scopeKey: `global_daily_${data.quizDate}`,
    schemaVersion: SOCIAL_CACHE_SCHEMA_VERSION,
  });
}

export async function clearCachedGlobalLeaderboard(): Promise<void> {
  await clearCachedResource(getGlobalLeaderboardKey(getQuizDate()));
}

export async function getCachedFriendsLeaderboard(userId: string): Promise<CacheEnvelope<FriendsLeaderboardResponse> | null> {
  return getCachedResource<FriendsLeaderboardResponse>(
    getFriendsLeaderboardKey(userId, getQuizDate()),
    { schemaVersion: SOCIAL_CACHE_SCHEMA_VERSION }
  );
}

export async function setCachedFriendsLeaderboard(
  userId: string,
  data: FriendsLeaderboardResponse
): Promise<void> {
  await setCachedResource(getFriendsLeaderboardKey(userId, data.quizDate), data, {
    staleInMs: FRIENDS_CACHE_STALE_MS,
    expiresInMs: FRIENDS_CACHE_EXPIRY_MS,
    scopeKey: `${userId}_daily_${data.quizDate}`,
    schemaVersion: SOCIAL_CACHE_SCHEMA_VERSION,
  });
}

export async function clearCachedFriendsLeaderboard(userId: string): Promise<void> {
  await clearCachedResource(getFriendsLeaderboardKey(userId, getQuizDate()));
}
