import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
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
import { useProfileStore } from '../state/useProfileStore';
import AuthSyncScreen from '../components/AuthSyncScreen';
import { loginWithAuth0 } from '../services/authFlow';
import {
  useCenteredWebStyle,
  useMobileLayoutMetrics,
  webContentWidth,
} from '../components/ResponsiveLayout';
import { formatPublicPlayerName } from '../utils/publicIdentity';
import { buildStreakStatus } from '../../shared/streak';
import { getQuizDate } from '../utils/quizDate';
import StreakIcon from '../components/StreakIcon';
import { useMainTabSafeAreaEdges } from '../navigation/MainTabSafeArea';
import AvatarPickerModal from '../components/AvatarPickerModal';
import { useLeaderboardStore } from '../state/useLeaderboardStore';

const EMPTY_STATS: UserStats = {
  streak: 0,
  streakStatus: buildStreakStatus(
    { runLength: 0, lastPlayedDate: null },
    getQuizDate()
  ),
  bestScore: 0,
  totalQuizzes: 0,
  challengeWins: 0,
  challengeLosses: 0,
  challengeDraws: 0,
  username: null,
  displayName: null,
  createdAt: null,
  canChangeUsername: false,
  usernameChangeAvailableAt: null,
};

export default function MeScreen() {
  const safeAreaEdges = useMainTabSafeAreaEdges(['bottom']);
  const centeredProfileStyle = useCenteredWebStyle(webContentWidth.quiz);
  const { appWidth, isCompactWidth, screenPadding } = useMobileLayoutMetrics();
  const settingsRight =
    Platform.OS === 'web'
      ? Math.max(
          screenPadding,
          (appWidth - webContentWidth.quiz) / 2 + screenPadding
        )
      : 16;
  const { stats, revalidate, saveAvatar } = useProfileStore();
  const applyLeaderboardAvatar = useLeaderboardStore((state) => state.applyAvatar);
  const {
    user,
    isAuthenticated,
    isAuth0Available,
    forceInteractiveAuth,
  } = useAuthStore();
  const [authLoadingIntent, setAuthLoadingIntent] = useState<'signup' | 'login' | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);

  const [signupRequest, , promptSignup] = useAuthRequest({
    intent: 'signup',
    forceInteractive: forceInteractiveAuth,
  });
  const [loginRequest, , promptLogin] = useAuthRequest({
    intent: 'login',
    forceInteractive: true,
  });

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

  const formatChallengeRecord = (wins: number, losses: number, draws: number): string => {
    return `${wins}-${losses}-${draws}`;
  };

  const localStats = stats ?? EMPTY_STATS;
  const currentAvatarId = user?.avatarId ?? localStats.avatarId;
  const currentQuizDate = getQuizDate();
  const streakStatus =
    localStats.streakStatus.asOfQuizDate === currentQuizDate
      ? localStats.streakStatus
      : buildStreakStatus(
          {
            runLength: localStats.streak,
            lastPlayedDate: localStats.streakStatus.lastPlayedDate,
          },
          currentQuizDate
        );
  const streakHighlighted = streakStatus.state === 'active_today';
  const streakAccessibilityLabel =
    streakStatus.state === 'active_today'
      ? `${streakStatus.current} ${streakStatus.current === 1 ? 'day' : 'days'} streak, extended today.`
      : streakStatus.state === 'at_risk'
        ? `${streakStatus.current} ${streakStatus.current === 1 ? 'day' : 'days'} streak, play today to continue.`
        : 'No active streak.';

  if (authLoadingIntent !== null) {
    return <AuthSyncScreen />;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={safeAreaEdges}>
        <TouchableOpacity
          style={[styles.settingsButton, { right: settingsRight }]}
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
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
      <TouchableOpacity
        style={[styles.settingsButton, { right: settingsRight }]}
        onPress={() => setSettingsVisible(true)}
      >
        <Ionicons name="settings-sharp" size={24} color={theme.colors.textDark} />
      </TouchableOpacity>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isCompactWidth && styles.scrollContentCompact,
          Platform.OS === 'web' && { paddingHorizontal: screenPadding },
          centeredProfileStyle,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        <View
          style={[
            styles.profileSection,
            isCompactWidth && styles.profileSectionCompact,
          ]}
        >
          <TouchableOpacity
            onPress={() => currentAvatarId && setAvatarPickerVisible(true)}
            disabled={!currentAvatarId}
            accessibilityRole="button"
            accessibilityLabel="Edit avatar"
          >
            <Avatar
              userId={user?.sub || ''}
              username={localStats.username || user?.username}
              avatarId={currentAvatarId}
              imageUrl={user?.picture}
              size="lg"
            />
          </TouchableOpacity>
          <View style={styles.profileIdentity}>
            <Text
              style={[styles.username, isCompactWidth && styles.usernameCompact]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {formatPublicPlayerName(localStats.username || user?.username)}
            </Text>
            <Text style={styles.profileCaption}>Player profile</Text>
          </View>
          <View
            style={[
              styles.streakIndicator,
              isCompactWidth && styles.streakIndicatorCompact,
            ]}
            accessible
            accessibilityLabel={streakAccessibilityLabel}
          >
            <StreakIcon
              highlighted={streakHighlighted}
              size={isCompactWidth ? 26 : 32}
            />
            <Text
              style={[
                styles.streakValue,
                isCompactWidth && styles.streakValueCompact,
              ]}
            >
              {streakStatus.current}
            </Text>
          </View>
        </View>

        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>STATS</Text>

          <View style={styles.statsCard}>
            <View style={styles.statCell}>
              <Ionicons name="star" size={20} color={theme.colors.accent} />
              <Text style={styles.statValue}>{localStats.bestScore}</Text>
              <Text style={styles.statLabel}>Best Score</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Ionicons name="trophy" size={20} color={theme.colors.primary} />
              <Text style={styles.statValue}>
                {formatChallengeRecord(
                  localStats.challengeWins,
                  localStats.challengeLosses,
                  localStats.challengeDraws
                )}
              </Text>
              <Text style={styles.statLabel}>W-L-D</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      {currentAvatarId && user?.sub ? (
        <AvatarPickerModal
          visible={avatarPickerVisible}
          currentAvatarId={currentAvatarId}
          onClose={() => setAvatarPickerVisible(false)}
          onConfirm={async (avatarId) => {
            const confirmedAvatarId = await saveAvatar(avatarId);
            await applyLeaderboardAvatar(user.sub, confirmedAvatarId);
            setAvatarPickerVisible(false);
          }}
        />
      ) : null}

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
    zIndex: 10,
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 56,
    paddingBottom: theme.spacing.xxl,
  },
  scrollContentCompact: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: 52,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  profileSectionCompact: {
    gap: theme.spacing.md,
  },
  profileIdentity: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  usernameCompact: {
    fontSize: 18,
  },
  profileCaption: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  streakIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: theme.spacing.sm,
  },
  streakIndicatorCompact: {
    gap: theme.spacing.xs,
  },
  streakValue: {
    minWidth: 20,
    fontSize: 26,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  streakValueCompact: {
    minWidth: 16,
    fontSize: 22,
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 76,
    gap: theme.spacing.xs,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.lightGray,
    marginVertical: theme.spacing.xs,
  },
  statValue: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
});
