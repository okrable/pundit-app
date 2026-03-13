import { create } from 'zustand';
import { getFriendsLeaderboard, getLeaderboard } from '../services/api';
import {
  CacheEnvelope,
  FriendsLeaderboardEntry,
  LeaderboardEntry,
} from '../types';
import {
  getCachedFriendsLeaderboard,
  getCachedGlobalLeaderboard,
  setCachedFriendsLeaderboard,
  setCachedGlobalLeaderboard,
} from '../storage/leaderboardCache';
import { useAuthStore } from './useAuthStore';
import { logError, logInfo } from '../services/debugLog';

interface LeaderboardState {
  friendsLeaderboard: FriendsLeaderboardEntry[];
  totalFriends: number;
  friendsPlayedToday: number;
  globalLeaderboard: LeaderboardEntry[];
  friendsCache: CacheEnvelope<{
    leaderboard: FriendsLeaderboardEntry[];
    totalFriends: number;
    friendsPlayedToday: number;
  }> | null;
  globalCache: CacheEnvelope<LeaderboardEntry[]> | null;
  loadingFriends: boolean;
  loadingGlobal: boolean;
  error: string | null;
  hydrateFromCache: (userId: string) => Promise<void>;
  revalidateFriends: (userId: string) => Promise<void>;
  revalidateGlobal: () => Promise<void>;
  prefetchDailyLoop: (userId: string, isAuthenticated: boolean) => Promise<void>;
  invalidateFriends: (userId: string) => Promise<void>;
  reset: () => void;
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  friendsLeaderboard: [],
  totalFriends: 0,
  friendsPlayedToday: 0,
  globalLeaderboard: [],
  friendsCache: null,
  globalCache: null,
  loadingFriends: false,
  loadingGlobal: false,
  error: null,

  hydrateFromCache: async (userId: string) => {
    logInfo('leaderboard.cache.hydrate.start', { userId });
    const [friendsCache, globalCache] = await Promise.all([
      userId.startsWith('guest_') ? Promise.resolve(null) : getCachedFriendsLeaderboard(userId),
      getCachedGlobalLeaderboard(),
    ]);

    set({
      friendsLeaderboard: friendsCache?.data.leaderboard ?? [],
      totalFriends: friendsCache?.data.totalFriends ?? 0,
      friendsPlayedToday: friendsCache?.data.friendsPlayedToday ?? 0,
      globalLeaderboard: globalCache?.data ?? [],
      friendsCache,
      globalCache,
      error: null,
    });
    logInfo('leaderboard.cache.hydrate.success', {
      userId,
      friendsCount: friendsCache?.data.leaderboard.length ?? 0,
      globalCount: globalCache?.data.length ?? 0,
    });
  },

  revalidateFriends: async (userId: string) => {
    if (userId.startsWith('guest_') || !useAuthStore.getState().token) {
      logInfo('leaderboard.friends.skip', {
        userId,
        isGuest: userId.startsWith('guest_'),
        hasToken: Boolean(useAuthStore.getState().token),
      });
      return;
    }

    logInfo('leaderboard.friends.start', { userId });
    set({ loadingFriends: true, error: null });
    try {
      const data = await getFriendsLeaderboard(userId);
      await setCachedFriendsLeaderboard(userId, data);
      const refreshedCache = await getCachedFriendsLeaderboard(userId);

      set({
        friendsLeaderboard: data.leaderboard,
        totalFriends: data.totalFriends,
        friendsPlayedToday: data.friendsPlayedToday,
        friendsCache: refreshedCache,
        loadingFriends: false,
        error: null,
      });
      logInfo('leaderboard.friends.success', { userId, count: data.leaderboard.length });
    } catch (error) {
      logError('leaderboard.friends.error', error);
      set({
        loadingFriends: false,
        error: error instanceof Error ? error.message : 'Failed to load friends leaderboard',
      });
    }
  },

  revalidateGlobal: async () => {
    logInfo('leaderboard.global.start');
    set({ loadingGlobal: true, error: null });
    try {
      const data = await getLeaderboard();
      await setCachedGlobalLeaderboard(data);
      const refreshedCache = await getCachedGlobalLeaderboard();

      set({
        globalLeaderboard: data,
        globalCache: refreshedCache,
        loadingGlobal: false,
        error: null,
      });
      logInfo('leaderboard.global.success', { count: data.length });
    } catch (error) {
      logError('leaderboard.global.error', error);
      set({
        loadingGlobal: false,
        error: error instanceof Error ? error.message : 'Failed to load leaderboard',
      });
    }
  },

  prefetchDailyLoop: async (userId: string, isAuthenticated: boolean) => {
    const tasks: Array<Promise<void>> = [get().revalidateGlobal()];
    if (isAuthenticated && !userId.startsWith('guest_')) {
      tasks.push(get().revalidateFriends(userId));
    }
    await Promise.all(tasks);
  },

  invalidateFriends: async (userId: string) => {
    if (userId.startsWith('guest_')) {
      set({
        friendsLeaderboard: [],
        totalFriends: 0,
        friendsPlayedToday: 0,
        friendsCache: null,
      });
      return;
    }

    await get().revalidateFriends(userId);
  },

  reset: () => set({
    friendsLeaderboard: [],
    totalFriends: 0,
    friendsPlayedToday: 0,
    globalLeaderboard: [],
    friendsCache: null,
    globalCache: null,
    loadingFriends: false,
    loadingGlobal: false,
    error: null,
  }),
}));
