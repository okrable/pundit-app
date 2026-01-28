import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useChallengeStore } from '../state/useChallengeStore';
import { theme } from '../theme/theme';
import type { ChallengeSubmitResult, ChallengeAnswer } from '../types';

type RouteParams = {
  ChallengeResults: {
    result: ChallengeSubmitResult;
    code: string;
    opponentName: string | null;
    isCreator: boolean;
  };
};

export default function ChallengeResultsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'ChallengeResults'>>();
  const { clearCurrentChallenge } = useChallengeStore();
  const [copied, setCopied] = useState(false);

  const { result, code, opponentName, isCreator } = route.params;
  const isWaiting = result.status === 'waiting';
  const isComplete = result.status === 'complete';

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I challenge you to beat my score on Pundit! Enter code: ${code}`,
        title: 'Pundit Challenge',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleBackToChallenges = () => {
    clearCurrentChallenge();
    navigation.navigate('Main', { screen: 'Challenge' });
  };

  const handleNewChallenge = () => {
    clearCurrentChallenge();
    navigation.navigate('Main', { screen: 'Challenge' });
  };

  const getResultTitle = () => {
    if (!isComplete) return '';
    switch (result.result) {
      case 'win':
        return 'You Win!';
      case 'loss':
        return 'You Lose';
      case 'draw':
        return "It's a Draw!";
      default:
        return 'Challenge Complete';
    }
  };

  const getResultIcon = () => {
    if (!isComplete) return 'hourglass-outline';
    switch (result.result) {
      case 'win':
        return 'trophy';
      case 'loss':
        return 'sad-outline';
      case 'draw':
        return 'swap-horizontal';
      default:
        return 'checkmark-circle';
    }
  };

  const getResultColor = () => {
    if (!isComplete) return theme.colors.accent;
    switch (result.result) {
      case 'win':
        return theme.colors.correct;
      case 'loss':
        return theme.colors.incorrect;
      case 'draw':
        return theme.colors.mediumGray;
      default:
        return theme.colors.primary;
    }
  };

  const correctCount = result.yourAnswers.filter((a) => a.isCorrect).length;

  const renderQuestionBreakdown = () => {
    if (!isComplete || !result.opponentAnswers) return null;

    return (
      <View style={styles.breakdownSection}>
        <Text style={styles.sectionTitle}>Question Breakdown</Text>
        {result.yourAnswers.map((yourAnswer, index) => {
          const opponentAnswer = result.opponentAnswers?.[index];
          const yourCorrect = yourAnswer.isCorrect;
          const opponentCorrect = opponentAnswer?.isCorrect ?? false;

          return (
            <View key={index} style={styles.breakdownRow}>
              <Text style={styles.breakdownQuestion}>Q{index + 1}</Text>
              <View style={styles.breakdownIcons}>
                <Ionicons
                  name={yourCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={yourCorrect ? theme.colors.correct : theme.colors.incorrect}
                />
                <Text style={styles.breakdownVs}>vs</Text>
                <Ionicons
                  name={opponentCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={opponentCorrect ? theme.colors.correct : theme.colors.incorrect}
                />
              </View>
              <Text style={styles.breakdownLabel}>
                {yourCorrect && opponentCorrect
                  ? 'Both correct'
                  : yourCorrect
                  ? 'You got it'
                  : opponentCorrect
                  ? 'They got it'
                  : 'Both wrong'}
              </Text>
            </View>
          );
        })}
      </View>
    );
  };

  // Waiting state - opponent hasn't played yet
  if (isWaiting) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
        >
          <View style={styles.header}>
            <Ionicons name="hourglass-outline" size={64} color={theme.colors.accent} />
            <Text style={styles.waitingTitle}>Waiting for Opponent</Text>
            <Text style={styles.waitingSubtitle}>
              Your score is locked in!
            </Text>
          </View>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Your Score</Text>
            <Text style={styles.scoreValue}>{result.yourScore}</Text>
            <Text style={styles.scoreCorrect}>
              {correctCount} of {result.yourAnswers.length} correct
            </Text>
          </View>

          <View style={styles.shareSection}>
            <Text style={styles.shareTitle}>
              {opponentName
                ? `Waiting for ${opponentName} to play...`
                : 'Share the code to get an opponent!'}
            </Text>

            <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode}>
              <Text style={styles.codeText}>{code}</Text>
              <View style={styles.copyHint}>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={16}
                  color={copied ? theme.colors.correct : theme.colors.mediumGray}
                />
                <Text style={[styles.copyHintText, copied && styles.copiedText]}>
                  {copied ? 'Copied!' : 'Tap to copy'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={theme.colors.white} />
              <Text style={styles.shareButtonText}>Share Challenge</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.backButton} onPress={handleBackToChallenges}>
            <Text style={styles.backButtonText}>Back to Challenges</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Complete state - both have played
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.header}>
          <Ionicons name={getResultIcon()} size={64} color={getResultColor()} />
          <Text style={[styles.resultTitle, { color: getResultColor() }]}>
            {getResultTitle()}
          </Text>
        </View>

        <View style={styles.comparisonSection}>
          <View style={styles.playerCard}>
            <Text style={styles.playerLabel}>You</Text>
            <Text style={styles.playerScore}>{result.yourScore}</Text>
            <Text style={styles.playerCorrect}>
              {correctCount}/{result.yourAnswers.length}
            </Text>
            {result.result === 'win' && (
              <View style={styles.winnerBadge}>
                <Text style={styles.winnerBadgeText}>Winner</Text>
              </View>
            )}
          </View>

          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>

          <View style={styles.playerCard}>
            <Text style={styles.playerLabel}>
              {result.opponentDisplayName || opponentName || 'Opponent'}
            </Text>
            <Text style={styles.playerScore}>{result.opponentScore}</Text>
            <Text style={styles.playerCorrect}>
              {result.opponentAnswers?.filter((a) => a.isCorrect).length ?? 0}/
              {result.opponentAnswers?.length ?? result.yourAnswers.length}
            </Text>
            {result.result === 'loss' && (
              <View style={styles.winnerBadge}>
                <Text style={styles.winnerBadgeText}>Winner</Text>
              </View>
            )}
          </View>
        </View>

        {renderQuestionBreakdown()}

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.newChallengeButton} onPress={handleNewChallenge}>
            <Text style={styles.newChallengeButtonText}>New Challenge</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={handleBackToChallenges}>
            <Text style={styles.backButtonText}>Back to Challenges</Text>
          </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  waitingTitle: {
    fontSize: 24,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginTop: theme.spacing.md,
  },
  waitingSubtitle: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  resultTitle: {
    fontSize: 28,
    fontFamily: theme.fonts.gothamBold,
    marginTop: theme.spacing.md,
  },
  scoreCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.sm,
  },
  scoreValue: {
    fontSize: 48,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  scoreCorrect: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.xs,
  },
  shareSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  shareTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  codeBox: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    width: '100%',
  },
  codeText: {
    fontSize: 32,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    letterSpacing: 4,
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  copyHintText: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  copiedText: {
    color: theme.colors.correct,
  },
  shareButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  shareButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  backButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: theme.colors.mediumGray,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  comparisonSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  playerCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  playerLabel: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.sm,
  },
  playerScore: {
    fontSize: 36,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  playerCorrect: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  winnerBadge: {
    backgroundColor: theme.colors.correct,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.sm,
  },
  winnerBadgeText: {
    color: theme.colors.white,
    fontSize: 12,
    fontFamily: theme.fonts.gothamMedium,
  },
  vsContainer: {
    paddingHorizontal: theme.spacing.md,
  },
  vsText: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.mediumGray,
  },
  breakdownSection: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.md,
  },
  breakdownRow: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  breakdownQuestion: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    width: 30,
  },
  breakdownIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginRight: theme.spacing.md,
  },
  breakdownVs: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  breakdownLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'right',
  },
  actionButtons: {
    gap: theme.spacing.md,
  },
  newChallengeButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  newChallengeButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
});
