import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheEnvelope, Quiz } from '../types';
import {
  clearCachedResource,
  getCachedResource,
  isResourceStale,
  setCachedResource,
} from './resourceCache';

const QUIZ_CACHE_PREFIX = 'quiz_';
const QUIZ_CACHE_STALE_MS = 6 * 60 * 60 * 1000;
const QUIZ_CACHE_EXPIRY_MS = 36 * 60 * 60 * 1000;

function getQuizCacheKey(date: string): string {
  return `${QUIZ_CACHE_PREFIX}${date}`;
}

export async function getCachedQuiz(date: string): Promise<Quiz | null> {
  const cache = await getCachedQuizEntry(date);
  return cache?.data ?? null;
}

export async function getCachedQuizEntry(date: string): Promise<CacheEnvelope<Quiz> | null> {
  return getCachedResource<Quiz>(getQuizCacheKey(date));
}

export function isQuizCacheStale(cache: CacheEnvelope<Quiz> | null): boolean {
  return isResourceStale(cache);
}

export async function setCachedQuiz(date: string, quiz: Quiz): Promise<void> {
  await setCachedResource(getQuizCacheKey(date), quiz, {
    staleInMs: QUIZ_CACHE_STALE_MS,
    expiresInMs: QUIZ_CACHE_EXPIRY_MS,
    scopeKey: date,
  });
}

export async function clearQuizCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const quizKeys = keys.filter((key) => key.startsWith('@pundit_resource_quiz_'));
    await AsyncStorage.multiRemove(quizKeys);
  } catch (error) {
    console.error('Error clearing quiz cache:', error);
  }
}

export async function clearCachedQuiz(date: string): Promise<void> {
  await clearCachedResource(getQuizCacheKey(date));
}
