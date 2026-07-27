import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CareerGameResult, SyncState } from '../types';
import { getQuizDate } from '../utils/quizDate';

const GUEST_RESULT_KEY = '@pundit_daily_career_result_guest';
const AUTH_RESULT_KEY_PREFIX = '@pundit_daily_career_result_auth_';

export interface CachedCareerGameResult extends CareerGameResult {
  cachedAt: string;
  userId?: string;
}

function getCacheKey(userId?: string | null): string {
  if (!userId || userId.startsWith('guest_')) {
    return GUEST_RESULT_KEY;
  }
  return `${AUTH_RESULT_KEY_PREFIX}${userId}`;
}

export async function saveCareerGameResult(
  result: CareerGameResult,
  userId?: string,
  syncState?: SyncState
): Promise<CachedCareerGameResult> {
  const cachedResult: CachedCareerGameResult = {
    ...result,
    syncState: syncState ?? result.syncState,
    userId,
    cachedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(cachedResult));
  return cachedResult;
}

export async function getTodayCareerGameResult(
  userId?: string
): Promise<CachedCareerGameResult | null> {
  try {
    const key = getCacheKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const result = JSON.parse(raw) as CachedCareerGameResult;
    if (result.date === getQuizDate()) {
      return result;
    }

    await AsyncStorage.removeItem(key);
    return null;
  } catch (error) {
    console.error('Error reading career game result:', error);
    return null;
  }
}

export async function getGuestCareerGameResult(): Promise<CachedCareerGameResult | null> {
  return getTodayCareerGameResult();
}

export async function clearGuestCareerGameResult(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_RESULT_KEY);
}
