import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkUsername } from '../services/api';
import {
  completeUsernameOnboarding,
  logoutWithAuth0,
  retryIdentityActivation,
} from '../services/authFlow';
import { trackAnalyticsEvent } from '../services/analytics';
import { useAuthStore } from '../state/useAuthStore';
import { theme } from '../theme/theme';

const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

export default function UsernameOnboardingScreen() {
  const { identityStatus, identityError, authSyncError } = useAuthStore();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (identityStatus === 'username_required') {
      trackAnalyticsEvent('username_onboarding_shown', 'authenticated');
    }
  }, [identityStatus]);

  const validateFormat = useCallback((value: string): string | null => {
    if (value.length < MIN_LENGTH) return `At least ${MIN_LENGTH} characters`;
    if (value.length > MAX_LENGTH) return `At most ${MAX_LENGTH} characters`;
    if (!USERNAME_REGEX.test(value)) {
      if (value.startsWith('_') || value.endsWith('_')) {
        return "Can't start or end with underscore";
      }
      return 'Only lowercase letters, numbers, and underscores';
    }
    return null;
  }, []);

  useEffect(() => {
    if (identityStatus !== 'username_required') return;

    const formatError = validateFormat(input);
    if (formatError) {
      setIsAvailable(null);
      setError(input.length > 0 ? formatError : null);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    setError(null);
    let isCurrent = true;
    const timer = setTimeout(async () => {
      try {
        const result = await checkUsername(input);
        if (isCurrent) {
          setIsAvailable(result.available);
          setError(result.available ? null : result.error || 'Username is already taken');
        }
      } catch {
        if (isCurrent) {
          setIsAvailable(null);
          setError('Unable to check availability. Please try again.');
        }
      } finally {
        if (isCurrent) {
          setIsChecking(false);
        }
      }
    }, 500);

    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [identityStatus, input, validateFormat]);

  const handleSubmit = async () => {
    if (!isAvailable || isChecking || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await completeUsernameOnboarding(input);
      if (!result.success) {
        setError(result.error || 'Unable to set your username');
        if (result.code !== 'USERNAME_IMMUTABLE') {
          setIsAvailable(null);
        }
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to set your username. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    try {
      await retryIdentityActivation();
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : 'Unable to synchronize your account'
      );
    } finally {
      setIsRetrying(false);
    }
  };

  const handleSignOut = async () => {
    if (isSubmitting || isRetrying) return;
    await logoutWithAuth0();
  };

  const handleInputChange = (value: string) => {
    setInput(value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    setIsAvailable(null);
  };

  const showUsernameForm = identityStatus === 'username_required';
  const showLoading = identityStatus === 'syncing';
  const canSubmit = Boolean(isAvailable && !isChecking && !isSubmitting);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.icon}>
            <Ionicons name="person-circle-outline" size={58} color={theme.colors.accent} />
          </View>
          <Text style={styles.title}>
            {showUsernameForm ? 'Choose your username' : 'Finish setting up your account'}
          </Text>
          <Text style={styles.subtitle}>
            {showUsernameForm
              ? 'This is how every player will know you. Usernames are permanent.'
              : 'We need to verify your player identity before you continue.'}
          </Text>

          {showUsernameForm ? (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.prefix}>@</Text>
                <TextInput
                  style={styles.input}
                  value={input}
                  onChangeText={handleInputChange}
                  placeholder="username"
                  placeholderTextColor={theme.colors.mediumGray}
                  maxLength={MAX_LENGTH}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {isChecking && <ActivityIndicator size="small" color={theme.colors.mediumGray} />}
                {!isChecking && isAvailable === true && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.correct} />
                )}
              </View>
              <View style={styles.inputMeta}>
                <Text style={error ? styles.error : styles.helper}>
                  {error || 'Lowercase letters, numbers, and underscores'}
                </Text>
                <Text style={styles.count}>{input.length}/{MAX_LENGTH}</Text>
              </View>
              <TouchableOpacity
                style={[styles.primaryButton, !canSubmit && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {isSubmitting ? (
                  <ActivityIndicator color={theme.colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {showLoading ? (
                <ActivityIndicator size="large" color={theme.colors.accent} />
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleRetry}
                  disabled={isRetrying}
                >
                  {isRetrying ? (
                    <ActivityIndicator color={theme.colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Try Again</Text>
                  )}
                </TouchableOpacity>
              )}
              {(error || identityError || authSyncError) && (
                <Text style={styles.centeredError}>
                  {error || identityError || authSyncError}
                </Text>
              )}
            </>
          )}

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            disabled={isSubmitting || isRetrying}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'stretch',
  },
  icon: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: theme.fonts.gothamBlack,
    fontSize: 26,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: theme.fonts.gothamBook,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.neutralDark,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  prefix: {
    fontFamily: theme.fonts.gothamMedium,
    fontSize: 18,
    color: theme.colors.mediumGray,
  },
  input: {
    flex: 1,
    fontFamily: theme.fonts.gothamMedium,
    fontSize: 18,
    color: theme.colors.textDark,
    paddingVertical: theme.spacing.md,
  },
  inputMeta: {
    minHeight: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.xs,
  },
  helper: {
    flex: 1,
    fontFamily: theme.fonts.gothamBook,
    fontSize: 12,
    color: theme.colors.mediumGray,
  },
  error: {
    flex: 1,
    fontFamily: theme.fonts.gothamBook,
    fontSize: 12,
    color: theme.colors.incorrect,
  },
  count: {
    fontFamily: theme.fonts.gothamBook,
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginLeft: theme.spacing.sm,
  },
  centeredError: {
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.incorrect,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    fontFamily: theme.fonts.gothamBold,
    fontSize: 16,
    color: theme.colors.white,
  },
  signOutButton: {
    alignSelf: 'center',
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  signOutText: {
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.neutralDark,
    textDecorationLine: 'underline',
  },
});
