import { getUserId } from '../storage/userStorage';
import { useAuthStore } from '../state/useAuthStore';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import { useProfileStore } from '../state/useProfileStore';
import { useQuizStore } from '../state/useQuizStore';

export async function resolveEffectiveUserId(): Promise<string> {
  const authState = useAuthStore.getState();
  if (authState.isAuthenticated && authState.user?.sub) {
    return authState.user.sub;
  }

  return getUserId();
}

export async function hydrateDailyLoopFromCache(userId: string): Promise<void> {
  useQuizStore.getState().setUserId(userId);
  await Promise.all([
    useQuizStore.getState().hydrateFromCache(userId),
    useProfileStore.getState().hydrateFromCache(userId),
    useLeaderboardStore.getState().hydrateFromCache(userId),
  ]);
}

export async function prefetchDailyLoop(userId?: string): Promise<void> {
  const effectiveUserId = userId ?? (await resolveEffectiveUserId());
  const isAuthenticated =
    useAuthStore.getState().isAuthenticated && !effectiveUserId.startsWith('guest_');

  await Promise.all([
    useQuizStore.getState().fetchQuiz(),
    useProfileStore.getState().revalidate(effectiveUserId),
    useLeaderboardStore.getState().prefetchDailyLoop(effectiveUserId, isAuthenticated),
    useQuizStore.getState().retryPendingSubmission(),
  ]);
}
