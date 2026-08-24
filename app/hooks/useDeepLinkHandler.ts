import { useCallback, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { acceptFriendLink, getFriendInvite } from '../services/api';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import { useSocialStore } from '../state/useSocialStore';
import {
  getSharedCodeActionFromUrl,
  getWebSharedCodeUrlReplacement,
  SharedCodeAction,
} from '../services/sharedCode';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';
import type { FriendInvitePreviewResponse } from '../types';
import {
  clearPendingSharedAction,
  getPendingSharedAction,
  setPendingSharedAction,
} from '../storage/pendingSharedAction';
import { logError, logInfo } from '../services/debugLog';

export type SharedLinkPreview = {
  kind: 'friendInvite';
  data: FriendInvitePreviewResponse;
};

export type SharedLinkPhase =
  | 'idle'
  | 'sign_in_required'
  | 'loading'
  | 'ready'
  | 'accepting'
  | 'success'
  | 'unavailable'
  | 'error';

interface DeepLinkHandlerOptions {
  onChallengeUnavailable?: () => void;
}

function getFriendUnavailableMessage(preview: FriendInvitePreviewResponse): string {
  switch (preview.state) {
    case 'self':
      return 'You cannot add yourself as a friend.';
    case 'expired':
      return 'This friend invite has expired. Ask for a new link.';
    case 'used':
      return 'This older invite link has already been used.';
    case 'inviter_unavailable':
      return 'The inviting player must finish setting up their profile first.';
    default:
      return 'This friend invite is no longer available.';
  }
}

export default function useDeepLinkHandler(options: DeepLinkHandlerOptions = {}) {
  const { onChallengeUnavailable } = options;
  const {
    user,
    token,
    isAuthenticated,
    isInitialized,
    authStatus,
    identityStatus,
    authStateVersion,
  } = useAuthStore();
  const [pendingAction, setPendingActionState] = useState<SharedCodeAction | null>(null);
  const [phase, setPhase] = useState<SharedLinkPhase>('idle');
  const [preview, setPreview] = useState<SharedLinkPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [suspendedForSignIn, setSuspendedForSignIn] = useState(false);
  const actionKeyRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const hasHydratedInitialActionRef = useRef(false);

  const clearAction = useCallback(async () => {
    actionKeyRef.current = null;
    setPendingActionState(null);
    setPreview(null);
    setMessage(null);
    setPhase('idle');
    setSuspendedForSignIn(false);
    await clearPendingSharedAction();
  }, []);

  const openAction = useCallback(async (action: SharedCodeAction) => {
    if (action.kind === 'invalid') return;
    if (action.kind === 'challenge') {
      actionKeyRef.current = null;
      setPendingActionState(null);
      setPreview(null);
      setMessage(null);
      setPhase('idle');
      setSuspendedForSignIn(false);
      await clearPendingSharedAction();
      logInfo('shared_link.challenge_retired');
      onChallengeUnavailable?.();
      return;
    }
    const key = `${action.kind}:${action.code}`;
    if (actionKeyRef.current === key) return;
    actionKeyRef.current = key;
    setPreview(null);
    setMessage(null);
    setSuspendedForSignIn(false);
    setPendingActionState(action);
    setPhase('loading');
    await setPendingSharedAction(action);
    logInfo('shared_link.received', { kind: action.kind });
  }, [onChallengeUnavailable]);

  const handleUrl = useCallback(async (url: string) => {
    const action = getSharedCodeActionFromUrl(url);
    if (!action) return;

    await openAction(action);

    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const currentAction = getSharedCodeActionFromUrl(window.location.href);
    if (
      currentAction?.kind !== action.kind ||
      currentAction.code !== action.code
    ) {
      return;
    }
    const replacement = getWebSharedCodeUrlReplacement(window.location.href);
    if (replacement) {
      window.history.replaceState(window.history.state, '', replacement);
    }
  }, [openAction]);

  useEffect(() => {
    if (hasHydratedInitialActionRef.current) return;
    hasHydratedInitialActionRef.current = true;
    let isActive = true;

    const hydrateInitialAction = async () => {
      const initialUrl =
        Platform.OS === 'web' && typeof window !== 'undefined'
          ? window.location.href
          : await Linking.getInitialURL();
      if (!isActive) return;

      if (initialUrl && getSharedCodeActionFromUrl(initialUrl)) {
        await handleUrl(initialUrl);
        return;
      }

      const stored = await getPendingSharedAction();
      if (isActive && stored && !actionKeyRef.current) {
        await openAction({ kind: stored.kind, code: stored.code });
      }
    };

    void hydrateInitialAction();
    return () => {
      isActive = false;
    };
  }, [handleUrl, openAction]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });
    return () => subscription.remove();
  }, [handleUrl]);

  const loadPreview = useCallback(async () => {
    if (
      !pendingAction ||
      pendingAction.kind !== 'friendInvite' ||
      !user?.sub ||
      isProcessingRef.current
    ) return;
    const expectedAuthStateVersion = useAuthStore.getState().authStateVersion;
    const startedAuthState = useAuthStore.getState();
    if (
      !canProcessProtectedAction(
        {
          isAuthenticated: startedAuthState.isAuthenticated,
          authStatus: startedAuthState.authStatus,
          identityStatus: startedAuthState.identityStatus,
          token: startedAuthState.token,
          userId: startedAuthState.user?.sub,
          authStateVersion: startedAuthState.authStateVersion,
        },
        { userId: user.sub, authStateVersion: expectedAuthStateVersion }
      )
    ) return;
    isProcessingRef.current = true;
    setPhase('loading');
    setMessage(null);
    try {
      const data = await getFriendInvite(pendingAction.code, user.sub);
      const latestAuthState = useAuthStore.getState();
      if (
        !canProcessProtectedAction(
          {
            isAuthenticated: latestAuthState.isAuthenticated,
            authStatus: latestAuthState.authStatus,
            identityStatus: latestAuthState.identityStatus,
            token: latestAuthState.token,
            userId: latestAuthState.user?.sub,
            authStateVersion: latestAuthState.authStateVersion,
          },
          { userId: user.sub, authStateVersion: expectedAuthStateVersion }
        )
      ) return;
      setPreview({ kind: 'friendInvite', data });
      if (data.state === 'already_friends') {
        setMessage(`You and ${data.inviter?.username || 'this player'} are already friends.`);
        setPhase('success');
        await clearPendingSharedAction();
      } else if (data.canAccept) {
        setPhase('ready');
      } else {
        setMessage(getFriendUnavailableMessage(data));
        setPhase('unavailable');
      }
      logInfo('shared_link.previewed', { kind: pendingAction.kind });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load this invitation.');
      setPhase('error');
      logError('shared_link.preview_failed', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [pendingAction, user?.sub]);

  useEffect(() => {
    if (!pendingAction || !isInitialized) return;
    if (
      !user?.sub ||
      !canProcessProtectedAction(
        {
          isAuthenticated,
          authStatus,
          identityStatus,
          token,
          userId: user.sub,
          authStateVersion,
        },
        { userId: user.sub, authStateVersion }
      )
    ) {
      if (
        !suspendedForSignIn &&
        (!isAuthenticated || authStatus === 'anonymous' || authStatus === 'reauthRequired')
      ) {
        setPhase('sign_in_required');
      }
      return;
    }
    if (suspendedForSignIn) setSuspendedForSignIn(false);
    if (!preview && !isProcessingRef.current) void loadPreview();
  }, [
    authStateVersion,
    authStatus,
    identityStatus,
    isAuthenticated,
    isInitialized,
    loadPreview,
    pendingAction,
    preview,
    suspendedForSignIn,
    token,
    user?.sub,
  ]);

  const accept = useCallback(async () => {
    if (
      !pendingAction ||
      pendingAction.kind !== 'friendInvite' ||
      !user?.sub ||
      isProcessingRef.current
    ) return;
    const expectedAuthStateVersion = authStateVersion;
    if (
      !canProcessProtectedAction(
        {
          isAuthenticated,
          authStatus,
          identityStatus,
          token,
          userId: user.sub,
          authStateVersion,
        },
        { userId: user.sub, authStateVersion: expectedAuthStateVersion }
      )
    ) return;
    isProcessingRef.current = true;
    setPhase('accepting');
    setMessage(null);
    try {
      const response = await acceptFriendLink(pendingAction.code, user.sub);
      const latestAuthState = useAuthStore.getState();
      if (
        !canProcessProtectedAction(
          {
            isAuthenticated: latestAuthState.isAuthenticated,
            authStatus: latestAuthState.authStatus,
            identityStatus: latestAuthState.identityStatus,
            token: latestAuthState.token,
            userId: latestAuthState.user?.sub,
            authStateVersion: latestAuthState.authStateVersion,
          },
          { userId: user.sub, authStateVersion: expectedAuthStateVersion }
        )
      ) return;
      await useLeaderboardStore.getState().invalidateFriends(user.sub);
      await useSocialStore.getState().refresh(user.sub);
      setMessage(
        response.alreadyFriends
          ? `You and ${response.friendUsername || 'this player'} are already friends.`
          : `You and ${response.friendUsername || 'this player'} are now friends.`
      );
      setPhase('success');
      await clearPendingSharedAction();
      logInfo('shared_link.accepted', { kind: pendingAction.kind });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to accept this invitation.');
      setPhase('error');
      logError('shared_link.accept_failed', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [authStateVersion, authStatus, identityStatus, isAuthenticated, pendingAction, token, user?.sub]);

  const retry = useCallback(() => {
    setPreview(null);
    void loadPreview();
  }, [loadPreview]);

  const deferForSignIn = useCallback(() => {
    setSuspendedForSignIn(true);
    logInfo('shared_link.sign_in_requested', { kind: pendingAction?.kind });
  }, [pendingAction?.kind]);

  return {
    pendingAction,
    phase,
    preview,
    message,
    visible: Boolean(pendingAction) && !suspendedForSignIn,
    openAction,
    accept,
    retry,
    dismiss: clearAction,
    deferForSignIn,
  };
}
