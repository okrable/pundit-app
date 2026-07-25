export function formatPublicPlayerName(
  username?: string | null,
  legacyLabel?: string | null,
  fallback = 'Player'
): string {
  if (username) return `@${username}`;
  if (legacyLabel) return legacyLabel;
  return fallback;
}
