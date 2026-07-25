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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import { Friend } from '../types';
import { getFriends, removeFriend, createFriendLink } from '../services/api';
import { useAuthStore } from '../state/useAuthStore';
import Avatar from './Avatar';
import ShareFriendLinkModal from './ShareFriendLinkModal';

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
  const { user } = useAuthStore();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const loadFriends = useCallback(async () => {
    if (!user?.sub) return;

    try {
      const response = await getFriends(user.sub);
      setFriends(response.friends);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.sub]);

  useEffect(() => {
    if (visible && user?.sub) {
      setLoading(true);
      loadFriends();
    }
  }, [visible, user?.sub, loadFriends]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadFriends();
  };

  const handleGenerateLink = async () => {
    if (!user?.sub) return;

    setGeneratingLink(true);
    try {
      const response = await createFriendLink(user.sub);
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

  const handleRemoveFriend = (friend: Friend) => {
    const friendName = friend.displayName || friend.username || 'this friend';

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
    if (!user?.sub) return;

    setRemovingFriendId(friendId);
    try {
      await removeFriend(user.sub, friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      onFriendsChanged?.();
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Failed to remove friend. Please try again.');
    } finally {
      setRemovingFriendId(null);
    }
  };

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <Avatar
        userId={item.id}
        displayName={item.displayName}
        username={item.username}
        imageUrl={item.avatarUrl}
        size="md"
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName}>
          {item.username ? `@${item.username}` : item.displayName || 'Anonymous'}
        </Text>
        <Text style={styles.friendStats}>Streak: {item.streak}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveFriend(item)}
        disabled={removingFriendId === item.id}
      >
        {removingFriendId === item.id ? (
          <ActivityIndicator size="small" color={theme.colors.incorrect} />
        ) : (
          <Ionicons name="close-circle" size={24} color={theme.colors.incorrect} />
        )}
      </TouchableOpacity>
    </View>
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
          <TouchableOpacity
            style={styles.inviteButton}
            onPress={handleGenerateLink}
            disabled={generatingLink}
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
        </View>

        {/* Friends List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <>
            {friends.length > 0 && (
              <Text style={styles.sectionTitle}>
                YOUR FRIENDS ({friends.length})
              </Text>
            )}
            <FlatList
              data={friends}
              renderItem={renderFriendItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmptyState}
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
  inviteButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
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
    paddingHorizontal: theme.spacing.lg,
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
