import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type {
  FriendsLeaderboardEntry,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardScope,
} from '../types';
import { useAuthStore } from '../state/useAuthStore';
import { useAuthRequest } from '../services/auth0';
import { theme } from '../theme/theme';
import Avatar from '../components/Avatar';
import ManageFriendsModal from '../components/ManageFriendsModal';
import { useLeaderboardStore } from '../state/useLeaderboardStore';
import AuthSyncScreen from '../components/AuthSyncScreen';
import { loginWithAuth0 } from '../services/authFlow';
import {
  useCenteredWebStyle,
  useMobileLayoutMetrics,
  webContentWidth,
} from '../components/ResponsiveLayout';
import { formatPublicPlayerName } from '../utils/publicIdentity';
import { formatStreakLabel } from '../../shared/streak';
import { useMainTabSafeAreaEdges } from '../navigation/MainTabSafeArea';
import { getLeaderboardDatasetKey } from '../../shared/leaderboard';
import { trackAnalyticsEvent } from '../services/analytics';
import { openPlayerProfile } from '../navigation/rootNavigation';
import { useSocialStore } from '../state/useSocialStore';

type Row = LeaderboardEntry | FriendsLeaderboardEntry;

export default function LeaderboardScreen() {
  const safeAreaEdges = useMainTabSafeAreaEdges(['bottom']);
  const centeredContentStyle = useCenteredWebStyle(webContentWidth.standard);
  const { appWidth, screenPadding } = useMobileLayoutMetrics();
  const responsiveHorizontalPadding =
    Platform.OS === 'web' ? { paddingHorizontal: screenPadding } : null;
  const guestBannerWebStyle = Platform.OS === 'web'
    ? { width: Math.min(webContentWidth.standard, appWidth - screenPadding * 2), marginHorizontal: 0 }
    : null;

  const [period, setPeriod] = useState<LeaderboardPeriod>('daily');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [showManageFriends, setShowManageFriends] = useState(false);

  const {
    globalData,
    friendsData,
    loading,
    errors,
    hydratePeriodFromCache,
    revalidateFriends,
    revalidateGlobal,
    invalidateFriends,
  } = useLeaderboardStore();
  const {
    user,
    isAuthenticated,
    isAuth0Available,
    authStatus,
    identityStatus,
    forceInteractiveAuth,
    clearError,
  } = useAuthStore();
  const [request, , promptAsync] = useAuthRequest({
    intent: 'signup',
    forceInteractive: forceInteractiveAuth,
  });
  const incomingRequestCount = useSocialStore((state) =>
    state.ownerId === user?.sub ? state.incoming.length : 0
  );
  const refreshSocial = useSocialStore((state) => state.refresh);

  const scope: LeaderboardScope = friendsOnly && isAuthenticated ? 'friends' : 'global';
  const datasetKey = getLeaderboardDatasetKey(scope, period);
  const activeResponse = scope === 'friends' ? friendsData[period] : globalData[period];
  const activeData: Row[] = activeResponse?.leaderboard ?? [];
  const activeLoading = Boolean(loading[datasetKey]);
  const activeError = errors[datasetKey];
  const actorType = isAuthenticated ? 'authenticated' : 'guest';

  const loadCurrent = useCallback(async (force = false) => {
    if (scope === 'friends' && user?.sub) {
      await revalidateFriends(user.sub, period, { force });
    } else {
      await revalidateGlobal(period, { force });
    }
  }, [period, revalidateFriends, revalidateGlobal, scope, user?.sub]);

  useEffect(() => {
    if (!isAuthenticated && friendsOnly) setFriendsOnly(false);
  }, [friendsOnly, isAuthenticated]);

  useEffect(() => {
    const userId = user?.sub;
    if (userId) void hydratePeriodFromCache(userId, period).then(() => loadCurrent());
    else void loadCurrent();
  }, [hydratePeriodFromCache, loadCurrent, period, user?.sub]);

  useEffect(() => {
    if (scope === 'friends' && authStatus === 'authenticated' && identityStatus === 'complete') {
      void loadCurrent();
    }
  }, [authStatus, identityStatus, loadCurrent, scope]);

  useFocusEffect(
    useCallback(() => {
      void loadCurrent();
      if (isAuthenticated && user?.sub) void refreshSocial(user.sub);
      trackAnalyticsEvent('leaderboard_viewed', actorType, {
        leaderboardScope: scope,
        leaderboardPeriod: period,
      });
    }, [actorType, isAuthenticated, loadCurrent, period, refreshSocial, scope, user?.sub])
  );

  const handleCreateAccount = async () => {
    setIsAuthLoading(true);
    clearError();
    try {
      await loginWithAuth0({ intent: 'signup', request, promptAsync });
    } catch (error) {
      console.error('Token exchange error:', error);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadCurrent(true).finally(() => setRefreshing(false));
  };

  const selectPeriod = (nextPeriod: LeaderboardPeriod) => {
    if (nextPeriod === period) return;
    setPeriod(nextPeriod);
    trackAnalyticsEvent('leaderboard_filter_changed', actorType, {
      leaderboardScope: scope,
      leaderboardPeriod: nextPeriod,
    });
  };

  const toggleFriends = () => {
    if (!isAuthenticated) return;
    const nextFriendsOnly = !friendsOnly;
    setFriendsOnly(nextFriendsOnly);
    trackAnalyticsEvent('leaderboard_filter_changed', actorType, {
      leaderboardScope: nextFriendsOnly ? 'friends' : 'global',
      leaderboardPeriod: period,
    });
  };

  const renderRow = ({ item, index }: { item: Row; index: number }) => {
    const friendEntry = scope === 'friends' ? item as FriendsLeaderboardEntry : null;
    const hasPlayed = friendEntry ? friendEntry.hasPlayedPeriod : true;
    const isCurrentUser = item.userId === user?.sub;
    const stats = period === 'weekly'
      ? `${item.score} pts • ${item.gamesPlayed}/7 played`
      : `${item.score} pts • ${formatStreakLabel(item.streak)}`;
    const notPlayed = period === 'weekly' ? 'No score this week' : 'Not played today';

    return (
      <TouchableOpacity
        style={[styles.leaderboardItem, isCurrentUser && styles.currentUserItem]}
        onPress={() => openPlayerProfile({
          playerId: item.userId,
          username: item.username,
          avatarId: item.avatarId,
        })}
        accessibilityRole="button"
        accessibilityLabel={`View ${formatPublicPlayerName(item.username)} profile`}
      >
        {hasPlayed && item.rank ? (
          <View style={styles.rankContainer}>
            <Text style={styles.rank}>#{item.rank || index + 1}</Text>
          </View>
        ) : (
          <View style={[styles.rankContainer, styles.rankContainerEmpty]}>
            <Ionicons name="time-outline" size={16} color={theme.colors.mediumGray} />
          </View>
        )}
        <Avatar userId={item.userId} username={item.username} avatarId={item.avatarId} size="md" />
        <View style={styles.playerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.playerName} numberOfLines={1}>
              {formatPublicPlayerName(item.username)}
            </Text>
            {isCurrentUser ? <Text style={styles.youBadge}>You</Text> : null}
          </View>
          <Text style={hasPlayed ? styles.playerStats : styles.notPlayedText}>
            {hasPlayed ? stats : notPlayed}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderGuestBanner = () => {
    if (isAuthenticated || !isAuth0Available) return null;
    return (
      <View style={[styles.guestBanner, centeredContentStyle, guestBannerWebStyle]}>
        <Text style={styles.guestBannerTitle}>Compete with friends</Text>
        <Text style={styles.guestBannerText}>
          Sign in to filter the leaderboard to you and your friends.
        </Text>
        <TouchableOpacity
          style={styles.createAccountButton}
          onPress={handleCreateAccount}
          disabled={isAuthLoading || !request}
          accessibilityRole="button"
        >
          {isAuthLoading ? <ActivityIndicator size="small" color={theme.colors.white} /> : (
            <Text style={styles.createAccountButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={scope === 'friends' ? 'people-outline' : 'trophy-outline'}
        size={48}
        color={theme.colors.mediumGray}
      />
      <Text style={styles.emptyText}>
        {scope === 'friends' ? 'No friends yet' : 'No leaderboard data yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {scope === 'friends'
          ? 'Add friends to build your personal leaderboard.'
          : period === 'weekly'
            ? 'Be the first to score this week!'
            : "Be the first to complete today's quiz!"}
      </Text>
      {scope === 'friends' ? (
        <TouchableOpacity style={styles.inviteFriendsButton} onPress={() => setShowManageFriends(true)}>
          <Text style={styles.inviteFriendsButtonText}>Invite Friends</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderPlaceholder = () => (
    <View style={[styles.placeholderList, centeredContentStyle, responsiveHorizontalPadding]}>
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

  const subtitle = scope === 'friends' && activeResponse && 'totalFriends' in activeResponse
    ? `${activeResponse.friendsPlayedPeriod} of ${activeResponse.totalFriends} friends scored ${period === 'weekly' ? 'this week' : 'today'}`
    : period === 'weekly' ? "This week's top players" : "Today's top players";

  if (isAuthLoading) return <AuthSyncScreen />;

  return (
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
      {renderGuestBanner()}
      <View style={[styles.header, centeredContentStyle, responsiveHorizontalPadding]}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>League Tables</Text>
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.manageFriendsButton}
              onPress={() => setShowManageFriends(true)}
              accessibilityRole="button"
              accessibilityLabel="Add friends"
            >
              <Ionicons name="person-add" size={18} color={theme.colors.white} />
              <Text style={styles.manageFriendsButtonText}>Add Friends</Text>
              {incomingRequestCount > 0 ? (
                <View style={styles.requestBadge}>
                  <Text style={styles.requestBadgeText}>{Math.min(incomingRequestCount, 99)}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.filtersRow}>
          <View style={styles.periodControl} accessibilityRole="tablist">
            {(['daily', 'weekly'] as const).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.periodOption, period === option && styles.filterActive]}
                onPress={() => selectPeriod(option)}
                accessibilityRole="tab"
                accessibilityState={{ selected: period === option }}
              >
                <Text style={[styles.filterText, period === option && styles.filterTextActive]}>
                  {option === 'daily' ? 'Daily' : 'Weekly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[
              styles.friendsFilter,
              friendsOnly && styles.filterActive,
              !isAuthenticated && styles.filterDisabled,
            ]}
            onPress={toggleFriends}
            disabled={!isAuthenticated}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: friendsOnly, disabled: !isAuthenticated }}
            accessibilityLabel={isAuthenticated ? 'Friends only' : 'Friends only, sign in required'}
          >
            <Ionicons
              name="people"
              size={16}
              color={friendsOnly ? theme.colors.white : theme.colors.mediumGray}
            />
            <Text style={[styles.filterText, friendsOnly && styles.filterTextActive]}>Friends only</Text>
          </TouchableOpacity>
        </View>
        {activeError ? <Text style={styles.errorText}>Could not refresh. Showing saved scores.</Text> : null}
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {activeData.length === 0 && activeLoading ? renderPlaceholder() : (
        <FlatList
          data={activeData}
          renderItem={renderRow}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={[styles.listContainer, centeredContentStyle, responsiveHorizontalPadding]}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
          }
        />
      )}

      <ManageFriendsModal
        visible={showManageFriends}
        onClose={() => setShowManageFriends(false)}
        onFriendsChanged={() => user?.sub && void invalidateFriends(user.sub, period)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { padding: theme.spacing.lg, paddingBottom: theme.spacing.sm },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md,
  },
  title: { fontSize: 24, fontFamily: theme.fonts.gothamBlack, color: theme.colors.textDark },
  manageFriendsButton: {
    minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary,
  },
  manageFriendsButtonText: { fontSize: 13, fontFamily: theme.fonts.gothamBold, color: theme.colors.white },
  requestBadge: { minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: theme.colors.white, alignItems: 'center', justifyContent: 'center' },
  requestBadgeText: { color: theme.colors.primary, fontFamily: theme.fonts.gothamBold, fontSize: 10 },
  filtersRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  periodControl: {
    flex: 1, flexDirection: 'row', backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md, padding: 4,
  },
  periodOption: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: theme.borderRadius.sm },
  friendsFilter: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md, backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.md,
  },
  filterActive: { backgroundColor: theme.colors.primary },
  filterDisabled: { opacity: 0.5 },
  filterText: { fontSize: 13, fontFamily: theme.fonts.gothamMedium, color: theme.colors.mediumGray },
  filterTextActive: { color: theme.colors.white },
  subtitle: { fontSize: 13, color: theme.colors.mediumGray, fontFamily: theme.fonts.gothamBook },
  errorText: { fontSize: 13, color: theme.colors.incorrect, fontFamily: theme.fonts.gothamBook, marginBottom: theme.spacing.xs },
  guestBanner: {
    marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, marginBottom: theme.spacing.md,
    padding: theme.spacing.lg, backgroundColor: theme.colors.white, borderRadius: theme.borderRadius.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.24, shadowRadius: 6, elevation: 3,
  },
  guestBannerTitle: { fontSize: 16, fontFamily: theme.fonts.gothamBold, color: theme.colors.textDark, marginBottom: theme.spacing.xs },
  guestBannerText: {
    fontSize: 13, fontFamily: theme.fonts.gothamBook, color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md, lineHeight: 18,
  },
  createAccountButton: {
    backgroundColor: theme.colors.primary, paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg, borderRadius: theme.borderRadius.md, alignItems: 'center',
  },
  createAccountButtonText: { color: theme.colors.white, fontSize: 14, fontFamily: theme.fonts.gothamBold },
  listContainer: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm, flexGrow: 1 },
  leaderboardItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.white,
    padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  currentUserItem: { borderWidth: 2, borderColor: theme.colors.primary },
  rankContainer: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.md,
  },
  rankContainerEmpty: { backgroundColor: theme.colors.lightGray },
  rank: { color: theme.colors.white, fontSize: 13, fontFamily: theme.fonts.gothamBold },
  playerInfo: { flex: 1, minWidth: 0, marginLeft: theme.spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.xs },
  playerName: { flexShrink: 1, fontSize: 15, fontFamily: theme.fonts.gothamMedium, color: theme.colors.textDark },
  youBadge: { marginLeft: theme.spacing.sm, fontSize: 11, fontFamily: theme.fonts.gothamMedium, color: theme.colors.primary },
  playerStats: { fontSize: 13, fontFamily: theme.fonts.gothamBook, color: theme.colors.mediumGray },
  notPlayedText: { fontSize: 13, fontFamily: theme.fonts.gothamBook, color: theme.colors.mediumGray },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: theme.spacing.xxl },
  emptyText: { marginTop: theme.spacing.md, fontSize: 18, fontFamily: theme.fonts.gothamBold, color: theme.colors.textDark },
  emptySubtext: {
    marginTop: theme.spacing.sm, fontSize: 14, fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray, textAlign: 'center', marginBottom: theme.spacing.lg,
  },
  inviteFriendsButton: {
    backgroundColor: theme.colors.primary, paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl, borderRadius: theme.borderRadius.md,
  },
  inviteFriendsButtonText: { color: theme.colors.white, fontSize: 14, fontFamily: theme.fonts.gothamBold },
  placeholderList: { padding: theme.spacing.lg, paddingTop: theme.spacing.sm },
  placeholderCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.white,
    padding: theme.spacing.lg, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.sm, opacity: 0.72,
  },
  placeholderRank: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.lightGray, marginRight: theme.spacing.md,
  },
  placeholderBody: { flex: 1 },
  placeholderLinePrimary: {
    height: 14, width: '48%', backgroundColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.sm, marginBottom: theme.spacing.sm,
  },
  placeholderLineSecondary: {
    height: 12, width: '62%', backgroundColor: theme.colors.lightGray, borderRadius: theme.borderRadius.sm,
  },
});
