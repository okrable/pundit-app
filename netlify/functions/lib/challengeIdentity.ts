export const LEGACY_GUEST_LABEL = 'Legacy guest activity';
export const LEGACY_PLAYER_LABEL = 'Legacy player';

export interface ResolvedChallengeIdentity {
  username: string | null;
  legacyLabel: string | null;
  isLegacyGuest: boolean;
}

export function resolveChallengeIdentity(
  userId: string | null,
  currentUsername: string | null,
  snapshotUsername: string | null
): ResolvedChallengeIdentity | null {
  if (!userId) {
    return null;
  }

  const username = currentUsername || snapshotUsername || null;
  if (username) {
    return {
      username,
      legacyLabel: null,
      isLegacyGuest: false,
    };
  }

  const isLegacyGuest = userId.startsWith('guest_');
  return {
    username: null,
    legacyLabel: isLegacyGuest ? LEGACY_GUEST_LABEL : LEGACY_PLAYER_LABEL,
    isLegacyGuest,
  };
}

export function getCompatibilityPlayerName(
  identity: ResolvedChallengeIdentity | null
): string | null {
  return identity?.username || identity?.legacyLabel || null;
}
