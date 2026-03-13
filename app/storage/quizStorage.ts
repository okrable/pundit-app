import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuizResult, QuizResultImmediate, SyncState } from '../types';
import { getQuizDate } from '../utils/quizDate';

// Cache keys are now user-specific to keep guest and auth0 results separate
const GUEST_RESULT_KEY = '@pundit_daily_quiz_result_guest';
const AUTH_RESULT_KEY_PREFIX = '@pundit_daily_quiz_result_auth_';

export interface CachedQuizResult extends QuizResult {
  cachedAt: string; // ISO date string
  userId?: string; // Track which user this result belongs to
}

/**
 * Convert immediate result (with detailed answers) to compact result (boolean array)
 */
function toCompactResult(result: QuizResultImmediate | QuizResult): QuizResult {
  // If already compact (answers are booleans), return as-is
  if (result.answers.length === 0 || typeof result.answers[0] === 'boolean') {
    return result as QuizResult;
  }

  // Convert detailed answers to boolean array
  const immediateResult = result as QuizResultImmediate;
    return {
      date: immediateResult.date,
      quizId: immediateResult.quizId,
      score: immediateResult.score,
      totalQuestions: immediateResult.totalQuestions,
      streak: immediateResult.streak,
      bestScore: immediateResult.bestScore,
      answers: immediateResult.answers.map(a => a.isCorrect),
      syncState: immediateResult.syncState,
    };
  }

/**
 * Get today's date in YYYY-MM-DD format for comparison
 */
function getTodayDateString(): string {
  return getQuizDate();
}

/**
 * Get the cache key for a specific user
 */
function getCacheKey(userId: string | null): string {
  if (!userId || userId.startsWith('guest_')) {
    return GUEST_RESULT_KEY;
  }
  // For auth0 users, use their ID in the key
  return `${AUTH_RESULT_KEY_PREFIX}${userId}`;
}

/**
 * Save a quiz result to local storage for a specific user
 * Accepts both immediate (detailed) and compact (boolean) result formats
 */
export async function saveDailyQuizResult(
  result: QuizResult | QuizResultImmediate,
  userId?: string,
  syncState?: SyncState
): Promise<void> {
  try {
    const compactResult = toCompactResult(result);
    const cachedResult: CachedQuizResult = {
      ...compactResult,
      syncState: syncState ?? compactResult.syncState,
      cachedAt: new Date().toISOString(),
      userId,
    };
    const cacheKey = getCacheKey(userId || null);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cachedResult));
  } catch (error) {
    console.error('Error saving quiz result:', error);
  }
}

/**
 * Get today's cached quiz result for a specific user
 * Returns null if no result exists or if the cached result is from a previous day
 */
export async function getTodayQuizResult(userId?: string): Promise<CachedQuizResult | null> {
  try {
    const cacheKey = getCacheKey(userId || null);
    const resultJson = await AsyncStorage.getItem(cacheKey);
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
    await clearDailyQuizResult(userId);
    return null;
  } catch (error) {
    console.error('Error getting quiz result:', error);
    return null;
  }
}

/**
 * Get guest's cached quiz result for today (used for migration to auth0)
 */
export async function getGuestTodayResult(): Promise<CachedQuizResult | null> {
  try {
    const resultJson = await AsyncStorage.getItem(GUEST_RESULT_KEY);
    if (!resultJson) {
      return null;
    }

    const cachedResult: CachedQuizResult = JSON.parse(resultJson);
    const resultDate = cachedResult.date;
    const todayDate = getTodayDateString();

    if (resultDate === todayDate) {
      return cachedResult;
    }

    return null;
  } catch (error) {
    console.error('Error getting guest quiz result:', error);
    return null;
  }
}

/**
 * Clear the cached quiz result for a specific user
 */
export async function clearDailyQuizResult(userId?: string): Promise<void> {
  try {
    const cacheKey = getCacheKey(userId || null);
    await AsyncStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error clearing quiz result:', error);
  }
}

/**
 * Clear guest cache (used after migrating to auth0)
 */
export async function clearGuestCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_RESULT_KEY);
  } catch (error) {
    console.error('Error clearing guest cache:', error);
  }
}
