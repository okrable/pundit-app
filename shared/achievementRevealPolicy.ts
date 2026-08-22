import type { AchievementId } from './achievements';

export interface AchievementRevealQueues {
  activeRevealIds: AchievementId[];
  immediateRevealIds: AchievementId[];
  deferredDailyRevealIds: AchievementId[];
  locallyRevealedIds: AchievementId[];
}

function unique(values: AchievementId[]): AchievementId[] {
  return [...new Set(values)];
}

function without(values: AchievementId[], excluded: Set<AchievementId>): AchievementId[] {
  return unique(values).filter((id) => !excluded.has(id));
}

export function normalizeAchievementRevealQueues(
  queues: AchievementRevealQueues,
  serverCelebratedIds: AchievementId[] = []
): AchievementRevealQueues {
  const serverCelebrated = new Set(unique(serverCelebratedIds));
  const locallyRevealedIds = without(queues.locallyRevealedIds, serverCelebrated);
  const revealed = new Set(unique([
    ...locallyRevealedIds,
    ...serverCelebratedIds,
  ]));
  const activeRevealIds = without(queues.activeRevealIds, revealed);
  const active = new Set(activeRevealIds);
  const immediateRevealIds = without(
    queues.immediateRevealIds,
    new Set([...revealed, ...active])
  );
  const immediate = new Set(immediateRevealIds);
  const deferredDailyRevealIds = without(
    queues.deferredDailyRevealIds,
    new Set([...revealed, ...active, ...immediate])
  );

  return {
    activeRevealIds,
    immediateRevealIds,
    deferredDailyRevealIds,
    locallyRevealedIds,
  };
}

export function enqueueAchievementReveals(
  queues: AchievementRevealQueues,
  candidateIds: AchievementId[],
  destination: 'immediate' | 'deferred',
  serverCelebratedIds: AchievementId[] = [],
  rejectedIds: AchievementId[] = []
): AchievementRevealQueues {
  const normalized = normalizeAchievementRevealQueues(queues, serverCelebratedIds);
  const unavailable = new Set<AchievementId>([
    ...normalized.activeRevealIds,
    ...normalized.immediateRevealIds,
    ...normalized.deferredDailyRevealIds,
    ...normalized.locallyRevealedIds,
    ...serverCelebratedIds,
    ...rejectedIds,
  ]);
  const additions = unique(candidateIds).filter((id) => !unavailable.has(id));

  return normalizeAchievementRevealQueues({
    ...normalized,
    immediateRevealIds:
      destination === 'immediate'
        ? [...normalized.immediateRevealIds, ...additions]
        : normalized.immediateRevealIds,
    deferredDailyRevealIds:
      destination === 'deferred'
        ? [...normalized.deferredDailyRevealIds, ...additions]
        : normalized.deferredDailyRevealIds,
  }, serverCelebratedIds);
}

export function releaseDeferredAchievementReveals(
  queues: AchievementRevealQueues,
  serverCelebratedIds: AchievementId[] = []
): AchievementRevealQueues {
  const normalized = normalizeAchievementRevealQueues(queues, serverCelebratedIds);
  return normalizeAchievementRevealQueues({
    ...normalized,
    immediateRevealIds: [
      ...normalized.immediateRevealIds,
      ...normalized.deferredDailyRevealIds,
    ],
    deferredDailyRevealIds: [],
  }, serverCelebratedIds);
}

export function beginAchievementReveal(
  queues: AchievementRevealQueues,
  serverCelebratedIds: AchievementId[] = []
): AchievementRevealQueues {
  const normalized = normalizeAchievementRevealQueues(queues, serverCelebratedIds);
  if (normalized.activeRevealIds.length > 0 || normalized.immediateRevealIds.length === 0) {
    return normalized;
  }

  return {
    ...normalized,
    activeRevealIds: normalized.immediateRevealIds,
    immediateRevealIds: [],
  };
}

export function dismissAchievementReveal(
  queues: AchievementRevealQueues,
  serverCelebratedIds: AchievementId[] = []
): AchievementRevealQueues {
  const dismissedIds = unique(queues.activeRevealIds);
  const dismissed = new Set(dismissedIds);
  return normalizeAchievementRevealQueues({
    activeRevealIds: [],
    immediateRevealIds: queues.immediateRevealIds.filter((id) => !dismissed.has(id)),
    deferredDailyRevealIds: queues.deferredDailyRevealIds.filter((id) => !dismissed.has(id)),
    locallyRevealedIds: unique([...queues.locallyRevealedIds, ...dismissedIds]),
  }, serverCelebratedIds);
}
