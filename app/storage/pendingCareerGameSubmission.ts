import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingCareerGameSubmission } from '../types';

const PENDING_CAREER_GAME_KEY = '@pundit_pending_career_game_submission';
const PENDING_CAREER_GAME_KEY_PREFIX = `${PENDING_CAREER_GAME_KEY}_`;

function getPendingCareerGameKey(userId: string): string {
  return `${PENDING_CAREER_GAME_KEY_PREFIX}${userId}`;
}

export async function getPendingCareerGameSubmission(
  userId?: string
): Promise<PendingCareerGameSubmission | null> {
  try {
    if (userId) {
      const scopedRaw = await AsyncStorage.getItem(getPendingCareerGameKey(userId));
      if (scopedRaw) return JSON.parse(scopedRaw) as PendingCareerGameSubmission;

      const legacyRaw = await AsyncStorage.getItem(PENDING_CAREER_GAME_KEY);
      if (!legacyRaw) return null;
      const legacy = JSON.parse(legacyRaw) as PendingCareerGameSubmission;
      if (legacy.userId !== userId) return null;
      await AsyncStorage.setItem(getPendingCareerGameKey(userId), legacyRaw);
      await AsyncStorage.removeItem(PENDING_CAREER_GAME_KEY);
      return legacy;
    }

    const raw = await AsyncStorage.getItem(PENDING_CAREER_GAME_KEY);
    return raw ? (JSON.parse(raw) as PendingCareerGameSubmission) : null;
  } catch (error) {
    console.error('Error reading pending career game submission:', error);
    return null;
  }
}

export async function setPendingCareerGameSubmission(
  submission: PendingCareerGameSubmission
): Promise<void> {
  await AsyncStorage.setItem(
    getPendingCareerGameKey(submission.userId),
    JSON.stringify(submission)
  );
}

export async function clearPendingCareerGameSubmission(expected?: {
  userId: string;
  gameId: string;
}): Promise<void> {
  if (expected) {
    const current = await getPendingCareerGameSubmission(expected.userId);
    if (
      current &&
      (current.userId !== expected.userId || current.gameId !== expected.gameId)
    ) {
      return;
    }
  }
  await AsyncStorage.removeItem(
    expected ? getPendingCareerGameKey(expected.userId) : PENDING_CAREER_GAME_KEY
  );
}
