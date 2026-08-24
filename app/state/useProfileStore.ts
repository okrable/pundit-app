import { create } from 'zustand';
import { getTodayResult, getUserStats, updateAvatar } from '../services/api';
import { CacheEnvelope, QuizResult, QuizResultImmediate, UserStats } from '../types';
import { getCachedUserStats, setCachedUserStats } from '../storage/profileCache';
import { getTodayQuizResult } from '../storage/quizStorage';
import { useAuthStore } from './useAuthStore';
import { logError, logInfo } from '../services/debugLog';
import { getQuizDate } from '../utils/quizDate';
import { buildStreakStatus } from '../../shared/streak';
import type { AvatarId } from '../../shared/avatarCatalog';
import {
  applyAchievementEvent,
  type AvatarChangeAchievementEvent,
} from '../../shared/achievements';
import { useAchievementStore } from './useAchievementStore';
import {
  clearPendingAvatarAchievementMutation,
  getPendingAvatarAchievementMutation,
  setPendingAvatarAchievementMutation,
} from '../storage/achievementStorage';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';

let latestProfileHydrationRequest = 0;

function hasVerifiedProfileSession(userId: string, authStateVersion?: number): boolean {
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

const GUEST_STATS: UserStats = {
  streak: 0,
  streakStatus: buildStreakStatus(
    { runLength: 0, lastPlayedDate: null },
    getQuizDate()
  ),
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
  revalidate: (userId: string, options?: { propagateError?: boolean }) => Promise<void>;
  applyServerStats: (stats: UserStats) => Promise<void>;
  saveAvatar: (avatarId: AvatarId) => Promise<AvatarId>;
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
    const requestId = ++latestProfileHydrationRequest;
    logInfo('profile.cache.hydrate.start', { userId });
    const [cachedStats, todayResult] = await Promise.all([
      userId.startsWith('guest_') ? Promise.resolve(null) : getCachedUserStats(userId),
      getTodayQuizResult(userId),
    ]);

    if (requestId !== latestProfileHydrationRequest) {
      logInfo('profile.cache.hydrate.discarded_stale', { userId, requestId });
      return;
    }

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

  revalidate: async (userId: string, options = {}) => {
    const startedAuthState = useAuthStore.getState();
    const startedAuthVersion = startedAuthState.authStateVersion;

    if (
      !userId.startsWith('guest_') &&
      !hasVerifiedProfileSession(userId, startedAuthVersion)
    ) {
      logInfo('profile.revalidate.waiting_for_verified_session', { userId });
      return;
    }

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

      const [stats, remoteTodayResult] = await Promise.all([
        getUserStats(userId),
        getTodayResult(userId),
      ]);

      if (stats.achievements) {
        await useAchievementStore.getState().reconcileServer(userId, stats.achievements);
      }

      await setCachedUserStats(userId, stats);
      const refreshedCache = await getCachedUserStats(userId);
      const latestAuthState = useAuthStore.getState();
      if (
        !hasVerifiedProfileSession(userId, startedAuthVersion)
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
        playedToday:
          stats.streakStatus.state === 'active_today' ||
          Boolean(remoteTodayResult || todayResult),
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
      if (options.propagateError) throw error;
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

  saveAvatar: async (avatarId) => {
    const startedAuthState = useAuthStore.getState();
    const userId = startedAuthState.user?.sub;
    const authStateVersion = startedAuthState.authStateVersion;
    if (!userId || !hasVerifiedProfileSession(userId, authStateVersion)) {
      throw new Error('Your session is no longer available.');
    }

    const achievementEvent: AvatarChangeAchievementEvent =
      (await getPendingAvatarAchievementMutation(userId, avatarId)) ?? {
        id: `avatar:${userId}:${getQuizDate()}:${Date.now()}`,
        kind: 'avatar-change',
        occurredAt: new Date().toISOString(),
        quizDate: getQuizDate(),
        allowCumulative: true,
      };
    await setPendingAvatarAchievementMutation(userId, avatarId, achievementEvent);
    const proposal = applyAchievementEvent(
      useAchievementStore.getState().snapshot,
      achievementEvent
    );
    const achievementSync = useAchievementStore.getState().buildSyncEnvelope(
      achievementEvent.id,
      proposal.newlyUnlocked
    );
    const response = await updateAvatar(
      userId,
      avatarId,
      achievementEvent,
      achievementSync
    );
    if (!response.success || !response.profile?.avatarId) {
      throw new Error(response.error || 'Unable to save your avatar.');
    }

    const latestAuthState = useAuthStore.getState();
    if (
      !hasVerifiedProfileSession(userId, authStateVersion)
    ) {
      throw new Error('Your session changed. Please try again.');
    }

    const confirmedAvatarId = response.profile.avatarId;
    await clearPendingAvatarAchievementMutation(userId);
    await useAchievementStore.getState().applyLocalEvent(userId, achievementEvent);
    if (response.achievementSnapshot) {
      await useAchievementStore.getState().reconcileServer(
        userId,
        response.achievementSnapshot,
        {
          acceptedEventId: achievementEvent.id,
          newlyUnlocked: response.newlyUnlockedAchievements,
          rejectedIds: response.rejectedAchievementIds,
        }
      );
    }
    await latestAuthState.applyAvatar(confirmedAvatarId);
    const currentStats = get().statsUserId === userId ? get().stats : null;
    if (currentStats) {
      const nextStats = { ...currentStats, avatarId: confirmedAvatarId };
      await setCachedUserStats(userId, nextStats);
      const refreshedCache = await getCachedUserStats(userId);
      if (useAuthStore.getState().user?.sub === userId) {
        set({ stats: nextStats, statsCache: refreshedCache, error: null });
      }
    }

    return confirmedAvatarId;
  },

  markPlayedToday: async (result: QuizResultImmediate | QuizResult, userId: string) => {
    const isGuest = userId.startsWith('guest_');
    const authState = useAuthStore.getState();
    if (
      !isGuest &&
      (!authState.isAuthenticated || authState.user?.sub !== userId)
    ) {
      logInfo('profile.mark_played.discarded_stale', {
        userId,
        authUserId: authState.user?.sub,
      });
      return;
    }

    const alreadyPlayedToday = get().playedToday;
    const currentStats =
      (get().statsUserId === userId ? get().stats : null) ??
      (isGuest ? GUEST_STATS : null);
    const isServerConfirmed =
      result.syncState === undefined || result.syncState === 'synced';
    const shouldApplyResult =
      isGuest || isServerConfirmed || Boolean(result.isOptimistic);

    if (!currentStats) {
      const nextStats: UserStats = {
        ...GUEST_STATS,
        streak: shouldApplyResult ? result.streak : 0,
        streakStatus: shouldApplyResult
          ? {
              current: result.streak,
              state: 'active_today',
              lastPlayedDate: result.date,
              asOfQuizDate: result.date,
            }
          : GUEST_STATS.streakStatus,
        bestScore: Math.max(result.bestScore, result.score),
        totalQuizzes: shouldApplyResult ? 1 : 0,
      };

      set({
        statsUserId: userId,
        stats: nextStats,
        playedToday: true,
        error: null,
      });

      if (!isGuest) {
        await setCachedUserStats(userId, nextStats);
        const refreshedCache = await getCachedUserStats(userId);
        if (get().statsUserId === userId) {
          set({ statsCache: refreshedCache });
        }
      }

      return;
    }

    const nextStats: UserStats = {
      ...currentStats,
      streak: shouldApplyResult ? result.streak : currentStats.streak,
      streakStatus: shouldApplyResult
        ? {
            current: result.streak,
            state: 'active_today',
            lastPlayedDate: result.date,
            asOfQuizDate: result.date,
          }
        : currentStats.streakStatus,
      bestScore: Math.max(currentStats.bestScore, result.bestScore, result.score),
      totalQuizzes: isGuest && !alreadyPlayedToday
        ? currentStats.totalQuizzes + 1
        : currentStats.totalQuizzes,
    };

    set({
      statsUserId: userId,
      stats: nextStats,
      playedToday: true,
      error: null,
    });

    if (!isGuest) {
      await setCachedUserStats(userId, nextStats);
      const refreshedCache = await getCachedUserStats(userId);
      if (get().statsUserId === userId) {
        set({ statsCache: refreshedCache });
      }
    }
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
