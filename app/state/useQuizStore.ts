import { create } from 'zustand';
import {
  finalizeQuizStats,
  getDailyQuiz,
  getUserStats,
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
  setUserId: (userId: string) => void;
  hydrateFromCache: (userId: string, date?: string) => Promise<void>;
  fetchQuiz: (date?: string, options?: { force?: boolean }) => Promise<Quiz | null>;
  setCachedResult: (result: CachedQuizResult | null) => void;
  createLocalResult: (answers: AnswerWithTiming[]) => Promise<QuizResultImmediate | null>;
  submitQuizAnswers: (answers: AnswerWithTiming[], userProfile?: UserProfile) => Promise<void>;
  retryPendingSubmission: () => Promise<void>;
  resetQuiz: () => void;
}

function calculatePoints(timeRemainingMs: number | undefined): number {
  if (timeRemainingMs === undefined) return 60;
  const seconds = timeRemainingMs / 1000;
  if (seconds >= 16) return 100;
  if (seconds >= 12) return 80;
  if (seconds >= 8) return 60;
  if (seconds >= 4) return 40;
  return 20;
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
      logError('quiz.fetch.error', error);
      set({
        isQuizLoading: false,
        quizError: error instanceof Error ? error.message : 'Failed to fetch quiz',
      });
      return cachedQuiz?.data ?? null;
    }
  },

  setCachedResult: (cachedResult: CachedQuizResult | null) => set({ cachedResult }),

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

      return total + calculatePoints(answer.timeRemainingMs);
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

    const userProfile = buildUserProfile();

    await Promise.all([
      saveDailyQuizResult(localResult, userId, localResult.syncState),
      setPendingQuizSubmission({
        userId,
        quizId: quiz.id,
        answers,
        userProfile,
        localResult,
        queuedAt: new Date().toISOString(),
      }),
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

    return localResult;
  },

  submitQuizAnswers: async (answers: AnswerWithTiming[], userProfile?: UserProfile) => {
    const { quiz, userId, result } = get();
    if (!quiz || !userId) {
      logWarn('quiz.submit.missing_context', { hasQuiz: Boolean(quiz), userId });
      set({ submitError: 'Quiz or user ID not available' });
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
        syncState: serverResult.statsPending ? 'pending' : 'synced',
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

      if (!serverResult.statsPending) {
        logInfo('quiz.submit.success', { userId, quizId: submittedQuizId, statsPending: false });
        await useProfileStore.getState().markPlayedToday(mergedResult, userId);
        if (!userId.startsWith('guest_')) {
          void useLeaderboardStore.getState().prefetchDailyLoop(userId, true);
        }
        return;
      }

      if (!userId.startsWith('guest_')) {
        logInfo('quiz.submit.success', { userId, quizId: submittedQuizId, statsPending: true });
        const refreshDelay = serverResult.statsRefreshAfterMs ?? 800;
        setTimeout(async () => {
          let finalizeSucceeded = false;

          try {
            const finalizeResult = await finalizeQuizStats(submittedQuizId, userId, profile);
            finalizeSucceeded = Boolean(finalizeResult.finalized || finalizeResult.skipped);
          } catch (finalizeError) {
            console.error('Failed to finalize quiz stats:', finalizeError);
          }

          if (!finalizeSucceeded) {
            return;
          }

          try {
            const latestStats = await getUserStats(userId);
            await useProfileStore.getState().applyServerStats(latestStats);
            await saveDailyQuizResult(
              {
                ...(get().result ?? result ?? mergedResult),
                streak: latestStats.streak,
                bestScore: latestStats.bestScore,
                statsPending: false,
                syncState: 'synced',
              },
              userId,
              'synced'
            );
            set((state) => ({
              result: state.result
                ? {
                    ...state.result,
                    streak: latestStats.streak,
                    bestScore: latestStats.bestScore,
                    statsPending: false,
                    syncState: 'synced',
                  }
                : state.result,
              cachedResult: state.cachedResult
                ? {
                    ...state.cachedResult,
                    streak: latestStats.streak,
                    bestScore: latestStats.bestScore,
                    syncState: 'synced',
                    cachedAt: new Date().toISOString(),
                  }
                : state.cachedResult,
            }));
            void useLeaderboardStore.getState().prefetchDailyLoop(userId, true);
          } catch (statsError) {
            console.error('Failed to refresh user stats after quiz submit:', statsError);
          }
        }, refreshDelay);
      }
    } catch (error) {
      logError('quiz.submit.error', error);
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
