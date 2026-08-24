import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { retryIdentityActivation } from '../services/authFlow';
import { logError } from '../services/debugLog';
import { theme } from '../theme/theme';

export default function AccountSyncBanner() {
  const [isRetrying, setIsRetrying] = React.useState(false);

  const handleRetry = React.useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await retryIdentityActivation();
    } catch (error) {
      logError('auth.sync_banner.retry.error', error);
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={styles.container}
      >
        <Text style={styles.message}>Account data could not refresh.</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry account refresh"
          disabled={isRetrying}
          onPress={() => void handleRetry()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          {isRetrying ? (
            <ActivityIndicator color={theme.colors.white} size="small" />
          ) : (
            <Text style={styles.buttonText}>Retry</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.neutralDark,
  },
  container: {
    minHeight: 44,
    backgroundColor: theme.colors.neutralDark,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  message: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamBook,
    fontSize: 14,
    flexShrink: 1,
  },
  button: {
    minWidth: 64,
    minHeight: 32,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamBold,
    fontSize: 14,
  },
});
