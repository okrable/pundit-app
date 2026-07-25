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
import { trackAnalyticsEvent } from '../services/analytics';
import { chooseReconciliationSource } from '../../shared/reconciliation';

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
  setUserId: (userId: string) => void;
  hydrateFromCache: (userId: string, date?: string) => Promise<void>;
  fetchQuiz: (date?: string, options?: { force?: boolean }) => Promise<Quiz | null>;
  setCachedResult: (result: CachedQuizResult | null) => void;
  reconcileIdentity: (userId: string, userProfile?: UserProfile) => Promise<void>;
  createLocalResult: (answers: AnswerWithTiming[]) => Promise<QuizResultImmediate | null>;
  submitQuizAnswers: (answers: AnswerWithTiming[], userProfile?: UserProfile) => Promise<void>;
  retryPendingSubmission: () => Promise<void>;
  resetQuiz: () => void;
}

function buildUserProfile(): UserProfile | undefined {
  const authState = useAuthStore.getState();
  if (!authState.isAuthenticated || !authState.user) {
    return undefined;
  }

  return {
    displayName: authState.user.name,
    email: authState.user.email,
    avatarUrl: authState.user.picture,
  };
}

let inflightIdentityReconciliation: Promise<void> | null = null;
let lastIdentityReconciliationKey: string | null = null;

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

  setUserId: (userId: string) => set({ userId }),

  hydrateFromCache: async (userId: string, date?: string) => {
    const targetDate = date || getQuizDate();
    logInfo('quiz.cache.hydrate.start', { userId, targetDate });
    const [quizCache, cachedResult] = await Promise.all([
      getCachedQuizEntry(targetDate),
      getTodayQuizResult(userId),
    ]);

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
      hasCachedResult: Boolean(cachedResult),
    });
  },

  fetchQuiz: async (date?: string, options?: { force?: boolean }) => {
    const targetDate = date || getQuizDate();
    logInfo('quiz.fetch.start', { targetDate, force: Boolean(options?.force) });
    const cachedQuiz = await getCachedQuizEntry(targetDate);

    if (cachedQuiz && !options?.force && !isQuizCacheStale(cachedQuiz)) {
      logInfo('quiz.fetch.cache_hit', { targetDate });
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
      const quiz = await getDailyQuiz(date);
      await setCachedQuiz(targetDate, quiz);
      const refreshedCache = await getCachedQuizEntry(targetDate);
      set({
        quiz,
        quizCache: refreshedCache,
        isQuizLoading: false,
        quizError: null,
      });
      logInfo('quiz.fetch.success', { targetDate, questionCount: quiz.questions.length });
      return quiz;
    } catch (error) {
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

  reconcileIdentity: async (userId: string, userProfile?: UserProfile) => {
    if (!userId || userId.startsWith('guest_')) {
      return;
    }

    const reconciliationKey = `${userId}:${getQuizDate()}:${useAuthStore.getState().authStateVersion}`;
    if (lastIdentityReconciliationKey === reconciliationKey) {
      logInfo('quiz.identity.reconcile.skip_already_done', { userId });
      return;
    }

    if (inflightIdentityReconciliation) {
      return inflightIdentityReconciliation;
    }

    const startedAt = Date.now();
    logInfo('quiz.identity.reconcile.start', { userId });
    lastIdentityReconciliationKey = reconciliationKey;
    set({
      userId,
      isReconcilingIdentity: true,
      result: null,
      submitError: null,
      isSubmitting: false,
    });

    inflightIdentityReconciliation = (async () => {
      try {
        const localResult = await getTodayQuizResult(userId);
        if (localResult) {
          await clearGuestCache();
          await useProfileStore.getState().markPlayedToday(localResult, userId);
          set({
            cachedResult: localResult,
            result: null,
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
            await saveDailyQuizResult(serverResult, userId, serverResult.syncState);
            const cachedServerResult = await getTodayQuizResult(userId);
            await clearGuestCache();
            await useProfileStore.getState().markPlayedToday(serverResult, userId);
            set({
              cachedResult: cachedServerResult,
              result: null,
              userId,
              quizError: null,
              submitError: null,
            });
            logInfo('quiz.identity.reconcile.server_result', { userId });
            return;
          }
        } catch (error) {
          logError('quiz.identity.reconcile.server_result.error', error);
        }

        const guestResult = await getGuestTodayResult();
        const reconciliationSource = chooseReconciliationSource({
          hasLocalResult: false,
          hasServerResult: false,
          hasGuestResult: Boolean(guestResult),
        });
        if (reconciliationSource === 'none' || !guestResult) {
          set({
            cachedResult: null,
            result: null,
            userId,
            quizError: null,
            submitError: null,
          });
          logInfo('quiz.identity.reconcile.no_result', { userId });
          return;
        }

        const migrationResult = await migrateGuestResult(
          userId,
          guestResult.quizId,
          guestResult.score,
          guestResult.totalQuestions,
          guestResult.answers,
          userProfile ?? buildUserProfile()
        );

        if (!migrationResult.migrated) {
          const existingResult = await getTodayResult(userId);
          if (existingResult) {
            await saveDailyQuizResult(existingResult, userId, existingResult.syncState);
            const cachedExistingResult = await getTodayQuizResult(userId);
            await clearGuestCache();
            await useProfileStore.getState().markPlayedToday(existingResult, userId);
            set({
              cachedResult: cachedExistingResult,
              result: null,
              userId,
              quizError: null,
              submitError: null,
            });
            logInfo('quiz.identity.reconcile.existing_after_migration', { userId });
            return;
          }

          set({
            cachedResult: null,
            result: null,
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
        void useLeaderboardStore.getState().prefetchDailyLoop(userId, true, { force: true });
        set({
          cachedResult: cachedMigratedResult ?? migratedResult,
          result: null,
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
        set({
          cachedResult: null,
          result: null,
          userId,
          submitError: error instanceof Error ? error.message : 'Failed to sync your play',
        });
      } finally {
        await holdInterstitial(startedAt);
        set({ isReconcilingIdentity: false });
        inflightIdentityReconciliation = null;
        logInfo('quiz.identity.reconcile.end', { userId });
      }
    })();

    return inflightIdentityReconciliation;
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

    const currentStats = useProfileStore.getState().stats;
    const localResult: QuizResultImmediate = {
      date: quiz.date,
      quizId: quiz.id,
      score,
      totalQuestions: answers.length,
      streak: userId.startsWith('guest_') ? 1 : currentStats?.streak ?? 0,
      bestScore: Math.max(currentStats?.bestScore ?? 0, score),
      answers: detailedAnswers,
      statsPending: !userId.startsWith('guest_'),
      syncState: userId.startsWith('guest_') ? 'synced' : 'pending',
      isOptimistic: true,
    };

    const isGuest = userId.startsWith('guest_');
    const userProfile = buildUserProfile();
    const persistPendingSubmission = isGuest
      ? Promise.resolve()
      : setPendingQuizSubmission({
          userId,
          quizId: quiz.id,
          answers,
          userProfile,
          localResult,
          queuedAt: new Date().toISOString(),
        });

    await Promise.all([
      saveDailyQuizResult(localResult, userId, localResult.syncState),
      persistPendingSubmission,
      useProfileStore.getState().markPlayedToday(localResult, userId),
    ]);

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
        cachedAt: new Date().toISOString(),
        userId,
      },
      submitError: null,
    });

    trackAnalyticsEvent(
      'quiz_completed',
      userId.startsWith('guest_') ? 'guest' : 'authenticated'
    );

    return localResult;
  },

  submitQuizAnswers: async (answers: AnswerWithTiming[], userProfile?: UserProfile) => {
    const { quiz, userId, result } = get();
    if (!quiz || !userId) {
      logWarn('quiz.submit.missing_context', { hasQuiz: Boolean(quiz), userId });
      set({ submitError: 'Quiz or user ID not available' });
      return;
    }

    if (userId.startsWith('guest_')) {
      logInfo('quiz.submit.skip_guest', { userId, quizId: quiz.id, answerCount: answers.length });
      set({ isSubmitting: false, submitError: null });
      return;
    }

    logInfo('quiz.submit.start', { userId, quizId: quiz.id, answerCount: answers.length });
    set({ isSubmitting: true, submitError: null });

    const profile = userProfile ?? buildUserProfile();

    try {
      const submittedQuizId = quiz.id;
      const serverResult = await submitQuiz(submittedQuizId, userId, answers, profile);
      const mergedResult: QuizResultImmediate = {
        ...serverResult,
        syncState: 'synced',
      };

      await saveDailyQuizResult(mergedResult, userId, mergedResult.syncState);
      await clearPendingQuizSubmission();

      set({
        result: mergedResult,
        cachedResult: {
          date: mergedResult.date,
          quizId: mergedResult.quizId,
          score: mergedResult.score,
          totalQuestions: mergedResult.totalQuestions,
          streak: mergedResult.streak,
          bestScore: mergedResult.bestScore,
          answers: mergedResult.answers.map((answer) => answer.isCorrect),
          syncState: mergedResult.syncState,
          cachedAt: new Date().toISOString(),
          userId,
        },
        isSubmitting: false,
        submitError: null,
      });

      logInfo('quiz.submit.success', { userId, quizId: submittedQuizId, statsPending: false });
      await useProfileStore.getState().markPlayedToday(mergedResult, userId);
      if (!userId.startsWith('guest_')) {
        void useLeaderboardStore.getState().prefetchDailyLoop(userId, true, { force: true });
      }
    } catch (error) {
      logError('quiz.submit.error', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : String(error),
        statusCode:
          error instanceof Error && 'statusCode' in error
            ? (error as { statusCode?: number }).statusCode
            : undefined,
        quizId: quiz.id,
        userId,
        answerCount: answers.length,
      });
      set((state) => ({
        isSubmitting: false,
        submitError: error instanceof Error ? error.message : 'Failed to submit quiz',
        result: state.result
          ? { ...state.result, syncState: 'failed', statsPending: true }
          : state.result,
        cachedResult: state.cachedResult
          ? { ...state.cachedResult, syncState: 'failed', cachedAt: new Date().toISOString() }
          : state.cachedResult,
      }));

      if (result) {
        await saveDailyQuizResult(
          { ...result, syncState: 'failed', statsPending: true },
          userId,
          'failed'
        );
      }
    }
  },

  retryPendingSubmission: async () => {
    const pending = await getPendingQuizSubmission();
    const { userId } = get();

    if (!pending || !userId || pending.userId !== userId) {
      logInfo('quiz.submit.retry.none', { userId, hasPending: Boolean(pending) });
      return;
    }

    logWarn('quiz.submit.retry.start', { userId, quizId: pending.quizId });
    set({
      result: pending.localResult,
      submitError: null,
    });

    await get().submitQuizAnswers(pending.answers, pending.userProfile);
  },

  resetQuiz: () => set({
    result: null,
    quizError: null,
    submitError: null,
    isQuizLoading: false,
    isSubmitting: false,
  }),
}));
