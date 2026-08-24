import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AvatarId } from '../../shared/avatarCatalog';

const KEY = '@pundit_pending_player_profile_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface PendingPlayerProfile {
  playerId: string;
  username: string | null;
  avatarId?: AvatarId | null;
  savedAt: number;
}

export async function savePendingPlayerProfile(
  profile: Omit<PendingPlayerProfile, 'savedAt'>
): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...profile, savedAt: Date.now() }));
}

export async function consumePendingPlayerProfile(): Promise<PendingPlayerProfile | null> {
  const value = await AsyncStorage.getItem(KEY);
  if (!value) return null;
  await AsyncStorage.removeItem(KEY);
  try {
    const parsed = JSON.parse(value) as PendingPlayerProfile;
    if (!parsed.playerId || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
