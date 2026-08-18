import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AchievementEvent,
  AchievementId,
  AchievementSnapshot,
  AvatarChangeAchievementEvent,
} from '../../shared/achievements';
import { createEmptyAchievementSnapshot } from '../../shared/achievements';

export interface StoredAchievementState {
  confirmedSnapshot: AchievementSnapshot;
  snapshot: AchievementSnapshot;
  pendingEvents: AchievementEvent[];
  deferredDailyRevealIds: AchievementId[];
  immediateRevealIds: AchievementId[];
  locallyRevealedIds: AchievementId[];
  pendingAcknowledgedIds: AchievementId[];
}

const KEY_PREFIX = '@pundit_achievements_v1_';
const AVATAR_MUTATION_KEY_PREFIX = '@pundit_achievement_avatar_mutation_';

export function createEmptyStoredAchievementState(): StoredAchievementState {
  const confirmedSnapshot = createEmptyAchievementSnapshot();
  return {
    confirmedSnapshot,
    snapshot: createEmptyAchievementSnapshot(),
    pendingEvents: [],
    deferredDailyRevealIds: [],
    immediateRevealIds: [],
    locallyRevealedIds: [],
    pendingAcknowledgedIds: [],
  };
}

function keyFor(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export async function getStoredAchievementState(userId: string): Promise<StoredAchievementState> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return createEmptyStoredAchievementState();
    const parsed = JSON.parse(raw) as Partial<StoredAchievementState>;
    const empty = createEmptyStoredAchievementState();
    return {
      confirmedSnapshot: parsed.confirmedSnapshot ?? empty.confirmedSnapshot,
      snapshot: parsed.snapshot ?? empty.snapshot,
      pendingEvents: parsed.pendingEvents ?? [],
      deferredDailyRevealIds: parsed.deferredDailyRevealIds ?? [],
      immediateRevealIds: parsed.immediateRevealIds ?? [],
      locallyRevealedIds: parsed.locallyRevealedIds ?? [],
      pendingAcknowledgedIds: parsed.pendingAcknowledgedIds ?? [],
    };
  } catch {
    return createEmptyStoredAchievementState();
  }
}

export async function setStoredAchievementState(
  userId: string,
  state: StoredAchievementState
): Promise<void> {
  await AsyncStorage.setItem(keyFor(userId), JSON.stringify(state));
}

interface PendingAvatarAchievementMutation {
  avatarId: string;
  event: AvatarChangeAchievementEvent;
}

export async function getPendingAvatarAchievementMutation(
  userId: string,
  avatarId: string
): Promise<AvatarChangeAchievementEvent | null> {
  try {
    const raw = await AsyncStorage.getItem(`${AVATAR_MUTATION_KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAvatarAchievementMutation;
    return parsed.avatarId === avatarId ? parsed.event : null;
  } catch {
    return null;
  }
}

export async function setPendingAvatarAchievementMutation(
  userId: string,
  avatarId: string,
  event: AvatarChangeAchievementEvent
): Promise<void> {
  await AsyncStorage.setItem(
    `${AVATAR_MUTATION_KEY_PREFIX}${userId}`,
    JSON.stringify({ avatarId, event } satisfies PendingAvatarAchievementMutation)
  );
}

export async function clearPendingAvatarAchievementMutation(userId: string): Promise<void> {
  await AsyncStorage.removeItem(`${AVATAR_MUTATION_KEY_PREFIX}${userId}`);
}
