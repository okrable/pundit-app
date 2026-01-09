import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest, auth0Config } from '../services/auth0';

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
    backgroundColor: '#fff',
  },
  contentContainer: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  infoCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#000',
    fontFamily: 'monospace',
  },
  infoSubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  authCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
  },
  userInfo: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    marginTop: 8,
  },
});
