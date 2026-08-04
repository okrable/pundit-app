import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingCareerGameSubmission } from '../types';

const PENDING_CAREER_GAME_KEY = '@pundit_pending_career_game_submission';

export async function getPendingCareerGameSubmission(): Promise<PendingCareerGameSubmission | null> {
  try {
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
  await AsyncStorage.setItem(PENDING_CAREER_GAME_KEY, JSON.stringify(submission));
}

export async function clearPendingCareerGameSubmission(expected?: {
  userId: string;
  gameId: string;
}): Promise<void> {
  if (expected) {
    const current = await getPendingCareerGameSubmission();
    if (
      current &&
      (current.userId !== expected.userId || current.gameId !== expected.gameId)
    ) {
      return;
    }
  }
  await AsyncStorage.removeItem(PENDING_CAREER_GAME_KEY);
}
