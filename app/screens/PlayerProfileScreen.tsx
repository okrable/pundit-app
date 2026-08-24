import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/rootNavigation';
import type { PublicPlayerProfile } from '../types';
import type { FriendRelationshipState } from '../../shared/socialPolicy';
import { ACHIEVEMENTS } from '../../shared/achievements';
import Avatar from '../components/Avatar';
import AuthSyncScreen from '../components/AuthSyncScreen';
import { useAuthRequest } from '../services/auth0';
import { loginWithAuth0 } from '../services/authFlow';
import { getPlayerProfile } from '../services/api';
import { trackAnalyticsEvent } from '../services/analytics';
import { getCachedPlayerProfile, setCachedPlayerProfile } from '../storage/playerProfileCache';
import { savePendingPlayerProfile } from '../storage/playerProfileContinuation';
import { useAuthStore } from '../state/useAuthStore';
import { useSocialStore } from '../state/useSocialStore';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';
import { theme } from '../theme/theme';
import { useCenteredWebStyle, useMobileLayoutMetrics, webContentWidth } from '../components/ResponsiveLayout';
import { formatPublicPlayerName } from '../utils/publicIdentity';
import { formatStreakLabel } from '../../shared/streak';

type Props = NativeStackScreenProps<RootStackParamList, 'PlayerProfile'>;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

