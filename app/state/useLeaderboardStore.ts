import { create } from 'zustand';
import { ApiError, getFriendsLeaderboard, getLeaderboard } from '../services/api';
import {
  CacheEnvelope,
  FriendsLeaderboardEntry,
  FriendsLeaderboardResponse,
  GlobalLeaderboardResponse,
  LeaderboardEntry,
  LeaderboardPeriod,
} from '../types';
import {
  getCachedFriendsLeaderboard,
  getCachedGlobalLeaderboard,
  setCachedFriendsLeaderboard,
  setCachedGlobalLeaderboard,
} from '../storage/leaderboardCache';
import { useAuthStore } from './useAuthStore';
import { logError, logInfo, logWarn } from '../services/debugLog';
import { getQuizDate } from '../utils/quizDate';

interface LeaderboardState {
  friendsLeaderboard: FriendsLeaderboardEntry[];
  totalFriends: number;
  friendsPlayedToday: number;
  friendsPlayedThisWeek: number;
  globalLeaderboard: LeaderboardEntry[];
  friendsPeriod: LeaderboardPeriod;
  globalPeriod: LeaderboardPeriod;
  friendsCache: CacheEnvelope<FriendsLeaderboardResponse> | null;
  globalCache: CacheEnvelope<GlobalLeaderboardResponse> | null;
  loadingFriends: boolean;
  loadingGlobal: boolean;
  error: string | null;
  hydrateFromCache: (userId: string, period?: LeaderboardPeriod) => Promise<void>;
  revalidateFriends: (userId: string, period?: LeaderboardPeriod) => Promise<void>;
  revalidateGlobal: (period?: LeaderboardPeriod) => Promise<void>;
  prefetchDailyLoop: (userId: string, isAuthenticated: boolean) => Promise<void>;
  invalidateFriends: (userId: string, period?: LeaderboardPeriod) => Promise<void>;
  reset: () => void;
}

function isCurrentAuthUser(userId: string): boolean {
  const authState = useAuthStore.getState();
  return Boolean(authState.token && authState.user?.sub === userId);
}

function getCurrentWeekBounds(referenceDate: Date = new Date()): { weekStart: string; weekEnd: string } {
  const quizDate = getQuizDate(referenceDate);
  const [year, month, day] = quizDate.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7;
  const weekStartDate = new Date(utcDate);
  weekStartDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

  return {
    weekStart: weekStartDate.toISOString().split('T')[0],
    weekEnd: weekEndDate.toISOString().split('T')[0],
  };
}

function buildSelfOnlyFriendsResponse(
  userId: string,
  period: LeaderboardPeriod
): FriendsLeaderboardResponse {
  const authUser = useAuthStore.getState().user;
  const quizDate = getQuizDate();
  const { weekStart, weekEnd } = getCurrentWeekBounds();

  return {
    period,
    quizDate,
    weekStart,
    weekEnd,
    leaderboard: [
      {
        userId,
        displayName: authUser?.name ?? null,
        username: authUser?.username ?? null,
        score: 0,
        gamesPlayed: 0,
        streak: 0,
        rank: null,
        hasPlayedToday: false,
        hasPlayedThisWeek: false,
      },
    ],
    totalFriends: 0,
    friendsPlayedToday: 0,
    friendsPlayedThisWeek: 0,
  };
}

