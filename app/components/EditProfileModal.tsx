import React, { useState, useEffect } from 'react';
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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { updateProfile } from '../services/api';
import { useAuthStore } from '../state/useAuthStore';
import UsernameModal from './UsernameModal';

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  currentDisplayName?: string | null;
  currentUsername?: string | null;
  canChangeUsername: boolean;
  usernameChangeAvailableAt?: string | null;
  onDisplayNameChange: (name: string) => void;
  onUsernameChange: (username: string) => void;
}

const DISPLAY_NAME_MAX_LENGTH = 50;

export default function EditProfileModal({
  visible,
  onClose,
  currentDisplayName,
  currentUsername,
  canChangeUsername,
  usernameChangeAvailableAt,
  onDisplayNameChange,
  onUsernameChange,
}: EditProfileModalProps) {
  const { user } = useAuthStore();
  const [displayName, setDisplayName] = useState(currentDisplayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setDisplayName(currentDisplayName || '');
      setError(null);
      setIsSaving(false);
    }
  }, [visible, currentDisplayName]);

  const handleSaveDisplayName = async () => {
    if (!user?.sub || isSaving) return;

    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Display name cannot be empty');
      return;
    }

    // Skip if unchanged
    if (trimmed === currentDisplayName) {
      onClose();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await updateProfile(user.sub, trimmed);
      if (result.success && result.profile?.displayName) {
        onDisplayNameChange(result.profile.displayName);
        onClose();
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUsernameSuccess = (username: string) => {
    onUsernameChange(username);
    setShowUsernameModal(false);
  };

  const formatCooldownDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <Modal
        visible={visible && !showUsernameModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <SafeAreaView style={styles.container} edges={['top']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit Profile</Text>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveDisplayName}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
              {/* Display Name Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>DISPLAY NAME</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={theme.colors.mediumGray}
                    value={displayName}
                    onChangeText={setDisplayName}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.inputMeta}>
                  {error ? (
                    <Text style={styles.errorText}>{error}</Text>
                  ) : (
                    <Text style={styles.helperText}>
                      This is shown on leaderboards and challenges
                    </Text>
                  )}
                  <Text style={styles.charCount}>
                    {displayName.length}/{DISPLAY_NAME_MAX_LENGTH}
                  </Text>
                </View>
              </View>

              {/* Username Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>USERNAME</Text>
                <TouchableOpacity
                  style={styles.usernameRow}
                  onPress={() => canChangeUsername && setShowUsernameModal(true)}
                  disabled={!canChangeUsername}
                >
                  <View style={styles.usernameInfo}>
                    <Text style={styles.usernameValue}>
                      {currentUsername ? `@${currentUsername}` : 'Not set'}
                    </Text>
                    {!canChangeUsername && usernameChangeAvailableAt && (
                      <Text style={styles.cooldownText}>
                        Can change on {formatCooldownDate(usernameChangeAvailableAt)}
                      </Text>
                    )}
                  </View>
                  {canChangeUsername && (
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.mediumGray} />
                  )}
                </TouchableOpacity>
                {canChangeUsername && (
                  <Text style={styles.helperText}>
                    {currentUsername
                      ? 'Username can be changed once every 30 days'
                      : 'Choose a unique username'}
                  </Text>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <UsernameModal
        visible={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        onSuccess={handleUsernameSuccess}
        currentUsername={currentUsername}
        isRequired={false}
      />
    </>
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
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.lightGray,
  },
  cancelButton: {
    paddingVertical: theme.spacing.xs,
    minWidth: 60,
  },
  cancelButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  saveButton: {
    paddingVertical: theme.spacing.xs,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.accent,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  inputContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  input: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBook,
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
    flex: 1,
    marginTop: theme.spacing.xs,
    marginLeft: theme.spacing.xs,
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
  usernameRow: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usernameInfo: {
    flex: 1,
  },
  usernameValue: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  cooldownText: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
});
