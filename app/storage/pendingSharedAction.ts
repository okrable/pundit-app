import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SharedCodeAction } from '../services/sharedCode';

const PENDING_SHARED_ACTION_KEY = '@pundit_pending_shared_action';

export interface PendingSharedAction extends SharedCodeAction {
  receivedAt: string;
}

export async function getPendingSharedAction(): Promise<PendingSharedAction | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_SHARED_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingSharedAction;
    if (
      (parsed.kind !== 'challenge' && parsed.kind !== 'friendInvite') ||
      !parsed.code ||
      !parsed.receivedAt
    ) {
      await AsyncStorage.removeItem(PENDING_SHARED_ACTION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function setPendingSharedAction(action: SharedCodeAction): Promise<void> {
  if (action.kind === 'invalid') return;
  await AsyncStorage.setItem(
    PENDING_SHARED_ACTION_KEY,
    JSON.stringify({ ...action, receivedAt: new Date().toISOString() })
  );
}

export async function clearPendingSharedAction(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_SHARED_ACTION_KEY);
}
