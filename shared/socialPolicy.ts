export function normalizeSocialCode(code: string): string {
  return code.trim().toUpperCase();
}

export function orderFriendshipPair(userId: string, friendId: string): [string, string] {
  return userId < friendId ? [userId, friendId] : [friendId, userId];
}

export function canReuseFriendLink(input: {
  isReusable: boolean;
  expiresAt: string | Date;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  return input.isReusable && new Date(input.expiresAt).getTime() > now.getTime();
}

export type FriendLinkAcceptanceDecision =
  | 'expired'
  | 'self'
  | 'already_friends'
  | 'used_legacy'
  | 'create_friendship';

export function decideFriendLinkAcceptance(input: {
  isExpired: boolean;
  isSelf: boolean;
  alreadyFriends: boolean;
  isReusable: boolean;
  usedBy: string | null;
}): FriendLinkAcceptanceDecision {
  if (input.isExpired) return 'expired';
  if (input.isSelf) return 'self';
  if (input.alreadyFriends) return 'already_friends';
  if (!input.isReusable && input.usedBy) return 'used_legacy';
  return 'create_friendship';
}

export type FriendInvitePreviewDecision =
  | 'available'
  | 'already_friends'
  | 'self'
  | 'expired'
  | 'used'
  | 'inviter_unavailable';

export function decideFriendInvitePreview(input: {
  isExpired: boolean;
  isSelf: boolean;
  inviterAvailable: boolean;
  alreadyFriends: boolean;
  isReusable: boolean;
  usedBy: string | null;
}): FriendInvitePreviewDecision {
  if (input.isExpired) return 'expired';
  if (input.isSelf) return 'self';
  if (!input.inviterAvailable) return 'inviter_unavailable';
  if (input.alreadyFriends) return 'already_friends';
  if (!input.isReusable && input.usedBy) return 'used';
  return 'available';
}
