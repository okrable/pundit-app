import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CareerGameResult, SyncState } from '../types';
import { getQuizDate } from '../utils/quizDate';
export interface CachedCareerGameResult extends CareerGameResult { cachedAt: string; userId?: string; pendingSync?: boolean; }
const key = (id?: string | null) => `@pundit_journey_v2_${!id || id.startsWith('guest_') ? 'guest' : id}`;
export async function saveCareerGameResult(result: CareerGameResult, userId?: string, syncState?: SyncState): Promise<CachedCareerGameResult> {
  const value = { ...result, outcome: result.outcome ?? 'solved' as const, userId,
    syncState: syncState ?? result.syncState, cachedAt: new Date().toISOString() };
  await AsyncStorage.setItem(key(userId), JSON.stringify(value));
  return value;
}
export async function readCareerGameResult(userId?: string): Promise<CachedCareerGameResult | null> {
  let raw = await AsyncStorage.getItem(key(userId));
  if (!raw) {
    const legacyKey = !userId || userId.startsWith('guest_') ? '@pundit_daily_career_result_guest' : `@pundit_daily_career_result_auth_${userId}`;
    raw = await AsyncStorage.getItem(legacyKey);
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as CachedCareerGameResult;
    if (!value || typeof value.gameId !== 'string' || typeof value.date !== 'string' ||
        typeof value.canonicalName !== 'string' || typeof value.submittedAnswer !== 'string' ||
        (value.outcome !== undefined && value.outcome !== 'solved' && value.outcome !== 'given_up')) return null;
    return { ...value, outcome: value.outcome ?? 'solved' };
  } catch { return null; }
}
export async function getTodayCareerGameResult(userId?: string) {
  const value = await readCareerGameResult(userId);
  return value?.date === getQuizDate() ? value : null;
}
export const getGuestCareerGameResult = () => getTodayCareerGameResult();
export async function clearGuestCareerGameResult(): Promise<void> {
  await AsyncStorage.multiRemove([key(), '@pundit_daily_career_result_guest']);
}
