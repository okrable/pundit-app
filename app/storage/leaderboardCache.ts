import {
  CacheEnvelope,
  FriendsLeaderboardEntry,
  LeaderboardEntry,
} from '../types';
import { clearCachedResource, getCachedResource, setCachedResource } from './resourceCache';

interface FriendsLeaderboardCache {
  leaderboard: FriendsLeaderboardEntry[];
  totalFriends: number;
  friendsPlayedToday: number;
}

const GLOBAL_CACHE_STALE_MS = 5 * 60 * 1000;
const GLOBAL_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;
const FRIENDS_CACHE_STALE_MS = 2 * 60 * 1000;
const FRIENDS_CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

function getGlobalLeaderboardKey(): string {
  return 'leaderboard_global';
}

function getFriendsLeaderboardKey(userId: string): string {
  return `leaderboard_friends_${userId}`;
}

export async function getCachedGlobalLeaderboard():
  Promise<CacheEnvelope<LeaderboardEntry[]> | null> {
  return getCachedResource<LeaderboardEntry[]>(getGlobalLeaderboardKey());
}

export async function setCachedGlobalLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
  await setCachedResource(getGlobalLeaderboardKey(), entries, {
    staleInMs: GLOBAL_CACHE_STALE_MS,
    expiresInMs: GLOBAL_CACHE_EXPIRY_MS,
    scopeKey: 'global',
  });
}

export async function clearCachedGlobalLeaderboard(): Promise<void> {
  await clearCachedResource(getGlobalLeaderboardKey());
}

export async function getCachedFriendsLeaderboard(
  userId: string
): Promise<CacheEnvelope<FriendsLeaderboardCache> | null> {
  return getCachedResource<FriendsLeaderboardCache>(getFriendsLeaderboardKey(userId));
}

export async function setCachedFriendsLeaderboard(
  userId: string,
  data: FriendsLeaderboardCache
): Promise<void> {
  await setCachedResource(getFriendsLeaderboardKey(userId), data, {
    staleInMs: FRIENDS_CACHE_STALE_MS,
    expiresInMs: FRIENDS_CACHE_EXPIRY_MS,
    scopeKey: userId,
  });
}

export async function clearCachedFriendsLeaderboard(userId: string): Promise<void> {
  await clearCachedResource(getFriendsLeaderboardKey(userId));
}
