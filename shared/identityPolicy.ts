export type IdentityProvisioningAction =
  | 'use_existing'
  | 'require_username'
  | 'generate_username';

export function chooseIdentityProvisioningAction({
  hasUserRow,
  hasUsername,
  onboardingStatus,
  intent,
}: {
  hasUserRow: boolean;
  hasUsername: boolean;
  onboardingStatus?: 'username_required' | 'complete';
  intent: 'signup' | 'login' | 'restore';
}): IdentityProvisioningAction {
  if (hasUsername) return 'use_existing';
  if (hasUserRow && onboardingStatus === 'username_required') {
    return 'require_username';
  }
  if (!hasUserRow) {
    return 'require_username';
  }
  return 'generate_username';
}

export type UsernameAssignmentAction = 'assign' | 'idempotent' | 'immutable';

export function chooseUsernameAssignmentAction({
  currentUsername,
  requestedUsername,
  onboardingStatus,
}: {
  currentUsername: string | null;
  requestedUsername: string;
  onboardingStatus: 'username_required' | 'complete';
}): UsernameAssignmentAction {
  if (currentUsername?.toLowerCase() === requestedUsername.toLowerCase()) {
    return 'idempotent';
  }

  if (currentUsername || onboardingStatus === 'complete') {
    return 'immutable';
  }

  return 'assign';
}
