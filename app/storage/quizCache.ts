import AsyncStorage from '@react-native-async-storage/async-storage';
import { Quiz } from '../types';

const QUIZ_CACHE_PREFIX = '@pundit_quiz_';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedQuiz {
  quiz: Quiz;
  timestamp: number;
}

export async function getCachedQuiz(date: string): Promise<Quiz | null> {
  try {
    const cached = await AsyncStorage.getItem(`${QUIZ_CACHE_PREFIX}${date}`);
    if (!cached) return null;

    const { quiz, timestamp }: CachedQuiz = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - timestamp > CACHE_EXPIRY_MS) {
      await AsyncStorage.removeItem(`${QUIZ_CACHE_PREFIX}${date}`);
      return null;
    }

    return quiz;
  } catch (error) {
    console.error('Error getting cached quiz:', error);
    return null;
  }
}

export async function setCachedQuiz(date: string, quiz: Quiz): Promise<void> {
  try {
    const cacheData: CachedQuiz = {
      quiz,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(`${QUIZ_CACHE_PREFIX}${date}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error caching quiz:', error);
  }
}

export async function clearQuizCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const quizKeys = keys.filter((key) => key.startsWith(QUIZ_CACHE_PREFIX));
    await AsyncStorage.multiRemove(quizKeys);
  } catch (error) {
    console.error('Error clearing quiz cache:', error);
  }
}
