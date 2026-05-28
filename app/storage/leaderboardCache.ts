import {
  CacheEnvelope,
  FriendsLeaderboardResponse,
  GlobalLeaderboardResponse,
  LeaderboardPeriod,
} from '../types';
import { clearCachedResource, getCachedResource, setCachedResource } from './resourceCache';

const GLOBAL_CACHE_STALE_MS = 5 * 60 * 1000;
const GLOBAL_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const FRIENDS_CACHE_STALE_MS = 2 * 60 * 1000;
const FRIENDS_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

function getGlobalLeaderboardKey(period: LeaderboardPeriod): string {
  return `leaderboard_global_${period}`;
}

function getFriendsLeaderboardKey(userId: string, period: LeaderboardPeriod): string {
  return `leaderboard_friends_${period}_${userId}`;
}

export async function getCachedGlobalLeaderboard(
  period: LeaderboardPeriod = 'daily'
): Promise<CacheEnvelope<GlobalLeaderboardResponse> | null> {
  return getCachedResource<GlobalLeaderboardResponse>(getGlobalLeaderboardKey(period));
}

export async function setCachedGlobalLeaderboard(data: GlobalLeaderboardResponse): Promise<void> {
  await setCachedResource(getGlobalLeaderboardKey(data.period), data, {
    staleInMs: GLOBAL_CACHE_STALE_MS,
    expiresInMs: GLOBAL_CACHE_EXPIRY_MS,
    scopeKey: `global_${data.period}`,
  });
}

export async function clearCachedGlobalLeaderboard(
  period: LeaderboardPeriod = 'daily'
): Promise<void> {
  await clearCachedResource(getGlobalLeaderboardKey(period));
}

export async function getCachedFriendsLeaderboard(
  userId: string,
  period: LeaderboardPeriod = 'daily'
): Promise<CacheEnvelope<FriendsLeaderboardResponse> | null> {
  return getCachedResource<FriendsLeaderboardResponse>(getFriendsLeaderboardKey(userId, period));
}

export async function setCachedFriendsLeaderboard(
  userId: string,
  data: FriendsLeaderboardResponse
): Promise<void> {
  await setCachedResource(getFriendsLeaderboardKey(userId, data.period), data, {
    staleInMs: FRIENDS_CACHE_STALE_MS,
    expiresInMs: FRIENDS_CACHE_EXPIRY_MS,
    scopeKey: `${userId}_${data.period}`,
  });
}

export async function clearCachedFriendsLeaderboard(
  userId: string,
  period: LeaderboardPeriod = 'daily'
): Promise<void> {
  await clearCachedResource(getFriendsLeaderboardKey(userId, period));
}
