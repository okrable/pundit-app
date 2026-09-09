import AsyncStorage from '@react-native-async-storage/async-storage';
import { getQuizDate } from '../utils/quizDate';
import { createJourneyRepository } from '../../shared/journeyStorage';
export type { CachedCareerGameResult } from '../../shared/journeyStorage';
const repository = createJourneyRepository(AsyncStorage);
export const saveCareerGameResult = repository.save;
export const readCareerGameResult = repository.read;
export async function getTodayCareerGameResult(userId?: string) {
  const value = await repository.read(userId);
  return value?.date === getQuizDate() ? value : null;
}
export const getGuestCareerGameResult = () => getTodayCareerGameResult();
export const clearGuestCareerGameResult = repository.clearGuest;
