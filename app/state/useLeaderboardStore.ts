import { create } from 'zustand';
import { ApiError, getFriendsLeaderboard, getLeaderboard } from '../services/api';
import type {
  CacheEnvelope,
  FriendsLeaderboardResponse,
  GlobalLeaderboardResponse,
  LeaderboardPeriod,
} from '../types';
import {
  clearCachedFriendsLeaderboards,
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
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';
import { getLeaderboardDatasetKey, getLeaderboardDateWindow } from '../../shared/leaderboard';

type DatasetKey = 'global:daily' | 'global:weekly' | 'friends:daily' | 'friends:weekly';

interface RevalidateOptions {
  force?: boolean;
  propagateError?: boolean;
}

interface PrefetchOptions {
  force?: boolean;
  propagateProtectedError?: boolean;
}

interface LeaderboardState {
  friendsOwnerId: string | null;
  globalData: Partial<Record<LeaderboardPeriod, GlobalLeaderboardResponse>>;
  friendsData: Partial<Record<LeaderboardPeriod, FriendsLeaderboardResponse>>;
  globalCaches: Partial<Record<LeaderboardPeriod, CacheEnvelope<GlobalLeaderboardResponse>>>;
  friendsCaches: Partial<Record<LeaderboardPeriod, CacheEnvelope<FriendsLeaderboardResponse>>>;
  loading: Partial<Record<DatasetKey, boolean>>;
  errors: Partial<Record<DatasetKey, string>>;
  hydrateFromCache: (userId: string) => Promise<void>;
  hydratePeriodFromCache: (userId: string, period: LeaderboardPeriod) => Promise<void>;
  revalidateFriends: (
    userId: string,
    period?: LeaderboardPeriod,
    options?: RevalidateOptions
  ) => Promise<void>;
  revalidateGlobal: (period?: LeaderboardPeriod, options?: RevalidateOptions) => Promise<void>;
  prefetchDailyLoop: (
    userId: string,
    isAuthenticated: boolean,
    options?: PrefetchOptions
  ) => Promise<void>;
  invalidateFriends: (userId: string, periodToRefresh?: LeaderboardPeriod) => Promise<void>;
  applyAvatar: (userId: string, avatarId: AvatarId) => Promise<void>;
  reset: () => void;
}

const requests = new Map<string, Promise<void>>();
let latestHydrationRequest = 0;

function isCurrentAuthUser(userId: string, authStateVersion?: number): boolean {
  const authState = useAuthStore.getState();
  return canProcessProtectedAction(
    {
      isAuthenticated: authState.isAuthenticated,
      authStatus: authState.authStatus,
      identityStatus: authState.identityStatus,
      token: authState.token,
      userId: authState.user?.sub,
      authStateVersion: authState.authStateVersion,
    },
    { userId, authStateVersion }
  );
}

function isCurrentCache<T extends { period: LeaderboardPeriod; periodStart: string }>(
  cache: CacheEnvelope<T> | null | undefined,
  period: LeaderboardPeriod
): cache is CacheEnvelope<T> {
  const expected = getLeaderboardDateWindow(getQuizDate(), period);
  return Boolean(
    cache && cache.data.period === period && cache.data.periodStart === expected.periodStart
  );
}

function isCurrentResponse(data: { period: LeaderboardPeriod; periodStart: string }): boolean {
  return data.periodStart === getLeaderboardDateWindow(getQuizDate(), data.period).periodStart;
}

function buildSelfOnlyFriendsResponse(
  userId: string,
  period: LeaderboardPeriod
): FriendsLeaderboardResponse {
  const authUser = useAuthStore.getState().user;
  const dates = getLeaderboardDateWindow(getQuizDate(), period);
  return {
    period,
    quizDate: dates.quizDate,
    periodStart: dates.periodStart,
    periodEnd: dates.periodEnd,
    leaderboard: [{
      userId,
      displayName: authUser?.username ?? null,
      username: authUser?.username ?? null,
      score: 0,
      gamesPlayed: 0,
      streak: 0,
      rank: null,
      hasPlayedToday: false,
      hasPlayedPeriod: false,
      avatarId: authUser?.avatarId ?? null,
    }],
    totalFriends: 0,
    friendsPlayedToday: 0,
    friendsPlayedPeriod: 0,
  };
}

function setDatasetError(
  set: (partial: Partial<LeaderboardState> | ((state: LeaderboardState) => Partial<LeaderboardState>)) => void,
  key: DatasetKey,
  message?: string
): void {
  set((state) => ({
    loading: { ...state.loading, [key]: false },
    errors: { ...state.errors, [key]: message },
  }));
}

export const useLeaderboardStore = create<LeaderboardState>((set, get) => ({
  globalData: {},
  friendsOwnerId: null,
  friendsData: {},
  globalCaches: {},
  friendsCaches: {},
  loading: {},
  errors: {},

  hydrateFromCache: async (userId) => {
    await get().hydratePeriodFromCache(userId, 'daily');
  },

  hydratePeriodFromCache: async (userId, period) => {
    const requestId = ++latestHydrationRequest;
    set((state) => state.friendsOwnerId === userId ? {} : {
      friendsOwnerId: userId,
      friendsData: {},
      friendsCaches: {},
      errors: {
        ...state.errors,
        'friends:daily': undefined,
        'friends:weekly': undefined,
      },
    });
    const [friendsCache, globalCache] = await Promise.all([
      userId.startsWith('guest_')
        ? Promise.resolve(null)
        : getCachedFriendsLeaderboard(userId, period),
      getCachedGlobalLeaderboard(period),
    ]);
    if (requestId !== latestHydrationRequest) return;

    set((state) => ({
      friendsData: {
        ...state.friendsData,
        [period]: isCurrentCache(friendsCache, period) ? friendsCache.data : undefined,
      },
      friendsOwnerId: userId,
      globalData: {
        ...state.globalData,
        [period]: isCurrentCache(globalCache, period) ? globalCache.data : undefined,
      },
      friendsCaches: {
        ...state.friendsCaches,
        [period]: isCurrentCache(friendsCache, period) ? friendsCache : undefined,
      },
      globalCaches: {
        ...state.globalCaches,
        [period]: isCurrentCache(globalCache, period) ? globalCache : undefined,
      },
    }));
    logInfo('leaderboard.cache.hydrate.success', { userId, period });
  },

  revalidateFriends: async (userId, period = 'daily', options = {}) => {
    const authStateVersion = useAuthStore.getState().authStateVersion;
    if (userId.startsWith('guest_') || !isCurrentAuthUser(userId, authStateVersion)) return;
    if (get().friendsOwnerId !== userId) {
      set({ friendsOwnerId: userId, friendsData: {}, friendsCaches: {} });
    }
    const cache = get().friendsCaches[period];
    if (!options.force && isCurrentCache(cache, period) && !isResourceStale(cache)) return;

    const key = getLeaderboardDatasetKey('friends', period);
    const requestKey = `${key}:${userId}:${authStateVersion}`;
    const existing = requests.get(requestKey);
    if (existing) return existing;

    const request = (async () => {
      set((state) => ({
        loading: { ...state.loading, [key]: true },
        errors: { ...state.errors, [key]: undefined },
      }));
      try {
        const data = await getFriendsLeaderboard(userId, period);
        if (!isCurrentResponse(data)) return;
        await setCachedFriendsLeaderboard(userId, data);
        const refreshedCache = await getCachedFriendsLeaderboard(userId, period);
        if (!isCurrentAuthUser(userId, authStateVersion)) return;
        set((state) => ({
          friendsData: { ...state.friendsData, [period]: data },
          friendsCaches: {
            ...state.friendsCaches,
            ...(refreshedCache ? { [period]: refreshedCache } : {}),
          },
        }));
        setDatasetError(set, key);
      } catch (error) {
        if (!isCurrentAuthUser(userId, authStateVersion)) return;
        const staleData = get().friendsData[period];
        if (staleData?.leaderboard.length) {
          logWarn('leaderboard.friends.refresh_failed_using_stale', { userId, period });
          setDatasetError(set, key, error instanceof Error ? error.message : 'Refresh failed');
        } else if (error instanceof ApiError && error.statusCode === 408) {
          const fallback = buildSelfOnlyFriendsResponse(userId, period);
          await setCachedFriendsLeaderboard(userId, fallback);
          set((state) => ({ friendsData: { ...state.friendsData, [period]: fallback } }));
          setDatasetError(set, key);
        } else {
          logError('leaderboard.friends.error', error);
          setDatasetError(
            set,
            key,
            error instanceof Error ? error.message : 'Failed to load friends leaderboard'
          );
        }
        if (options.propagateError) throw error;
      } finally {
        requests.delete(requestKey);
        if (isCurrentAuthUser(userId, authStateVersion)) setDatasetError(set, key, get().errors[key]);
      }
    })();
    requests.set(requestKey, request);
    return request;
  },

  revalidateGlobal: async (period = 'daily', options = {}) => {
    const cache = get().globalCaches[period];
    if (!options.force && isCurrentCache(cache, period) && !isResourceStale(cache)) return;
    const key = getLeaderboardDatasetKey('global', period);
    const requestKey = key;
    const existing = requests.get(requestKey);
    if (existing) return existing;

    const request = (async () => {
      set((state) => ({
        loading: { ...state.loading, [key]: true },
        errors: { ...state.errors, [key]: undefined },
      }));
      try {
        const data = await getLeaderboard(period);
        if (!isCurrentResponse(data)) return;
        await setCachedGlobalLeaderboard(data);
        const refreshedCache = await getCachedGlobalLeaderboard(period);
        set((state) => ({
          globalData: { ...state.globalData, [period]: data },
          globalCaches: {
            ...state.globalCaches,
            ...(refreshedCache ? { [period]: refreshedCache } : {}),
          },
        }));
        setDatasetError(set, key);
      } catch (error) {
        logError('leaderboard.global.error', error);
        setDatasetError(
          set,
          key,
          error instanceof Error ? error.message : 'Failed to load leaderboard'
        );
        if (options.propagateError) throw error;
      } finally {
        requests.delete(requestKey);
        setDatasetError(set, key, get().errors[key]);
      }
    })();
    requests.set(requestKey, request);
    return request;
  },

  prefetchDailyLoop: async (userId, isAuthenticated, options = {}) => {
    await Promise.all([
      get().revalidateGlobal('daily', { force: options.force }),
      isAuthenticated
        ? get().revalidateFriends(userId, 'daily', {
            force: options.force,
            propagateError: options.propagateProtectedError,
          })
        : Promise.resolve(),
    ]);
  },

  invalidateFriends: async (userId, periodToRefresh = 'daily') => {
    await clearCachedFriendsLeaderboards(userId);
    set({ friendsOwnerId: userId, friendsData: {}, friendsCaches: {} });
    if (!userId.startsWith('guest_')) {
      await get().revalidateFriends(userId, periodToRefresh, { force: true });
    }
  },

  applyAvatar: async (userId, avatarId) => {
    const state = get();
    const globalData = Object.fromEntries(
      Object.entries(state.globalData).map(([period, data]) => [
        period,
        data && { ...data, leaderboard: data.leaderboard.map((entry) =>
          entry.userId === userId ? { ...entry, avatarId } : entry
        ) },
      ])
    ) as LeaderboardState['globalData'];
    const friendsData = Object.fromEntries(
      Object.entries(state.friendsData).map(([period, data]) => [
        period,
        data && { ...data, leaderboard: data.leaderboard.map((entry) =>
          entry.userId === userId ? { ...entry, avatarId } : entry
        ) },
      ])
    ) as LeaderboardState['friendsData'];
    set({ globalData, friendsData });

    const ownerId = useAuthStore.getState().user?.sub;
    const periods: LeaderboardPeriod[] = ['daily', 'weekly'];
    const cached = await Promise.all(periods.flatMap((period) => [
      getCachedGlobalLeaderboard(period),
      ownerId ? getCachedFriendsLeaderboard(ownerId, period) : Promise.resolve(null),
    ]));
    await Promise.all(cached.flatMap((envelope, index) => {
      if (!envelope) return [];
      const data = {
        ...envelope.data,
        leaderboard: envelope.data.leaderboard.map((entry) =>
          entry.userId === userId ? { ...entry, avatarId } : entry
        ),
      };
      return index % 2 === 0
        ? [setCachedGlobalLeaderboard(data as GlobalLeaderboardResponse)]
        : ownerId
          ? [setCachedFriendsLeaderboard(ownerId, data as FriendsLeaderboardResponse)]
          : [];
    }));
  },

  reset: () => set({
    friendsOwnerId: null,
    globalData: {},
    friendsData: {},
    globalCaches: {},
    friendsCaches: {},
    loading: {},
    errors: {},
  }),
}));
