import { create } from 'zustand';
import type {
  Friend,
  FriendRelationshipResponse,
  FriendRequestSummary,
} from '../types';
import {
  cancelFriendRequest,
  getFriendRequests,
  getFriends,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '../services/api';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';
import { useAuthStore } from './useAuthStore';
import { useLeaderboardStore } from './useLeaderboardStore';
import { trackAnalyticsEvent } from '../services/analytics';

interface SocialState {
  ownerId: string | null;
  friends: Friend[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
  loading: boolean;
  error: string | null;
  refresh: (userId: string) => Promise<void>;
  sendRequest: (userId: string, playerId: string) => Promise<FriendRelationshipResponse>;
  respondRequest: (
    userId: string,
    playerId: string,
    action: 'accept' | 'decline'
  ) => Promise<FriendRelationshipResponse>;
  cancelRequest: (userId: string, playerId: string) => Promise<FriendRelationshipResponse>;
  remove: (userId: string, playerId: string) => Promise<void>;
  reset: () => void;
}

function verified(userId: string, version: number): boolean {
  const auth = useAuthStore.getState();
  return canProcessProtectedAction(
    {
      isAuthenticated: auth.isAuthenticated,
      authStatus: auth.authStatus,
      identityStatus: auth.identityStatus,
      token: auth.token,
      userId: auth.user?.sub,
      authStateVersion: auth.authStateVersion,
    },
    { userId, authStateVersion: version }
  );
}

export const useSocialStore = create<SocialState>((set, get) => ({
  ownerId: null,
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  error: null,

  refresh: async (userId) => {
    const version = useAuthStore.getState().authStateVersion;
    if (!verified(userId, version)) return;
    if (get().ownerId !== userId) {
      set({ ownerId: userId, friends: [], incoming: [], outgoing: [] });
    }
    set({ loading: true, error: null });
    try {
      const [friends, requests] = await Promise.all([
        getFriends(userId),
        getFriendRequests(userId),
      ]);
      if (!verified(userId, version)) return;
      set({
        ownerId: userId,
        friends: friends.friends,
        incoming: requests.incoming,
        outgoing: requests.outgoing,
        loading: false,
      });
    } catch (error) {
      if (!verified(userId, version)) return;
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to refresh friends',
      });
    }
  },

  sendRequest: async (userId, playerId) => {
    const version = useAuthStore.getState().authStateVersion;
    if (!verified(userId, version)) throw new Error('Your account is still syncing.');
    const response = await sendFriendRequest(userId, playerId);
    if (!verified(userId, version)) throw new Error('Account changed before the request completed.');
    if (response.relationship === 'outgoing_pending' && !response.alreadyRequested) {
      trackAnalyticsEvent('friend_request_sent', 'authenticated');
    }
    if (response.relationship === 'friends') {
      if (response.reciprocalAccepted) {
        trackAnalyticsEvent('friend_request_accepted', 'authenticated');
      }
      await useLeaderboardStore.getState().invalidateFriends(userId);
    }
    await get().refresh(userId);
    return response;
  },

  respondRequest: async (userId, playerId, action) => {
    const version = useAuthStore.getState().authStateVersion;
    if (!verified(userId, version)) throw new Error('Your account is still syncing.');
    const response = await respondFriendRequest(userId, playerId, action);
    if (!verified(userId, version)) throw new Error('Account changed before the request completed.');
    if (action === 'accept' && response.relationship === 'friends') {
      trackAnalyticsEvent('friend_request_accepted', 'authenticated');
      await useLeaderboardStore.getState().invalidateFriends(userId);
    }
    await get().refresh(userId);
    return response;
  },

  cancelRequest: async (userId, playerId) => {
    const version = useAuthStore.getState().authStateVersion;
    if (!verified(userId, version)) throw new Error('Your account is still syncing.');
    const response = await cancelFriendRequest(userId, playerId);
    if (!verified(userId, version)) throw new Error('Account changed before the request completed.');
    await get().refresh(userId);
    return response;
  },

  remove: async (userId, playerId) => {
    const version = useAuthStore.getState().authStateVersion;
    if (!verified(userId, version)) throw new Error('Your account is still syncing.');
    await removeFriend(userId, playerId);
    if (!verified(userId, version)) throw new Error('Account changed before removal completed.');
    await useLeaderboardStore.getState().invalidateFriends(userId);
    await get().refresh(userId);
  },

  reset: () => set({
    ownerId: null,
    friends: [],
    incoming: [],
    outgoing: [],
    loading: false,
    error: null,
  }),
}));
