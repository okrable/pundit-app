import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DailyQuizAttempt,
  isDailyQuizAttempt,
} from '../../shared/dailyQuizAttempt';

const ACTIVE_ATTEMPT_KEY_PREFIX = '@pundit_daily_quiz_attempt_v1_';
const writeQueues = new Map<string, Promise<void>>();

function getActiveAttemptKey(userId: string): string {
  return `${ACTIVE_ATTEMPT_KEY_PREFIX}${encodeURIComponent(userId)}`;
}

function enqueueWrite(key: string, write: () => Promise<void>): Promise<void> {
  const previous = writeQueues.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(write);
  writeQueues.set(key, next);
  void next.then(
    () => {
      if (writeQueues.get(key) === next) writeQueues.delete(key);
    },
    () => {
      if (writeQueues.get(key) === next) writeQueues.delete(key);
    }
  );
  return next;
}

export async function getDailyQuizAttempt(
  userId: string
): Promise<DailyQuizAttempt | null> {
  const key = getActiveAttemptKey(userId);
  await writeQueues.get(key)?.catch(() => undefined);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isDailyQuizAttempt(parsed)) return parsed;
  } catch {
    // Invalid local state is removed below.
  }

  await AsyncStorage.removeItem(key);
  return null;
}

export function saveDailyQuizAttempt(attempt: DailyQuizAttempt): Promise<void> {
  const key = getActiveAttemptKey(attempt.userId);
  return enqueueWrite(key, () => AsyncStorage.setItem(key, JSON.stringify(attempt)));
}

export function clearDailyQuizAttempt(userId: string): Promise<void> {
  const key = getActiveAttemptKey(userId);
  return enqueueWrite(key, () => AsyncStorage.removeItem(key));
}
