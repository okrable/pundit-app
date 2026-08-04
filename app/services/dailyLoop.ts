import { getUserId } from '../storage/userStorage';
import { useAuthStore } from '../state/useAuthStore';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import { useProfileStore } from '../state/useProfileStore';
import { useQuizStore } from '../state/useQuizStore';
import { useChallengeStore } from '../state/useChallengeStore';
import { useCareerGameStore } from '../state/useCareerGameStore';
import { logError, logInfo, logWarn } from './debugLog';
import { isIdentityActivationCurrent } from '../../shared/clientIdentityPolicy';

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
  useCareerGameStore.getState().setUserId(userId);
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
    useCareerGameStore.getState().hydrateFromCache(userId).then(() => {
      logInfo('dailyLoop.cache.hydrate.career.success', { userId });
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
    tasks.push(useCareerGameStore.getState().retryPendingSubmission(effectiveUserId));
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
  const startedAuthState = useAuthStore.getState();
  const startedAuthStateVersion = startedAuthState.authStateVersion;
  const syncKey = `${userId}:${startedAuthStateVersion}`;
  const existingSync = inflightAuthSyncs.get(syncKey);
  if (existingSync) {
    logWarn('dailyLoop.authSync.skipped_inflight', { userId, source });
    return existingSync;
  }

  const sync = (async () => {
    const assertCurrentSession = () => {
      const currentAuthState = useAuthStore.getState();
      if (!isIdentityActivationCurrent(userId, startedAuthStateVersion, {
        userId: currentAuthState.user?.sub,
        token: currentAuthState.token,
        isAuthenticated: currentAuthState.isAuthenticated,
        authStateVersion: currentAuthState.authStateVersion,
      })) {
        throw new Error('Authenticated session changed during synchronization');
      }
    };

    assertCurrentSession();
    useAuthStore.getState().beginAuthSync(source);
    logInfo('dailyLoop.authSync.start', { userId, source });

    try {
      await useQuizStore.getState().reconcileIdentity(userId, userProfile);
      assertCurrentSession();
      await useCareerGameStore.getState().reconcileIdentity(userId);
      assertCurrentSession();
      await prefetchDailyLoop({ userId, mode: 'bootstrap-auth' });
      assertCurrentSession();
      useAuthStore.getState().finishAuthSync();
      logInfo('dailyLoop.authSync.success', { userId, source });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync authenticated session';
      const latestAuthState = useAuthStore.getState();
      if (isIdentityActivationCurrent(userId, startedAuthStateVersion, {
        userId: latestAuthState.user?.sub,
        token: latestAuthState.token,
        isAuthenticated: latestAuthState.isAuthenticated,
        authStateVersion: latestAuthState.authStateVersion,
      })) {
        latestAuthState.failAuthSync(message);
      } else {
        logWarn('dailyLoop.authSync.discarded_stale', { userId, source });
      }
      logError('dailyLoop.authSync.error', { userId, source, message });
      throw error;
    }
  })().finally(() => {
    inflightAuthSyncs.delete(syncKey);
  });

  inflightAuthSyncs.set(syncKey, sync);
  return sync;
}
