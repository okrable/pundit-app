export type ClientIdentityStatus =
  | 'unknown'
  | 'syncing'
  | 'username_required'
  | 'complete'
  | 'failed';

export function buildIdentityActivationKey(
  userId: string,
  authStateVersion: number
): string {
  return `${userId}:${authStateVersion}`;
}

export function isIdentityActivationCurrent(
  expectedUserId: string,
  expectedAuthStateVersion: number,
  current: {
    userId?: string | null;
    token?: string | null;
    isAuthenticated: boolean;
    authStateVersion: number;
  }
): boolean {
  return (
    current.authStateVersion === expectedAuthStateVersion &&
    current.userId === expectedUserId &&
    current.isAuthenticated &&
    Boolean(current.token)
  );
}

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

export function shouldShowUsernameOnboarding(
  isAuthenticated: boolean,
  identityStatus: ClientIdentityStatus
): boolean {
  return isAuthenticated && identityStatus === 'username_required';
}

export function shouldShowIdentitySync(
  isAuthenticated: boolean,
  identityStatus: ClientIdentityStatus,
  authSyncStatus: 'idle' | 'syncing' | 'ready' | 'failed',
  restoredShellEligible = false
): boolean {
  return (
    isAuthenticated &&
    !restoredShellEligible &&
    authSyncStatus !== 'failed' &&
    (identityStatus === 'unknown' ||
      identityStatus === 'syncing' ||
      authSyncStatus === 'syncing')
  );
}

export function shouldShowIdentityFailure(
  isAuthenticated: boolean,
  identityStatus: ClientIdentityStatus,
  authSyncStatus: 'idle' | 'syncing' | 'ready' | 'failed',
  restoredShellEligible = false
): boolean {
  return (
    isAuthenticated &&
    !restoredShellEligible &&
    (identityStatus === 'failed' || authSyncStatus === 'failed')
  );
}

export interface VerifiedSessionState {
  isAuthenticated: boolean;
  authStatus: 'anonymous' | 'restoring' | 'authenticated' | 'reauthRequired';
  identityStatus: ClientIdentityStatus;
  token?: string | null;
  userId?: string | null;
  authStateVersion: number;
}

export interface VerifiedSessionExpectation {
  userId: string;
  authStateVersion?: number;
}

export function canProcessProtectedAction(
  current: VerifiedSessionState,
  expected: VerifiedSessionExpectation
): boolean {
  return (
    current.isAuthenticated &&
    current.authStatus === 'authenticated' &&
    current.identityStatus === 'complete' &&
    Boolean(current.token) &&
    current.userId === expected.userId &&
    (expected.authStateVersion === undefined ||
      current.authStateVersion === expected.authStateVersion)
  );
}
