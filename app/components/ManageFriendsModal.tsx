import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import type { Friend, FriendRequestSummary, PublicPlayer } from '../types';
import { createFriendLink } from '../services/api';
import { useAuthStore } from '../state/useAuthStore';
import Avatar from './Avatar';
import ShareFriendLinkModal from './ShareFriendLinkModal';
import { formatPublicPlayerName } from '../utils/publicIdentity';
import { formatStreakLabel } from '../../shared/streak';
import { normalizeSharedCode, resolveSharedCode } from '../services/sharedCode';
import { useSharedLinkFlow } from '../context/SharedLinkContext';
import { canProcessProtectedAction } from '../../shared/clientIdentityPolicy';
import { useSocialStore } from '../state/useSocialStore';
import { openPlayerProfile } from '../navigation/rootNavigation';

interface ManageFriendsModalProps {
  visible: boolean;
  onClose: () => void;
  onFriendsChanged?: () => void;
}

export default function ManageFriendsModal({
  visible,
  onClose,
  onFriendsChanged,
}: ManageFriendsModalProps) {
  const {
    user,
    token,
    isAuthenticated,
    authStatus,
    identityStatus,
    authStateVersion,
  } = useAuthStore();
  const hasVerifiedSession = Boolean(
    user?.sub &&
      canProcessProtectedAction(
        {
          isAuthenticated,
          authStatus,
          identityStatus,
          token,
          userId: user.sub,
          authStateVersion,
        },
        { userId: user.sub, authStateVersion }
      )
  );
  const { openSharedAction } = useSharedLinkFlow();
  const {
    ownerId,
    friends: storedFriends,
    incoming: storedIncoming,
    outgoing: storedOutgoing,
    loading,
    refresh: refreshSocial,
    respondRequest,
    cancelRequest,
    remove,
  } = useSocialStore();
  const friends = ownerId === user?.sub ? storedFriends : [];
  const incoming = ownerId === user?.sub ? storedIncoming : [];
  const outgoing = ownerId === user?.sub ? storedOutgoing : [];
  const [refreshing, setRefreshing] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [processingPlayerId, setProcessingPlayerId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [openingInvite, setOpeningInvite] = useState(false);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const loadFriends = useCallback(async () => {
    if (!user?.sub || !hasVerifiedSession) {
      setRefreshing(false);
      return;
    }
    await refreshSocial(user.sub);
    setRefreshing(false);
  }, [hasVerifiedSession, refreshSocial, user?.sub]);

  useEffect(() => {
    if (visible && user?.sub) {
      void loadFriends();
    }
  }, [visible, user?.sub, loadFriends]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFriends();
  };

  const handleGenerateLink = async () => {
    if (!user?.sub || !hasVerifiedSession) return;

    const expectedAuthStateVersion = authStateVersion;
    setGeneratingLink(true);
    try {
      const response = await createFriendLink(user.sub);
      if (useAuthStore.getState().authStateVersion !== expectedAuthStateVersion) return;
      setShareCode(response.code);
      setShareUrl(response.shareUrl);
      setShowShareModal(true);
    } catch (error) {
      console.error('Error generating friend link:', error);
      Alert.alert('Error', 'Failed to generate invite link. Please try again.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleEnterInvite = async () => {
    const action = resolveSharedCode(inviteCode);
    if (action.kind !== 'friendInvite') {
      Alert.alert('Invalid Code', 'Enter an 8-character friend invite code.');
      return;
    }
    setOpeningInvite(true);
    try {
      setInviteCode('');
      onClose();
      await openSharedAction(action);
    } finally {
      setOpeningInvite(false);
    }
  };

  const handleRemoveFriend = (friend: Friend) => {
    const friendName = formatPublicPlayerName(friend.username, null, 'this friend');

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined'
        && window.confirm(`Remove ${friendName} from your leaderboard?`);

      if (confirmed) {
        void confirmRemoveFriend(friend.id);
      }
      return;
    }

    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendName} from your leaderboard?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => confirmRemoveFriend(friend.id),
        },
      ]
    );
  };

  const confirmRemoveFriend = async (friendId: string) => {
    if (!user?.sub || !hasVerifiedSession) return;

    setProcessingPlayerId(friendId);
    try {
      await remove(user.sub, friendId);
      onFriendsChanged?.();
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Failed to remove friend. Please try again.');
    } finally {
      setProcessingPlayerId(null);
    }
  };

  const openProfile = (player: PublicPlayer) => {
    onClose();
    requestAnimationFrame(() => {
      openPlayerProfile({
        playerId: player.userId,
        username: player.username,
        avatarId: player.avatarId,
      });
    });
  };

  const handleRequestResponse = async (
    item: FriendRequestSummary,
    action: 'accept' | 'decline' | 'cancel'
  ) => {
    if (!user?.sub || !hasVerifiedSession) return;
    setProcessingPlayerId(item.player.userId);
    try {
      if (action === 'cancel') {
        await cancelRequest(user.sub, item.player.userId);
      } else {
        await respondRequest(user.sub, item.player.userId, action);
        if (action === 'accept') onFriendsChanged?.();
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Unable to update request.');
    } finally {
      setProcessingPlayerId(null);
    }
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Avatar
        userId={item.id}
        username={item.username}
        avatarId={item.avatarId}
        imageUrl={item.avatarUrl}
        size="md"
      />
      <TouchableOpacity style={styles.friendInfo} onPress={() => openProfile({
        userId: item.id,
        username: item.username,
        avatarId: item.avatarId,
        avatarUrl: item.avatarUrl,
      })} accessibilityRole="button" accessibilityLabel={`View ${formatPublicPlayerName(item.username)} profile`}>
        <Text style={styles.friendName}>
          {formatPublicPlayerName(item.username)}
        </Text>
        <Text style={styles.friendStats}>{formatStreakLabel(item.streak)}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.removeButton, !hasVerifiedSession && styles.buttonDisabled]}
        onPress={() => handleRemoveFriend(item)}
        disabled={!hasVerifiedSession || processingPlayerId === item.id}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${formatPublicPlayerName(item.username)}`}
      >
        {processingPlayerId === item.id ? (
          <ActivityIndicator size="small" color={theme.colors.incorrect} />
        ) : (
          <Ionicons name="close-circle" size={24} color={theme.colors.incorrect} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderRequest = (item: FriendRequestSummary, direction: 'incoming' | 'outgoing') => (
    <View key={item.requestId} style={styles.friendItem}>
      <Avatar userId={item.player.userId} username={item.player.username} avatarId={item.player.avatarId} size="md" />
      <TouchableOpacity style={styles.friendInfo} onPress={() => openProfile(item.player)} accessibilityRole="button" accessibilityLabel={`View ${formatPublicPlayerName(item.player.username)} profile`}>
        <Text style={styles.friendName}>{formatPublicPlayerName(item.player.username)}</Text>
        <Text style={styles.friendStats}>{direction === 'incoming' ? 'Wants to add you' : 'Request sent'}</Text>
      </TouchableOpacity>
      {processingPlayerId === item.player.userId ? <ActivityIndicator color={theme.colors.primary} /> : direction === 'incoming' ? (
        <View style={styles.requestActions}>
          <TouchableOpacity style={styles.acceptRequestButton} onPress={() => void handleRequestResponse(item, 'accept')} accessibilityRole="button" accessibilityLabel={`Accept ${formatPublicPlayerName(item.player.username)}'s friend request`}>
            <Ionicons name="checkmark" size={18} color={theme.colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.declineRequestButton} onPress={() => void handleRequestResponse(item, 'decline')} accessibilityRole="button" accessibilityLabel={`Decline ${formatPublicPlayerName(item.player.username)}'s friend request`}>
            <Ionicons name="close" size={18} color={theme.colors.mediumGray} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.declineRequestButton} onPress={() => void handleRequestResponse(item, 'cancel')} accessibilityRole="button" accessibilityLabel={`Cancel request to ${formatPublicPlayerName(item.player.username)}`}>
          <Ionicons name="close" size={18} color={theme.colors.mediumGray} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderRequestSections = () => (
    <>
      {incoming.length > 0 ? (
        <View style={styles.requestSection}>
          <Text style={styles.sectionTitle}>REQUESTS ({incoming.length})</Text>
          {incoming.map((item) => renderRequest(item, 'incoming'))}
        </View>
      ) : null}
      {outgoing.length > 0 ? (
        <View style={styles.requestSection}>
          <Text style={styles.sectionTitle}>SENT ({outgoing.length})</Text>
          {outgoing.map((item) => renderRequest(item, 'outgoing'))}
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>YOUR FRIENDS ({friends.length})</Text>
      {friends.length === 0 && (incoming.length > 0 || outgoing.length > 0) ? (
        <Text style={styles.noExistingFriends}>No existing friends yet.</Text>
      ) : null}
    </>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={48} color={theme.colors.mediumGray} />
      <Text style={styles.emptyTitle}>No friends yet</Text>
      <Text style={styles.emptyText}>
        Invite friends to compete on your personal leaderboard
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Friends</Text>
          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Invite Section */}
        <View style={styles.inviteSection}>
          <Text style={styles.actionTitle}>Add friends</Text>
          <Text style={styles.actionDescription}>
            Share your invite link or enter a code someone sent you.
          </Text>
          <TouchableOpacity
            style={[styles.inviteButton, !hasVerifiedSession && styles.buttonDisabled]}
            onPress={handleGenerateLink}
            disabled={!hasVerifiedSession || generatingLink}
          >
            {generatingLink ? (
              <ActivityIndicator size="small" color={theme.colors.white} />
            ) : (
              <>
                <Ionicons name="person-add" size={20} color={theme.colors.white} />
                <Text style={styles.inviteButtonText}>Invite a Friend</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              placeholder="Friend code"
              placeholderTextColor={theme.colors.mediumGray}
              value={inviteCode}
              onChangeText={(value) => setInviteCode(normalizeSharedCode(value))}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
              accessibilityLabel="Friend invite code"
            />
            <TouchableOpacity
              style={[
                styles.codeButton,
                (inviteCode.length !== 8 || openingInvite) && styles.buttonDisabled,
              ]}
              onPress={() => void handleEnterInvite()}
              disabled={inviteCode.length !== 8 || openingInvite}
              accessibilityState={{ disabled: inviteCode.length !== 8 || openingInvite, busy: openingInvite }}
            >
              {openingInvite ? (
                <ActivityIndicator size="small" color={theme.colors.white} />
              ) : (
                <Text style={styles.codeButtonText}>Add</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Friends List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            <FlatList
              data={friends}
              renderItem={renderFriendItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={renderRequestSections}
              ListEmptyComponent={incoming.length === 0 && outgoing.length === 0 ? renderEmptyState : null}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.primary}
                />
              }
            />
          </>
        )}
      </SafeAreaView>

      {/* Share Modal */}
      <ShareFriendLinkModal
        visible={showShareModal}
        code={shareCode}
        shareUrl={shareUrl}
        onClose={() => setShowShareModal(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  doneButton: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  doneButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.accent,
  },
  inviteSection: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  actionTitle: {
    fontSize: 17,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.md,
  },
  inviteButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  codeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  codeInput: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    letterSpacing: 1.5,
  },
  codeButton: {
    minWidth: 92,
    minHeight: 46,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  codeButtonText: {
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
    fontSize: 14,
  },
  inviteButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.mediumGray,
    paddingHorizontal: 0,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  friendInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  friendName: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    marginBottom: 2,
  },
  friendStats: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  removeButton: {
    padding: theme.spacing.xs,
  },
  requestSection: {
    marginBottom: theme.spacing.sm,
  },
  noExistingFriends: {
    marginBottom: theme.spacing.md,
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  requestActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  acceptRequestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineRequestButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
});
