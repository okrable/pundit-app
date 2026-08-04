import { create } from 'zustand';
import { ApiError, getFriendsLeaderboard, getLeaderboard } from '../services/api';
import {
  CacheEnvelope,
  FriendsLeaderboardEntry,
  FriendsLeaderboardResponse,
  GlobalLeaderboardResponse,
  LeaderboardEntry,
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
import type { AvatarId } from '../../shared/avatarCatalog';

interface RevalidateOptions {
  force?: boolean;
}

interface PrefetchOptions {
  force?: boolean;
}

interface LeaderboardState {
  friendsLeaderboard: FriendsLeaderboardEntry[];
  totalFriends: number;
  friendsPlayedToday: number;
  globalLeaderboard: LeaderboardEntry[];
  friendsCache: CacheEnvelope<FriendsLeaderboardResponse> | null;
  globalCache: CacheEnvelope<GlobalLeaderboardResponse> | null;
  loadingFriends: boolean;
  loadingGlobal: boolean;
  error: string | null;
  hydrateFromCache: (userId: string) => Promise<void>;
  revalidateFriends: (userId: string, options?: RevalidateOptions) => Promise<void>;
  revalidateGlobal: (options?: RevalidateOptions) => Promise<void>;
  prefetchDailyLoop: (
    userId: string,
    isAuthenticated: boolean,
    options?: PrefetchOptions
  ) => Promise<void>;
  invalidateFriends: (userId: string) => Promise<void>;
  applyAvatar: (userId: string, avatarId: AvatarId) => Promise<void>;
  reset: () => void;
}

const friendsRequests = new Map<string, Promise<void>>();
let globalRequest: Promise<void> | null = null;

function isCurrentAuthUser(userId: string): boolean {
  const authState = useAuthStore.getState();
  return Boolean(authState.token && authState.user?.sub === userId);
}

function isCurrentDailyCache<T extends { quizDate: string }>(
  cache: CacheEnvelope<T> | null,
  quizDate = getQuizDate()
): cache is CacheEnvelope<T> {
  return Boolean(cache && cache.data.quizDate === quizDate);
}

function buildSelfOnlyFriendsResponse(userId: string): FriendsLeaderboardResponse {
  const authUser = useAuthStore.getState().user;
  const quizDate = getQuizDate();

  return {
    period: 'daily',
    quizDate,
    leaderboard: [
      {
        userId,
        displayName: authUser?.username ?? null,
        username: authUser?.username ?? null,
        score: 0,
        gamesPlayed: 0,
        streak: 0,
        rank: null,
        hasPlayedToday: false,
        avatarId: authUser?.avatarId ?? null,
      },
    ],
    totalFriends: 0,
    friendsPlayedToday: 0,
  };
}

function hasUsableFriendsData(state: Pick<LeaderboardState, 'friendsLeaderboard' | 'friendsCache'>): boolean {
  return (
    state.friendsLeaderboard.length > 0 ||
    Boolean(isCurrentDailyCache(state.friendsCache) && state.friendsCache.data.leaderboard.length)
  );
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
    const quizDate = getQuizDate();
    logInfo('leaderboard.cache.hydrate.start', { userId, quizDate });
    const [friendsCache, globalCache] = await Promise.all([
      userId.startsWith('guest_') ? Promise.resolve(null) : getCachedFriendsLeaderboard(userId),
      getCachedGlobalLeaderboard(),
    ]);

    const currentFriendsCache = isCurrentDailyCache(friendsCache, quizDate) ? friendsCache : null;
    const currentGlobalCache = isCurrentDailyCache(globalCache, quizDate) ? globalCache : null;

    set((state) => ({
      friendsLeaderboard: currentFriendsCache?.data.leaderboard ?? state.friendsLeaderboard,
      totalFriends: currentFriendsCache?.data.totalFriends ?? state.totalFriends,
      friendsPlayedToday: currentFriendsCache?.data.friendsPlayedToday ?? state.friendsPlayedToday,
      globalLeaderboard: currentGlobalCache?.data.leaderboard ?? state.globalLeaderboard,
      friendsCache: currentFriendsCache,
      globalCache: currentGlobalCache,
      error: null,
    }));
    logInfo('leaderboard.cache.hydrate.success', {
      userId,
      quizDate,
      friendsCount: currentFriendsCache?.data.leaderboard.length ?? 0,
      globalCount: currentGlobalCache?.data.leaderboard.length ?? 0,
    });
  },

  revalidateFriends: async (userId: string, options: RevalidateOptions = {}) => {
    if (userId.startsWith('guest_') || !useAuthStore.getState().token) {
      logInfo('leaderboard.friends.skip', {
        userId,
        isGuest: userId.startsWith('guest_'),
        hasToken: Boolean(useAuthStore.getState().token),
      });
      return;
    }

    const cache = get().friendsCache;
    if (!options.force && isCurrentDailyCache(cache) && !isResourceStale(cache)) {
      logInfo('leaderboard.friends.fresh_cache_skip', { userId, quizDate: cache.data.quizDate });
      return;
    }

    const inFlightRequest = friendsRequests.get(userId);
    if (inFlightRequest) {
      logInfo('leaderboard.friends.in_flight_reuse', { userId });
      return inFlightRequest;
    }

    const request = (async () => {
      logInfo('leaderboard.friends.start', { userId, force: Boolean(options.force) });
      set({ loadingFriends: true, error: null });

      try {
        const data = await getFriendsLeaderboard(userId);
        await setCachedFriendsLeaderboard(userId, data);
        const refreshedCache = await getCachedFriendsLeaderboard(userId);

        if (!isCurrentAuthUser(userId)) {
          logInfo('leaderboard.friends.stale_response', { userId });
          return;
        }

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
        if (!isCurrentAuthUser(userId)) {
          return;
        }

        if (hasUsableFriendsData(get())) {
          logWarn('leaderboard.friends.refresh_failed_using_stale', {
            userId,
            message: error instanceof Error ? error.message : 'Failed to load friends leaderboard',
          });
          set({ loadingFriends: false, error: null });
          return;
        }

        if (
          error instanceof ApiError &&
          error.statusCode === 408 &&
          get().totalFriends === 0 &&
          get().friendsLeaderboard.length <= 1
        ) {
          const fallback = buildSelfOnlyFriendsResponse(userId);
          await setCachedFriendsLeaderboard(userId, fallback);
          const refreshedCache = await getCachedFriendsLeaderboard(userId);
          logWarn('leaderboard.friends.timeout_self_only_fallback', { userId });
          set({
            friendsLeaderboard: fallback.leaderboard,
            totalFriends: fallback.totalFriends,
            friendsPlayedToday: fallback.friendsPlayedToday,
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
      } finally {
        friendsRequests.delete(userId);
        set({ loadingFriends: false });
      }
    })();

    friendsRequests.set(userId, request);
    return request;
  },

  revalidateGlobal: async (options: RevalidateOptions = {}) => {
    const cache = get().globalCache;
    if (!options.force && isCurrentDailyCache(cache) && !isResourceStale(cache)) {
      logInfo('leaderboard.global.fresh_cache_skip', { quizDate: cache.data.quizDate });
      return;
    }

    if (globalRequest) {
      logInfo('leaderboard.global.in_flight_reuse');
      return globalRequest;
    }

    globalRequest = (async () => {
      logInfo('leaderboard.global.start', { force: Boolean(options.force) });
      set({ loadingGlobal: true, error: null });

      try {
        const data = await getLeaderboard();
        await setCachedGlobalLeaderboard(data);
        const refreshedCache = await getCachedGlobalLeaderboard();

        set({
          globalLeaderboard: data.leaderboard,
          globalCache: refreshedCache,
          loadingGlobal: false,
          error: null,
        });
        logInfo('leaderboard.global.success', { count: data.leaderboard.length });
      } catch (error) {
        logError('leaderboard.global.error', error);
        set({
          loadingGlobal: false,
          error: error instanceof Error ? error.message : 'Failed to load leaderboard',
        });
      } finally {
        globalRequest = null;
        set({ loadingGlobal: false });
      }
    })();

    return globalRequest;
  },

  prefetchDailyLoop: async (
    userId: string,
    isAuthenticated: boolean,
    options: PrefetchOptions = {}
  ) => {
    logInfo('leaderboard.prefetch.start', {
      userId,
      isAuthenticated,
      force: Boolean(options.force),
    });
    await Promise.all([
      get().revalidateGlobal({ force: options.force }),
      isAuthenticated ? get().revalidateFriends(userId, { force: options.force }) : Promise.resolve(),
    ]);
    logInfo('leaderboard.prefetch.success', { userId, isAuthenticated });
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

    await get().revalidateFriends(userId, { force: true });
  },

  applyAvatar: async (userId, avatarId) => {
    const state = get();
    const friendsLeaderboard = state.friendsLeaderboard.map((entry) =>
      entry.userId === userId ? { ...entry, avatarId } : entry
    );
    const globalLeaderboard = state.globalLeaderboard.map((entry) =>
      entry.userId === userId ? { ...entry, avatarId } : entry
    );
    const friendsCache = state.friendsCache
      ? {
          ...state.friendsCache,
          data: {
            ...state.friendsCache.data,
            leaderboard: state.friendsCache.data.leaderboard.map((entry) =>
              entry.userId === userId ? { ...entry, avatarId } : entry
            ),
          },
        }
      : null;
    const globalCache = state.globalCache
      ? {
          ...state.globalCache,
          data: {
            ...state.globalCache.data,
            leaderboard: state.globalCache.data.leaderboard.map((entry) =>
              entry.userId === userId ? { ...entry, avatarId } : entry
            ),
          },
        }
      : null;

    set({ friendsLeaderboard, globalLeaderboard, friendsCache, globalCache });
    await Promise.all([
      friendsCache ? setCachedFriendsLeaderboard(userId, friendsCache.data) : Promise.resolve(),
      globalCache ? setCachedGlobalLeaderboard(globalCache.data) : Promise.resolve(),
    ]);
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
