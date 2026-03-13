import { getUserId } from '../storage/userStorage';
import { useAuthStore } from '../state/useAuthStore';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import { useProfileStore } from '../state/useProfileStore';
import { useQuizStore } from '../state/useQuizStore';
import { logError, logInfo, logWarn } from './debugLog';

let inflightPrefetch: Promise<void> | null = null;

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
    useQuizStore.getState().hydrateFromCache(userId),
    useProfileStore.getState().hydrateFromCache(userId),
    useLeaderboardStore.getState().hydrateFromCache(userId),
  ]);
  logInfo('dailyLoop.cache.hydrate.success', { userId });
}

export async function prefetchDailyLoop(userId?: string): Promise<void> {
  if (inflightPrefetch) {
    logWarn('dailyLoop.prefetch.skipped_inflight');
    return inflightPrefetch;
  }

  const effectiveUserId = userId ?? (await resolveEffectiveUserId());
  const isAuthenticated =
    useAuthStore.getState().isAuthenticated && !effectiveUserId.startsWith('guest_');

  logInfo('dailyLoop.prefetch.start', { userId: effectiveUserId, isAuthenticated });
  inflightPrefetch = Promise.all([
    useQuizStore.getState().fetchQuiz(),
    useProfileStore.getState().revalidate(effectiveUserId),
    useLeaderboardStore.getState().prefetchDailyLoop(effectiveUserId, isAuthenticated),
    useQuizStore.getState().retryPendingSubmission(),
  ]).then(() => undefined)
    .then(() => {
      logInfo('dailyLoop.prefetch.success', { userId: effectiveUserId });
    })
    .catch((error) => {
      logError('dailyLoop.prefetch.error', error);
      throw error;
    })
    .finally(() => {
      inflightPrefetch = null;
    });

  return inflightPrefetch;
}
