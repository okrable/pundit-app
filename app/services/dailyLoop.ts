import { getUserId } from '../storage/userStorage';
import { useAuthStore } from '../state/useAuthStore';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import { useProfileStore } from '../state/useProfileStore';
import { useQuizStore } from '../state/useQuizStore';
import { useChallengeStore } from '../state/useChallengeStore';
import { logError, logInfo, logWarn } from './debugLog';

const inflightPrefetches = new Map<string, Promise<void>>();
const inflightAuthSyncs = new Map<string, Promise<void>>();

type PrefetchMode = 'bootstrap-auth' | 'public-warm' | 'manual';

interface PrefetchOptions {
  userId?: string;
  mode?: PrefetchMode;
}

interface AuthenticatedSessionSyncOptions {
  userId: string;
  userProfile?: {
    email?: string;
    avatarUrl?: string;
  };
  source: 'login' | 'restore';
}

export async function resolveEffectiveUserId(): Promise<string> {
  const authState = useAuthStore.getState();
  if (authState.isAuthenticated && authState.user?.sub) {
    logInfo('dailyLoop.user.authenticated', { userId: authState.user.sub });
    return authState.user.sub;
  }

  const guestUserId = await getUserId();
  logInfo('dailyLoop.user.guest', { userId: guestUserId });
  return guestUserId;
}

export async function hydrateDailyLoopFromCache(userId: string): Promise<void> {
  logInfo('dailyLoop.cache.hydrate.start', { userId });
  useQuizStore.getState().setUserId(userId);
  await Promise.all([
    useQuizStore.getState().hydrateFromCache(userId).then(() => {
      logInfo('dailyLoop.cache.hydrate.quiz.success', { userId });
    }),
    useProfileStore.getState().hydrateFromCache(userId).then(() => {
      logInfo('dailyLoop.cache.hydrate.profile.success', { userId });
    }),
    useLeaderboardStore.getState().hydrateFromCache(userId).then(() => {
      logInfo('dailyLoop.cache.hydrate.leaderboard.success', { userId });
    }),
  ]);
  logInfo('dailyLoop.cache.hydrate.success', { userId });
}

export async function prefetchDailyLoop(options?: string | PrefetchOptions): Promise<void> {
  const normalizedOptions =
    typeof options === 'string'
      ? { userId: options, mode: 'public-warm' as PrefetchMode }
      : options ?? { mode: 'public-warm' as PrefetchMode };
  const mode = normalizedOptions.mode ?? 'public-warm';
  const effectiveUserId = normalizedOptions.userId ?? (await resolveEffectiveUserId());
  const existingPrefetch = inflightPrefetches.get(`${effectiveUserId}:${mode}`);
  if (existingPrefetch) {
    logWarn('dailyLoop.prefetch.skipped_inflight', { userId: effectiveUserId, mode });
    return existingPrefetch;
  }

  const isAuthenticated =
    useAuthStore.getState().isAuthenticated &&
    useAuthStore.getState().authStatus === 'authenticated' &&
    Boolean(useAuthStore.getState().token) &&
    !effectiveUserId.startsWith('guest_');
  const hasToken = Boolean(useAuthStore.getState().token);
  const shouldRunProtected = mode === 'bootstrap-auth' && isAuthenticated && hasToken;

  logInfo('dailyLoop.prefetch.start', {
    userId: effectiveUserId,
    mode,
    isAuthenticated,
    hasToken,
    shouldRunProtected,
  });
  const tasks: Promise<unknown>[] = [
    useQuizStore.getState().fetchQuiz(),
    useLeaderboardStore.getState().prefetchDailyLoop(effectiveUserId, shouldRunProtected),
  ];

  if (shouldRunProtected) {
    tasks.push(useQuizStore.getState().retryPendingSubmission());
    tasks.push(useChallengeStore.getState().retryPendingSubmission(effectiveUserId));
    tasks.push(useProfileStore.getState().revalidate(effectiveUserId));
  }

  const prefetch = Promise.all(tasks).then(() => undefined)
    .then(() => {
      logInfo('dailyLoop.prefetch.success', { userId: effectiveUserId });
    })
    .catch((error) => {
      logError('dailyLoop.prefetch.error', error);
      throw error;
    })
    .finally(() => {
      inflightPrefetches.delete(`${effectiveUserId}:${mode}`);
    });

  inflightPrefetches.set(`${effectiveUserId}:${mode}`, prefetch);
  return prefetch;
}

export async function syncAuthenticatedSession({
  userId,
  userProfile,
  source,
}: AuthenticatedSessionSyncOptions): Promise<void> {
  const syncKey = `${userId}:${source}:${useAuthStore.getState().authStateVersion}`;
  const existingSync = inflightAuthSyncs.get(syncKey);
  if (existingSync) {
    logWarn('dailyLoop.authSync.skipped_inflight', { userId, source });
    return existingSync;
  }

  const sync = (async () => {
    useAuthStore.getState().beginAuthSync(source);
    logInfo('dailyLoop.authSync.start', { userId, source });

    try {
      await useQuizStore.getState().reconcileIdentity(userId, userProfile);
      await prefetchDailyLoop({ userId, mode: 'bootstrap-auth' });
      useAuthStore.getState().finishAuthSync();
      logInfo('dailyLoop.authSync.success', { userId, source });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync authenticated session';
      useAuthStore.getState().failAuthSync(message);
      logError('dailyLoop.authSync.error', { userId, source, message });
      throw error;
    }
  })().finally(() => {
    inflightAuthSyncs.delete(syncKey);
  });

  inflightAuthSyncs.set(syncKey, sync);
  return sync;
}
