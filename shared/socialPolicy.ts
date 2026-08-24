export function normalizeSocialCode(code: string): string {
  return code.trim().toUpperCase();
}

export function orderFriendshipPair(userId: string, friendId: string): [string, string] {
  return userId < friendId ? [userId, friendId] : [friendId, userId];
}

export type FriendRelationshipState =
  | 'guest'
  | 'self'
  | 'none'
  | 'outgoing_pending'
  | 'incoming_pending'
  | 'friends';

export type SendFriendRequestDecision =
  | 'self'
  | 'already_friends'
  | 'create_request'
  | 'already_requested'
  | 'accept_reciprocal';

export function decideSendFriendRequest(input: {
  senderId: string;
  recipientId: string;
  alreadyFriends: boolean;
  pendingSenderId: string | null;
}): SendFriendRequestDecision {
  if (input.senderId === input.recipientId) return 'self';
  if (input.alreadyFriends) return 'already_friends';
  if (!input.pendingSenderId) return 'create_request';
  return input.pendingSenderId === input.senderId
    ? 'already_requested'
    : 'accept_reciprocal';
}

export function getFriendRelationshipState(input: {
  viewerId?: string | null;
  playerId: string;
  alreadyFriends: boolean;
  pendingSenderId: string | null;
}): FriendRelationshipState {
  if (!input.viewerId) return 'guest';
  if (input.viewerId === input.playerId) return 'self';
  if (input.alreadyFriends) return 'friends';
  if (!input.pendingSenderId) return 'none';
  return input.pendingSenderId === input.viewerId
    ? 'outgoing_pending'
    : 'incoming_pending';
}

export type FriendRequestResponseDecision =
  | 'already_friends'
  | 'already_handled'
  | 'forbidden'
  | 'accept'
  | 'decline';

export function decideFriendRequestResponse(input: {
  responderId: string;
  pendingSenderId: string | null;
  alreadyFriends: boolean;
  action: 'accept' | 'decline';
}): FriendRequestResponseDecision {
  if (input.alreadyFriends) return 'already_friends';
  if (!input.pendingSenderId) return 'already_handled';
  if (input.pendingSenderId === input.responderId) return 'forbidden';
  return input.action;
}

export type CancelFriendRequestDecision = 'already_handled' | 'forbidden' | 'cancel';

export function decideCancelFriendRequest(input: {
  senderId: string;
  pendingSenderId: string | null;
}): CancelFriendRequestDecision {
  if (!input.pendingSenderId) return 'already_handled';
  return input.pendingSenderId === input.senderId ? 'cancel' : 'forbidden';
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
