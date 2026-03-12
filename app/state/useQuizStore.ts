import { create } from 'zustand';
import { Quiz, QuizResultImmediate, UserStats, UserProfile, AnswerWithTiming } from '../types';
import { finalizeQuizStats, getDailyQuiz, submitQuiz, getUserStats } from '../services/api';
import { getCachedQuiz, setCachedQuiz } from '../storage/quizCache';
import { useAuthStore } from './useAuthStore';
import { getQuizDate } from '../utils/quizDate';

interface QuizState {
  quiz: Quiz | null;
  loading: boolean;
  error: string | null;
  result: QuizResultImmediate | null;
  userStats: UserStats | null;
  userId: string | null;

  // Actions
  setUserId: (userId: string) => void;
  fetchQuiz: (date?: string) => Promise<void>;
  submitQuizAnswers: (answers: AnswerWithTiming[]) => Promise<void>;
  fetchUserStats: () => Promise<void>;
  resetQuiz: () => void;
}

export const useQuizStore = create<QuizState>((set, get) => ({
  quiz: null,
  loading: false,
  error: null,
  result: null,
  userStats: null,
  userId: null,

  setUserId: (userId: string) => set({ userId }),

  fetchQuiz: async (date?: string) => {
    const targetDate = date || getQuizDate();
    set({ loading: true, error: null });

    try {
      // Try to get from cache first
      const cachedQuiz = await getCachedQuiz(targetDate);
      if (cachedQuiz) {
        set({ quiz: cachedQuiz, loading: false });
        return;
      }

      // If not cached, fetch from API
      const quiz = await getDailyQuiz(date);
      await setCachedQuiz(targetDate, quiz);
      set({ quiz, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch quiz',
        loading: false,
      });
    }
  },

  submitQuizAnswers: async (answers) => {
    const { quiz, userId } = get();
    if (!quiz || !userId) {
      set({ error: 'Quiz or user ID not available' });
      return;
    }

    set({ loading: true, error: null });
    try {
      // Get Auth0 user profile if authenticated
      const authState = useAuthStore.getState();
      let userProfile: UserProfile | undefined;

      if (authState.isAuthenticated && authState.user) {
        userProfile = {
          displayName: authState.user.name,
          email: authState.user.email,
          avatarUrl: authState.user.picture,
        };
      }

      const submittedQuizId = quiz.id;
      const result = await submitQuiz(submittedQuizId, userId, answers, userProfile);
      set({ result, loading: false });

      if (result.statsPending && !userId.startsWith('guest_')) {
        const refreshDelay = result.statsRefreshAfterMs ?? 800;
        setTimeout(async () => {
          let finalizeSucceeded = false;
          try {
            const finalizeResult = await finalizeQuizStats(submittedQuizId, userId, userProfile);
            finalizeSucceeded = Boolean(finalizeResult.finalized || finalizeResult.skipped);
          } catch (finalizeError) {
            console.error('Failed to finalize quiz stats:', finalizeError);
          }

          if (!finalizeSucceeded) {
            return;
          }

          try {
            const latestStats = await getUserStats(userId);
            set((state) => {
              const nextState: Partial<QuizState> = { userStats: latestStats };
              if (state.result && state.result.quizId === submittedQuizId) {
                nextState.result = {
                  ...state.result,
                  streak: latestStats.streak,
                  bestScore: latestStats.bestScore,
                  statsPending: false,
                };
              }
              return nextState;
            });
          } catch (statsError) {
            console.error('Failed to refresh user stats after quiz submit:', statsError);
          }
        }, refreshDelay);
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to submit quiz',
        loading: false,
      });
    }
  },

  fetchUserStats: async () => {
    const { userId } = get();
    if (!userId) return;

    try {
      const userStats = await getUserStats(userId);
      set({ userStats });
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  },

  resetQuiz: () => set({ quiz: null, result: null, error: null }),
}));
