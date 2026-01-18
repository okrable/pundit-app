import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuizResult } from '../types';

const QUIZ_RESULT_KEY = '@pundit_daily_quiz_result';

export interface CachedQuizResult extends QuizResult {
  cachedAt: string; // ISO date string
}

/**
 * Get today's date in YYYY-MM-DD format for comparison
 */
function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Save a quiz result to local storage
 */
export async function saveDailyQuizResult(result: QuizResult): Promise<void> {
  try {
    const cachedResult: CachedQuizResult = {
      ...result,
      cachedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(QUIZ_RESULT_KEY, JSON.stringify(cachedResult));
  } catch (error) {
    console.error('Error saving quiz result:', error);
  }
}

/**
 * Get today's cached quiz result if it exists
 * Returns null if no result exists or if the cached result is from a previous day
 */
export async function getTodayQuizResult(): Promise<CachedQuizResult | null> {
  try {
    const resultJson = await AsyncStorage.getItem(QUIZ_RESULT_KEY);
    if (!resultJson) {
      return null;
    }

    const cachedResult: CachedQuizResult = JSON.parse(resultJson);

    // Check if the cached result is from today
    const resultDate = cachedResult.date; // YYYY-MM-DD format from backend
    const todayDate = getTodayDateString();

    if (resultDate === todayDate) {
      return cachedResult;
    }

    // Result is from a previous day, clear it
    await clearDailyQuizResult();
    return null;
  } catch (error) {
    console.error('Error getting quiz result:', error);
    return null;
  }
}

/**
 * Clear the cached quiz result
 */
export async function clearDailyQuizResult(): Promise<void> {
  try {
    await AsyncStorage.removeItem(QUIZ_RESULT_KEY);
  } catch (error) {
    console.error('Error clearing quiz result:', error);
  }
}

/**
 * Generate emoji string representing quiz results (⚽️ for correct, ❌ for incorrect)
 */
export function generateResultEmojis(result: QuizResult | CachedQuizResult): string {
  return result.answers
    .map(answer => answer.isCorrect ? '⚽️' : '❌')
    .join('');
}
