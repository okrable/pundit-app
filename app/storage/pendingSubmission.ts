import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingQuizSubmission } from '../types';

const PENDING_SUBMISSION_KEY = '@pundit_pending_daily_submission';

export async function getPendingQuizSubmission(): Promise<PendingQuizSubmission | null> {
  try {
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
    await AsyncStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(submission));
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
      const current = await getPendingQuizSubmission();
      if (
        current &&
        (current.userId !== expected.userId || current.quizId !== expected.quizId)
      ) {
        return;
      }
    }
    await AsyncStorage.removeItem(PENDING_SUBMISSION_KEY);
  } catch (error) {
    console.error('Error clearing pending quiz submission:', error);
  }
}
