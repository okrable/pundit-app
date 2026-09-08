import { create } from 'zustand';
import {
  ApiError,
  completeCareerGame as submit,
  getTodayCareerGameResult as readServer,
} from '../services/api';
import type { CareerGame, CareerGameResult } from '../types';
import {
  saveCareerGameResult,
  getTodayCareerGameResult,
  getGuestCareerGameResult,
  clearGuestCareerGameResult,
  type CachedCareerGameResult,
} from '../storage/careerGameStorage';
import { useAuthStore } from './useAuthStore';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';
import { isTransientQuizSubmissionFailure } from '../../shared/quizSync';
import type { JourneyOutcome } from '../../shared/journeyOutcome';
import { trackAnalyticsEvent } from '../services/analytics';
import { getQuizDate } from '../utils/quizDate';

interface State {
  userId: string | null;
  result: CachedCareerGameResult | null;
  error: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  setUserId(id: string): void;
  hydrateFromCache(id: string): Promise<void>;
  reconcileIdentity(id: string): Promise<void>;
  completeGame(
    game: CareerGame,
    answer: string,
    outcome?: JourneyOutcome,
    durationMs?: number,
  ): Promise<CareerGameResult>;
  retryPendingSubmission(id: string): Promise<void>;
}
const inflight = new Map<string, Promise<CareerGameResult>>();
const retrying = new Set<string>();
function verified(id: string, version: number) {
  const a = useAuthStore.getState();
  return canProcessProtectedAction(
    {
      isAuthenticated: a.isAuthenticated,
      authStatus: a.authStatus,
      identityStatus: a.identityStatus,
      token: a.token,
      userId: a.user?.sub,
      authStateVersion: a.authStateVersion,
    },
    { userId: id, authStateVersion: version },
  );
}
export const useCareerGameStore = create<State>((set, get) => ({
  userId: null,
  result: null,
  error: null,
  isLoading: false,
  isSubmitting: false,
  setUserId: (id) => {
    if (get().userId !== id)
      set({
        userId: id,
        result: null,
        error: null,
        isLoading: false,
        isSubmitting: false,
      });
  },
  hydrateFromCache: async (id) => {
    const version = useAuthStore.getState().authStateVersion;
    try {
      const result = await getTodayCareerGameResult(id);
      if (
        get().userId === id &&
        useAuthStore.getState().authStateVersion === version
      )
        set({ result, error: null });
    } catch {
      if (get().userId === id)
        set({ error: 'Unable to read saved Journey. Please retry.' });
    }
  },
  reconcileIdentity: async (id) => {
    if (id.startsWith('guest_')) return;
    const version = useAuthStore.getState().authStateVersion;
    if (!verified(id, version)) return;
    const current = () => get().userId === id && verified(id, version);
    set({ isLoading: true });
    try {
      const server = await readServer(id);
      if (!current()) return;
      if (server) {
        const result = await saveCareerGameResult(server, id, 'synced');
        if (!current()) return;
        await clearGuestCareerGameResult();
        if (current()) set({ result, error: null });
      } else {
        const local = await getTodayCareerGameResult(id);
        const guest = local ? null : await getGuestCareerGameResult();
        if (!current()) return;
        if (guest) {
          // Bind adoption to this account durably before the guest record is removed.
          const result = await saveCareerGameResult(
            { ...guest, syncState: 'pending', isOptimistic: true },
            id,
            'pending',
          );
          if (!current()) return;
          await clearGuestCareerGameResult();
          if (current()) set({ result });
        } else if (local && current()) set({ result: local });
        if (current()) await get().retryPendingSubmission(id);
      }
    } catch {
      if (current())
        set({ error: 'Saved on this device. Retry sync when connected.' });
    } finally {
      if (current()) set({ isLoading: false });
    }
  },
  completeGame: async (game, answer, outcome = 'solved', durationMs = 0) => {
    const id = get().userId;
    if (!id) throw new Error('Journey is not ready');
    if (game.date !== getQuizDate())
      throw new Error('A new Journey is available. Return to Games.');
    const version = useAuthStore.getState().authStateVersion;
    const current = () =>
      get().userId === id &&
      useAuthStore.getState().authStateVersion === version;
    const workKey = `${id}:${game.id}`;
    const running = inflight.get(workKey);
    if (running) return running;
    const work = (async () => {
      const existing = await getTodayCareerGameResult(id);
      if (existing?.gameId === game.id) {
        if (current()) set({ result: existing });
        return existing;
      }
      if (!current()) throw new Error('Account changed');
      const guest = id.startsWith('guest_');
      const result = await saveCareerGameResult(
        {
          date: game.date,
          gameId: game.id,
          completed: true,
          outcome,
          canonicalName: game.canonicalName,
          submittedAnswer: outcome === 'solved' ? answer.trim() : '',
          syncState: guest ? 'synced' : 'pending',
          isOptimistic: !guest,
        },
        id,
      );
      if (current()) {
        set({ result, error: null });
        trackAnalyticsEvent(
          outcome === 'given_up' ? 'journey_given_up' : 'journey_solved',
          guest ? 'guest' : 'authenticated',
          {
            quizDate: game.date,
            durationMs: Math.max(0, Math.min(durationMs, 600000)),
          },
        );
      }
      if (!guest && current()) await get().retryPendingSubmission(id);
      return current() ? (get().result ?? result) : result;
    })();
    inflight.set(workKey, work);
    try {
      return await work;
    } catch (error) {
      if (current())
        set({
          error: 'Unable to save this result. Keep this screen open and retry.',
        });
      throw error;
    } finally {
      inflight.delete(workKey);
    }
  },
  retryPendingSubmission: async (id) => {
    if (id.startsWith('guest_') || retrying.has(id)) return;
    const version = useAuthStore.getState().authStateVersion;
    const current = () => get().userId === id && verified(id, version);
    if (!current()) return;
    retrying.add(id);
    try {
      const pending = await getTodayCareerGameResult(id);
      if (!pending || pending.syncState !== 'pending' || !current()) return;
      set({ isSubmitting: true });
      const canonical = await submit(
        pending.gameId,
        id,
        pending.submittedAnswer,
        pending.outcome ?? 'solved',
      );
      // Writing the originating account's cache is safe even after an account change.
      const result = await saveCareerGameResult(canonical, id, 'synced');
      if (current() && result.date === getQuizDate())
        set({ result, error: null });
    } catch (error) {
      if (current()) {
        const retryable = isTransientQuizSubmissionFailure(
          error instanceof ApiError ? error.statusCode : undefined,
        );
        if (!retryable) {
          const local = await getTodayCareerGameResult(id);
          if (local) {
            const result = await saveCareerGameResult(local, id, 'failed');
            if (current()) set({ result });
          }
        }
        if (current())
          set({
            error: retryable
              ? 'Saved on this device. Retry sync when connected.'
              : 'This result could not be synced. Return to Games to refresh.',
          });
      }
    } finally {
      retrying.delete(id);
      if (current()) set({ isSubmitting: false });
    }
  },
}));
