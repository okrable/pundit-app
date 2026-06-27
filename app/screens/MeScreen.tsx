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
import { getUserId } from '../storage/userStorage';
import { theme } from '../theme/theme';
import { UserStats } from '../types';
import SettingsModal from '../components/SettingsModal';
import Avatar from '../components/Avatar';
import UsernameModal from '../components/UsernameModal';
import { useProfileStore } from '../state/useProfileStore';
import AuthSyncScreen from '../components/AuthSyncScreen';
import { loginWithAuth0, useAuthFlowRequest } from '../services/authFlow';
import { useCenteredWebStyle, webContentWidth } from '../components/ResponsiveLayout';

const EMPTY_STATS: UserStats = {
  streak: 0,
  bestScore: 0,
  totalQuizzes: 0,
  challengeWins: 0,
  challengeLosses: 0,
  challengeDraws: 0,
  username: null,
  createdAt: null,
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
    setUsernameRequired,
  } = useAuthStore();
  const [authLoadingIntent, setAuthLoadingIntent] = useState<'signup' | 'login' | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [signupRequest, promptSignup] = useAuthFlowRequest({
    intent: 'signup',
    forceInteractive: forceInteractiveAuth,
  });
  const [loginRequest, promptLogin] = useAuthFlowRequest({
    intent: 'login',
    forceInteractive: true,
  });

  useEffect(() => {
    if (!isAuthenticated || !user || !token || !stats || profileLoading || statsUserId !== user.sub) {
      return;
    }

    if (stats.username) {
      if (stats.username !== user.username) {
        setUsername(stats.username);
      }
      setUsernameRequired(false);
      setShowUsernameModal(false);
      return;
    }

    if (user.username) {
      setUsernameRequired(false);
      setShowUsernameModal(false);
      return;
    }

    setUsernameRequired(true);
    setShowUsernameModal(true);
  }, [
    isAuthenticated,
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
    setUsernameRequired(false);
    setShowUsernameModal(false);
    if (user?.sub) {
      void revalidate(user.sub);
    }
  };

  const getStreakMessage = (streak: number): string => {
    if (streak === 0) return 'Start your streak today.';
    if (streak === 1) return '1 day. Keep it going.';
    if (streak < 5) return `${streak} days. Nice work.`;
    if (streak < 10) return `${streak} days. Strong run.`;
    return `${streak} days. Legendary form.`;
  };

  const getStreakCta = (hasPlayedToday: boolean): string => {
    return hasPlayedToday
      ? 'Come back tomorrow to protect it.'
      : 'Play today to protect it.';
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
  const profileUsername = localStats.username || user?.username || null;
  const usernameRequired = Boolean(user?.usernameRequired || (!profileUsername && statsUserId === user?.sub));

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
          <Ionicons name="person-circle-outline" size={72} color={theme.colors.primary} />
          <Text style={styles.promoTitle}>Build your Pundit record</Text>
          <Text style={styles.promoSubtitle}>
            Create an account to keep your stats, streaks, leaderboards, and challenge history together.
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
            username={profileUsername}
            imageUrl={user?.picture}
            size="xl"
          />
          <Text
            style={[styles.usernameTitle, !profileUsername && styles.usernameTitleMissing]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >
            {profileUsername ? `@${profileUsername}` : 'Choose your username'}
          </Text>
          <View style={styles.identityPill}>
            <Ionicons
              name={profileUsername ? 'lock-closed' : 'alert-circle'}
              size={14}
              color={profileUsername ? theme.colors.primary : theme.colors.accent}
            />
            <Text style={styles.identityPillText}>
              {profileUsername ? 'Permanent username' : 'Required to continue'}
            </Text>
          </View>
          <Text style={styles.memberSince}>
            Joined {formatMemberSince(localStats.createdAt)}
          </Text>
          {!profileUsername && (
            <TouchableOpacity
              style={styles.chooseUsernameButton}
              onPress={() => setShowUsernameModal(true)}
            >
              <Text style={styles.chooseUsernameButtonText}>Choose Username</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.streakBand}>
          <View style={styles.streakIcon}>
            <Ionicons name="flame" size={22} color={theme.colors.accent} />
          </View>
          <View style={styles.streakCopy}>
            <Text style={styles.streakTitle}>Streak Status</Text>
            <Text style={styles.streakMessage}>{getStreakMessage(localStats.streak)}</Text>
            <Text style={styles.streakCta}>{getStreakCta(playedToday)}</Text>
          </View>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>STATS</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="flame-outline" size={22} color={theme.colors.accent} />
              <Text style={styles.statValue}>{localStats.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="star-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.statValue}>{localStats.bestScore}</Text>
              <Text style={styles.statLabel}>Best Score</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="stats-chart-outline" size={22} color={theme.colors.correct} />
              <Text style={styles.statValue}>{localStats.totalQuizzes}</Text>
              <Text style={styles.statLabel}>Quizzes</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCardWide}>
              <Ionicons name="trophy-outline" size={22} color={theme.colors.primary} />
              <Text style={styles.statValueSmall}>
                {formatChallengeRecord(
                  localStats.challengeWins,
                  localStats.challengeLosses,
                  localStats.challengeDraws
                )}
              </Text>
              <Text style={styles.statLabel}>Challenge W-L-D</Text>
            </View>
            <View style={styles.statCardWide}>
              <Ionicons name="calendar-outline" size={22} color={theme.colors.mediumGray} />
              <Text style={styles.statValueSmall}>
                {formatMemberSince(localStats.createdAt)}
              </Text>
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>
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
        currentUsername={profileUsername}
        isRequired={usernameRequired}
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
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxl,
    gap: theme.spacing.lg,
  },
  loggedOutContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  promoTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  promoSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
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
    gap: theme.spacing.sm,
  },
  usernameTitle: {
    maxWidth: '100%',
    fontSize: 28,
    lineHeight: 34,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    marginTop: theme.spacing.xs,
  },
  usernameTitleMissing: {
    fontSize: 24,
    color: theme.colors.mediumGray,
  },
  identityPill: {
    minHeight: 30,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  identityPillText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  memberSince: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  chooseUsernameButton: {
    marginTop: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
  },
  chooseUsernameButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.white,
  },
  streakBand: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  streakIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakCopy: {
    flex: 1,
    gap: 2,
  },
  streakTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  streakMessage: {
    fontSize: 15,
    lineHeight: 19,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
  },
  streakCta: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  statsSection: {
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.mediumGray,
    letterSpacing: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    minHeight: 104,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  statCardWide: {
    flex: 1,
    minHeight: 104,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  statValue: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  statValueSmall: {
    fontSize: 18,
    lineHeight: 23,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
});
