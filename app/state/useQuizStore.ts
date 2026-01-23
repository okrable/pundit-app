import { create } from 'zustand';
import { Quiz, QuizResultImmediate, UserStats, UserProfile, AnswerWithTiming } from '../types';
import { getDailyQuiz, submitQuiz, getUserStats } from '../services/api';
import { getCachedQuiz, setCachedQuiz } from '../storage/quizCache';
import { useAuthStore } from './useAuthStore';

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
    const targetDate = date || new Date().toISOString().split('T')[0];
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

      const result = await submitQuiz(quiz.id, userId, answers, userProfile);
      set({ result, loading: false });
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
