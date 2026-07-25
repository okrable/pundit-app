import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../state/useAuthStore';
import { clearGuestCache } from '../storage/quizStorage';
import { theme } from '../theme/theme';
import { clearDebugLogs, getDebugLogText, logInfo } from '../services/debugLog';
import { logoutWithAuth0 } from '../services/authFlow';
import { APP_VERSION } from '../constants/version';
import { IS_PREVIEW_BUILD } from '../constants/environment';

const DONATION_URL = process.env.EXPO_PUBLIC_DONATION_URL || 'https://www.buymeacoffee.com';
const FEEDBACK_URL = process.env.EXPO_PUBLIC_FEEDBACK_URL || 'mailto:feedback@pundit-trivia.com';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const { user, isAuthenticated, error, clearError } = useAuthStore();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [isCopyingLogs, setIsCopyingLogs] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    clearError();
    await logoutWithAuth0();
    setIsLoggingOut(false);
    onClose();
  };

  const handleDonation = () => {
    Linking.openURL(DONATION_URL);
  };

  const handleFeedback = () => {
    Linking.openURL(FEEDBACK_URL);
  };

  const handleCopyDebugLog = async () => {
    setIsCopyingLogs(true);
    try {
      const logText = await getDebugLogText();
      await Clipboard.setStringAsync(logText || 'No debug log entries recorded.');
      logInfo('debugLog.copied');
      Alert.alert('Debug Log Copied', 'The latest app trace has been copied to your clipboard.');
    } catch (copyError) {
      Alert.alert('Unable to Copy Log', 'Please try again after reopening the app.');
    } finally {
      setIsCopyingLogs(false);
    }
  };

  const handleClearDebugLog = () => {
    Alert.alert(
      'Clear Debug Log',
      'Remove the saved app trace from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearDebugLogs();
            Alert.alert('Debug Log Cleared', 'Saved diagnostics have been removed.');
          },
        },
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Today's Quiz",
      'This will allow you to replay today\'s quiz. Your score will be reset. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearGuestCache();
            Alert.alert('Cache Cleared', 'You can now replay today\'s quiz.');
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Text style={styles.pageTitle}>Settings</Text>

          {/* Account Section - Only show if logged in */}
          {isAuthenticated && user && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ACCOUNT</Text>
              <View style={styles.card}>
                <View style={styles.accountInfo}>
                  <View style={styles.accountIcon}>
                    <Ionicons name="person-circle" size={40} color={theme.colors.primary} />
                  </View>
                  <View style={styles.accountDetails}>
                    <Text style={styles.accountName}>{user.name || 'User'}</Text>
                    {user.email && <Text style={styles.accountEmail}>{user.email}</Text>}
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={theme.colors.incorrect} />
                ) : (
                  <Text style={styles.logoutButtonText}>Sign Out</Text>
                )}
              </TouchableOpacity>
              {error ? <Text style={styles.logoutHelper}>{error}</Text> : null}
            </View>
          )}

          {/* Support Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SUPPORT</Text>
            <TouchableOpacity style={styles.listItem} onPress={handleFeedback}>
              <View style={styles.listItemContent}>
                <Ionicons name="chatbubble-outline" size={22} color={theme.colors.textDark} />
                <Text style={styles.listItemText}>Bug Reports & Feedback</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.mediumGray} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.listItem} onPress={handleDonation}>
              <View style={styles.listItemContent}>
                <Text style={styles.listItemEmoji}>🥧</Text>
                <Text style={styles.listItemText}>Buy Me a Half Time Pie</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.mediumGray} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.listItem}
              onPress={handleCopyDebugLog}
              disabled={isCopyingLogs}
            >
              <View style={styles.listItemContent}>
                <Ionicons name="document-text-outline" size={22} color={theme.colors.textDark} />
                <Text style={styles.listItemText}>Copy Debug Log</Text>
              </View>
              {isCopyingLogs ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Ionicons name="copy-outline" size={20} color={theme.colors.mediumGray} />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.listItem} onPress={handleClearDebugLog}>
              <View style={styles.listItemContent}>
                <Ionicons name="trash-outline" size={22} color={theme.colors.textDark} />
                <Text style={styles.listItemText}>Clear Debug Log</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.mediumGray} />
            </TouchableOpacity>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ABOUT</Text>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutTitle}>Pundit Trivia</Text>
              {IS_PREVIEW_BUILD && (
                <View style={styles.previewBadge}>
                  <Text style={styles.previewBadgeText}>PREVIEW BUILD</Text>
                </View>
              )}
              <Text style={styles.aboutVersion}>Version {APP_VERSION}</Text>
              <Text style={styles.aboutDescription}>Daily football quiz</Text>
            </View>
          </View>

          {/* Guest Options - Only show if not logged in */}
          {!isAuthenticated && ( 
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>GUEST OPTIONS</Text>
              <TouchableOpacity style={styles.listItem} onPress={handleClearCache}>
                <View style={styles.listItemContent}>
                  <Ionicons name="refresh-outline" size={22} color={theme.colors.textDark} />
                  <Text style={styles.listItemText}>Clear Today's Quiz</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.mediumGray} />
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Replay today's quiz (resets your score)
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  doneButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  doneButtonText: {
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
  pageTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
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
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  accountInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  accountIcon: {
    marginRight: theme.spacing.md,
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  accountEmail: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  logoutButtonText: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.incorrect,
  },
  logoutHelper: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
  listItem: {
    backgroundColor: theme.colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  listItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemText: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    marginLeft: theme.spacing.md,
  },
  listItemEmoji: {
    fontSize: 20,
    width: 22,
    textAlign: 'center',
  },
  aboutCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  aboutVersion: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  previewBadge: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  previewBadgeText: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  aboutDescription: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  helperText: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginLeft: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  },
});