function hasUsableFriendsData(
  state: Pick<LeaderboardState, 'friendsLeaderboard' | 'friendsCache'>,
  period: LeaderboardPeriod
): boolean {
  return (
    state.friendsLeaderboard.length > 0 ||
    Boolean(
      state.friendsCache?.data.period === period &&
        state.friendsCache.data.leaderboard.length > 0
    )
  );
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  friendsLeaderboard: [],
  totalFriends: 0,
  friendsPlayedToday: 0,
  friendsPlayedThisWeek: 0,
  globalLeaderboard: [],
  friendsPeriod: 'daily',
  globalPeriod: 'daily',
  friendsCache: null,
  globalCache: null,
  loadingFriends: false,
  loadingGlobal: false,
  error: null,

  hydrateFromCache: async (userId: string, period: LeaderboardPeriod = 'daily') => {
    logInfo('leaderboard.cache.hydrate.start', { userId, period });
    const [friendsCache, globalCache] = await Promise.all([
      userId.startsWith('guest_') ? Promise.resolve(null) : getCachedFriendsLeaderboard(userId, period),
      getCachedGlobalLeaderboard(period),
    ]);

    set({
      friendsLeaderboard: friendsCache?.data.leaderboard ?? [],
      totalFriends: friendsCache?.data.totalFriends ?? 0,
      friendsPlayedToday: friendsCache?.data.friendsPlayedToday ?? 0,
      friendsPlayedThisWeek: friendsCache?.data.friendsPlayedThisWeek ?? 0,
      globalLeaderboard: globalCache?.data.leaderboard ?? [],
      friendsPeriod: period,
      globalPeriod: period,
      friendsCache,
      globalCache,
      error: null,
    });
    logInfo('leaderboard.cache.hydrate.success', {
      userId,
      period,
      friendsCount: friendsCache?.data.leaderboard.length ?? 0,
      globalCount: globalCache?.data.leaderboard.length ?? 0,
    });
  },

  revalidateFriends: async (userId: string, period: LeaderboardPeriod = 'daily') => {
    if (userId.startsWith('guest_') || !useAuthStore.getState().token) {
      logInfo('leaderboard.friends.skip', {
        userId,
        period,
        isGuest: userId.startsWith('guest_'),
        hasToken: Boolean(useAuthStore.getState().token),
      });
      return;
    }

    logInfo('leaderboard.friends.start', { userId, period });
    set({ loadingFriends: true, error: null, friendsPeriod: period });
    try {
      const data = await getFriendsLeaderboard(userId, period);
      await setCachedFriendsLeaderboard(userId, data);
      const refreshedCache = await getCachedFriendsLeaderboard(userId, period);

      if (get().friendsPeriod !== period || !isCurrentAuthUser(userId)) {
        logInfo('leaderboard.friends.stale_response', { userId, period });
        return;
      }

      set({
        friendsLeaderboard: data.leaderboard,
        totalFriends: data.totalFriends,
        friendsPlayedToday: data.friendsPlayedToday,
        friendsPlayedThisWeek: data.friendsPlayedThisWeek,
        friendsCache: refreshedCache,
        loadingFriends: false,
        error: null,
      });
      logInfo('leaderboard.friends.success', { userId, period, count: data.leaderboard.length });
    } catch (error) {
      if (get().friendsPeriod !== period || !isCurrentAuthUser(userId)) {
        return;
      }

      if (hasUsableFriendsData(get(), period)) {
        logWarn('leaderboard.friends.refresh_failed_using_stale', {
          userId,
          period,
          message: error instanceof Error ? error.message : 'Failed to load friends leaderboard',
        });
        set({
          loadingFriends: false,
          error: null,
        });
        return;
      }

      if (
        error instanceof ApiError &&
        error.statusCode === 408 &&
        get().totalFriends === 0 &&
        get().friendsLeaderboard.length <= 1
      ) {
        const fallback = buildSelfOnlyFriendsResponse(userId, period);
        await setCachedFriendsLeaderboard(userId, fallback);
        const refreshedCache = await getCachedFriendsLeaderboard(userId, period);
        logWarn('leaderboard.friends.timeout_self_only_fallback', { userId, period });
        set({
          friendsLeaderboard: fallback.leaderboard,
          totalFriends: fallback.totalFriends,
          friendsPlayedToday: fallback.friendsPlayedToday,
          friendsPlayedThisWeek: fallback.friendsPlayedThisWeek,
          friendsCache: refreshedCache,
          loadingFriends: false,
          error: null,
        });
        return;
      }

      logError('leaderboard.friends.error', error);
      set({
        loadingFriends: false,
        error: error instanceof Error ? error.message : 'Failed to load friends leaderboard',
      });
    }
  },

  revalidateGlobal: async (period: LeaderboardPeriod = 'daily') => {
    logInfo('leaderboard.global.start', { period });
    set({ loadingGlobal: true, error: null, globalPeriod: period });
    try {
      const data = await getLeaderboard(period);
      await setCachedGlobalLeaderboard(data);
      const refreshedCache = await getCachedGlobalLeaderboard(period);

      if (get().globalPeriod !== period) {
        logInfo('leaderboard.global.stale_response', { period });
        return;
      }

      set({
        globalLeaderboard: data.leaderboard,
        globalCache: refreshedCache,
        loadingGlobal: false,
        error: null,
      });
      logInfo('leaderboard.global.success', { period, count: data.leaderboard.length });
    } catch (error) {
      logError('leaderboard.global.error', error);
      if (get().globalPeriod !== period) {
        return;
      }
      set({
        loadingGlobal: false,
        error: error instanceof Error ? error.message : 'Failed to load leaderboard',
      });
    }
  },

  prefetchDailyLoop: async (userId: string, isAuthenticated: boolean) => {
    logInfo('leaderboard.prefetch.start', { userId, isAuthenticated });
    await Promise.all([
      get().revalidateGlobal('daily'),
      isAuthenticated ? get().revalidateFriends(userId, 'daily') : Promise.resolve(),
    ]);
    logInfo('leaderboard.prefetch.success', { userId, isAuthenticated });
  },

  invalidateFriends: async (userId: string, period: LeaderboardPeriod = 'daily') => {
    if (userId.startsWith('guest_')) {
      set({
        friendsLeaderboard: [],
        totalFriends: 0,
        friendsPlayedToday: 0,
        friendsPlayedThisWeek: 0,
        friendsCache: null,
      });
      return;
    }

    await get().revalidateFriends(userId, period);
  },

  reset: () => set({
    friendsLeaderboard: [],
    totalFriends: 0,
    friendsPlayedToday: 0,
    friendsPlayedThisWeek: 0,
    globalLeaderboard: [],
    friendsPeriod: 'daily',
    globalPeriod: 'daily',
    friendsCache: null,
    globalCache: null,
    loadingFriends: false,
    loadingGlobal: false,
    error: null,
  }),
}));
