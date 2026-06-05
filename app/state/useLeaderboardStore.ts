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
import { isResourceStale } from '../storage/resourceCache';
import { useAuthStore } from './useAuthStore';
import { logError, logInfo, logWarn } from '../services/debugLog';
import { getQuizDate } from '../utils/quizDate';

type LeaderboardByPeriod<T> = Record<LeaderboardPeriod, T>;
type LoadingByPeriod = Record<LeaderboardPeriod, boolean>;

interface RevalidateOptions {
  force?: boolean;
}

interface LeaderboardState {
  friendsLeaderboards: LeaderboardByPeriod<FriendsLeaderboardEntry[]>;
  totalFriendsByPeriod: LeaderboardByPeriod<number>;
  friendsPlayedTodayByPeriod: LeaderboardByPeriod<number>;
  friendsPlayedThisWeekByPeriod: LeaderboardByPeriod<number>;
  globalLeaderboards: LeaderboardByPeriod<LeaderboardEntry[]>;
  friendsCaches: LeaderboardByPeriod<CacheEnvelope<FriendsLeaderboardResponse> | null>;
  globalCaches: LeaderboardByPeriod<CacheEnvelope<GlobalLeaderboardResponse> | null>;
  loadingFriendsByPeriod: LoadingByPeriod;
  loadingGlobalByPeriod: LoadingByPeriod;
  error: string | null;
  hydrateFromCache: (userId: string, period?: LeaderboardPeriod) => Promise<void>;
  revalidateFriends: (
    userId: string,
    period?: LeaderboardPeriod,
    options?: RevalidateOptions
  ) => Promise<void>;
  revalidateGlobal: (period?: LeaderboardPeriod, options?: RevalidateOptions) => Promise<void>;
  prefetchDailyLoop: (userId: string, isAuthenticated: boolean) => Promise<void>;
  invalidateFriends: (userId: string, period?: LeaderboardPeriod) => Promise<void>;
  reset: () => void;
}

const emptyFriendsLeaderboards = (): LeaderboardByPeriod<FriendsLeaderboardEntry[]> => ({
  daily: [],
  weekly: [],
});

const emptyGlobalLeaderboards = (): LeaderboardByPeriod<LeaderboardEntry[]> => ({
  daily: [],
  weekly: [],
});

const emptyNumberByPeriod = (): LeaderboardByPeriod<number> => ({
  daily: 0,
  weekly: 0,
});

const emptyCaches = <T>(): LeaderboardByPeriod<CacheEnvelope<T> | null> => ({
  daily: null,
  weekly: null,
});

const emptyLoading = (): LoadingByPeriod => ({
  daily: false,
  weekly: false,
});

