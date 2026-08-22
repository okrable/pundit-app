import { create } from 'zustand';
import {
  AchievementEvent,
  AchievementId,
  AchievementSnapshot,
  AchievementSyncEnvelope,
  ACHIEVEMENT_EVALUATOR_VERSION,
  applyAchievementEvent,
  createEmptyAchievementSnapshot,
} from '../../shared/achievements';
import {
  StoredAchievementState,
  createEmptyStoredAchievementState,
  getStoredAchievementState,
  setStoredAchievementState,
} from '../storage/achievementStorage';
import { logInfo, logWarn } from '../services/debugLog';
import {
  beginAchievementReveal,
  dismissAchievementReveal,
  enqueueAchievementReveals,
  normalizeAchievementRevealQueues,
  releaseDeferredAchievementReveals,
} from '../../shared/achievementRevealPolicy';

interface AchievementState extends StoredAchievementState {
  userId: string | null;
  hydrated: boolean;
  dailyGameActive: boolean;
  activeRevealIds: AchievementId[];
  hydrate: (userId: string) => Promise<void>;
  applyLocalEvent: (userId: string, event: AchievementEvent) => Promise<AchievementId[]>;
  reconcileServer: (
    userId: string,
    serverSnapshot: AchievementSnapshot,
    options?: {
      acceptedEventId?: string;
      newlyUnlocked?: AchievementId[];
      rejectedIds?: AchievementId[];
      deferReveal?: boolean;
    }
  ) => Promise<void>;
  buildSyncEnvelope: (eventId: string, proposedUnlockIds: AchievementId[]) => AchievementSyncEnvelope;
  setDailyGameActive: (active: boolean) => void;
  releaseDailyReveals: () => Promise<void>;
  beginReveal: () => void;
  dismissReveal: () => Promise<void>;
  reset: () => void;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function stored(state: AchievementState): StoredAchievementState {
  return {
    confirmedSnapshot: state.confirmedSnapshot,
    snapshot: state.snapshot,
    pendingEvents: state.pendingEvents,
    deferredDailyRevealIds: state.deferredDailyRevealIds,
    immediateRevealIds: state.immediateRevealIds,
    locallyRevealedIds: state.locallyRevealedIds,
    pendingAcknowledgedIds: state.pendingAcknowledgedIds,
  };
}

async function persist(state: AchievementState) {
  if (state.userId) await setStoredAchievementState(state.userId, stored(state));
}

export const useAchievementStore = create<AchievementState>((set, get) => ({
  ...createEmptyStoredAchievementState(),
  userId: null,
  hydrated: false,
  dailyGameActive: false,
  activeRevealIds: [],

  hydrate: async (userId) => {
    const saved = await getStoredAchievementState(userId);
    const revealQueues = normalizeAchievementRevealQueues({
      activeRevealIds: [],
      immediateRevealIds: saved.immediateRevealIds,
      deferredDailyRevealIds: saved.deferredDailyRevealIds,
      locallyRevealedIds: saved.locallyRevealedIds,
    }, saved.confirmedSnapshot.celebratedIds);
    set({ ...saved, ...revealQueues, userId, hydrated: true });
    logInfo('achievements.cache.hydrated', { userId, pendingEvents: saved.pendingEvents.length });
  },

  applyLocalEvent: async (userId, event) => {
    if (get().userId !== userId) await get().hydrate(userId);
    if (get().pendingEvents.some((item) => item.id === event.id)) return [];

    const evaluation = applyAchievementEvent(get().snapshot, event);
    set((state) => ({
      ...enqueueAchievementReveals(
        state,
        evaluation.newlyUnlocked,
        event.kind === 'daily-quiz' ? 'deferred' : 'immediate',
        state.confirmedSnapshot.celebratedIds
      ),
      snapshot: evaluation.snapshot,
      pendingEvents: [...state.pendingEvents, event],
    }));
    await persist(get());
    return evaluation.newlyUnlocked;
  },

  reconcileServer: async (userId, serverSnapshot, options = {}) => {
    if (get().userId !== userId) {
      logWarn('achievements.reconcile.discarded_stale', { userId, activeUserId: get().userId });
      return;
    }
    const remaining = get().pendingEvents.filter((event) => event.id !== options.acceptedEventId);
    let merged = serverSnapshot;
    for (const event of remaining) merged = applyAchievementEvent(merged, event).snapshot;

    const rejected = options.rejectedIds ?? [];
    if (rejected.length > 0) {
      logWarn('achievements.reconcile.rejected', { userId, achievementIds: rejected });
    }
    const uncelebratedServerIds = Object.keys(serverSnapshot.unlocked).filter(
      (id): id is AchievementId =>
        !serverSnapshot.celebratedIds.includes(id as AchievementId)
    );
    const serverCandidates = unique([
      ...(options.newlyUnlocked ?? []),
      ...uncelebratedServerIds,
    ]);
    set((state) => {
      const revealQueues = enqueueAchievementReveals(
        {
          activeRevealIds: state.activeRevealIds,
          immediateRevealIds: state.immediateRevealIds.filter((id) => !rejected.includes(id)),
          deferredDailyRevealIds: state.deferredDailyRevealIds.filter(
            (id) => !rejected.includes(id)
          ),
          locallyRevealedIds: state.locallyRevealedIds,
        },
        serverCandidates,
        options.deferReveal ? 'deferred' : 'immediate',
        serverSnapshot.celebratedIds,
        rejected
      );
      return {
        ...revealQueues,
        confirmedSnapshot: serverSnapshot,
        snapshot: merged,
        pendingEvents: remaining,
        pendingAcknowledgedIds: state.pendingAcknowledgedIds.filter(
          (id) => !serverSnapshot.celebratedIds.includes(id)
        ),
      };
    });
    await persist(get());
  },

  buildSyncEnvelope: (eventId, proposedUnlockIds) => ({
    evaluatorVersion: ACHIEVEMENT_EVALUATOR_VERSION,
    eventId,
    proposedUnlockIds,
    acknowledgedIds: get().pendingAcknowledgedIds,
  }),

  setDailyGameActive: (dailyGameActive) => set({ dailyGameActive }),

  releaseDailyReveals: async () => {
    set((state) => ({
      ...releaseDeferredAchievementReveals(
        state,
        state.confirmedSnapshot.celebratedIds
      ),
      dailyGameActive: false,
    }));
    await persist(get());
  },

  beginReveal: () => {
    const state = get();
    if (state.activeRevealIds.length > 0 || state.dailyGameActive || state.immediateRevealIds.length === 0) return;
    set(beginAchievementReveal(state, state.confirmedSnapshot.celebratedIds));
  },

  dismissReveal: async () => {
    const ids = get().activeRevealIds;
    if (ids.length === 0) return;
    set((state) => ({
      ...dismissAchievementReveal(state, state.confirmedSnapshot.celebratedIds),
      pendingAcknowledgedIds: unique([...state.pendingAcknowledgedIds, ...ids]),
      snapshot: {
        ...state.snapshot,
        celebratedIds: unique([...state.snapshot.celebratedIds, ...ids]),
      },
    }));
    await persist(get());
  },

  reset: () => set({
    ...createEmptyStoredAchievementState(),
    userId: null,
    hydrated: false,
    dailyGameActive: false,
    activeRevealIds: [],
    snapshot: createEmptyAchievementSnapshot(),
  }),
}));
