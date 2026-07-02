import { useEffect, useRef, useState, useCallback } from 'react';
import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { acceptFriendLink, ApiError } from '../services/api';
import { useChallengeStore } from '../state/useChallengeStore';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import { getSharedCodeActionFromUrl, SharedCodeAction } from '../services/sharedCode';

interface DeepLinkHandlerOptions {
  onChallengeJoined?: () => void;
}

// Handles shared friend invite and challenge links across native and web.
export default function useDeepLinkHandler(options: DeepLinkHandlerOptions = {}) {
  const { onChallengeJoined } = options;
  const { user, isAuthenticated, isInitialized, token, authStatus } = useAuthStore();
  const [pendingAction, setPendingAction] = useState<SharedCodeAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const processingActionKeyRef = useRef<string | null>(null);
  const completedActionKeysRef = useRef<Set<string>>(new Set());
  const promptedAuthActionKeysRef = useRef<Set<string>>(new Set());

  const authFullyReady =
    isInitialized &&
    isAuthenticated &&
    authStatus === 'authenticated' &&
    Boolean(user?.sub) &&
    Boolean(token);

  const getActionKey = useCallback((action: SharedCodeAction) => {
    return `${action.kind}:${action.code}`;
  }, []);

  const queueAction = useCallback((action: SharedCodeAction) => {
    const actionKey = getActionKey(action);
    if (completedActionKeysRef.current.has(actionKey)) return;
    setPendingAction((current) => {
      if (current && getActionKey(current) === actionKey) {
        return current;
      }
      return action;
    });
  }, [getActionKey]);

  const processAction = useCallback(async (action: SharedCodeAction) => {
    if (!authFullyReady || !user?.sub) {
      queueAction(action);
      return;
    }

    const actionKey = getActionKey(action);
    if (
      completedActionKeysRef.current.has(actionKey) ||
      isProcessingRef.current ||
      processingActionKeyRef.current === actionKey
    ) {
      return;
    }

    isProcessingRef.current = true;
    processingActionKeyRef.current = actionKey;
    setIsProcessing(true);
    let shouldMarkCompleted = false;
    try {
      if (action.kind === 'friendInvite') {
        const response = await acceptFriendLink(action.code, user.sub);

        if (response.success) {
          shouldMarkCompleted = true;
          await useLeaderboardStore.getState().invalidateFriends(user.sub);
          const friendName = response.friendDisplayName || response.friendUsername || 'your friend';
          Alert.alert(
            'Friend Added',
            `You and ${friendName} are now connected. Check your friends leaderboard.`,
            [{ text: 'OK' }]
          );
        } else {
          shouldMarkCompleted = true;
          Alert.alert('Could Not Add Friend', response.error || 'Please try again.');
        }
        return;
      }

      if (action.kind === 'challenge') {
        await useChallengeStore.getState().joinChallenge(action.code, user.sub, user.name);
        shouldMarkCompleted = true;
        onChallengeJoined?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process code';
      if (action.kind === 'friendInvite' && error instanceof ApiError) {
        shouldMarkCompleted = [400, 401, 404, 409, 410].includes(error.statusCode);
        Alert.alert('Could Not Add Friend', message);
      } else {
        shouldMarkCompleted = true;
        Alert.alert('Error', message);
      }
    } finally {
      if (shouldMarkCompleted) {
        completedActionKeysRef.current.add(actionKey);
      }
      isProcessingRef.current = false;
      processingActionKeyRef.current = null;
      setIsProcessing(false);
      setPendingAction(null);
    }
  }, [authFullyReady, getActionKey, onChallengeJoined, queueAction, user?.name, user?.sub]);

  const handleUrl = useCallback((url: string) => {
    const action = getSharedCodeActionFromUrl(url);
    if (!action) return;
    const actionKey = getActionKey(action);
    if (completedActionKeysRef.current.has(actionKey)) return;

    if (!authFullyReady) {
      queueAction(action);
      if (
        isInitialized &&
        !isAuthenticated &&
        !promptedAuthActionKeysRef.current.has(actionKey)
      ) {
        promptedAuthActionKeysRef.current.add(actionKey);
        Alert.alert(
          'Sign In Required',
          action.kind === 'friendInvite'
            ? 'Please sign in to add this friend to your leaderboard.'
            : 'Please sign in to join this challenge.',
          [{ text: 'OK' }]
        );
      }
      return;
    }

    processAction(action);
  }, [authFullyReady, getActionKey, isAuthenticated, isInitialized, processAction, queueAction]);

  useEffect(() => {
    if (
      pendingAction &&
      isInitialized &&
      !authFullyReady &&
      authStatus === 'reauthRequired'
    ) {
      const actionKey = getActionKey(pendingAction);
      if (promptedAuthActionKeysRef.current.has(actionKey)) return;
      promptedAuthActionKeysRef.current.add(actionKey);
      Alert.alert(
        'Sign In Required',
        pendingAction.kind === 'friendInvite'
          ? 'Please sign in to add this friend to your leaderboard.'
          : 'Please sign in to join this challenge.',
        [{ text: 'OK' }]
      );
    }
  }, [authFullyReady, authStatus, getActionKey, isInitialized, pendingAction]);

  useEffect(() => {
    const getInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleUrl(url);
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        handleUrl(window.location.href);
      }
    };

    getInitialUrl();
  }, [handleUrl]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [handleUrl]);

  useEffect(() => {
    if (pendingAction && authFullyReady) {
      processAction(pendingAction);
    }
  }, [pendingAction, authFullyReady, processAction]);

  return {
    pendingAction,
    isProcessing,
    clearPendingCode: () => setPendingAction(null),
  };
}
