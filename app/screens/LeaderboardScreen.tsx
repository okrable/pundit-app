import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AuthSession from 'expo-auth-session';
import { LeaderboardEntry } from '../types';
import { getLeaderboard } from '../services/api';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest, auth0Config } from '../services/auth0';
import { theme } from '../theme/theme';

export default function LeaderboardScreen() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const { isAuthenticated, isAuth0Available, setAuthResult, clearError } = useAuthStore();
  const [request, response, promptAsync] = useAuthRequest();

  useEffect(() => {
    loadLeaderboard();
  }, []);

  // Handle Auth0 response
  useEffect(() => {
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeForToken(code);
    } else if (response) {
      if (response.type === 'error') {
        console.error('Auth error:', response.error);
      }
      setIsAuthLoading(false);
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
      setIsAuthLoading(false);
    } catch (error) {
      console.error('Token exchange error:', error);
      setIsAuthLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsAuthLoading(true);
    clearError();
    await promptAsync();
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => (
    <View style={styles.leaderboardItem}>
      <View style={styles.rankContainer}>
        <Text style={styles.rank}>#{item.rank || index + 1}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.displayName || 'Anonymous'}</Text>
        <Text style={styles.playerStats}>
          {item.score} pts • Streak: {item.streak}
        </Text>
      </View>
    </View>
  );

  const renderGuestBanner = () => {
    if (isAuthenticated || !isAuth0Available) return null;

    return (
      <View style={styles.guestBanner}>
        <Text style={styles.guestBannerTitle}>Join our growing community!</Text>
        <Text style={styles.guestBannerText}>
          Create a free account to compete on the leaderboard and track your stats.
        </Text>
        <TouchableOpacity
          style={styles.createAccountButton}
          onPress={handleCreateAccount}
          disabled={isAuthLoading}
        >
          {isAuthLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.createAccountButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {renderGuestBanner()}
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Today's top players</Text>
      </View>
      <FlatList
        data={leaderboard}
        renderItem={renderItem}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No leaderboard data yet</Text>
            <Text style={styles.emptySubtext}>Be the first to complete today's quiz!</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.incorrect,
    textAlign: 'center',
    fontFamily: theme.fonts.gothamBook,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
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
  guestBanner: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 6,
    elevation: 3,
  },
  guestBannerTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  guestBannerText: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  createAccountButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  createAccountButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
  },
  listContainer: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rankContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  rank: {
    color: theme.colors.white,
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  playerStats: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  emptyContainer: {
    padding: theme.spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textDark,
    fontFamily: theme.fonts.gothamMedium,
    marginBottom: theme.spacing.xs,
  },
  emptySubtext: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
});
