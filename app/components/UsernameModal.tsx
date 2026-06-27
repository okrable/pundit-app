import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { checkUsername, setUsername } from '../services/api';
import { useAuthStore } from '../state/useAuthStore';

interface UsernameModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (username: string) => void;
  currentUsername?: string | null;
  isRequired?: boolean; // If true, modal cannot be dismissed without setting username
}

const USERNAME_REGEX = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

export default function UsernameModal({
  visible,
  onClose,
  onSuccess,
  currentUsername,
  isRequired = false,
}: UsernameModalProps) {
  const { user } = useAuthStore();
  const [input, setInput] = useState(currentUsername || '');
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedDevelopmentTerms, setAcceptedDevelopmentTerms] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setInput(currentUsername || '');
      setError(null);
      setIsAvailable(null);
      setIsChecking(false);
      setIsSubmitting(false);
      setAcceptedDevelopmentTerms(false);
    }
  }, [visible, currentUsername]);

  // Validate format locally
  const validateFormat = useCallback((value: string): string | null => {
    const normalized = value.toLowerCase().trim();

    if (normalized.length < MIN_LENGTH) {
      return `At least ${MIN_LENGTH} characters`;
    }
    if (normalized.length > MAX_LENGTH) {
      return `At most ${MAX_LENGTH} characters`;
    }
    if (!USERNAME_REGEX.test(normalized)) {
      if (normalized.startsWith('_') || normalized.endsWith('_')) {
        return "Can't start or end with underscore";
      }
      return 'Only lowercase letters, numbers, underscores';
    }
    return null;
  }, []);

  // Debounced availability check
  useEffect(() => {
    const normalized = input.toLowerCase().trim();

    // Skip if too short or same as current
    if (normalized.length < MIN_LENGTH) {
      setIsAvailable(null);
      setError(null);
      return;
    }

    // Skip if same as current username
    if (currentUsername && normalized === currentUsername.toLowerCase()) {
      setIsAvailable(true);
      setError(null);
      return;
    }

    // Validate format first
    const formatError = validateFormat(input);
    if (formatError) {
      setIsAvailable(null);
      setError(formatError);
      return;
    }

    setIsChecking(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const result = await checkUsername(normalized);
        setIsAvailable(result.available);
        if (!result.available && result.error) {
          setError(result.error);
        } else {
          setError(null);
        }
      } catch (err) {
        setError('Unable to check availability');
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [input, currentUsername, validateFormat]);

  const handleInputChange = (text: string) => {
    // Convert to lowercase and remove invalid characters
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setInput(cleaned);
  };

  const handleSubmit = async () => {
    if (!user?.sub || !isAvailable || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await setUsername(user.sub, input);
      if (result.success && result.username) {
        onSuccess(result.username);
      } else {
        setError(result.error || 'Failed to set username');
      }
    } catch (err) {
      setError('Failed to set username');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isRequired) {
      onClose();
    }
  };

  const isCreatingUsername = !currentUsername;
  const canSubmit =
    isAvailable &&
    !isChecking &&
    !isSubmitting &&
    input.length >= MIN_LENGTH &&
    (!isCreatingUsername || acceptedDevelopmentTerms);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            {!isRequired && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>
              {isRequired ? 'Welcome to Pundit' : 'Choose a Username'}
            </Text>
            <Text style={styles.subtitle}>
              Choose your permanent username to finish setting up your account.
            </Text>

            {/* Input Section */}
            <View style={styles.inputSection}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputPrefix}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="username"
                  placeholderTextColor={theme.colors.mediumGray}
                  value={input}
                  onChangeText={handleInputChange}
                  maxLength={MAX_LENGTH}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {isChecking && (
                  <ActivityIndicator size="small" color={theme.colors.mediumGray} />
                )}
                {!isChecking && isAvailable === true && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.correct} />
                )}
                {!isChecking && isAvailable === false && (
                  <Ionicons name="close-circle" size={24} color={theme.colors.incorrect} />
                )}
              </View>

              <View style={styles.inputMeta}>
                {error ? (
                  <Text style={styles.errorText}>{error}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    Letters, numbers, underscores
                  </Text>
                )}
                <Text style={styles.charCount}>
                  {input.length}/{MAX_LENGTH}
                </Text>
              </View>
            </View>

            {isCreatingUsername && (
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setAcceptedDevelopmentTerms((accepted) => !accepted)}
                activeOpacity={0.82}
              >
                <Ionicons
                  name={acceptedDevelopmentTerms ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={acceptedDevelopmentTerms ? theme.colors.primary : theme.colors.mediumGray}
                />
                <Text style={styles.termsText}>
                  I understand Pundit is under development and features, data, or availability may change while the app is being tested.
                </Text>
              </TouchableOpacity>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>
                  Set Username
                </Text>
              )}
            </TouchableOpacity>

            {isRequired && (
              <Text style={styles.requiredNote}>
                Choose carefully. Usernames cannot be changed later.
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  cancelButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.accent,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  inputSection: {
    marginBottom: theme.spacing.xl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  inputPrefix: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.mediumGray,
    marginRight: theme.spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    padding: 0,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  helperText: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.incorrect,
  },
  charCount: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.white,
  },
  requiredNote: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
  },
});
