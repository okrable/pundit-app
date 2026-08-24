import { create } from 'zustand';
import {
  ApiError,
  getDailyQuiz,
  getTodayResult,
  migrateGuestResult,
  submitQuiz,
} from '../services/api';
import { useAuthStore } from './useAuthStore';
import { getQuizDate } from '../utils/quizDate';
import { getCachedQuizEntry, isQuizCacheStale, setCachedQuiz } from '../storage/quizCache';
import {
  clearPendingQuizSubmission,
  getPendingQuizSubmission,
  setPendingQuizSubmission,
} from '../storage/pendingSubmission';
import {
  CachedQuizResult,
  clearGuestCache,
  getGuestTodayResult,
  getTodayQuizResult,
  saveDailyQuizResult,
} from '../storage/quizStorage';
import {
  AnswerWithTiming,
  CacheEnvelope,
  PendingQuizSubmission,
  Quiz,
  QuizResultImmediate,
  UserProfile,
} from '../types';
import { useProfileStore } from './useProfileStore';
import { useLeaderboardStore } from './useLeaderboardStore';
import { logError, logInfo, logWarn } from '../services/debugLog';
import { calculateQuizPoints } from '../../shared/scoring';
import {
  clearAnalyticsTiming,
  getAnalyticsTimingDuration,
  trackAnalyticsEvent,
} from '../services/analytics';
import { chooseReconciliationSource } from '../../shared/reconciliation';
import { projectStreakAfterPlay } from '../../shared/streak';
import {
  isQuizSubmissionCurrent,
  isTransientQuizSubmissionFailure,
} from '../../shared/quizSync';
import { isQuizForDate } from '../../shared/dailyQuiz';
import type { DailyQuizAchievementEvent } from '../../shared/achievements';
import { useAchievementStore } from './useAchievementStore';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';

interface ReconcileIdentityOptions {
  holdInteractiveHandoff?: boolean;
}

interface QuizState {
  quiz: Quiz | null;
  quizCache: CacheEnvelope<Quiz> | null;
  cachedResult: CachedQuizResult | null;
  result: QuizResultImmediate | null;
  userId: string | null;
  quizError: string | null;
  submitError: string | null;
  isQuizLoading: boolean;
  isSubmitting: boolean;
  isReconcilingIdentity: boolean;
  guestResetVersion: number;
  setUserId: (userId: string) => void;
  hydrateFromCache: (userId: string, date?: string) => Promise<void>;
  fetchQuiz: (date?: string, options?: { force?: boolean }) => Promise<Quiz | null>;
  setCachedResult: (result: CachedQuizResult | null) => void;
  reconcileIdentity: (
    userId: string,
    userProfile?: UserProfile,
    options?: ReconcileIdentityOptions
  ) => Promise<void>;
  completeQuiz: (answers: AnswerWithTiming[]) => Promise<void>;
  createLocalResult: (answers: AnswerWithTiming[]) => Promise<QuizResultImmediate | null>;
  submitQuizAnswers: (
    answers: AnswerWithTiming[],
    userProfile?: UserProfile,
    context?: {
      quizId: string;
      localResult: QuizResultImmediate;
    }
  ) => Promise<void>;
  retryPendingSubmission: () => Promise<void>;
  clearGuestTodayQuiz: () => Promise<void>;
  resetQuiz: () => void;
}

function buildUserProfile(): UserProfile | undefined {
  const authState = useAuthStore.getState();
  if (!authState.isAuthenticated || !authState.user) {
    return undefined;
  }

  return {
    email: authState.user.email,
    avatarUrl: authState.user.picture,
  };
}

function hasVerifiedQuizSession(userId: string, authStateVersion?: number): boolean {
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

const inflightIdentityReconciliations = new Map<string, Promise<void>>();
const completedIdentityReconciliations = new Set<string>();
let latestQuizFetchRequest = 0;
const SUBMISSION_RETRY_DELAY_MS = 750;

async function holdInterstitial(startedAt: number): Promise<void> {
  const minimumDurationMs = 1200;
  const elapsed = Date.now() - startedAt;
  if (elapsed >= minimumDurationMs) {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, minimumDurationMs - elapsed));
}

