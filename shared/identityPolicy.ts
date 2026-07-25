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
  if (!hasUserRow && intent === 'signup') {
    return 'require_username';
  }
  return 'generate_username';
}
