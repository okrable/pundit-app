import { create } from 'zustand';
import { challengeApi } from '../services/challengeApi';
import type {
  Question,
  ActiveChallenge,
  ChallengeHistoryItem,
  ChallengeStats,
  ChallengeSubmitResult,
  AnswerWithTiming,
} from '../types';

interface CurrentChallenge {
  challengeId: string;
  code: string;
  shareUrl?: string;
  questions: Question[];
  isCreator: boolean;
  opponentName: string | null;
}

interface ChallengeState {
  // Current challenge being played
  currentChallenge: CurrentChallenge | null;

  // User's challenges data
  activeChallenge: ActiveChallenge | null;
  history: ChallengeHistoryItem[];
  stats: ChallengeStats;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  createChallenge: (userId: string, displayName?: string) => Promise<{ code: string; shareUrl: string }>;
  joinChallenge: (code: string, userId: string, displayName?: string) => Promise<void>;
  submitAnswers: (userId: string, answers: AnswerWithTiming[]) => Promise<ChallengeSubmitResult>;
  revokeChallenge: (userId: string) => Promise<void>;
  fetchUserChallenges: (userId: string) => Promise<void>;
  clearCurrentChallenge: () => void;
  clearError: () => void;
  setCurrentChallengeForPlay: (challenge: CurrentChallenge) => void;
}

export const useChallengeStore = create<ChallengeState>((set, get) => ({
  currentChallenge: null,
  activeChallenge: null,
  history: [],
  stats: { wins: 0, losses: 0, draws: 0 },
  isLoading: false,
  error: null,

  createChallenge: async (userId, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await challengeApi.createChallenge(userId, displayName);
      set({
        currentChallenge: {
          challengeId: response.challengeId,
          code: response.code,
          shareUrl: response.shareUrl,
          questions: response.questions,
          isCreator: true,
          opponentName: null,
        },
        activeChallenge: {
          challengeId: response.challengeId,
          code: response.code,
          shareUrl: response.shareUrl,
          status: 'pending',
          creatorDisplayName: displayName || null,
          creatorUsername: null,
          opponentUsername: null,
          isCreator: true,
          createdAt: new Date().toISOString(),
          hasCreatorPlayed: false,
          hasOpponentPlayed: false,
          opponentDisplayName: null,
          expiresAt: response.expiresAt,
        },
        isLoading: false,
      });
      return { code: response.code, shareUrl: response.shareUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create challenge';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  joinChallenge: async (code, userId, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const response = await challengeApi.joinChallenge(code, userId, displayName);
      set({
        currentChallenge: {
          challengeId: response.challengeId,
          code,
          questions: response.questions,
          isCreator: false,
          opponentName: response.creator.displayName,
        },
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join challenge';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  submitAnswers: async (userId, answers) => {
    const { currentChallenge } = get();
    if (!currentChallenge) throw new Error('No active challenge');

    set({ isLoading: true, error: null });
    try {
      const result = await challengeApi.submitAnswers(currentChallenge.challengeId, userId, answers);
      set({ isLoading: false });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit answers';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  revokeChallenge: async (userId) => {
    const { activeChallenge } = get();
    if (!activeChallenge) throw new Error('No active challenge to revoke');

    set({ isLoading: true, error: null });
    try {
      await challengeApi.revokeChallenge(activeChallenge.challengeId, userId);
      set({ activeChallenge: null, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to revoke challenge';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  fetchUserChallenges: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await challengeApi.getUserChallenges(userId);
      set({
        activeChallenge: data.active,
        history: data.history,
        stats: data.stats,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch challenges';
      set({ error: message, isLoading: false });
    }
  },

  clearCurrentChallenge: () => set({ currentChallenge: null }),
  clearError: () => set({ error: null }),
  setCurrentChallengeForPlay: (challenge) => set({ currentChallenge: challenge }),
}));
