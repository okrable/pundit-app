import { create } from 'zustand';
import { getTodayResult, getUserStats } from '../services/api';
import { CacheEnvelope, QuizResultImmediate, UserStats } from '../types';
import { getCachedUserStats, setCachedUserStats } from '../storage/profileCache';
import { getTodayQuizResult } from '../storage/quizStorage';
import { useAuthStore } from './useAuthStore';

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
  canChangeUsername: true,
  usernameChangeAvailableAt: null,
};

interface ProfileState {
  stats: UserStats | null;
  playedToday: boolean;
  statsCache: CacheEnvelope<UserStats> | null;
  loading: boolean;
  error: string | null;
  hydrateFromCache: (userId: string) => Promise<void>;
  revalidate: (userId: string) => Promise<void>;
  applyServerStats: (stats: UserStats) => Promise<void>;
  markPlayedToday: (result: QuizResultImmediate, userId: string) => Promise<void>;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  stats: null,
  playedToday: false,
  statsCache: null,
  loading: false,
  error: null,

  hydrateFromCache: async (userId: string) => {
    const [cachedStats, todayResult] = await Promise.all([
      userId.startsWith('guest_') ? Promise.resolve(null) : getCachedUserStats(userId),
      getTodayQuizResult(userId),
    ]);

    set({
      stats: cachedStats?.data ?? (userId.startsWith('guest_') ? GUEST_STATS : null),
      playedToday: Boolean(todayResult),
      statsCache: cachedStats,
      error: null,
    });
  },

  revalidate: async (userId: string) => {
    set({ loading: true, error: null });

    try {
      const todayResult = await getTodayQuizResult(userId);

      if (userId.startsWith('guest_')) {
        set({
          stats: GUEST_STATS,
          statsCache: null,
          playedToday: Boolean(todayResult),
          loading: false,
          error: null,
        });
        return;
      }

      const authState = useAuthStore.getState();
      if (!authState.token) {
        set({
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

      set({
        stats,
        statsCache: refreshedCache,
        playedToday: Boolean(remoteTodayResult || todayResult),
        loading: false,
        error: null,
      });
    } catch (error) {
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
      stats,
      statsCache: refreshedCache,
      error: null,
    });
  },

  markPlayedToday: async (result: QuizResultImmediate, userId: string) => {
    const currentStats = get().stats ?? (userId.startsWith('guest_') ? GUEST_STATS : null);
    if (!currentStats) {
      set({ playedToday: true });
      return;
    }

    const nextStats: UserStats = {
      ...currentStats,
      bestScore: Math.max(currentStats.bestScore, result.score),
      totalQuizzes: userId.startsWith('guest_')
        ? Math.max(currentStats.totalQuizzes, 1)
        : currentStats.totalQuizzes,
    };

    if (!userId.startsWith('guest_')) {
      await setCachedUserStats(userId, nextStats);
    }

    set({
      stats: nextStats,
      playedToday: true,
      error: null,
    });
  },

  reset: () => set({
    stats: null,
    playedToday: false,
    statsCache: null,
    loading: false,
    error: null,
  }),
}));
