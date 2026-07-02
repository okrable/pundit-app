import { useEffect, useRef, useState, useCallback } from 'react';
import * as Linking from 'expo-linking';
import { Alert, Platform } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { acceptFriendLink } from '../services/api';
import { useChallengeStore } from '../state/useChallengeStore';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import { getSharedCodeActionFromUrl, SharedCodeAction } from '../services/sharedCode';

interface DeepLinkHandlerOptions {
  onChallengeJoined?: () => void;
}

// Handles shared friend invite and challenge links across native and web.
export default function useDeepLinkHandler(options: DeepLinkHandlerOptions = {}) {
  const { onChallengeJoined } = options;
  const { user, isAuthenticated, isInitialized } = useAuthStore();
  const [pendingAction, setPendingAction] = useState<SharedCodeAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);

  const processAction = useCallback(async (action: SharedCodeAction) => {
    if (!user?.sub || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    try {
      if (action.kind === 'friendInvite') {
        const response = await acceptFriendLink(action.code, user.sub);

        if (response.success) {
          await useLeaderboardStore.getState().invalidateFriends(user.sub);
          const friendName = response.friendDisplayName || response.friendUsername || 'your friend';
          Alert.alert(
            'Friend Added',
            `You and ${friendName} are now connected. Check your friends leaderboard.`,
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Could Not Add Friend', response.error || 'Please try again.');
        }
        return;
      }

      if (action.kind === 'challenge') {
        await useChallengeStore.getState().joinChallenge(action.code, user.sub, user.name);
        onChallengeJoined?.();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process code';
      Alert.alert('Error', message);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setPendingAction(null);
    }
  }, [onChallengeJoined, user?.name, user?.sub]);

  const handleUrl = useCallback((url: string) => {
    const action = getSharedCodeActionFromUrl(url);
    if (!action) return;

    if (!isInitialized) {
      setPendingAction(action);
      return;
    }

    if (!isAuthenticated) {
      setPendingAction(action);
      Alert.alert(
        'Sign In Required',
        action.kind === 'friendInvite'
          ? 'Please sign in to add this friend to your leaderboard.'
          : 'Please sign in to join this challenge.',
        [{ text: 'OK' }]
      );
      return;
    }

    processAction(action);
  }, [isInitialized, isAuthenticated, processAction]);

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
    if (pendingAction && isAuthenticated && isInitialized && user?.sub) {
      processAction(pendingAction);
    }
  }, [pendingAction, isAuthenticated, isInitialized, user?.sub, processAction]);

  return {
    pendingAction,
    isProcessing,
    clearPendingCode: () => setPendingAction(null),
  };
}
