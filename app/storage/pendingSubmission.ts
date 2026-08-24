import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingQuizSubmission } from '../types';

const PENDING_SUBMISSION_KEY = '@pundit_pending_daily_submission';
const PENDING_SUBMISSION_KEY_PREFIX = `${PENDING_SUBMISSION_KEY}_`;

function getPendingSubmissionKey(userId: string): string {
  return `${PENDING_SUBMISSION_KEY_PREFIX}${userId}`;
}

export async function getPendingQuizSubmission(
  userId?: string
): Promise<PendingQuizSubmission | null> {
  try {
    if (userId) {
      const scopedRaw = await AsyncStorage.getItem(getPendingSubmissionKey(userId));
      if (scopedRaw) return JSON.parse(scopedRaw) as PendingQuizSubmission;

      const legacyRaw = await AsyncStorage.getItem(PENDING_SUBMISSION_KEY);
      if (!legacyRaw) return null;
      const legacy = JSON.parse(legacyRaw) as PendingQuizSubmission;
      if (legacy.userId !== userId) return null;
      await AsyncStorage.setItem(getPendingSubmissionKey(userId), legacyRaw);
      await AsyncStorage.removeItem(PENDING_SUBMISSION_KEY);
      return legacy;
    }

    const raw = await AsyncStorage.getItem(PENDING_SUBMISSION_KEY);
    return raw ? (JSON.parse(raw) as PendingQuizSubmission) : null;
  } catch (error) {
    console.error('Error reading pending quiz submission:', error);
    return null;
  }
}

export async function setPendingQuizSubmission(
  submission: PendingQuizSubmission
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      getPendingSubmissionKey(submission.userId),
      JSON.stringify(submission)
    );
  } catch (error) {
    console.error('Error saving pending quiz submission:', error);
  }
}

export async function clearPendingQuizSubmission(expected?: {
  userId: string;
  quizId: string;
}): Promise<void> {
  try {
    if (expected) {
      const current = await getPendingQuizSubmission(expected.userId);
      if (
        current &&
        (current.userId !== expected.userId || current.quizId !== expected.quizId)
      ) {
        return;
      }
    }
    await AsyncStorage.removeItem(
      expected ? getPendingSubmissionKey(expected.userId) : PENDING_SUBMISSION_KEY
    );
  } catch (error) {
    console.error('Error clearing pending quiz submission:', error);
  }
}