export const useQuizStore = create<QuizState>((set, get) => ({
  quiz: null,
  quizCache: null,
  cachedResult: null,
  result: null,
  userId: null,
  quizError: null,
  submitError: null,
  isQuizLoading: false,
  isSubmitting: false,
  isReconcilingIdentity: false,
  guestResetVersion: 0,

  setUserId: (userId: string) =>
    set((state) =>
      state.userId === userId
        ? { userId }
        : {
            userId,
            result: null,
            submitError: null,
            isSubmitting: false,
          }
    ),

  hydrateFromCache: async (userId: string, date?: string) => {
    const targetDate = date || getQuizDate();
    logInfo('quiz.cache.hydrate.start', { userId, targetDate });
    const [quizCache, cachedResult] = await Promise.all([
      getCachedQuizEntry(targetDate),
      getTodayQuizResult(userId),
    ]);

    const currentDate = getQuizDate();
    if (targetDate !== currentDate) {
      logWarn('quiz.cache.hydrate.discarded_stale', {
        userId,
        targetDate,
        currentDate,
        responseDate: quizCache?.data.date,
      });
      return get().hydrateFromCache(userId, currentDate);
    }

    if (get().userId !== userId) {
      logWarn('quiz.cache.hydrate.discarded_identity_change', { userId, targetDate });
      return;
    }

    set({
      userId,
      quiz: quizCache?.data ?? null,
      quizCache,
      cachedResult,
      quizError: null,
    });
    logInfo('quiz.cache.hydrate.success', {
      userId,
      targetDate,
      hasQuiz: Boolean(quizCache?.data),
      responseDate: quizCache?.data.date,
      source: quizCache?.data ? 'local-cache' : 'none',
      hasCachedResult: Boolean(cachedResult),
    });
  },

  fetchQuiz: async (date?: string, options?: { force?: boolean }) => {
    const targetDate = date || getQuizDate();
    const requestId = ++latestQuizFetchRequest;
    const isCurrentRequest = () =>
      requestId === latestQuizFetchRequest && targetDate === getQuizDate();
    const discardStaleRequest = (
      source: 'local-cache' | 'network',
      responseDate?: string
    ) => {
      const currentDate = getQuizDate();
      logWarn('quiz.fetch.discarded_stale', {
        targetDate,
        responseDate,
        currentDate,
        requestId,
        latestRequestId: latestQuizFetchRequest,
        source,
      });

      if (requestId === latestQuizFetchRequest && targetDate !== currentDate) {
        set({
          quiz: null,
          quizCache: null,
          cachedResult: null,
          result: null,
          quizError: null,
          isQuizLoading: true,
        });
        void get().fetchQuiz(currentDate);
      }
    };
    const currentState = get();
    const hasMismatchedQuiz = Boolean(
      currentState.quiz && !isQuizForDate(currentState.quiz, targetDate)
    );
    const hasMismatchedCachedResult = Boolean(
      currentState.cachedResult && currentState.cachedResult.date !== targetDate
    );
    const hasMismatchedResult = Boolean(
      currentState.result && currentState.result.date !== targetDate
    );

    logInfo('quiz.fetch.start', {
      targetDate,
      force: Boolean(options?.force),
      requestId,
      heldQuizDate: currentState.quiz?.date,
    });

    if (hasMismatchedQuiz || hasMismatchedCachedResult || hasMismatchedResult) {
      logWarn('quiz.fetch.date_rollover_clear', {
        targetDate,
        heldQuizDate: currentState.quiz?.date,
        heldResultDate: currentState.cachedResult?.date ?? currentState.result?.date,
      });
      set({
        ...(hasMismatchedQuiz ? { quiz: null, quizCache: null } : {}),
        ...(hasMismatchedCachedResult ? { cachedResult: null } : {}),
        ...(hasMismatchedResult ? { result: null } : {}),
        quizError: null,
        isQuizLoading: true,
      });
    }

    const cachedQuiz = await getCachedQuizEntry(targetDate);

    if (!isCurrentRequest()) {
      discardStaleRequest('local-cache', cachedQuiz?.data.date);
      return null;
    }

    if (cachedQuiz && !options?.force && !isQuizCacheStale(cachedQuiz)) {
      logInfo('quiz.fetch.cache_hit', {
        targetDate,
        responseDate: cachedQuiz.data.date,
        requestId,
        source: 'local-cache',
      });
      set({
        quiz: cachedQuiz.data,
        quizCache: cachedQuiz,
        quizError: null,
      });
      return cachedQuiz.data;
    }

    if (cachedQuiz?.data) {
      set({
        quiz: cachedQuiz.data,
        quizCache: cachedQuiz,
        quizError: null,
      });
    }

    set({ isQuizLoading: !cachedQuiz?.data, quizError: null });

    try {
      const quiz = await getDailyQuiz(targetDate);
      if (!isQuizForDate(quiz, targetDate)) {
        logWarn('quiz.fetch.response_date_mismatch', {
          targetDate,
          responseDate: quiz.date,
          responseQuizId: quiz.id,
          requestId,
          source: 'network',
        });
        throw new Error(`Received quiz ${quiz.id} for ${quiz.date}, expected ${targetDate}`);
      }

      await setCachedQuiz(targetDate, quiz);
      const refreshedCache = await getCachedQuizEntry(targetDate);

      if (!isCurrentRequest()) {
        discardStaleRequest('network', quiz.date);
        return null;
      }

      set({
        quiz,
        quizCache: refreshedCache,
        isQuizLoading: false,
        quizError: null,
      });
      logInfo('quiz.fetch.success', {
        targetDate,
        responseDate: quiz.date,
        requestId,
        source: 'network',
        questionCount: quiz.questions.length,
      });
      return quiz;
    } catch (error) {
      if (!isCurrentRequest()) {
        discardStaleRequest('network');
        return null;
      }

      if (error instanceof ApiError && error.statusCode === 404) {
        logWarn('quiz.fetch.missing', { targetDate, message: error.message });
        set({
          isQuizLoading: false,
          quizError: error.message,
        });
        return cachedQuiz?.data ?? null;
      }

      logError('quiz.fetch.error', error);
      set({
        isQuizLoading: false,
        quizError: error instanceof Error ? error.message : 'Failed to fetch quiz',
      });
      return cachedQuiz?.data ?? null;
    }
  },

  setCachedResult: (cachedResult: CachedQuizResult | null) => set({ cachedResult }),

  reconcileIdentity: async (
    userId: string,
    userProfile?: UserProfile,
    options?: ReconcileIdentityOptions
  ) => {
    if (!userId || userId.startsWith('guest_')) {
      return;
    }

    const authStateVersion = useAuthStore.getState().authStateVersion;
    const reconciliationKey = `${userId}:${getQuizDate()}:${authStateVersion}`;
    if (completedIdentityReconciliations.has(reconciliationKey)) {
      logInfo('quiz.identity.reconcile.skip_already_done', { userId });
      return;
    }

    const existingReconciliation = inflightIdentityReconciliations.get(reconciliationKey);
    if (existingReconciliation) return existingReconciliation;

    const assertCurrent = () => {
      const currentAuthState = useAuthStore.getState();
      if (
        !canProcessProtectedAction(
          {
            isAuthenticated: currentAuthState.isAuthenticated,
            authStatus: currentAuthState.authStatus,
            identityStatus: currentAuthState.identityStatus,
            token: currentAuthState.token,
            userId: currentAuthState.user?.sub,
            authStateVersion: currentAuthState.authStateVersion,
          },
          { userId, authStateVersion }
        )
      ) {
        throw new Error('Authenticated session changed during quiz reconciliation');
      }
    };

    assertCurrent();
    const startedAt = Date.now();
    logInfo('quiz.identity.reconcile.start', { userId });
    set({
      userId,
      isReconcilingIdentity: true,
      submitError: null,
      isSubmitting: false,
    });

    const reconciliation = (async () => {
      try {
        const localResult = await getTodayQuizResult(userId);
        if (localResult) {
          assertCurrent();
          await clearGuestCache();
          await useProfileStore.getState().markPlayedToday(localResult, userId);
          assertCurrent();
          set({
            cachedResult: localResult,
            userId,
            quizError: null,
            submitError: null,
          });
          logInfo('quiz.identity.reconcile.local_result', { userId });
          return;
        }

        try {
          const serverResult = await getTodayResult(userId);
          if (serverResult) {
            assertCurrent();
            await saveDailyQuizResult(serverResult, userId, serverResult.syncState);
            const cachedServerResult = await getTodayQuizResult(userId);
            await clearGuestCache();
            await useProfileStore.getState().markPlayedToday(serverResult, userId);
            assertCurrent();
            set({
              cachedResult: cachedServerResult,
              userId,
              quizError: null,
              submitError: null,
            });
            logInfo('quiz.identity.reconcile.server_result', { userId });
            return;
          }
        } catch (error) {
          logError('quiz.identity.reconcile.server_result.error', error);
          throw error;
        }

        const guestResult = await getGuestTodayResult();
        assertCurrent();
        const reconciliationSource = chooseReconciliationSource({
          hasLocalResult: false,
          hasServerResult: false,
          hasGuestResult: Boolean(guestResult),
        });
        if (reconciliationSource === 'none' || !guestResult) {
          set({
            cachedResult: null,
            userId,
            quizError: null,
            submitError: null,
          });
          logInfo('quiz.identity.reconcile.no_result', { userId });
          return;
        }

        const guestAchievementEvent = guestResult.achievementEvent;
        const guestAchievementSync = guestAchievementEvent
          ? {
              ...useAchievementStore.getState().buildSyncEnvelope(
                guestAchievementEvent.id,
                guestResult.newlyUnlockedAchievements ?? []
              ),
              acknowledgedIds: guestResult.newlyUnlockedAchievements ?? [],
            }
          : undefined;
        const migrationResult = await migrateGuestResult(
          userId,
          guestResult.quizId,
          guestResult.score,
          guestResult.totalQuestions,
          guestResult.answers,
          userProfile ?? buildUserProfile(),
          guestAchievementEvent,
          guestAchievementSync
        );
        assertCurrent();

        if (migrationResult.achievementSnapshot) {
          await useAchievementStore.getState().reconcileServer(
            userId,
            migrationResult.achievementSnapshot,
            {
              acceptedEventId: guestAchievementEvent?.id,
              newlyUnlocked: migrationResult.newlyUnlockedAchievements,
              rejectedIds: migrationResult.rejectedAchievementIds,
            }
          );
        }

        if (!migrationResult.migrated) {
          const existingResult = await getTodayResult(userId);
          assertCurrent();
          if (existingResult) {
            await saveDailyQuizResult(existingResult, userId, existingResult.syncState);
            const cachedExistingResult = await getTodayQuizResult(userId);
            await clearGuestCache();
            await useProfileStore.getState().markPlayedToday(existingResult, userId);
            assertCurrent();
            set({
              cachedResult: cachedExistingResult,
              userId,
              quizError: null,
              submitError: null,
            });
            logInfo('quiz.identity.reconcile.existing_after_migration', { userId });
            return;
          }

          set({
            cachedResult: null,
            userId,
            submitError: migrationResult.message ?? null,
          });
          logWarn('quiz.identity.reconcile.migration_not_applied', {
            userId,
            message: migrationResult.message,
          });
          return;
        }

        const migratedResult: CachedQuizResult = {
          ...guestResult,
          streak: migrationResult.streak,
          bestScore: migrationResult.bestScore,
          userId,
          syncState: 'synced',
          cachedAt: new Date().toISOString(),
        };

        await saveDailyQuizResult(migratedResult, userId, migratedResult.syncState);
        const cachedMigratedResult = await getTodayQuizResult(userId);
        await clearGuestCache();
        await useProfileStore.getState().markPlayedToday(migratedResult, userId);
        assertCurrent();
        void useLeaderboardStore.getState().prefetchDailyLoop(userId, true, { force: true });
        set({
          cachedResult: cachedMigratedResult ?? migratedResult,
          userId,
          quizError: null,
          submitError: null,
        });
        logInfo('quiz.identity.reconcile.migrated_guest', {
          userId,
          migrated: migrationResult.migrated,
        });
      } catch (error) {
        logError('quiz.identity.reconcile.error', error);
        if (useAuthStore.getState().authStateVersion === authStateVersion) {
          set({
            submitError: error instanceof Error ? error.message : 'Failed to sync your play',
          });
        }
        throw error;
      } finally {
        if (options?.holdInteractiveHandoff) await holdInterstitial(startedAt);
        if (useAuthStore.getState().authStateVersion === authStateVersion) {
          set({ isReconcilingIdentity: false });
        }
        inflightIdentityReconciliations.delete(reconciliationKey);
        logInfo('quiz.identity.reconcile.end', { userId });
      }
    })();

    void reconciliation.then(
      () => completedIdentityReconciliations.add(reconciliationKey),
      () => undefined
    );
    inflightIdentityReconciliations.set(reconciliationKey, reconciliation);
    return reconciliation;
  },

  createLocalResult: async (answers: AnswerWithTiming[]) => {
    const { quiz, userId } = get();
    if (!quiz || !userId) {
      set({ submitError: 'Quiz or user ID not available' });
      return null;
    }

    const detailedAnswers = answers.map((answer) => {
      const question = quiz.questions.find((item) => item.id === answer.questionId);
      const correctOptionIndex = question?.correctOptionIndex ?? 0;
      return {
        questionId: answer.questionId,
        selectedOptionIndex: answer.selectedOptionIndex,
        correctOptionIndex,
        isCorrect: answer.selectedOptionIndex === correctOptionIndex,
      };
    });

    const score = answers.reduce((total, answer) => {
      const question = quiz.questions.find((item) => item.id === answer.questionId);
      if (!question || question.correctOptionIndex !== answer.selectedOptionIndex) {
        return total;
      }

      return total + calculateQuizPoints(answer.timeRemainingMs);
    }, 0);

    const profileState = useProfileStore.getState();
    const currentStats =
      profileState.statsUserId === userId ? profileState.stats : null;
    const projectedStreak = userId.startsWith('guest_')
      ? 1
      : currentStats
        ? projectStreakAfterPlay(currentStats.streakStatus)
        : 1;
    const achievementEvent: DailyQuizAchievementEvent = {
      id: `daily:${quiz.id}`,
      kind: 'daily-quiz',
      occurredAt: new Date().toISOString(),
      quizDate: quiz.date,
      quizId: quiz.id,
      score,
      answersCorrect: detailedAnswers.map((answer) => answer.isCorrect),
      correctAtZero: detailedAnswers.some(
        (answer, index) => answer.isCorrect && answers[index]?.timeRemainingMs === 0
      ),
      allowCumulative: !userId.startsWith('guest_'),
    };
    const locallyUnlocked = await useAchievementStore
      .getState()
      .applyLocalEvent(userId, achievementEvent);
    const localResult: QuizResultImmediate = {
      date: quiz.date,
      quizId: quiz.id,
      score,
      totalQuestions: answers.length,
      streak: projectedStreak,
      bestScore: Math.max(currentStats?.bestScore ?? 0, score),
      answers: detailedAnswers,
      statsPending: !userId.startsWith('guest_'),
      syncState: userId.startsWith('guest_') ? 'synced' : 'pending',
      isOptimistic: true,
      achievementEvent,
      newlyUnlockedAchievements: locallyUnlocked,
    };

    const isGuest = userId.startsWith('guest_');
    const userProfile = buildUserProfile();
    const achievementSync = useAchievementStore
      .getState()
      .buildSyncEnvelope(achievementEvent.id, locallyUnlocked);
    const persistPendingSubmission = isGuest
      ? Promise.resolve()
      : setPendingQuizSubmission({
          userId,
          quizId: quiz.id,
          answers,
          userProfile,
          localResult,
          achievementEvent,
          achievementSync,
          queuedAt: new Date().toISOString(),
        });

    set({
      result: localResult,
      cachedResult: {
        date: localResult.date,
        quizId: localResult.quizId,
        score: localResult.score,
        totalQuestions: localResult.totalQuestions,
        streak: localResult.streak,
        bestScore: localResult.bestScore,
        answers: localResult.answers.map((answer) => answer.isCorrect),
        syncState: localResult.syncState,
        isOptimistic: localResult.isOptimistic,
        achievementEvent,
        newlyUnlockedAchievements: locallyUnlocked,
        cachedAt: new Date().toISOString(),
        userId,
      },
      submitError: null,
    });

    await Promise.all([
      saveDailyQuizResult(localResult, userId, localResult.syncState),
      persistPendingSubmission,
      useProfileStore.getState().markPlayedToday(localResult, userId),
    ]);

    trackAnalyticsEvent(
      'quiz_completed',
      userId.startsWith('guest_') ? 'guest' : 'authenticated',
      {
        quizDate: localResult.date,
        durationMs: getAnalyticsTimingDuration('daily-quiz-session'),
        totalQuestions: localResult.totalQuestions,
        score: localResult.score,
      }
    );
    clearAnalyticsTiming('daily-quiz-session');

    return localResult;
  },

  completeQuiz: async (answers: AnswerWithTiming[]) => {
    const originatingUserId = get().userId;
    const localResult = await get().createLocalResult(answers);
    if (
      !localResult ||
      !originatingUserId ||
      originatingUserId.startsWith('guest_') ||
      get().userId !== originatingUserId
    ) {
      return;
    }

    if (!hasVerifiedQuizSession(originatingUserId)) {
      logInfo('quiz.submit.deferred_until_verified', {
        userId: originatingUserId,
        quizId: localResult.quizId,
      });
      set({ isSubmitting: false, submitError: null });
      return;
    }

    await get().submitQuizAnswers(answers, undefined, {
      quizId: localResult.quizId,
      localResult,
    });
  },

  submitQuizAnswers: async (
    answers: AnswerWithTiming[],
    userProfile?: UserProfile,
    context?: {
      quizId: string;
      localResult: QuizResultImmediate;
    }
  ) => {
    const { quiz, userId } = get();
    const submittedQuizId = context?.quizId ?? quiz?.id;
    const submissionLocalResult =
      context?.localResult ??
      (get().result?.quizId === submittedQuizId
        ? get().result ?? undefined
        : undefined);
    if (!submittedQuizId || !userId) {
      logWarn('quiz.submit.missing_context', { hasQuiz: Boolean(quiz), userId });
      set({ submitError: 'Quiz or user ID not available' });
      return;
    }

    if (userId.startsWith('guest_')) {
      logInfo('quiz.submit.skip_guest', {
        userId,
        quizId: submittedQuizId,
        answerCount: answers.length,
      });
      set({ isSubmitting: false, submitError: null });
      return;
    }

    const submissionAuthStateVersion = useAuthStore.getState().authStateVersion;
    if (!hasVerifiedQuizSession(userId, submissionAuthStateVersion)) {
      logInfo('quiz.submit.deferred_until_verified', { userId, quizId: submittedQuizId });
      set({ isSubmitting: false, submitError: null });
      return;
    }

    logInfo('quiz.submit.start', {
      userId,
      quizId: submittedQuizId,
      answerCount: answers.length,
    });
    set({ isSubmitting: true, submitError: null });

    const profile = userProfile ?? buildUserProfile();
    let finalError: unknown = null;
    let sessionChanged = false;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (
        get().userId !== userId ||
        !hasVerifiedQuizSession(userId, submissionAuthStateVersion)
      ) {
        sessionChanged = true;
        finalError = new Error('Authenticated session changed during quiz submission');
        logWarn('quiz.submit.discarded_stale_before_attempt', {
          userId,
          quizId: submittedQuizId,
          attempt,
        });
        break;
      }

      try {
        const achievementEvent = submissionLocalResult?.achievementEvent;
        const achievementSync = achievementEvent
          ? useAchievementStore.getState().buildSyncEnvelope(
              achievementEvent.id,
              submissionLocalResult?.newlyUnlockedAchievements ?? []
            )
          : undefined;
        const serverResult = await submitQuiz(
          submittedQuizId,
          userId,
          answers,
          profile,
          achievementSync
        );
        if (
          get().userId !== userId ||
          !hasVerifiedQuizSession(userId, submissionAuthStateVersion)
        ) {
          sessionChanged = true;
          throw new Error('Authenticated session changed during quiz submission');
        }
        const mergedResult: QuizResultImmediate = {
          ...serverResult,
          achievementEvent,
          syncState: 'synced',
          statsPending: false,
          isOptimistic: false,
        };

        await saveDailyQuizResult(mergedResult, userId, mergedResult.syncState);
        await clearPendingQuizSubmission({ userId, quizId: submittedQuizId });
        if (serverResult.achievementSnapshot) {
          await useAchievementStore.getState().reconcileServer(
            userId,
            serverResult.achievementSnapshot,
            {
              acceptedEventId: achievementEvent?.id,
              newlyUnlocked: serverResult.newlyUnlockedAchievements,
              rejectedIds: serverResult.rejectedAchievementIds,
              deferReveal: true,
            }
          );
        }

        if (
          isQuizSubmissionCurrent(
            userId,
            submittedQuizId,
            get().userId,
            get().quiz?.id ?? get().cachedResult?.quizId
          )
        ) {
          set((state) => ({
            result:
              state.result?.quizId === submittedQuizId ? mergedResult : state.result,
            cachedResult: {
              date: mergedResult.date,
              quizId: mergedResult.quizId,
              score: mergedResult.score,
              totalQuestions: mergedResult.totalQuestions,
              streak: mergedResult.streak,
              bestScore: mergedResult.bestScore,
              answers: mergedResult.answers.map((answer) => answer.isCorrect),
              syncState: mergedResult.syncState,
              isOptimistic: false,
              cachedAt: new Date().toISOString(),
              userId,
            },
            isSubmitting: false,
            submitError: null,
          }));
        }

        logInfo('quiz.submit.success', {
          userId,
          quizId: submittedQuizId,
          statsPending: false,
          attempt,
        });
        const latestAuthState = useAuthStore.getState();
        if (
          get().userId === userId &&
          latestAuthState.isAuthenticated &&
          latestAuthState.user?.sub === userId
        ) {
          await useProfileStore.getState().markPlayedToday(mergedResult, userId);
          void useLeaderboardStore.getState().prefetchDailyLoop(userId, true, { force: true });
        }
        return;
      } catch (error) {
        finalError = error;
        const statusCode =
          error instanceof Error && 'statusCode' in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;
        const shouldRetry =
          !sessionChanged &&
          attempt === 1 &&
          isTransientQuizSubmissionFailure(statusCode);

        logError('quiz.submit.error', {
          name: error instanceof Error ? error.name : 'UnknownError',
          message: error instanceof Error ? error.message : String(error),
          statusCode,
          quizId: submittedQuizId,
          userId,
          answerCount: answers.length,
          attempt,
          willRetry: shouldRetry,
        });

        if (!shouldRetry) {
          break;
        }

        logWarn('quiz.submit.retry.scheduled', {
          userId,
          quizId: submittedQuizId,
          delayMs: SUBMISSION_RETRY_DELAY_MS,
        });
        await new Promise((resolve) => setTimeout(resolve, SUBMISSION_RETRY_DELAY_MS));
      }
    }

    if (sessionChanged) {
      if (get().userId === userId) set({ isSubmitting: false, submitError: null });
      logWarn('quiz.submit.deferred_after_session_change', { userId, quizId: submittedQuizId });
      return;
    }

    const failedResult = submissionLocalResult
      ? {
          ...submissionLocalResult,
          syncState: 'failed' as const,
          statsPending: true,
          isOptimistic: true,
        }
      : null;

    if (
      isQuizSubmissionCurrent(
        userId,
        submittedQuizId,
        get().userId,
        get().quiz?.id ?? get().cachedResult?.quizId
      )
    ) {
      set((state) => ({
        isSubmitting: false,
        submitError:
          finalError instanceof Error
            ? finalError.message
            : 'Failed to submit quiz',
        result:
          state.result?.quizId === submittedQuizId
            ? failedResult ?? {
                ...state.result,
                syncState: 'failed' as const,
                statsPending: true,
                isOptimistic: true,
              }
            : state.result,
        cachedResult:
          state.cachedResult?.quizId === submittedQuizId
            ? {
                ...state.cachedResult,
                syncState: 'failed',
                isOptimistic: true,
                cachedAt: new Date().toISOString(),
              }
            : state.cachedResult,
      }));
    }

    if (failedResult) {
      await saveDailyQuizResult(failedResult, userId, 'failed');
    }

    const finalStatusCode =
      finalError instanceof Error && 'statusCode' in finalError
        ? (finalError as { statusCode?: number }).statusCode
        : undefined;
    const latestAuthState = useAuthStore.getState();
    if (
      !isTransientQuizSubmissionFailure(finalStatusCode) &&
      get().userId === userId &&
      latestAuthState.isAuthenticated &&
      latestAuthState.user?.sub === userId
    ) {
      void useProfileStore.getState().revalidate(userId);
    }
  },

  retryPendingSubmission: async () => {
    const { userId } = get();
    const pending = userId ? await getPendingQuizSubmission(userId) : null;

    if (!pending || !userId || pending.userId !== userId) {
      logInfo('quiz.submit.retry.none', { userId, hasPending: Boolean(pending) });
      return;
    }

    if (!hasVerifiedQuizSession(userId)) {
      logInfo('quiz.submit.retry.waiting_for_verified_session', { userId });
      return;
    }

    logWarn('quiz.submit.retry.start', { userId, quizId: pending.quizId });
    const retryResult: QuizResultImmediate = {
      ...pending.localResult,
      syncState: 'pending',
      statsPending: true,
      isOptimistic: true,
    };
    set((state) => ({
      result:
        state.result?.quizId === pending.quizId ? retryResult : state.result,
      cachedResult: {
        date: retryResult.date,
        quizId: retryResult.quizId,
        score: retryResult.score,
        totalQuestions: retryResult.totalQuestions,
        streak: retryResult.streak,
        bestScore: retryResult.bestScore,
        answers: retryResult.answers.map((answer) => answer.isCorrect),
        syncState: retryResult.syncState,
        isOptimistic: true,
        cachedAt: new Date().toISOString(),
        userId,
      },
      submitError: null,
    }));

    await get().submitQuizAnswers(pending.answers, pending.userProfile, {
      quizId: pending.quizId,
      localResult: retryResult,
    });
  },

  clearGuestTodayQuiz: async () => {
    const userId = get().userId;
    const authState = useAuthStore.getState();
    if (!userId || !userId.startsWith('guest_') || authState.isAuthenticated) {
      throw new Error('Only the active guest quiz can be cleared.');
    }

    await clearGuestCache();
    const remainingResult = await getGuestTodayResult();
    if (remainingResult) {
      throw new Error('The saved guest quiz could not be cleared.');
    }
    if (get().userId !== userId || useAuthStore.getState().isAuthenticated) {
      throw new Error('Your session changed while clearing the guest quiz.');
    }

    set((state) => ({
      cachedResult: null,
      result: null,
      submitError: null,
      quizError: null,
      isSubmitting: false,
      guestResetVersion: state.guestResetVersion + 1,
    }));
    await useProfileStore.getState().hydrateFromCache(userId);
    logInfo('quiz.guest.today_cleared', { userId });
  },

  resetQuiz: () => set({
    result: null,
    quizError: null,
    submitError: null,
    isQuizLoading: false,
    isSubmitting: false,
  }),
}));
