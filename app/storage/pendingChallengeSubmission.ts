import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PendingChallengeSubmission } from '../types';

const PENDING_CHALLENGE_SUBMISSION_KEY = '@pundit_pending_challenge_submission';

export async function getPendingChallengeSubmission(): Promise<PendingChallengeSubmission | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_CHALLENGE_SUBMISSION_KEY);
    return raw ? (JSON.parse(raw) as PendingChallengeSubmission) : null;
  } catch (error) {
    console.error('Error reading pending challenge submission:', error);
    return null;
  }
}

export async function setPendingChallengeSubmission(
  submission: PendingChallengeSubmission
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_CHALLENGE_SUBMISSION_KEY,
      JSON.stringify(submission)
    );
  } catch (error) {
    console.error('Error saving pending challenge submission:', error);
  }
}

export async function clearPendingChallengeSubmission(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_CHALLENGE_SUBMISSION_KEY);
  } catch (error) {
    console.error('Error clearing pending challenge submission:', error);
  }
}
