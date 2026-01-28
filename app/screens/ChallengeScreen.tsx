import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useChallengeStore } from '../state/useChallengeStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { theme } from '../theme/theme';
import ShareChallengeModal from '../components/ShareChallengeModal';
import type { ChallengeHistoryItem } from '../types';

export default function ChallengeScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuthStore();
  const {
    activeChallenge,
    history,
    stats,
    isLoading,
    error,
    fetchUserChallenges,
    createChallenge,
    revokeChallenge,
    joinChallenge,
    currentChallenge,
    clearError,
  } = useChallengeStore();

  const [joinCode, setJoinCode] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch challenges and user ID when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const id = isAuthenticated && user ? user.sub : await getUserId();
        setUserId(id);
        await fetchUserChallenges(id);
      };
      loadData();
    }, [isAuthenticated, user])
  );

  const handleCreateChallenge = async () => {
    if (!userId) return;
    setIsCreating(true);
    clearError();
    try {
      const displayName = isAuthenticated && user ? user.name : undefined;
      const code = await createChallenge(userId, displayName);
      setCreatedCode(code);
      setShowShareModal(true);
    } catch (err) {
      Alert.alert('Error', error || 'Failed to create challenge');
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeChallenge = async () => {
    if (!userId) return;
    Alert.alert(
      'Cancel Challenge',
      'Are you sure you want to cancel this challenge?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeChallenge(userId);
              await fetchUserChallenges(userId);
            } catch (err) {
              Alert.alert('Error', 'Failed to cancel challenge');
            }
          },
        },
      ]
    );
  };

  const handleJoinChallenge = async () => {
    if (!userId || !joinCode.trim()) return;
    setIsJoining(true);
    clearError();
    try {
      const displayName = isAuthenticated && user ? user.name : undefined;
      await joinChallenge(joinCode.toUpperCase().trim(), userId, displayName);
      setJoinCode('');
      // Navigate to quiz
      navigation.navigate('ChallengeQuiz');
    } catch (err) {
      Alert.alert('Error', error || 'Failed to join challenge');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePlayNow = () => {
    setShowShareModal(false);
    navigation.navigate('ChallengeQuiz');
  };

  const handleShareModalClose = () => {
    setShowShareModal(false);
    setCreatedCode(null);
    // Refresh challenges to show the new active challenge
    if (userId) {
      fetchUserChallenges(userId);
    }
  };

  const handlePlayActiveChallenge = async () => {
    if (!activeChallenge || !userId) return;
    // Set up the current challenge for playing
    // The challenge questions need to be fetched - we'll navigate and the quiz screen will handle it
    navigation.navigate('ChallengeQuiz', { challengeId: activeChallenge.challengeId });
  };

  const getResultColor = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win':
        return theme.colors.correct;
      case 'loss':
        return theme.colors.incorrect;
      default:
        return theme.colors.mediumGray;
    }
  };

  const getResultIcon = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win':
        return 'checkmark-circle';
      case 'loss':
        return 'close-circle';
      default:
        return 'remove-circle';
    }
  };

  const getResultText = (result: 'win' | 'loss' | 'draw') => {
    switch (result) {
      case 'win':
        return 'Won';
      case 'loss':
        return 'Lost';
      default:
        return 'Draw';
    }
  };

  const renderHistoryItem = (item: ChallengeHistoryItem) => (
    <View key={item.challengeId} style={styles.historyCard}>
      <View style={styles.historyLeft}>
        <Ionicons
          name={getResultIcon(item.result)}
          size={24}
          color={getResultColor(item.result)}
        />
        <View style={styles.historyInfo}>
          <Text style={styles.historyOpponent}>
            vs {item.opponentDisplayName || 'Anonymous'}
          </Text>
          <Text style={styles.historyDate}>
            {new Date(item.completedAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <View style={styles.historyRight}>
        <Text style={[styles.historyResult, { color: getResultColor(item.result) }]}>
          {getResultText(item.result)}
        </Text>
        <Text style={styles.historyScore}>
          {item.yourScore} - {item.opponentScore}
        </Text>
      </View>
    </View>
  );

  const isGuest = userId?.startsWith('guest_');

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Create/Active Challenge Section */}
        <View style={styles.section}>
          {activeChallenge ? (
            <View style={styles.activeCard}>
              <View style={styles.activeHeader}>
                <Ionicons name="flash" size={24} color={theme.colors.accent} />
                <Text style={styles.activeTitle}>Active Challenge</Text>
              </View>
              <View style={styles.codeDisplay}>
                <Text style={styles.codeLabel}>Challenge Code</Text>
                <Text style={styles.codeValue}>{activeChallenge.code}</Text>
              </View>
              <Text style={styles.activeStatus}>
                {activeChallenge.status === 'pending'
                  ? 'Waiting for opponent to join...'
                  : activeChallenge.isCreator
                  ? activeChallenge.hasCreatorPlayed
                    ? 'Waiting for opponent to play...'
                    : 'Your turn to play!'
                  : activeChallenge.hasOpponentPlayed
                  ? 'Waiting for opponent to play...'
                  : 'Your turn to play!'}
              </Text>
              <View style={styles.activeButtons}>
                {activeChallenge.status === 'pending' ? (
                  <>
                    <TouchableOpacity
                      style={styles.shareButton}
                      onPress={() => {
                        setCreatedCode(activeChallenge.code);
                        setShowShareModal(true);
                      }}
                    >
                      <Ionicons name="share-outline" size={18} color={theme.colors.white} />
                      <Text style={styles.shareButtonText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={handleRevokeChallenge}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.playButton,
                      (activeChallenge.isCreator
                        ? activeChallenge.hasCreatorPlayed
                        : activeChallenge.hasOpponentPlayed) && styles.playButtonDisabled,
                    ]}
                    onPress={handlePlayActiveChallenge}
                    disabled={
                      activeChallenge.isCreator
                        ? activeChallenge.hasCreatorPlayed
                        : activeChallenge.hasOpponentPlayed
                    }
                  >
                    <Text style={styles.playButtonText}>
                      {(activeChallenge.isCreator
                        ? activeChallenge.hasCreatorPlayed
                        : activeChallenge.hasOpponentPlayed)
                        ? 'Already Played'
                        : 'Play Now'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.createCard}>
              <Ionicons name="flash-outline" size={32} color={theme.colors.accent} />
              <Text style={styles.createTitle}>Create a Challenge</Text>
              <Text style={styles.createSubtitle}>
                Challenge a friend to today's quiz!
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateChallenge}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.createButtonText}>Create Challenge</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Join Challenge Section */}
        <View style={styles.section}>
          <View style={styles.joinCard}>
            <View style={styles.joinHeader}>
              <Ionicons name="link-outline" size={24} color={theme.colors.primary} />
              <Text style={styles.joinTitle}>Join a Challenge</Text>
            </View>
            <View style={styles.joinInputRow}>
              <TextInput
                style={styles.joinInput}
                placeholder="Enter code"
                placeholderTextColor={theme.colors.mediumGray}
                value={joinCode}
                onChangeText={(text) => setJoinCode(text.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  (!joinCode.trim() || isJoining) && styles.joinButtonDisabled,
                ]}
                onPress={handleJoinChallenge}
                disabled={!joinCode.trim() || isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.joinButtonText}>Join</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats Section */}
        {!isGuest && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.wins}</Text>
                <Text style={styles.statLabel}>Wins</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.losses}</Text>
                <Text style={styles.statLabel}>Losses</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.draws}</Text>
                <Text style={styles.statLabel}>Draws</Text>
              </View>
            </View>
          </View>
        )}

        {/* History Section */}
        {!isGuest && history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Challenges</Text>
            {history.map(renderHistoryItem)}
          </View>
        )}

        {/* Guest Banner */}
        {isGuest && (
          <View style={styles.guestBanner}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.mediumGray} />
            <Text style={styles.guestText}>
              Create an account to save your challenge history and stats!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Share Modal */}
      {createdCode && (
        <ShareChallengeModal
          visible={showShareModal}
          code={createdCode}
          onClose={handleShareModalClose}
          onPlayNow={handlePlayNow}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
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
  // Create Challenge Card
  createCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  createTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  createSubtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xxl,
    borderRadius: theme.borderRadius.md,
    minWidth: 180,
    alignItems: 'center',
  },
  createButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  // Active Challenge Card
  activeCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  activeTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginLeft: theme.spacing.sm,
  },
  codeDisplay: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.xs,
  },
  codeValue: {
    fontSize: 28,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    letterSpacing: 4,
  },
  activeStatus: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  activeButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  shareButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.lightGray,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: theme.colors.textDark,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  playButton: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  playButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  playButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  // Join Challenge Card
  joinCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  joinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  joinTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginLeft: theme.spacing.sm,
  },
  joinInputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  joinInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: 18,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    letterSpacing: 2,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  joinButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  // History
  historyCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  historyInfo: {
    gap: 2,
  },
  historyOpponent: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  historyDate: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyResult: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
  },
  historyScore: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  // Guest Banner
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  guestText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
});
