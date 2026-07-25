import { create } from 'zustand';
import { challengeApi, ChallengeApiError } from '../services/challengeApi';
import type {
  Question,
  ActiveChallenge,
  ChallengeHistoryItem,
  ChallengeStats,
  ChallengeSubmitResult,
  AnswerWithTiming,
} from '../types';
import {
  clearPendingChallengeSubmission,
  getPendingChallengeSubmission,
  setPendingChallengeSubmission,
} from '../storage/pendingChallengeSubmission';
import { calculateQuizPoints } from '../../shared/scoring';
import { logError, logInfo, logWarn } from '../services/debugLog';
import { trackAnalyticsEvent } from '../services/analytics';

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
  retryPendingSubmission: (userId: string) => Promise<void>;
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
      trackAnalyticsEvent('challenge_created', 'authenticated');
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
      trackAnalyticsEvent('challenge_joined', 'authenticated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join challenge';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  submitAnswers: async (userId, answers) => {
    const { currentChallenge } = get();
    if (!currentChallenge) throw new Error('No active challenge');

    const localResult: ChallengeSubmitResult = {
      status: 'waiting',
      yourScore: answers.reduce((total, answer) => {
        const question = currentChallenge.questions.find(
          (item) => item.id === answer.questionId
        );
        return question?.correctOptionIndex === answer.selectedOptionIndex
          ? total + calculateQuizPoints(answer.timeRemainingMs)
          : total;
      }, 0),
      yourAnswers: answers.map((answer) => {
        const question = currentChallenge.questions.find(
          (item) => item.id === answer.questionId
        );
        const correctOptionIndex = question?.correctOptionIndex ?? 0;
        return {
          questionId: answer.questionId,
          selectedOptionIndex: answer.selectedOptionIndex,
          correctOptionIndex,
          isCorrect: answer.selectedOptionIndex === correctOptionIndex,
        };
      }),
      syncState: 'pending',
    };

    await setPendingChallengeSubmission({
      userId,
      challengeId: currentChallenge.challengeId,
      answers,
      localResult,
      queuedAt: new Date().toISOString(),
    });

    set({ isLoading: true, error: null });
    try {
      const result = await challengeApi.submitAnswers(currentChallenge.challengeId, userId, answers);
      await clearPendingChallengeSubmission();
      set({ isLoading: false });
      logInfo('challenge.submit.success', {
        userId,
        challengeId: currentChallenge.challengeId,
        status: result.status,
      });
      trackAnalyticsEvent('challenge_submitted', 'authenticated');
      return { ...result, syncState: 'synced' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit answers';
      set({ error: message, isLoading: false });
      const statusCode =
        error instanceof ChallengeApiError ? error.statusCode : undefined;
      const retryable =
        statusCode === undefined || statusCode === 429 || statusCode >= 500;
      if (!retryable) {
        await clearPendingChallengeSubmission();
        throw error;
      }
      logWarn('challenge.submit.queued', {
        userId,
        challengeId: currentChallenge.challengeId,
        message,
      });
      return { ...localResult, syncState: 'failed' };
    }
  },

  retryPendingSubmission: async (userId) => {
    const pending = await getPendingChallengeSubmission();
    if (!pending || pending.userId !== userId) {
      return;
    }

    logWarn('challenge.submit.retry.start', {
      userId,
      challengeId: pending.challengeId,
    });

    try {
      await challengeApi.submitAnswers(
        pending.challengeId,
        pending.userId,
        pending.answers
      );
      await clearPendingChallengeSubmission();
      await get().fetchUserChallenges(userId);
      logInfo('challenge.submit.retry.success', {
        userId,
        challengeId: pending.challengeId,
      });
    } catch (error) {
      const statusCode =
        error instanceof ChallengeApiError ? error.statusCode : undefined;
      if (
        statusCode !== undefined &&
        statusCode !== 429 &&
        statusCode < 500
      ) {
        await clearPendingChallengeSubmission();
        logWarn('challenge.submit.retry.discarded', {
          userId,
          challengeId: pending.challengeId,
          statusCode,
        });
        return;
      }
      logError('challenge.submit.retry.error', {
        userId,
        challengeId: pending.challengeId,
        message: error instanceof Error ? error.message : String(error),
      });
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
