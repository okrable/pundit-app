import { useCallback, useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { acceptFriendLink, getFriendInvite } from '../services/api';
import { challengeApi } from '../services/challengeApi';
import { useChallengeStore } from '../state/useChallengeStore';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import {
  getSharedCodeActionFromUrl,
  SharedCodeAction,
} from '../services/sharedCode';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';
import type {
  FriendInvitePreviewResponse,
  GetChallengeResponse,
} from '../types';
import {
  clearPendingSharedAction,
  getPendingSharedAction,
  setPendingSharedAction,
} from '../storage/pendingSharedAction';
import { logError, logInfo } from '../services/debugLog';

export type SharedLinkPreview =
  | { kind: 'friendInvite'; data: FriendInvitePreviewResponse }
  | { kind: 'challenge'; data: GetChallengeResponse };

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
  onChallengeJoined?: () => void;
}

function getChallengeUnavailableMessage(preview: GetChallengeResponse, userId: string): string {
  if (preview.creator.userId === userId) return 'You cannot join your own challenge.';
  if (preview.status === 'expired') return 'This challenge has expired.';
  if (preview.status === 'revoked') return 'This challenge was cancelled.';
  if (preview.status === 'completed') return 'This challenge has already finished.';
  if (preview.opponent) return 'Another player has already accepted this challenge.';
  return 'This challenge is no longer available.';
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
  const { onChallengeJoined } = options;
  const { user, isAuthenticated, isInitialized, identityStatus } = useAuthStore();
  const [pendingAction, setPendingActionState] = useState<SharedCodeAction | null>(null);
  const [phase, setPhase] = useState<SharedLinkPhase>('idle');
  const [preview, setPreview] = useState<SharedLinkPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [suspendedForSignIn, setSuspendedForSignIn] = useState(false);
  const actionKeyRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);

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
    const key = `${action.kind}:${action.code}`;
    if (actionKeyRef.current === key && pendingAction) return;
    actionKeyRef.current = key;
    setPreview(null);
    setMessage(null);
    setSuspendedForSignIn(false);
    setPendingActionState(action);
    setPhase('loading');
    await setPendingSharedAction(action);
    logInfo('shared_link.received', { kind: action.kind });
  }, [pendingAction]);

  const handleUrl = useCallback((url: string) => {
    const action = getSharedCodeActionFromUrl(url);
    if (action) void openAction(action);
  }, [openAction]);

  useEffect(() => {
    void getPendingSharedAction().then((stored) => {
      if (stored && !actionKeyRef.current) {
        void openAction({ kind: stored.kind, code: stored.code });
      }
    });
  }, [openAction]);

  useEffect(() => {
    const getInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) handleUrl(url);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        handleUrl(window.location.href);
      }
    };
    void getInitialUrl();
  }, [handleUrl]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => subscription.remove();
  }, [handleUrl]);

  const loadPreview = useCallback(async () => {
    if (!pendingAction || !user?.sub || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setPhase('loading');
    setMessage(null);
    try {
      if (pendingAction.kind === 'friendInvite') {
        const data = await getFriendInvite(pendingAction.code, user.sub);
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
      } else {
        const data = await challengeApi.getChallenge(pendingAction.code);
        setPreview({ kind: 'challenge', data });
        if (data.canJoin && data.creator.userId !== user.sub) {
          setPhase('ready');
        } else {
          setMessage(getChallengeUnavailableMessage(data, user.sub));
          setPhase('unavailable');
        }
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
    if (!canProcessProtectedAction(isAuthenticated, identityStatus) || !user?.sub) {
      if (!suspendedForSignIn) setPhase('sign_in_required');
      return;
    }
    if (suspendedForSignIn) setSuspendedForSignIn(false);
    if (!preview && !isProcessingRef.current) void loadPreview();
  }, [
    identityStatus,
    isAuthenticated,
    isInitialized,
    loadPreview,
    pendingAction,
    preview,
    suspendedForSignIn,
    user?.sub,
  ]);

  const accept = useCallback(async () => {
    if (!pendingAction || !user?.sub || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setPhase('accepting');
    setMessage(null);
    try {
      if (pendingAction.kind === 'friendInvite') {
        const response = await acceptFriendLink(pendingAction.code, user.sub);
        await useLeaderboardStore.getState().invalidateFriends(user.sub);
        setMessage(
          response.alreadyFriends
            ? `You and ${response.friendUsername || 'this player'} are already friends.`
            : `You and ${response.friendUsername || 'this player'} are now friends.`
        );
        setPhase('success');
        await clearPendingSharedAction();
      } else {
        await useChallengeStore.getState().joinChallenge(pendingAction.code, user.sub);
        await clearAction();
        onChallengeJoined?.();
      }
      logInfo('shared_link.accepted', { kind: pendingAction.kind });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to accept this invitation.');
      setPhase('error');
      logError('shared_link.accept_failed', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [clearAction, onChallengeJoined, pendingAction, user?.sub]);

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
