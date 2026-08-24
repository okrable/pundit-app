import { createNavigationContainerRef } from '@react-navigation/native';
import type { AvatarId } from '../../shared/avatarCatalog';

export interface PlayerProfileRouteParams {
  playerId: string;
  username?: string | null;
  avatarId?: AvatarId | null;
}

export type RootStackParamList = {
  Main: { screen?: 'Games' | 'Challenge' | 'League Tables' | 'Me' } | undefined;
  PlayerProfile: PlayerProfileRouteParams;
};

export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();

export function openPlayerProfile(params: PlayerProfileRouteParams): boolean {
  if (!rootNavigationRef.isReady()) return false;
  rootNavigationRef.navigate('PlayerProfile', params);
  return true;
}
