import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  logoutWithAuth0,
  retryIdentityActivation,
} from '../services/authFlow';
import { useAuthStore } from '../state/useAuthStore';
import { theme } from '../theme/theme';

export default function AuthSyncFailureScreen() {
  const { identityError, authSyncError } = useAuthStore();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      await retryIdentityActivation();
    } catch (error) {
      setRetryError(
        error instanceof Error
          ? error.message
          : 'Unable to synchronize your account'
      );
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSignOut = async () => {
    if (isRetrying) return;
    await logoutWithAuth0();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo/white/pundit-white.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>We couldn't finish signing you in</Text>
        <Text style={styles.subtitle}>
          Your account is safe. Try the connection again or sign out and start over.
        </Text>
        {(retryError || identityError || authSyncError) && (
          <Text style={styles.error}>
            {retryError || identityError || authSyncError}
          </Text>
        )}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator color={theme.colors.accent} />
          ) : (
            <Text style={styles.primaryButtonText}>Try again</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          disabled={isRetrying}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  logo: {
    width: 210,
    height: 74,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontFamily: theme.fonts.gothamBlack,
    fontSize: 24,
    lineHeight: 30,
    color: theme.colors.background,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.gothamBook,
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.background,
    textAlign: 'center',
    opacity: 0.9,
  },
  error: {
    marginTop: theme.spacing.md,
    fontFamily: theme.fonts.gothamBook,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.background,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    minWidth: 160,
    marginTop: theme.spacing.xl,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  primaryButtonText: {
    fontFamily: theme.fonts.gothamBold,
    fontSize: 16,
    color: theme.colors.accent,
  },
  signOutButton: {
    minHeight: 44,
    marginTop: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  signOutText: {
    fontFamily: theme.fonts.gothamBold,
    fontSize: 14,
    color: theme.colors.background,
    textDecorationLine: 'underline',
  },
});
