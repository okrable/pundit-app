import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest, auth0Config } from '../services/auth0';
import { theme } from '../theme/theme';
import SettingsModal from '../components/SettingsModal';

export default function MeScreen() {
  const { userStats, userId, fetchUserStats } = useQuizStore();
  const { user, isAuthenticated, isAuth0Available, setAuthResult, clearError } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Set up Auth0 authentication request
  const [request, response, promptAsync] = useAuthRequest();

  useEffect(() => {
    if (userId) {
      fetchUserStats();
    }
  }, [userId]);

  // Handle Auth0 response
  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeForToken(code);
    } else if (response) {
      // Handle dismiss, cancel, error, locked, or any other non-success type
      if (response.type === 'error') {
        console.error('Auth error:', response.error);
      }
      setIsLoading(false);
    }
  }, [response]);

  const exchangeCodeForToken = async (code: string) => {
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
            code_verifier: request?.codeVerifier || '',
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

  const handleLogin = async () => {
    setIsLoading(true);
    clearError();
    await promptAsync();
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
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={64} color={theme.colors.mediumGray} />
          </View>

          <Text style={styles.promoTitle}>Create an account to{'\n'}track your progress</Text>

          {isAuth0Available && (
            <>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Create Free Account</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.orText}>Already have an account?</Text>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={styles.secondaryButtonText}>Log In</Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.benefitText}>Track your streak</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.benefitText}>Compete on the leaderboard</Text>
            </View>
            <View style={styles.benefitItem}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
              <Text style={styles.benefitText}>Never lose your progress</Text>
            </View>
          </View>
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
            <Text style={styles.statValue}>{userStats?.streak ?? 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statEmoji}>⭐</Text>
            <Text style={styles.statValue}>{userStats?.bestScore ?? 0}/5</Text>
            <Text style={styles.statLabel}>Best</Text>
          </View>
        </View>

        {/* Streak status */}
        <View style={styles.streakSection}>
          <View style={styles.divider} />
          <Text style={styles.streakTitle}>Streak Status</Text>
          <Text style={styles.streakMessage}>{getStreakMessage(userStats?.streak ?? 0)}</Text>
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
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  promoTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 28,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.borderRadius.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
  },
  orText: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    width: '100%',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
  },
  benefitsList: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  benefitText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    marginLeft: theme.spacing.sm,
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
