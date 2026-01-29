import { useEffect, useState, useCallback } from 'react';
import * as Linking from 'expo-linking';
import { Alert } from 'react-native';
import { useAuthStore } from '../state/useAuthStore';
import { acceptFriendLink } from '../services/api';

// Hook to handle deep links for friend invites
// Listens for pundit-app://add-friend/{code} links

export default function useDeepLinkHandler() {
  const { user, isAuthenticated, isInitialized } = useAuthStore();
  const [pendingFriendCode, setPendingFriendCode] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFriendCode = useCallback(async (code: string) => {
    if (!user?.sub || isProcessing) return;

    setIsProcessing(true);
    try {
      const response = await acceptFriendLink(code, user.sub);

      if (response.success) {
        const friendName = response.friendDisplayName || response.friendUsername || 'your friend';
        Alert.alert(
          'Friend Added!',
          `You and ${friendName} are now connected. Check your friends leaderboard!`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Could Not Add Friend', response.error || 'Please try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add friend';
      Alert.alert('Error', message);
    } finally {
      setIsProcessing(false);
      setPendingFriendCode(null);
    }
  }, [user?.sub, isProcessing]);

  const handleUrl = useCallback((url: string) => {
    // Parse the URL to extract the friend code
    // Expected format: pundit-app://add-friend/{code}
    const parsed = Linking.parse(url);

    if (parsed.hostname === 'add-friend' || parsed.path?.startsWith('add-friend')) {
      // Extract code from path
      let code: string | null = null;

      if (parsed.path) {
        const pathParts = parsed.path.split('/');
        // Handle both 'add-friend/CODE' and 'add-friend' with code as last part
        code = pathParts[pathParts.length - 1];
        if (code === 'add-friend') {
          code = null;
        }
      }

      // Also check query params as fallback
      if (!code && parsed.queryParams?.code) {
        code = parsed.queryParams.code as string;
      }

      if (!code) return;

      // If not initialized yet, store for later
      if (!isInitialized) {
        setPendingFriendCode(code);
        return;
      }

      // If not authenticated, store code and show alert
      if (!isAuthenticated) {
        setPendingFriendCode(code);
        Alert.alert(
          'Sign In Required',
          'Please sign in to add this friend to your leaderboard.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Process the code immediately
      processFriendCode(code);
    }
  }, [isInitialized, isAuthenticated, processFriendCode]);

  // Handle initial URL when app opens
  useEffect(() => {
    const getInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleUrl(url);
      }
    };

    getInitialUrl();
  }, [handleUrl]);

  // Listen for URL events while app is open
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [handleUrl]);

  // Process pending code when auth state changes
  useEffect(() => {
    if (pendingFriendCode && isAuthenticated && isInitialized && user?.sub) {
      processFriendCode(pendingFriendCode);
    }
  }, [pendingFriendCode, isAuthenticated, isInitialized, user?.sub, processFriendCode]);

  return {
    pendingFriendCode,
    isProcessing,
    clearPendingCode: () => setPendingFriendCode(null),
  };
}
