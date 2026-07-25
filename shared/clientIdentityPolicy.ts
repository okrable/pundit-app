export type ClientIdentityStatus =
  | 'unknown'
  | 'syncing'
  | 'username_required'
  | 'complete'
  | 'failed';

export function resolveStoredIdentityStatus({
  username,
  onboardingStatus,
}: {
  username?: string;
  onboardingStatus?: 'username_required' | 'complete';
}): ClientIdentityStatus {
  if (username && onboardingStatus === 'complete') return 'complete';
  if (onboardingStatus === 'username_required') return 'username_required';
  return 'unknown';
}

export function shouldBlockAuthenticatedNavigation(
  isAuthenticated: boolean,
  identityStatus: ClientIdentityStatus
): boolean {
  return isAuthenticated && identityStatus !== 'complete';
}

export function canProcessProtectedAction(
  isAuthenticated: boolean,
  identityStatus: ClientIdentityStatus
): boolean {
  return isAuthenticated && identityStatus === 'complete';
}
