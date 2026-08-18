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
    set({ ...saved, userId, hydrated: true, activeRevealIds: [] });
    logInfo('achievements.cache.hydrated', { userId, pendingEvents: saved.pendingEvents.length });
  },

  applyLocalEvent: async (userId, event) => {
    if (get().userId !== userId) await get().hydrate(userId);
    if (get().pendingEvents.some((item) => item.id === event.id)) return [];

    const evaluation = applyAchievementEvent(get().snapshot, event);
    const unseen = evaluation.newlyUnlocked.filter(
      (id) => !get().locallyRevealedIds.includes(id)
    );
    set((state) => ({
      snapshot: evaluation.snapshot,
      pendingEvents: [...state.pendingEvents, event],
      deferredDailyRevealIds:
        event.kind === 'daily-quiz'
          ? unique([...state.deferredDailyRevealIds, ...unseen])
          : state.deferredDailyRevealIds,
      immediateRevealIds:
        event.kind === 'avatar-change'
          ? unique([...state.immediateRevealIds, ...unseen])
          : state.immediateRevealIds,
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
    const serverUnseen = unique([
      ...(options.newlyUnlocked ?? []),
      ...uncelebratedServerIds,
    ]).filter(
      (id) =>
        !serverSnapshot.celebratedIds.includes(id) &&
        !get().locallyRevealedIds.includes(id) &&
        !get().deferredDailyRevealIds.includes(id)
    );
    set((state) => ({
      confirmedSnapshot: serverSnapshot,
      snapshot: merged,
      pendingEvents: remaining,
      immediateRevealIds: (options.deferReveal
        ? state.immediateRevealIds
        : unique([...state.immediateRevealIds, ...serverUnseen]))
        .filter((id) => !rejected.includes(id)),
      deferredDailyRevealIds: options.deferReveal
        ? unique([...state.deferredDailyRevealIds, ...serverUnseen]).filter(
            (id) => !rejected.includes(id)
          )
        : state.deferredDailyRevealIds.filter((id) => !rejected.includes(id)),
      pendingAcknowledgedIds: state.pendingAcknowledgedIds.filter(
        (id) => !serverSnapshot.celebratedIds.includes(id)
      ),
    }));
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
      dailyGameActive: false,
      immediateRevealIds: unique([
        ...state.immediateRevealIds,
        ...state.deferredDailyRevealIds.filter((id) => !state.locallyRevealedIds.includes(id)),
      ]),
      deferredDailyRevealIds: [],
    }));
    await persist(get());
  },

  beginReveal: () => {
    const state = get();
    if (state.activeRevealIds.length > 0 || state.dailyGameActive || state.immediateRevealIds.length === 0) return;
    set({ activeRevealIds: state.immediateRevealIds, immediateRevealIds: [] });
  },

  dismissReveal: async () => {
    const ids = get().activeRevealIds;
    if (ids.length === 0) return;
    set((state) => ({
      activeRevealIds: [],
      locallyRevealedIds: unique([...state.locallyRevealedIds, ...ids]),
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
