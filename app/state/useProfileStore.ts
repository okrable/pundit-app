import { create } from 'zustand';
import { getTodayResult, getUserStats } from '../services/api';
import { CacheEnvelope, QuizResult, QuizResultImmediate, UserStats } from '../types';
import { getCachedUserStats, setCachedUserStats } from '../storage/profileCache';
import { getTodayQuizResult } from '../storage/quizStorage';
import { useAuthStore } from './useAuthStore';
import { logError, logInfo } from '../services/debugLog';

const GUEST_STATS: UserStats = {
  streak: 0,
  bestScore: 0,
  totalQuizzes: 0,
  challengeWins: 0,
  challengeLosses: 0,
  challengeDraws: 0,
  username: null,
  displayName: null,
  createdAt: null,
  canChangeUsername: false,
  usernameChangeAvailableAt: null,
};

interface ProfileState {
  statsUserId: string | null;
  stats: UserStats | null;
  playedToday: boolean;
  statsCache: CacheEnvelope<UserStats> | null;
  loading: boolean;
  error: string | null;
  hydrateFromCache: (userId: string) => Promise<void>;
  revalidate: (userId: string) => Promise<void>;
  applyServerStats: (stats: UserStats) => Promise<void>;
  markPlayedToday: (result: QuizResultImmediate | QuizResult, userId: string) => Promise<void>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  statsUserId: null,
  stats: null,
  playedToday: false,
  statsCache: null,
  loading: false,
  error: null,

  hydrateFromCache: async (userId: string) => {
    logInfo('profile.cache.hydrate.start', { userId });
    const [cachedStats, todayResult] = await Promise.all([
      userId.startsWith('guest_') ? Promise.resolve(null) : getCachedUserStats(userId),
      getTodayQuizResult(userId),
    ]);

    set({
      statsUserId: userId,
      stats: cachedStats?.data ?? (userId.startsWith('guest_') ? GUEST_STATS : null),
      playedToday: Boolean(todayResult),
      statsCache: cachedStats,
      error: null,
    });
    logInfo('profile.cache.hydrate.success', {
      userId,
      hasCachedStats: Boolean(cachedStats?.data),
      playedToday: Boolean(todayResult),
    });
  },

  revalidate: async (userId: string) => {
    const startedAuthState = useAuthStore.getState();
    const startedAuthVersion = startedAuthState.authStateVersion;

    logInfo('profile.revalidate.start', { userId, authStateVersion: startedAuthVersion });
    set({ loading: true, error: null });

    try {
      const todayResult = await getTodayQuizResult(userId);

      if (userId.startsWith('guest_')) {
        set({
          statsUserId: userId,
          stats: GUEST_STATS,
          statsCache: null,
          playedToday: Boolean(todayResult),
          loading: false,
          error: null,
        });
        logInfo('profile.revalidate.guest', { userId, playedToday: Boolean(todayResult) });
        return;
      }

      const authState = useAuthStore.getState();
      if (!authState.token || authState.user?.sub !== userId) {
        logInfo('profile.revalidate.skipped_no_matching_auth', {
          userId,
          authUserId: authState.user?.sub,
          hasToken: Boolean(authState.token),
        });
        set({
          statsUserId: userId,
          playedToday: Boolean(todayResult),
          loading: false,
        });
        return;
      }

      const [stats, remoteTodayResult] = await Promise.all([
        getUserStats(userId),
        getTodayResult(userId),
      ]);

      await setCachedUserStats(userId, stats);
      const refreshedCache = await getCachedUserStats(userId);
      const latestAuthState = useAuthStore.getState();
      if (
        latestAuthState.authStateVersion !== startedAuthVersion ||
        latestAuthState.user?.sub !== userId
      ) {
        logInfo('profile.revalidate.discarded_stale_success', {
          userId,
          startedAuthVersion,
          latestAuthVersion: latestAuthState.authStateVersion,
        });
        set({ loading: false });
        return;
      }

      set({
        statsUserId: userId,
        stats,
        statsCache: refreshedCache,
        playedToday: Boolean(remoteTodayResult || todayResult),
        loading: false,
        error: null,
      });
      logInfo('profile.revalidate.success', { userId, playedToday: Boolean(remoteTodayResult || todayResult) });
    } catch (error) {
      const latestAuthState = useAuthStore.getState();
      if (
        latestAuthState.authStateVersion !== startedAuthVersion ||
        latestAuthState.user?.sub !== userId
      ) {
        logInfo('profile.revalidate.discarded_stale_error', {
          userId,
          startedAuthVersion,
          latestAuthVersion: latestAuthState.authStateVersion,
        });
        set({ loading: false });
        return;
      }

      logError('profile.revalidate.error', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to refresh profile',
      });
    }
  },

  applyServerStats: async (stats: UserStats) => {
    const authUserId = useAuthStore.getState().user?.sub;
    if (!authUserId) {
      set({ stats, error: null });
      return;
    }

    await setCachedUserStats(authUserId, stats);
    const refreshedCache = await getCachedUserStats(authUserId);
    set({
      statsUserId: authUserId,
      stats,
      statsCache: refreshedCache,
      error: null,
    });
  },

  markPlayedToday: async (result: QuizResultImmediate | QuizResult, userId: string) => {
    const isGuest = userId.startsWith('guest_');
    const alreadyPlayedToday = get().playedToday;
    const currentStats = get().stats ?? (userId.startsWith('guest_') ? GUEST_STATS : null);
    if (!currentStats) {
      const isServerConfirmed = result.syncState === undefined || result.syncState === 'synced';
      const nextStats: UserStats = {
        ...GUEST_STATS,
        streak: isGuest || isServerConfirmed ? result.streak : 0,
        bestScore: Math.max(result.bestScore, result.score),
        totalQuizzes: isGuest || isServerConfirmed ? 1 : 0,
      };

      if (!isGuest) {
        await setCachedUserStats(userId, nextStats);
      }

      set({
        statsUserId: userId,
        stats: nextStats,
        playedToday: true,
        error: null,
      });
      return;
    }

    const isServerConfirmed = result.syncState === undefined || result.syncState === 'synced';
    const nextStats: UserStats = {
      ...currentStats,
      streak: isGuest || isServerConfirmed ? result.streak : currentStats.streak,
      bestScore: Math.max(currentStats.bestScore, result.bestScore, result.score),
      totalQuizzes: isGuest && !alreadyPlayedToday
        ? currentStats.totalQuizzes + 1
        : currentStats.totalQuizzes,
    };

    if (!isGuest) {
      await setCachedUserStats(userId, nextStats);
    }

    set({
      statsUserId: userId,
      stats: nextStats,
      playedToday: true,
      error: null,
    });
  },

  reset: () => set({
    statsUserId: null,
    stats: null,
    playedToday: false,
    statsCache: null,
    loading: false,
    error: null,
  }),
}));
