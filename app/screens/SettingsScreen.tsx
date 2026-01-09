import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest, auth0Config } from '../services/auth0';
import { theme } from '../theme/theme';

const DONATION_URL = process.env.DONATION_URL || 'https://www.buymeacoffee.com';

export default function SettingsScreen() {
  const { userStats, userId, fetchUserStats } = useQuizStore();
  const { user, isAuthenticated, isAuth0Available, setAuthResult, logout, clearError } = useAuthStore();
  const [isLoading, setIsLoading] = React.useState(false);

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
    } else if (response?.type === 'error') {
      console.error('Auth error:', response.error);
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

  const handleLogout = () => {
    logout();
  };

  const handleDonation = () => {
    Linking.openURL(DONATION_URL);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Your profile and stats</Text>
        </View>

        {isAuth0Available && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            {isAuthenticated && user ? (
              <View style={styles.authCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user.name || user.email || 'User'}</Text>
                  {user.email && <Text style={styles.userEmail}>{user.email}</Text>}
                </View>
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FF3B30" />
                  ) : (
                    <Text style={styles.logoutButtonText}>Logout</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.loginButton}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Login with Auth0</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Stats</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Current Streak</Text>
              <Text style={styles.statValue}>{userStats?.streak ?? '—'}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Best Score</Text>
              <Text style={styles.statValue}>{userStats?.bestScore ?? '—'}/5</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User ID</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              {isAuthenticated && user ? user.sub : userId || 'Loading...'}
            </Text>
            <Text style={styles.infoSubtext}>
              {isAuthenticated ? 'Auth0 User' : 'Guest User'}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.donationButton} onPress={handleDonation}>
            <Text style={styles.donationButtonText}>🥧 Buy Me a Half Time Pie</Text>
            <Text style={styles.donationSubtext}>Support the development of this app</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>Pundit Trivia v0.1</Text>
            <Text style={styles.infoSubtext}>Daily sports trivia challenge</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.lg,
  },
  header: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    fontFamily: theme.fonts.gothamBook,
  },
  statValue: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  infoCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    fontSize: 13,
    color: theme.colors.textDark,
    fontFamily: theme.fonts.gothamBook,
  },
  infoSubtext: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
    fontFamily: theme.fonts.gothamBook,
  },
  authCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    marginBottom: theme.spacing.md,
  },
  userName: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  logoutButton: {
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.incorrect,
  },
  logoutButtonText: {
    color: theme.colors.incorrect,
    fontSize: 13,
    fontFamily: theme.fonts.gothamMedium,
  },
  donationButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  donationButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    marginBottom: theme.spacing.xs,
  },
  donationSubtext: {
    color: theme.colors.white,
    fontSize: 11,
    fontFamily: theme.fonts.gothamBook,
    opacity: 0.9,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.incorrect,
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.gothamBook,
  },
});
