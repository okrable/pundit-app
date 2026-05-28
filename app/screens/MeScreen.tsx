import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest } from '../services/auth0';
import { getUserId } from '../storage/userStorage';
import { theme } from '../theme/theme';
import { UserStats } from '../types';
import SettingsModal from '../components/SettingsModal';
import Avatar from '../components/Avatar';
import UsernameModal from '../components/UsernameModal';
import EditProfileModal from '../components/EditProfileModal';
import { useProfileStore } from '../state/useProfileStore';
import AuthSyncScreen from '../components/AuthSyncScreen';
import { loginWithAuth0 } from '../services/authFlow';
import { useCenteredWebStyle, webContentWidth } from '../components/ResponsiveLayout';

const EMPTY_STATS: UserStats = {
  streak: 0,
  bestScore: 0,
  totalQuizzes: 0,
  challengeWins: 0,
  challengeLosses: 0,
  challengeDraws: 0,
  username: null,
  displayName: null,
  createdAt: null,
  canChangeUsername: true,
  usernameChangeAvailableAt: null,
};

export default function MeScreen() {
  const centeredProfileStyle = useCenteredWebStyle(webContentWidth.standard);
  const { stats, statsUserId, playedToday, revalidate, loading: profileLoading } = useProfileStore();
  const {
    user,
    isAuthenticated,
    isAuth0Available,
    token,
    forceInteractiveAuth,
    setUsername,
    setDisplayName,
    setUsernameRequired,
  } = useAuthStore();
  const [authLoadingIntent, setAuthLoadingIntent] = useState<'signup' | 'login' | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [signupRequest, , promptSignup] = useAuthRequest({
    intent: 'signup',
    forceInteractive: forceInteractiveAuth,
  });
  const [loginRequest, , promptLogin] = useAuthRequest({
    intent: 'login',
    forceInteractive: true,
  });

  useEffect(() => {
    if (!isAuthenticated || !user || !token || !stats || profileLoading || statsUserId !== user.sub) {
      return;
    }

    if (stats.username && stats.username !== user.username) {
      setUsername(stats.username);
    } else if (user.usernameRequired && !user.username) {
      setUsernameRequired(true);
      setShowUsernameModal(true);
    }

    if (stats.displayName && stats.displayName !== user.name) {
      setDisplayName(stats.displayName);
    }
  }, [
    isAuthenticated,
    setDisplayName,
    setUsername,
    setUsernameRequired,
    stats,
    statsUserId,
    token,
    user,
    profileLoading,
  ]);

  const handleSignup = async () => {
    setAuthLoadingIntent('signup');
    try {
      await loginWithAuth0({
        intent: 'signup',
        request: signupRequest,
        promptAsync: promptSignup,
      });
    } catch (error) {
      console.error('Token exchange error:', error);
    } finally {
      setAuthLoadingIntent(null);
    }
  };

  const handleLogin = async () => {
    setAuthLoadingIntent('login');
    try {
      await loginWithAuth0({
        intent: 'login',
        request: loginRequest,
        promptAsync: promptLogin,
      });
    } catch (error) {
      console.error('Token exchange error:', error);
    } finally {
      setAuthLoadingIntent(null);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (isAuthenticated && user?.sub) {
        await revalidate(user.sub);
        return;
      }

      const guestUserId = await getUserId();
      await revalidate(guestUserId);
    } finally {
      setRefreshing(false);
    }
  };

  const handleUsernameSuccess = (username: string) => {
    setUsername(username);
    setShowUsernameModal(false);
  };

  const handleDisplayNameChange = (name: string) => {
    setDisplayName(name);
  };

  const handleUsernameChange = (username: string) => {
    setUsername(username);
  };

  const getStreakMessage = (streak: number): string => {
    if (streak === 0) return 'Start your streak today!';
    if (streak === 1) return '1 day - keep it going!';
    if (streak < 5) return `${streak} days - nice work!`;
    if (streak < 10) return `${streak} days - you're on fire!`;
    return `${streak} days - legendary!`;
  };

  const getStreakCta = (hasPlayedToday: boolean): string => {
    return hasPlayedToday
      ? 'Come back tomorrow to keep your streak!'
      : 'Play today to keep your streak!';
  };

  const formatMemberSince = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatChallengeRecord = (wins: number, losses: number, draws: number): string => {
    return `${wins}-${losses}-${draws}`;
  };

  const localStats = stats ?? EMPTY_STATS;

  if (authLoadingIntent !== null) {
    return <AuthSyncScreen />;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setSettingsVisible(true)}
        >
          <Ionicons name="settings-sharp" size={24} color={theme.colors.textDark} />
        </TouchableOpacity>

        <View style={[styles.loggedOutContent, centeredProfileStyle]}>
          <Text style={styles.promoTitle}>Join our growing community!</Text>
          <Text style={styles.promoSubtitle}>
            View your stats, streak, leaderboards and more
          </Text>

          {isAuth0Available && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSignup}
                disabled={authLoadingIntent !== null || !signupRequest}
              >
                {authLoadingIntent === 'signup' ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create a free account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={authLoadingIntent !== null || !loginRequest}
                style={styles.loginLink}
              >
                {authLoadingIntent === 'login' ? (
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                ) : (
                  <Text style={styles.loginLinkText}>Log In</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <SettingsModal
          visible={settingsVisible}
          onClose={() => setSettingsVisible(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => setSettingsVisible(true)}
      >
        <Ionicons name="settings-sharp" size={24} color={theme.colors.textDark} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, centeredProfileStyle]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View style={styles.profileSection}>
          <Avatar
            userId={user?.sub || ''}
            displayName={localStats.displayName || user?.name}
            username={localStats.username || user?.username}
            imageUrl={user?.picture}
            size="xl"
          />
          <Text style={styles.displayName}>
            {localStats.displayName || user?.name || user?.email || 'Player'}
          </Text>
          {(localStats.username || user?.username) && (
            <Text style={styles.username}>@{localStats.username || user?.username}</Text>
          )}
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => setShowEditProfileModal(true)}
          >
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>STATS</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🔥</Text>
              <Text style={styles.statValue}>{localStats.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⭐</Text>
              <Text style={styles.statValue}>{localStats.bestScore}</Text>
              <Text style={styles.statLabel}>Best Score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📊</Text>
              <Text style={styles.statValue}>{localStats.totalQuizzes}</Text>
              <Text style={styles.statLabel}>Quizzes</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              <Text style={styles.statValueSmall}>
                {formatChallengeRecord(
                  localStats.challengeWins,
                  localStats.challengeLosses,
                  localStats.challengeDraws
                )}
              </Text>
              <Text style={styles.statLabel}>W-L-D</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📅</Text>
              <Text style={styles.statValueSmall}>
                {formatMemberSince(localStats.createdAt)}
              </Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>
        </View>

        <View style={styles.streakSection}>
          <View style={styles.divider} />
          <Text style={styles.streakTitle}>Streak Status</Text>
          <Text style={styles.streakMessage}>{getStreakMessage(localStats.streak)}</Text>
          <Text style={styles.streakCta}>{getStreakCta(playedToday)}</Text>
        </View>
      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      <UsernameModal
        visible={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        onSuccess={handleUsernameSuccess}
        currentUsername={localStats.username || user?.username}
        isRequired={user?.usernameRequired}
      />

      <EditProfileModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        currentDisplayName={localStats.displayName || user?.name}
        currentUsername={localStats.username || user?.username}
        canChangeUsername={localStats.canChangeUsername}
        usernameChangeAvailableAt={localStats.usernameChangeAvailableAt}
        onDisplayNameChange={handleDisplayNameChange}
        onUsernameChange={handleUsernameChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  settingsButton: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxl,
  },
  loggedOutContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  promoTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  promoSubtitle: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  loginLink: {
    paddingVertical: theme.spacing.sm,
  },
  loginLinkText: {
    color: theme.colors.textDark,
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  displayName: {
    fontSize: 22,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginTop: theme.spacing.md,
  },
  username: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  editProfileButton: {
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
  },
  editProfileButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.primary,
  },
  statsSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 108,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  statValueSmall: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  streakSection: {
    alignItems: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.lightGray,
    marginBottom: theme.spacing.lg,
  },
  streakTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.sm,
  },
  streakMessage: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  streakCta: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
});
