import { create } from 'zustand';
import {
  ApiError,
  completeCareerGame as completeCareerGameApi,
  getTodayCareerGameResult as getServerCareerGameResult,
} from '../services/api';
import type { CareerGame, CareerGameResult } from '../types';
import {
  CachedCareerGameResult,
  clearGuestCareerGameResult,
  getGuestCareerGameResult,
  getTodayCareerGameResult,
  saveCareerGameResult,
} from '../storage/careerGameStorage';
import {
  clearPendingCareerGameSubmission,
  getPendingCareerGameSubmission,
  setPendingCareerGameSubmission,
} from '../storage/pendingCareerGameSubmission';
import { isTransientQuizSubmissionFailure } from '../../shared/quizSync';
import { logError, logInfo, logWarn } from '../services/debugLog';
import { getQuizDate } from '../utils/quizDate';

interface CareerGameState {
  userId: string | null;
  result: CachedCareerGameResult | null;
  error: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  setUserId: (userId: string) => void;
  hydrateFromCache: (userId: string) => Promise<void>;
  reconcileIdentity: (userId: string) => Promise<void>;
  completeGame: (
    game: CareerGame,
    submittedAnswer: string
  ) => Promise<CareerGameResult>;
  retryPendingSubmission: (userId: string) => Promise<void>;
}

async function submitCompletion(
  userId: string,
  gameId: string,
  submittedAnswer: string
): Promise<CareerGameResult> {
  return completeCareerGameApi(gameId, userId, submittedAnswer);
}

export const useCareerGameStore = create<CareerGameState>((set, get) => ({
  userId: null,
  result: null,
  error: null,
  isLoading: false,
  isSubmitting: false,

  setUserId: (userId) =>
    set((state) =>
      state.userId === userId
        ? { userId }
        : {
            userId,
            result: null,
            error: null,
            isLoading: false,
            isSubmitting: false,
          }
    ),

  hydrateFromCache: async (userId) => {
    const result = await getTodayCareerGameResult(userId);
    if (get().userId === userId) {
      set({ result, error: null });
    }
  },

  reconcileIdentity: async (userId) => {
    if (!userId || userId.startsWith('guest_')) {
      return;
    }

    set({ userId, isLoading: true, error: null });
    try {
      const localResult = await getTodayCareerGameResult(userId);
      if (get().userId !== userId) {
        return;
      }
      if (localResult) {
        set({ result: localResult, isLoading: false });
        return;
      }

      const serverResult = await getServerCareerGameResult(userId);
      if (get().userId !== userId) {
        return;
      }
      if (serverResult) {
        const cached = await saveCareerGameResult(
          serverResult,
          userId,
          'synced'
        );
        if (get().userId !== userId) {
          return;
        }
        await clearGuestCareerGameResult();
        set({ result: cached, isLoading: false });
        return;
      }

      const guestResult = await getGuestCareerGameResult();
      if (get().userId !== userId) {
        return;
      }
      if (!guestResult) {
        set({ result: null, isLoading: false });
        return;
      }

      const migrated = await submitCompletion(
        userId,
        guestResult.gameId,
        guestResult.submittedAnswer
      );
      if (get().userId !== userId) {
        return;
      }
      const cached = await saveCareerGameResult(migrated, userId, 'synced');
      if (get().userId !== userId) {
        return;
      }
      await clearGuestCareerGameResult();
      set({ result: cached, isLoading: false });
      logInfo('career.identity.migrated_guest', {
        userId,
        gameId: migrated.gameId,
      });
    } catch (error) {
      logError('career.identity.reconcile.error', error);
      if (get().userId === userId) {
        set({
          isLoading: false,
          error:
            error instanceof Error ? error.message : 'Failed to sync career game',
        });
      }
    }
  },

  completeGame: async (game, submittedAnswer) => {
    const userId = get().userId;
    if (!userId) {
      throw new Error('Career game user is not ready');
    }

    const isGuest = userId.startsWith('guest_');
    const localResult: CareerGameResult = {
      date: game.date,
      gameId: game.id,
      completed: true,
      canonicalName: game.canonicalName,
      submittedAnswer: submittedAnswer.trim(),
      syncState: isGuest ? 'synced' : 'pending',
      isOptimistic: !isGuest,
    };
    const cached = await saveCareerGameResult(
      localResult,
      userId,
      localResult.syncState
    );
    set({ result: cached, error: null });

    if (isGuest) {
      return localResult;
    }

    await setPendingCareerGameSubmission({
      userId,
      gameId: game.id,
      submittedAnswer: submittedAnswer.trim(),
      localResult,
      queuedAt: new Date().toISOString(),
    });

    set({ isSubmitting: true });
    try {
      const serverResult = await submitCompletion(
        userId,
        game.id,
        submittedAnswer
      );
      const current = get();
      if (
        current.userId !== userId ||
        current.result?.gameId !== game.id ||
        serverResult.gameId !== game.id
      ) {
        return localResult;
      }

      const synced = await saveCareerGameResult(serverResult, userId, 'synced');
      await clearPendingCareerGameSubmission({ userId, gameId: game.id });
      set({ result: synced, isSubmitting: false, error: null });
      return serverResult;
    } catch (error) {
      const statusCode = error instanceof ApiError ? error.statusCode : undefined;
      const retryable = isTransientQuizSubmissionFailure(statusCode);
      if (!retryable) {
        await clearPendingCareerGameSubmission({ userId, gameId: game.id });
      }

      const failed = await saveCareerGameResult(
        { ...localResult, syncState: 'failed' },
        userId,
        'failed'
      );
      const current = get();
      if (current.userId === userId && current.result?.gameId === game.id) {
        set({
          result: failed,
          isSubmitting: false,
          error: retryable
            ? 'Solved on this device. We’ll retry syncing later.'
            : error instanceof Error
              ? error.message
              : 'Failed to save career game',
        });
      }
      return failed;
    }
  },

  retryPendingSubmission: async (userId) => {
    const pending = await getPendingCareerGameSubmission();
    if (!pending || pending.userId !== userId) {
      return;
    }
    if (pending.localResult.date !== getQuizDate()) {
      await clearPendingCareerGameSubmission({
        userId,
        gameId: pending.gameId,
      });
      return;
    }

    try {
      const serverResult = await submitCompletion(
        pending.userId,
        pending.gameId,
        pending.submittedAnswer
      );
      const cached = await saveCareerGameResult(serverResult, userId, 'synced');
      await clearPendingCareerGameSubmission({
        userId,
        gameId: pending.gameId,
      });
      const current = get();
      if (
        current.userId === userId &&
        (!current.result || current.result.gameId === pending.gameId)
      ) {
        set({ result: cached, error: null });
      }
      logInfo('career.submit.retry.success', {
        userId,
        gameId: pending.gameId,
      });
    } catch (error) {
      const statusCode = error instanceof ApiError ? error.statusCode : undefined;
      if (!isTransientQuizSubmissionFailure(statusCode)) {
        await clearPendingCareerGameSubmission({
          userId,
          gameId: pending.gameId,
        });
        logWarn('career.submit.retry.discarded', {
          userId,
          gameId: pending.gameId,
          statusCode,
        });
        return;
      }
      logError('career.submit.retry.error', error);
    }
  },
}));