export default function PlayerProfileScreen({ route }: Props) {
  const { playerId, username, avatarId } = route.params;
  const centeredStyle = useCenteredWebStyle(webContentWidth.quiz);
  const { screenPadding } = useMobileLayoutMetrics();
  const auth = useAuthStore();
  const [request, , promptAsync] = useAuthRequest({ intent: 'login', forceInteractive: auth.forceInteractiveAuth });
  const [profile, setProfile] = useState<PublicPlayerProfile | null>(null);
  const [relationship, setRelationship] = useState<FriendRelationshipState>('guest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const trackedPlayerRef = useRef<string | null>(null);
  const { sendRequest, respondRequest, cancelRequest, remove } = useSocialStore();

  const hasVerifiedSession = Boolean(
    auth.user?.sub && canProcessProtectedAction(
      {
        isAuthenticated: auth.isAuthenticated,
        authStatus: auth.authStatus,
        identityStatus: auth.identityStatus,
        token: auth.token,
        userId: auth.user.sub,
        authStateVersion: auth.authStateVersion,
      },
      { userId: auth.user.sub, authStateVersion: auth.authStateVersion }
    )
  );

  const load = useCallback(async (force = false) => {
    const requestId = ++requestIdRef.current;
    const startedVersion = useAuthStore.getState().authStateVersion;
    let hasCachedProfile = false;
    if (!force) {
      const cached = await getCachedPlayerProfile(playerId);
      hasCachedProfile = Boolean(cached);
      if (requestId === requestIdRef.current && cached) setProfile(cached.data);
    }
    if (requestId === requestIdRef.current) {
      setLoading(!hasCachedProfile);
      setError(null);
    }
    try {
      const currentAuth = useAuthStore.getState();
      const verifiedViewer = currentAuth.user?.sub && canProcessProtectedAction(
        {
          isAuthenticated: currentAuth.isAuthenticated,
          authStatus: currentAuth.authStatus,
          identityStatus: currentAuth.identityStatus,
          token: currentAuth.token,
          userId: currentAuth.user.sub,
          authStateVersion: currentAuth.authStateVersion,
        },
        { userId: currentAuth.user.sub, authStateVersion: currentAuth.authStateVersion }
      ) ? currentAuth.user.sub : undefined;
      const response = await getPlayerProfile(playerId, verifiedViewer);
      if (requestId !== requestIdRef.current) return;
      if (useAuthStore.getState().authStateVersion !== startedVersion) return;
      setProfile(response.profile);
      setRelationship(response.relationship);
      await setCachedPlayerProfile(response.profile);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(loadError instanceof Error ? loadError.message : 'Player profile unavailable');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [playerId]);

  useEffect(() => {
    void load();
  }, [auth.authStatus, auth.identityStatus, auth.authStateVersion, load]);

  useEffect(() => {
    if (trackedPlayerRef.current === playerId) return;
    trackedPlayerRef.current = playerId;
    trackAnalyticsEvent(
      'player_profile_viewed',
      auth.isAuthenticated ? 'authenticated' : 'guest'
    );
  }, [auth.isAuthenticated, playerId]);

  const runAction = async (action: () => Promise<FriendRelationshipState>) => {
    setActionLoading(true);
    setError(null);
    try {
      setRelationship(await action());
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update friendship');
    } finally {
      setActionLoading(false);
    }
  };

  const signInToAdd = async () => {
    await savePendingPlayerProfile({ playerId, username: profile?.username ?? username ?? null, avatarId: profile?.avatarId ?? avatarId });
    setAuthLoading(true);
    auth.clearError();
    try {
      await loginWithAuth0({ intent: 'login', request, promptAsync });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in');
    } finally {
      setAuthLoading(false);
    }
  };

  const confirmRemove = () => {
    if (!auth.user?.sub) return;
    const playerName = formatPublicPlayerName(profile?.username ?? username);
    const execute = () => runAction(async () => {
      await remove(auth.user!.sub, playerId);
      return 'none';
    });
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(`Remove ${playerName} as a friend?`)) void execute();
      return;
    }
    Alert.alert('Remove Friend', `Remove ${playerName} as a friend?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void execute() },
    ]);
  };

  const actionContent = () => {
    if (!profile) return null;
    if (auth.isAuthenticated && !hasVerifiedSession) {
      return <TouchableOpacity style={[styles.primaryButton, styles.disabled]} disabled><Text style={styles.primaryText}>Account syncing</Text></TouchableOpacity>;
    }
    if (!auth.isAuthenticated) {
      return <TouchableOpacity style={styles.primaryButton} onPress={() => void signInToAdd()} disabled={!request || authLoading}><Text style={styles.primaryText}>Sign in to add</Text></TouchableOpacity>;
    }
    if (relationship === 'guest') {
      return <TouchableOpacity style={[styles.primaryButton, styles.disabled]} disabled><Text style={styles.primaryText}>{error ? 'Friend actions unavailable' : 'Loading account'}</Text></TouchableOpacity>;
    }
    if (!auth.user?.sub || actionLoading) {
      return <View style={styles.actionSpinner}><ActivityIndicator color={theme.colors.primary} /></View>;
    }
    if (relationship === 'self') {
      return <View style={styles.statusButton}><Ionicons name="person" size={18} color={theme.colors.primary} /><Text style={styles.statusText}>This is you</Text></View>;
    }
    if (relationship === 'none') {
      return <TouchableOpacity style={styles.primaryButton} onPress={() => void runAction(async () => (await sendRequest(auth.user!.sub, playerId)).relationship)}><Text style={styles.primaryText}>Add Friend</Text></TouchableOpacity>;
    }
    if (relationship === 'outgoing_pending') {
      return <View style={styles.actionRow}><View style={styles.statusButton}><Text style={styles.statusText}>Request Sent</Text></View><TouchableOpacity style={styles.secondaryButton} onPress={() => void runAction(async () => (await cancelRequest(auth.user!.sub, playerId)).relationship)}><Text style={styles.secondaryText}>Cancel</Text></TouchableOpacity></View>;
    }
    if (relationship === 'incoming_pending') {
      return <View style={styles.actionRow}><TouchableOpacity style={[styles.primaryButton, styles.flexButton]} onPress={() => void runAction(async () => (await respondRequest(auth.user!.sub, playerId, 'accept')).relationship)}><Text style={styles.primaryText}>Accept</Text></TouchableOpacity><TouchableOpacity style={[styles.secondaryButton, styles.flexButton]} onPress={() => void runAction(async () => (await respondRequest(auth.user!.sub, playerId, 'decline')).relationship)}><Text style={styles.secondaryText}>Decline</Text></TouchableOpacity></View>;
    }
    return <View style={styles.actionRow}><View style={styles.statusButton}><Ionicons name="people" size={18} color={theme.colors.primary} /><Text style={styles.statusText}>Friends</Text></View><TouchableOpacity style={styles.removeButton} onPress={confirmRemove}><Text style={styles.removeText}>Remove Friend</Text></TouchableOpacity></View>;
  };

  if (authLoading) return <AuthSyncScreen />;
  const displayName = profile?.username ?? username;
  const displayAvatar = profile?.avatarId ?? avatarId;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, centeredStyle, Platform.OS === 'web' && { paddingHorizontal: screenPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={theme.colors.primary} />}
      >
        <View style={styles.hero}>
          <Avatar userId={playerId} username={displayName} avatarId={displayAvatar} size="lg" />
          <Text style={styles.username}>{formatPublicPlayerName(displayName)}</Text>
          <Text style={styles.caption}>Player profile</Text>
          {actionContent()}
        </View>

        {loading && !profile ? <ActivityIndicator style={styles.loader} color={theme.colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !profile ? (
          <View style={styles.unavailableCard}>
            <Ionicons name="person-circle-outline" size={42} color={theme.colors.mediumGray} />
            <Text style={styles.unavailableTitle}>Profile unavailable</Text>
            <Text style={styles.emptyText}>This player may no longer be available.</Text>
          </View>
        ) : null}
        {profile ? (
          <>
            <View style={styles.statsRow}>
              <Stat label="Current streak" value={formatStreakLabel(profile.currentStreak)} />
              <Stat label="Best score" value={`${profile.bestScore} pts`} />
              <Stat label="Quizzes" value={String(profile.totalQuizzes)} />
            </View>
            <View style={styles.achievementSection}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
                <Text style={styles.sectionCount}>{profile.achievements.length} earned</Text>
              </View>
              {profile.achievements.length === 0 ? (
                <View style={styles.emptyAchievements}><Text style={styles.emptyText}>No achievements earned yet.</Text></View>
              ) : profile.achievements.map((unlock) => {
                const definition = ACHIEVEMENTS.find((item) => item.id === unlock.id);
                if (!definition) return null;
                return (
                  <View key={unlock.id} style={styles.achievementCard}>
                    <View style={styles.medal}><Ionicons name={definition.icon as React.ComponentProps<typeof Ionicons>['name']} size={23} color={theme.colors.white} /></View>
                    <View style={styles.achievementCopy}>
                      <View style={styles.achievementTitleRow}><Text style={styles.achievementTitle}>{definition.title}</Text><Text style={styles.date}>{formatDate(unlock.unlockedAt)}</Text></View>
                      <Text style={styles.description}>{definition.description}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  hero: { alignItems: 'center', paddingVertical: theme.spacing.lg },
  username: { marginTop: theme.spacing.md, fontFamily: theme.fonts.gothamBlack, fontSize: 24, color: theme.colors.textDark },
  caption: { marginTop: 2, marginBottom: theme.spacing.lg, fontFamily: theme.fonts.gothamBook, fontSize: 13, color: theme.colors.mediumGray },
  loader: { marginVertical: theme.spacing.xl },
  error: { textAlign: 'center', marginBottom: theme.spacing.md, color: theme.colors.incorrect, fontFamily: theme.fonts.gothamBook },
  primaryButton: { minHeight: 44, minWidth: 150, paddingHorizontal: theme.spacing.lg, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: theme.colors.white, fontFamily: theme.fonts.gothamBold, fontSize: 14 },
  secondaryButton: { minHeight: 44, paddingHorizontal: theme.spacing.lg, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: theme.colors.lightGray, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: theme.colors.textDark, fontFamily: theme.fonts.gothamBold, fontSize: 13 },
  removeButton: { minHeight: 44, paddingHorizontal: theme.spacing.md, justifyContent: 'center' },
  removeText: { color: theme.colors.incorrect, fontFamily: theme.fonts.gothamBold, fontSize: 13 },
  statusButton: { minHeight: 44, flexDirection: 'row', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.lg, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  statusText: { color: theme.colors.primary, fontFamily: theme.fonts.gothamBold, fontSize: 13 },
  actionRow: { width: '100%', maxWidth: 380, flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center' },
  flexButton: { flex: 1, minWidth: 0 },
  actionSpinner: { minHeight: 44, justifyContent: 'center' },
  disabled: { opacity: 0.55 },
  statsRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  stat: { flex: 1, minWidth: 0, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.xs, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.white, alignItems: 'center' },
  statValue: { fontFamily: theme.fonts.gothamBold, fontSize: 16, color: theme.colors.textDark, textAlign: 'center' },
  statLabel: { marginTop: 3, fontFamily: theme.fonts.gothamBook, fontSize: 10, color: theme.colors.mediumGray, textAlign: 'center' },
  achievementSection: { marginBottom: theme.spacing.xxl },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  sectionTitle: { fontFamily: theme.fonts.gothamBold, fontSize: 13, letterSpacing: 1, color: theme.colors.mediumGray },
  sectionCount: { fontFamily: theme.fonts.gothamBook, fontSize: 12, color: theme.colors.mediumGray },
  achievementCard: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.white },
  medal: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  achievementCopy: { flex: 1, minWidth: 0 },
  achievementTitleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm },
  achievementTitle: { flex: 1, fontFamily: theme.fonts.gothamBold, fontSize: 15, color: theme.colors.textDark },
  date: { fontFamily: theme.fonts.gothamBook, fontSize: 10, color: theme.colors.mediumGray },
  description: { marginTop: 2, fontFamily: theme.fonts.gothamBook, fontSize: 12, lineHeight: 17, color: theme.colors.mediumGray },
  emptyAchievements: { padding: theme.spacing.xl, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.white, alignItems: 'center' },
  unavailableCard: { padding: theme.spacing.xl, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.white, alignItems: 'center' },
  unavailableTitle: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.xs, fontFamily: theme.fonts.gothamBold, fontSize: 17, color: theme.colors.textDark },
  emptyText: { fontFamily: theme.fonts.gothamBook, fontSize: 13, color: theme.colors.mediumGray },
});
