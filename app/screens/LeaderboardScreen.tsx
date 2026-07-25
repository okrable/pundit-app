import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FriendsLeaderboardEntry, LeaderboardEntry } from '../types';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest } from '../services/auth0';
import { theme } from '../theme/theme';
import Avatar from '../components/Avatar';
import ManageFriendsModal from '../components/ManageFriendsModal';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import AuthSyncScreen from '../components/AuthSyncScreen';
import { loginWithAuth0 } from '../services/authFlow';
import { useCenteredWebStyle, webContentWidth } from '../components/ResponsiveLayout';
import { formatPublicPlayerName } from '../utils/publicIdentity';

type ViewMode = 'friends' | 'global';

export default function LeaderboardScreen() {
  const centeredContentStyle = useCenteredWebStyle(webContentWidth.standard);
  const [viewMode, setViewMode] = useState<ViewMode>('friends');
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showManageFriends, setShowManageFriends] = useState(false);

  const {
    friendsLeaderboard,
    totalFriends,
    friendsPlayedToday,
    globalLeaderboard,
    loadingFriends,
    loadingGlobal,
    error,
    revalidateFriends,
    revalidateGlobal,
    invalidateFriends,
  } = useLeaderboardStore();
  const {
    user,
    isAuthenticated,
    isAuth0Available,
    forceInteractiveAuth,
    clearError,
  } = useAuthStore();
  const [request, , promptAsync] = useAuthRequest({
    intent: 'signup',
    forceInteractive: forceInteractiveAuth,
  });

  const refreshCurrentView = useCallback(async () => {
    try {
      if (viewMode === 'friends' && isAuthenticated && user?.sub) {
        await revalidateFriends(user.sub, { force: true });
      } else {
        await revalidateGlobal({ force: true });
      }
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated, revalidateFriends, revalidateGlobal, user?.sub, viewMode]);

  useEffect(() => {
    if (viewMode === 'friends' && (!isAuthenticated || !user?.sub)) {
      setViewMode('global');
    }
  }, [isAuthenticated, user?.sub, viewMode]);

  useFocusEffect(
    useCallback(() => {
      if (viewMode === 'friends' && isAuthenticated && user?.sub) {
        void revalidateFriends(user.sub, { force: true });
      } else {
        void revalidateGlobal({ force: true });
      }
    }, [
      isAuthenticated,
      revalidateFriends,
      revalidateGlobal,
      user?.sub,
      viewMode,
    ])
  );

  const handleCreateAccount = async () => {
    setIsAuthLoading(true);
    clearError();
    try {
      await loginWithAuth0({
        intent: 'signup',
        request,
        promptAsync,
      });
    } catch (err) {
      console.error('Token exchange error:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void refreshCurrentView();
  };

  const handleFriendsChanged = () => {
    if (user?.sub) {
      void invalidateFriends(user.sub);
    }
  };

  const handleSetViewMode = (nextMode: ViewMode) => {
    setViewMode(nextMode);
    if (nextMode === 'friends' && isAuthenticated && user?.sub) {
      void revalidateFriends(user.sub);
    } else {
      void revalidateGlobal();
    }
  };

  const renderSegmentedControl = () => {
    if (!isAuthenticated) return null;

    return (
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'friends' && styles.segmentActive]}
          onPress={() => handleSetViewMode('friends')}
        >
          <Text style={[styles.segmentText, viewMode === 'friends' && styles.segmentTextActive]}>
            Friends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, viewMode === 'global' && styles.segmentActive]}
          onPress={() => handleSetViewMode('global')}
        >
          <Text style={[styles.segmentText, viewMode === 'global' && styles.segmentTextActive]}>
            Global
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFriendsItem = ({ item }: { item: FriendsLeaderboardEntry }) => {
    const isCurrentUser = item.userId === user?.sub;
    const hasPlayed = item.hasPlayedToday;
    const scoreText = `${item.score} pts • Streak: ${item.streak}`;

    return (
      <View style={[styles.leaderboardItem, isCurrentUser && styles.currentUserItem]}>
        {hasPlayed && item.rank ? (
          <View style={styles.rankContainer}>
            <Text style={styles.rank}>#{item.rank}</Text>
          </View>
        ) : (
          <View style={[styles.rankContainer, styles.rankContainerEmpty]}>
            <Ionicons name="time-outline" size={16} color={theme.colors.mediumGray} />
          </View>
        )}
        <Avatar
          userId={item.userId}
          username={item.username}
          size="md"
        />
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName}>
              {formatPublicPlayerName(item.username)}
            </Text>
            {isCurrentUser && <Text style={styles.youBadge}>You</Text>}
          </View>
          {hasPlayed ? (
            <Text style={styles.playerStats}>{scoreText}</Text>
          ) : (
            <Text style={styles.notPlayedText}>Not yet played</Text>
          )}
        </View>
      </View>
    );
  };

  const renderGlobalItem = ({ item, index }: { item: LeaderboardEntry; index: number }) => (
    <View style={styles.leaderboardItem}>
      <View style={styles.rankContainer}>
        <Text style={styles.rank}>#{item.rank || index + 1}</Text>
      </View>
      <Avatar
        userId={item.userId}
        username={item.username}
        size="md"
      />
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>
          {formatPublicPlayerName(item.username)}
        </Text>
        <Text style={styles.playerStats}>
          {`${item.score} pts • Streak: ${item.streak}`}
        </Text>
      </View>
    </View>
  );

  const renderGuestBanner = () => {
    if (isAuthenticated || !isAuth0Available) return null;

    return (
      <View style={[styles.guestBanner, centeredContentStyle]}>
        <Text style={styles.guestBannerTitle}>Join our growing community!</Text>
        <Text style={styles.guestBannerText}>
          Log in or create a free account to compete with friends and track your stats.
        </Text>
        <TouchableOpacity
          style={styles.createAccountButton}
          onPress={handleCreateAccount}
          disabled={isAuthLoading || !request}
        >
          {isAuthLoading ? (
            <ActivityIndicator size="small" color={theme.colors.white} />
          ) : (
            <Text style={styles.createAccountButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderFriendsEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={48} color={theme.colors.mediumGray} />
      <Text style={styles.emptyText}>No friends yet</Text>
      <Text style={styles.emptySubtext}>
        Add friends to see your personal leaderboard
      </Text>
      <TouchableOpacity
        style={styles.inviteFriendsButton}
        onPress={() => setShowManageFriends(true)}
      >
        <Text style={styles.inviteFriendsButtonText}>Invite Friends</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGlobalEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No leaderboard data yet</Text>
      <Text style={styles.emptySubtext}>
        Be the first to complete today's quiz!
      </Text>
    </View>
  );

  const renderPlaceholder = () => (
    <View style={[styles.placeholderList, centeredContentStyle]}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.placeholderCard}>
          <View style={styles.placeholderRank} />
          <View style={styles.placeholderBody}>
            <View style={styles.placeholderLinePrimary} />
            <View style={styles.placeholderLineSecondary} />
          </View>
        </View>
      ))}
    </View>
  );

  const isFriendsView = viewMode === 'friends' && isAuthenticated;
  const activeLoading = isFriendsView
    ? loadingFriends
    : loadingGlobal;
  const activeData = isFriendsView ? friendsLeaderboard : globalLeaderboard;

  if (isAuthLoading) {
    return <AuthSyncScreen />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {renderGuestBanner()}

      <View style={[styles.header, centeredContentStyle]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Leaderboard</Text>
          {isAuthenticated && (
            <TouchableOpacity
              style={styles.manageFriendsButton}
              onPress={() => setShowManageFriends(true)}
            >
              <Ionicons name="people" size={22} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        {renderSegmentedControl()}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {isFriendsView && totalFriends > 0 && (
          <Text style={styles.subtitle}>
            {`${friendsPlayedToday} of ${totalFriends} friends played today`}
          </Text>
        )}
        {!isFriendsView && (
          <Text style={styles.subtitle}>
            Today's top players
          </Text>
        )}
      </View>

      {activeData.length === 0 && activeLoading ? (
        renderPlaceholder()
      ) : isFriendsView ? (
        <FlatList
          data={friendsLeaderboard}
          renderItem={renderFriendsItem}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={[styles.listContainer, centeredContentStyle]}
          ListEmptyComponent={renderFriendsEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      ) : (
        <FlatList
          data={globalLeaderboard}
          renderItem={renderGlobalItem}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={[styles.listContainer, centeredContentStyle]}
          ListEmptyComponent={renderGlobalEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        />
      )}

      <ManageFriendsModal
        visible={showManageFriends}
        onClose={() => setShowManageFriends(false)}
        onFriendsChanged={handleFriendsChanged}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  errorText: {
    fontSize: 13,
    color: theme.colors.incorrect,
    fontFamily: theme.fonts.gothamBook,
    marginBottom: theme.spacing.sm,
  },
  header: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  manageFriendsButton: {
    padding: theme.spacing.xs,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: 4,
    marginBottom: theme.spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  segmentActive: {
    backgroundColor: theme.colors.primary,
  },
  segmentText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.mediumGray,
  },
  segmentTextActive: {
    color: theme.colors.white,
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
    flexGrow: 1,
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
  currentUserItem: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
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
  rankContainerEmpty: {
    backgroundColor: theme.colors.lightGray,
  },
  rank: {
    color: theme.colors.white,
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
  },
  playerInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  playerName: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  youBadge: {
    marginLeft: theme.spacing.sm,
    fontSize: 11,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.primary,
  },
  playerStats: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  notPlayedText: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    marginTop: theme.spacing.md,
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  emptySubtext: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  inviteFriendsButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
  },
  inviteFriendsButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
  },
  placeholderList: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  placeholderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    opacity: 0.72,
  },
  placeholderRank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.lightGray,
    marginRight: theme.spacing.md,
  },
  placeholderBody: {
    flex: 1,
  },
  placeholderLinePrimary: {
    height: 14,
    width: '48%',
    backgroundColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  placeholderLineSecondary: {
    height: 12,
    width: '62%',
    backgroundColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.sm,
  },
});