const friendsRequests = new Map<string, Promise<void>>();
const globalRequests = new Map<LeaderboardPeriod, Promise<void>>();

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
  state: Pick<LeaderboardState, 'friendsLeaderboards' | 'friendsCaches'>,
  period: LeaderboardPeriod
): boolean {
  return (
    state.friendsLeaderboards[period].length > 0 ||
    Boolean(
      state.friendsCaches[period]?.data.period === period &&
        state.friendsCaches[period]?.data.leaderboard.length
    )
  );
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  friendsLeaderboards: emptyFriendsLeaderboards(),
  totalFriendsByPeriod: emptyNumberByPeriod(),
  friendsPlayedTodayByPeriod: emptyNumberByPeriod(),
  friendsPlayedThisWeekByPeriod: emptyNumberByPeriod(),
  globalLeaderboards: emptyGlobalLeaderboards(),
  friendsCaches: emptyCaches<FriendsLeaderboardResponse>(),
  globalCaches: emptyCaches<GlobalLeaderboardResponse>(),
  loadingFriendsByPeriod: emptyLoading(),
  loadingGlobalByPeriod: emptyLoading(),
  error: null,

  hydrateFromCache: async (userId: string, period: LeaderboardPeriod = 'daily') => {
    logInfo('leaderboard.cache.hydrate.start', { userId, period });
    const [dailyFriendsCache, weeklyFriendsCache, dailyGlobalCache, weeklyGlobalCache] =
      await Promise.all([
        userId.startsWith('guest_')
          ? Promise.resolve(null)
          : getCachedFriendsLeaderboard(userId, 'daily'),
        userId.startsWith('guest_')
          ? Promise.resolve(null)
          : getCachedFriendsLeaderboard(userId, 'weekly'),
        getCachedGlobalLeaderboard('daily'),
        getCachedGlobalLeaderboard('weekly'),
      ]);

    set((state) => ({
      friendsLeaderboards: {
        daily: dailyFriendsCache?.data.leaderboard ?? state.friendsLeaderboards.daily,
        weekly: weeklyFriendsCache?.data.leaderboard ?? state.friendsLeaderboards.weekly,
      },
      totalFriendsByPeriod: {
        daily: dailyFriendsCache?.data.totalFriends ?? state.totalFriendsByPeriod.daily,
        weekly: weeklyFriendsCache?.data.totalFriends ?? state.totalFriendsByPeriod.weekly,
      },
      friendsPlayedTodayByPeriod: {
        daily:
          dailyFriendsCache?.data.friendsPlayedToday ??
          state.friendsPlayedTodayByPeriod.daily,
        weekly:
          weeklyFriendsCache?.data.friendsPlayedToday ??
          state.friendsPlayedTodayByPeriod.weekly,
      },
      friendsPlayedThisWeekByPeriod: {
        daily:
          dailyFriendsCache?.data.friendsPlayedThisWeek ??
          state.friendsPlayedThisWeekByPeriod.daily,
        weekly:
          weeklyFriendsCache?.data.friendsPlayedThisWeek ??
          state.friendsPlayedThisWeekByPeriod.weekly,
      },
      globalLeaderboards: {
        daily: dailyGlobalCache?.data.leaderboard ?? state.globalLeaderboards.daily,
        weekly: weeklyGlobalCache?.data.leaderboard ?? state.globalLeaderboards.weekly,
      },
      friendsCaches: {
        daily: dailyFriendsCache,
        weekly: weeklyFriendsCache,
      },
      globalCaches: {
        daily: dailyGlobalCache,
        weekly: weeklyGlobalCache,
      },
      error: null,
    }));
    logInfo('leaderboard.cache.hydrate.success', {
      userId,
      period,
      friendsDailyCount: dailyFriendsCache?.data.leaderboard.length ?? 0,
      friendsWeeklyCount: weeklyFriendsCache?.data.leaderboard.length ?? 0,
      globalDailyCount: dailyGlobalCache?.data.leaderboard.length ?? 0,
      globalWeeklyCount: weeklyGlobalCache?.data.leaderboard.length ?? 0,
    });
  },

  revalidateFriends: async (
    userId: string,
    period: LeaderboardPeriod = 'daily',
    options: RevalidateOptions = {}
  ) => {
    if (userId.startsWith('guest_') || !useAuthStore.getState().token) {
      logInfo('leaderboard.friends.skip', {
        userId,
        period,
        isGuest: userId.startsWith('guest_'),
        hasToken: Boolean(useAuthStore.getState().token),
      });
      return;
    }

    const cache = get().friendsCaches[period];
    if (!options.force && cache && !isResourceStale(cache)) {
      logInfo('leaderboard.friends.fresh_cache_skip', { userId, period });
      return;
    }

    const requestKey = `${userId}:${period}`;
    const inFlightRequest = friendsRequests.get(requestKey);
    if (inFlightRequest) {
      logInfo('leaderboard.friends.in_flight_reuse', { userId, period });
      return inFlightRequest;
    }

    const request = (async () => {
      logInfo('leaderboard.friends.start', { userId, period, force: Boolean(options.force) });
      set((state) => ({
        loadingFriendsByPeriod: {
          ...state.loadingFriendsByPeriod,
          [period]: true,
        },
        error: null,
      }));

      try {
        const data = await getFriendsLeaderboard(userId, period);
        await setCachedFriendsLeaderboard(userId, data);
        const refreshedCache = await getCachedFriendsLeaderboard(userId, period);

        if (!isCurrentAuthUser(userId)) {
          logInfo('leaderboard.friends.stale_response', { userId, period });
          return;
        }

        set((state) => ({
          friendsLeaderboards: {
            ...state.friendsLeaderboards,
            [period]: data.leaderboard,
          },
          totalFriendsByPeriod: {
            ...state.totalFriendsByPeriod,
            [period]: data.totalFriends,
          },
          friendsPlayedTodayByPeriod: {
            ...state.friendsPlayedTodayByPeriod,
            [period]: data.friendsPlayedToday,
          },
          friendsPlayedThisWeekByPeriod: {
            ...state.friendsPlayedThisWeekByPeriod,
            [period]: data.friendsPlayedThisWeek,
          },
          friendsCaches: {
            ...state.friendsCaches,
            [period]: refreshedCache,
          },
          loadingFriendsByPeriod: {
            ...state.loadingFriendsByPeriod,
            [period]: false,
          },
          error: null,
        }));
        logInfo('leaderboard.friends.success', { userId, period, count: data.leaderboard.length });
      } catch (error) {
        if (!isCurrentAuthUser(userId)) {
          return;
        }

        if (hasUsableFriendsData(get(), period)) {
          logWarn('leaderboard.friends.refresh_failed_using_stale', {
            userId,
            period,
            message: error instanceof Error ? error.message : 'Failed to load friends leaderboard',
          });
          set((state) => ({
            loadingFriendsByPeriod: {
              ...state.loadingFriendsByPeriod,
              [period]: false,
            },
            error: null,
          }));
          return;
        }

        if (
          error instanceof ApiError &&
          error.statusCode === 408 &&
          get().totalFriendsByPeriod[period] === 0 &&
          get().friendsLeaderboards[period].length <= 1
        ) {
          const fallback = buildSelfOnlyFriendsResponse(userId, period);
          await setCachedFriendsLeaderboard(userId, fallback);
          const refreshedCache = await getCachedFriendsLeaderboard(userId, period);
          logWarn('leaderboard.friends.timeout_self_only_fallback', { userId, period });
          set((state) => ({
            friendsLeaderboards: {
              ...state.friendsLeaderboards,
              [period]: fallback.leaderboard,
            },
            totalFriendsByPeriod: {
              ...state.totalFriendsByPeriod,
              [period]: fallback.totalFriends,
            },
            friendsPlayedTodayByPeriod: {
              ...state.friendsPlayedTodayByPeriod,
              [period]: fallback.friendsPlayedToday,
            },
            friendsPlayedThisWeekByPeriod: {
              ...state.friendsPlayedThisWeekByPeriod,
              [period]: fallback.friendsPlayedThisWeek,
            },
            friendsCaches: {
              ...state.friendsCaches,
              [period]: refreshedCache,
            },
            loadingFriendsByPeriod: {
              ...state.loadingFriendsByPeriod,
              [period]: false,
            },
            error: null,
          }));
          return;
        }

        logError('leaderboard.friends.error', error);
        set((state) => ({
          loadingFriendsByPeriod: {
            ...state.loadingFriendsByPeriod,
            [period]: false,
          },
          error: error instanceof Error ? error.message : 'Failed to load friends leaderboard',
        }));
      } finally {
        friendsRequests.delete(requestKey);
        set((state) => ({
          loadingFriendsByPeriod: {
            ...state.loadingFriendsByPeriod,
            [period]: false,
          },
        }));
      }
    })();

    friendsRequests.set(requestKey, request);
    return request;
  },

  revalidateGlobal: async (
    period: LeaderboardPeriod = 'daily',
    options: RevalidateOptions = {}
  ) => {
    const cache = get().globalCaches[period];
    if (!options.force && cache && !isResourceStale(cache)) {
      logInfo('leaderboard.global.fresh_cache_skip', { period });
      return;
    }

    const inFlightRequest = globalRequests.get(period);
    if (inFlightRequest) {
      logInfo('leaderboard.global.in_flight_reuse', { period });
      return inFlightRequest;
    }

    const request = (async () => {
      logInfo('leaderboard.global.start', { period, force: Boolean(options.force) });
      set((state) => ({
        loadingGlobalByPeriod: {
          ...state.loadingGlobalByPeriod,
          [period]: true,
        },
        error: null,
      }));

      try {
        const data = await getLeaderboard(period);
        await setCachedGlobalLeaderboard(data);
        const refreshedCache = await getCachedGlobalLeaderboard(period);

        set((state) => ({
          globalLeaderboards: {
            ...state.globalLeaderboards,
            [period]: data.leaderboard,
          },
          globalCaches: {
            ...state.globalCaches,
            [period]: refreshedCache,
          },
          loadingGlobalByPeriod: {
            ...state.loadingGlobalByPeriod,
            [period]: false,
          },
          error: null,
        }));
        logInfo('leaderboard.global.success', { period, count: data.leaderboard.length });
      } catch (error) {
        logError('leaderboard.global.error', error);
        set((state) => ({
          loadingGlobalByPeriod: {
            ...state.loadingGlobalByPeriod,
            [period]: false,
          },
          error: error instanceof Error ? error.message : 'Failed to load leaderboard',
        }));
      } finally {
        globalRequests.delete(period);
        set((state) => ({
          loadingGlobalByPeriod: {
            ...state.loadingGlobalByPeriod,
            [period]: false,
          },
        }));
      }
    })();

    globalRequests.set(period, request);
    return request;
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
        friendsLeaderboards: emptyFriendsLeaderboards(),
        totalFriendsByPeriod: emptyNumberByPeriod(),
        friendsPlayedTodayByPeriod: emptyNumberByPeriod(),
        friendsPlayedThisWeekByPeriod: emptyNumberByPeriod(),
        friendsCaches: emptyCaches<FriendsLeaderboardResponse>(),
      });
      return;
    }

    await get().revalidateFriends(userId, period, { force: true });
  },

  reset: () => set({
    friendsLeaderboards: emptyFriendsLeaderboards(),
    totalFriendsByPeriod: emptyNumberByPeriod(),
    friendsPlayedTodayByPeriod: emptyNumberByPeriod(),
    friendsPlayedThisWeekByPeriod: emptyNumberByPeriod(),
    globalLeaderboards: emptyGlobalLeaderboards(),
    friendsCaches: emptyCaches<FriendsLeaderboardResponse>(),
    globalCaches: emptyCaches<GlobalLeaderboardResponse>(),
    loadingFriendsByPeriod: emptyLoading(),
    loadingGlobalByPeriod: emptyLoading(),
    error: null,
  }),
}));
