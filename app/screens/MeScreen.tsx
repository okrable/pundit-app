import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest, auth0Config } from '../services/auth0';
import { getTodayResult, getUserStats } from '../services/api';
import { getTodayQuizResult } from '../storage/quizStorage';
import { theme } from '../theme/theme';
import { UserStats } from '../types';
import SettingsModal from '../components/SettingsModal';
import Avatar from '../components/Avatar';
import UsernameModal from '../components/UsernameModal';
import EditProfileModal from '../components/EditProfileModal';

export default function MeScreen() {
  const { userStats } = useQuizStore();
  const {
    user,
    isAuthenticated,
    isAuth0Available,
    setAuthResult,
    setUsername,
    setDisplayName,
    setUsernameRequired,
    clearError,
  } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [localStats, setLocalStats] = useState<UserStats | null>(null);
  const [playedToday, setPlayedToday] = useState(false);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const hasLoadedStats = useRef(false);

  // Set up Auth0 authentication requests - one for signup, one for login
  const [signupRequest, signupResponse, promptSignup] = useAuthRequest('signup');
  const [loginRequest, loginResponse, promptLogin] = useAuthRequest('login');

  // Fetch fresh stats from DB when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadFreshStats = async () => {
        if (isAuthenticated && user?.sub) {
          const showSpinner = !hasLoadedStats.current;
          if (showSpinner) {
            setLoadingStats(true);
          }
          try {
            const freshStats = await getUserStats(user.sub);
            setLocalStats(freshStats);

            // Update auth store with username info from stats
            if (freshStats.username) {
              setUsername(freshStats.username);
            } else if (!user.username) {
              // User needs to set a username
              setUsernameRequired(true);
              setShowUsernameModal(true);
            }

            // Update display name if different
            if (freshStats.displayName && freshStats.displayName !== user.name) {
              setDisplayName(freshStats.displayName);
            }

            // Determine if the user has already played today's quiz
            let hasPlayedToday = false;
            const localResult = await getTodayQuizResult(user.sub);
            if (localResult) {
              hasPlayedToday = true;
            } else {
              try {
                const todayResult = await getTodayResult(user.sub);
                hasPlayedToday = Boolean(todayResult);
              } catch (todayResultError) {
                console.error('Error fetching today result:', todayResultError);
              }
            }
            setPlayedToday(hasPlayedToday);
            hasLoadedStats.current = true;
          } catch (error) {
            console.error('Error fetching fresh stats:', error);
          } finally {
            if (showSpinner) {
              setLoadingStats(false);
            }
          }
        }
      };
      loadFreshStats();
    }, [isAuthenticated, user?.sub])
  );

  // Handle Auth0 signup response
  useEffect(() => {
    if (signupResponse?.type === 'success') {
      const { code } = signupResponse.params;
      exchangeCodeForToken(code, signupRequest?.codeVerifier);
    } else if (signupResponse) {
      if (signupResponse.type === 'error') {
        console.error('Auth error:', signupResponse.error);
      }
      setIsLoading(false);
    }
  }, [signupResponse]);

  // Handle Auth0 login response
  useEffect(() => {
    if (loginResponse?.type === 'success') {
      const { code } = loginResponse.params;
      exchangeCodeForToken(code, loginRequest?.codeVerifier);
    } else if (loginResponse) {
      if (loginResponse.type === 'error') {
        console.error('Auth error:', loginResponse.error);
      }
      setIsLoading(false);
    }
  }, [loginResponse]);

  const exchangeCodeForToken = async (code: string, codeVerifier?: string) => {
    try {
      const redirectUri = AuthSession.makeRedirectUri({
        scheme: 'pundit-app',
      });

      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          code,
          clientId: auth0Config.clientId || '',
          redirectUri,
          extraParams: {
            code_verifier: codeVerifier || '',
          },
        },
        {
          tokenEndpoint: auth0Config.tokenEndpoint,
        }
      );

      const { accessToken } = tokenResponse;

      // Fetch user info
      const userInfoResponse = await fetch(`https://${auth0Config.domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userInfo = await userInfoResponse.json();

      // Update auth store
      setAuthResult(accessToken, userInfo);
      setIsLoading(false);
    } catch (error) {
      console.error('Token exchange error:', error);
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    setIsLoading(true);
    clearError();
    await promptSignup();
  };

  const handleLogin = async () => {
    setIsLoading(true);
    clearError();
    await promptLogin();
  };

  const handleUsernameSuccess = (username: string) => {
    setUsername(username);
    setShowUsernameModal(false);
    // Update local stats
    if (localStats) {
      setLocalStats({ ...localStats, username, canChangeUsername: false });
    }
  };

  const handleDisplayNameChange = (name: string) => {
    setDisplayName(name);
    if (localStats) {
      setLocalStats({ ...localStats, displayName: name });
    }
  };

  const handleUsernameChange = (username: string) => {
    setUsername(username);
    if (localStats) {
      setLocalStats({
        ...localStats,
        username,
        canChangeUsername: false,
        usernameChangeAvailableAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    }
  };

  const getStreakMessage = (streak: number): string => {
    if (streak === 0) return "Start your streak today!";
    if (streak === 1) return "1 day - keep it going!";
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

  // Logged out state
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setSettingsVisible(true)}
        >
          <Ionicons name="settings-sharp" size={24} color={theme.colors.textDark} />
        </TouchableOpacity>

        <View style={styles.loggedOutContent}>
          <Text style={styles.promoTitle}>Join our growing community!</Text>
          <Text style={styles.promoSubtitle}>
            View your stats, streak, leaderboards and more
          </Text>

          {isAuth0Available && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSignup}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create a free account</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                style={styles.loginLink}
              >
                <Text style={styles.loginLinkText}>Log In</Text>
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

  // Logged in state
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile section */}
        <View style={styles.profileSection}>
          <Avatar
            userId={user?.sub || ''}
            displayName={localStats?.displayName || user?.name}
            username={localStats?.username || user?.username}
            imageUrl={user?.picture}
            size="xl"
          />
          <Text style={styles.displayName}>
            {localStats?.displayName || user?.name || user?.email || 'Player'}
          </Text>
          {(localStats?.username || user?.username) && (
            <Text style={styles.username}>@{localStats?.username || user?.username}</Text>
          )}
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => setShowEditProfileModal(true)}
          >
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Stats section */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>STATS</Text>

          {/* First row of stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🔥</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={styles.statLoader} />
              ) : (
                <Text style={styles.statValue}>{localStats?.streak ?? 0}</Text>
              )}
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>⭐</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={styles.statLoader} />
              ) : (
                <Text style={styles.statValue}>{localStats?.bestScore ?? 0}</Text>
              )}
              <Text style={styles.statLabel}>High Score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🎯</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={styles.statLoader} />
              ) : (
                <Text style={styles.statValue}>{localStats?.accuracy ?? 0}%</Text>
              )}
              <Text style={styles.statLabel}>Accuracy</Text>
            </View>
          </View>

          {/* Second row of stats */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📊</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={styles.statLoader} />
              ) : (
                <Text style={styles.statValue}>{localStats?.totalQuizzes ?? 0}</Text>
              )}
              <Text style={styles.statLabel}>Quizzes</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>🏆</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={styles.statLoader} />
              ) : (
                <Text style={styles.statValueSmall}>
                  {formatChallengeRecord(
                    localStats?.challengeWins ?? 0,
                    localStats?.challengeLosses ?? 0,
                    localStats?.challengeDraws ?? 0
                  )}
                </Text>
              )}
              <Text style={styles.statLabel}>W-L-D</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statEmoji}>📅</Text>
              {loadingStats ? (
                <ActivityIndicator size="small" color={theme.colors.primary} style={styles.statLoader} />
              ) : (
                <Text style={styles.statValueSmall}>
                  {formatMemberSince(localStats?.createdAt ?? null)}
                </Text>
              )}
              <Text style={styles.statLabel}>Joined</Text>
            </View>
          </View>
        </View>

        {/* Streak status */}
        <View style={styles.streakSection}>
          <View style={styles.divider} />
          <Text style={styles.streakTitle}>Streak Status</Text>
          <Text style={styles.streakMessage}>{getStreakMessage(localStats?.streak ?? 0)}</Text>
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
        currentUsername={localStats?.username || user?.username}
        isRequired={user?.usernameRequired}
      />

      <EditProfileModal
        visible={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        currentDisplayName={localStats?.displayName || user?.name}
        currentUsername={localStats?.username || user?.username}
        canChangeUsername={localStats?.canChangeUsername ?? true}
        usernameChangeAvailableAt={localStats?.usernameChangeAvailableAt}
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
  // Logged out styles
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
  // Profile section
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
  // Stats section
  statsSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  statValueSmall: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  statLoader: {
    height: 28,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  // Streak section
  streakSection: {
    alignItems: 'center',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.lightGray,
    marginBottom: theme.spacing.xl,
  },
  streakTitle: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.sm,
  },
  streakMessage: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  streakCta: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
});
