import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest, auth0Config } from '../services/auth0';
import { getUserStats } from '../services/api';
import { theme } from '../theme/theme';
import SettingsModal from '../components/SettingsModal';

export default function MeScreen() {
  const { userStats } = useQuizStore();
  const { user, isAuthenticated, isAuth0Available, setAuthResult, clearError } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [localStats, setLocalStats] = useState(userStats);
  const hasLoadedStats = useRef(false);

  // Set up Auth0 authentication requests - one for signup, one for login
  const [signupRequest, signupResponse, promptSignup] = useAuthRequest('signup');
  const [loginRequest, loginResponse, promptLogin] = useAuthRequest('login');

  // Fetch fresh stats from DB when screen comes into focus
  // Only show loading spinner on first load
  useFocusEffect(
    useCallback(() => {
      const loadFreshStats = async () => {
        if (isAuthenticated && user?.sub) {
          // Only show spinner if we haven't loaded stats before
          const showSpinner = !hasLoadedStats.current;
          if (showSpinner) {
            setLoadingStats(true);
          }
          try {
            const freshStats = await getUserStats(user.sub);
            setLocalStats(freshStats);
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

  // Update local stats when store stats change
  useEffect(() => {
    if (userStats) {
      setLocalStats(userStats);
    }
  }, [userStats]);

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

  const getStreakMessage = (streak: number): string => {
    if (streak === 0) return "Start your streak today!";
    if (streak === 1) return "1 day - keep it going!";
    if (streak < 5) return `${streak} days - nice work!`;
    if (streak < 10) return `${streak} days - you're on fire!`;
    return `${streak} days - legendary!`;
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

      <View style={styles.loggedInContent}>
        {/* Profile section */}
        <View style={styles.profileSection}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.profilePicture} />
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              <Ionicons name="person" size={40} color={theme.colors.mediumGray} />
            </View>
          )}
          <Text style={styles.displayName}>{user?.name || user?.email || 'Player'}</Text>
        </View>

        {/* Stats cards */}
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
              <Text style={styles.statValue}>{localStats?.bestScore ?? 0}/5</Text>
            )}
            <Text style={styles.statLabel}>Best</Text>
          </View>
        </View>

        {/* Streak status */}
        <View style={styles.streakSection}>
          <View style={styles.divider} />
          <Text style={styles.streakTitle}>Streak Status</Text>
          <Text style={styles.streakMessage}>{getStreakMessage(localStats?.streak ?? 0)}</Text>
          <Text style={styles.streakCta}>Play today to keep your streak!</Text>
        </View>
      </View>

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
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
  // Logged in styles
  loggedInContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: theme.spacing.md,
  },
  profilePicturePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  displayName: {
    fontSize: 22,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  statLoader: {
    height: 34,
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
