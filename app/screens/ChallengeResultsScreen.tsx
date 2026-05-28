import React, { useState } from 'react';
import {
  Image,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useChallengeStore } from '../state/useChallengeStore';
import { useAuthStore } from '../state/useAuthStore';
import { theme } from '../theme/theme';
import type { ChallengeSubmitResult } from '../types';
import Avatar from '../components/Avatar';
import CenteredWebContent, { webContentWidth } from '../components/ResponsiveLayout';

const logoImage = require('../../assets/logo/dark/pundit-black.png');
const celebrationImage = require('../../assets/images/Asset 9.png');

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
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);

  const { result, code, opponentName } = route.params;
  const isWaiting = result.status === 'waiting';
  const isComplete = result.status === 'complete';
  const correctCount = result.yourAnswers.filter(answer => answer.isCorrect).length;
  const opponentCorrectCount =
    result.opponentAnswers?.filter(answer => answer.isCorrect).length ?? 0;
  const opponentAvatarId = `opponent_${result.opponentDisplayName || opponentName || code}`;

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const message = isWaiting
      ? `I scored ${result.yourScore} on Pundit. Enter challenge code ${code} and try to beat me.`
      : `Pundit Challenge result: ${result.yourScore}-${result.opponentScore ?? 0}. Code: ${code}`;

    await Share.share({
      message,
      title: 'Pundit Challenge',
    });
  };

  const handleBackToChallenges = () => {
    clearCurrentChallenge();
    navigation.navigate('Main', { screen: 'Challenge' });
  };

  const getResultTitle = () => {
    if (isWaiting) return 'Challenge locked in!';

    switch (result.result) {
      case 'win':
        return 'You win!';
      case 'loss':
        return 'Challenge complete';
      case 'draw':
        return "It's a draw!";
      default:
        return 'Challenge complete';
    }
  };

  const getResultSubtitle = () => {
    if (isWaiting) {
      return opponentName
        ? `Waiting for ${opponentName} to play.`
        : 'Share your code and wait for an opponent.';
    }

    switch (result.result) {
      case 'win':
        return 'What a finish.';
      case 'loss':
        return 'Come back swinging next time.';
      case 'draw':
        return 'Nothing between you.';
      default:
        return 'Final scores are in.';
    }
  };

  const getResultColor = () => {
    if (isWaiting) return theme.colors.accent;
    if (result.result === 'win') return theme.colors.correct;
    if (result.result === 'loss') return theme.colors.incorrect;
    return theme.colors.primary;
  };

  const renderAnswerBreakdown = () => (
    <View style={styles.answersList}>
      {result.yourAnswers.map((yourAnswer, index) => {
        const opponentAnswer = result.opponentAnswers?.[index];

        return (
          <View key={`${yourAnswer.questionId}-${index}`} style={styles.answerRow}>
            <Text style={styles.questionLabel}>Q{index + 1}</Text>
            <View style={styles.answerSide}>
              <Text style={styles.answerSideLabel}>You</Text>
              <Ionicons
                name={yourAnswer.isCorrect ? 'football' : 'close'}
                size={18}
                color={yourAnswer.isCorrect ? theme.colors.correct : theme.colors.incorrect}
              />
            </View>
            {isComplete ? (
              <View style={styles.answerSide}>
                <Text style={styles.answerSideLabel}>Them</Text>
                <Ionicons
                  name={opponentAnswer?.isCorrect ? 'football' : 'close'}
                  size={18}
                  color={opponentAnswer?.isCorrect ? theme.colors.correct : theme.colors.incorrect}
                />
              </View>
            ) : (
              <Text style={styles.pendingAnswerText}>Pending</Text>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <CenteredWebContent maxWidth={webContentWidth.quiz} style={styles.content}>
        <View style={styles.topBar}>
          <Image source={logoImage} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.heroRow}>
            <Image source={celebrationImage} style={styles.celebration} resizeMode="contain" />
            <View style={styles.heroCopy}>
              <Text style={styles.thanksTitle} adjustsFontSizeToFit numberOfLines={1}>
                {getResultTitle()}
              </Text>
              <Text style={styles.tomorrowText}>{getResultSubtitle()}</Text>
            </View>
          </View>

          <View style={[styles.scoreBand, { borderLeftColor: getResultColor() }]}>
            <Text style={styles.finalScoreLabel}>
              {isWaiting ? 'YOUR SCORE' : 'FINAL SCORE'}
            </Text>
            <Text style={styles.finalScoreValue}>
              {isWaiting ? result.yourScore : `${result.yourScore}-${result.opponentScore ?? 0}`}
            </Text>
          </View>

          {isComplete ? (
            <View style={styles.comparisonRow}>
              <View style={styles.playerSummary}>
                <Avatar
                  userId={user?.sub || 'you'}
                  displayName={user?.name}
                  username={user?.username}
                  imageUrl={user?.picture}
                  size="md"
                />
                <Text style={styles.playerName}>You</Text>
                <Text style={styles.playerMeta}>
                  {correctCount}/{result.yourAnswers.length}
                </Text>
              </View>

              <Text style={styles.vsText}>VS</Text>

              <View style={styles.playerSummary}>
                <Avatar
                  userId={opponentAvatarId}
                  displayName={result.opponentDisplayName || opponentName}
                  size="md"
                />
                <Text
                  style={styles.playerName}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                >
                  {result.opponentDisplayName || opponentName || 'Opponent'}
                </Text>
                <Text style={styles.playerMeta}>
                  {opponentCorrectCount}/{result.opponentAnswers?.length ?? result.yourAnswers.length}
                </Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode} activeOpacity={0.84}>
              <Text style={styles.codeLabel}>Challenge code</Text>
              <Text style={styles.codeText}>{code}</Text>
              <View style={styles.copyHint}>
                <Ionicons
                  name={copied ? 'checkmark-circle' : 'copy-outline'}
                  size={15}
                  color={copied ? theme.colors.correct : theme.colors.mediumGray}
                />
                <Text style={[styles.copyHintText, copied && styles.copiedText]}>
                  {copied ? 'Copied!' : 'Tap to copy'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          {renderAnswerBreakdown()}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.86}>
            <Text style={styles.shareButtonText}>
              {isWaiting ? 'Share challenge' : 'Share result'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={handleBackToChallenges}>
            <Text style={styles.backButtonText}>Back to challenges</Text>
          </TouchableOpacity>
        </View>
      </CenteredWebContent>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  topBar: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 132,
    height: 44,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7DFD2',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  heroRow: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  celebration: {
    width: 88,
    height: 80,
  },
  heroCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  thanksTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  tomorrowText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  scoreBand: {
    minHeight: 72,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    borderLeftWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  finalScoreLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.mediumGray,
    textTransform: 'uppercase',
  },
  finalScoreValue: {
    fontSize: 34,
    lineHeight: 39,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  comparisonRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  playerSummary: {
    flex: 1,
    minHeight: 86,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
    gap: 2,
  },
  playerName: {
    maxWidth: '100%',
    fontSize: 12,
    lineHeight: 15,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  playerMeta: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  vsText: {
    width: 30,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.accent,
  },
  codeBox: {
    minHeight: 92,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.sm,
  },
  codeLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.mediumGray,
    textTransform: 'uppercase',
  },
  codeText: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.accent,
    letterSpacing: 3,
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  copyHintText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  copiedText: {
    color: theme.colors.correct,
  },
  divider: {
    height: 1,
    backgroundColor: '#E7DFD2',
  },
  answersList: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  answerRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  questionLabel: {
    width: 30,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.accent,
  },
  answerSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  answerSideLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  pendingAnswerText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  actionRow: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  shareButton: {
    minWidth: 160,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: theme.colors.textDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  shareButtonText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
  backButton: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  backButtonText: {
    color: theme.colors.mediumGray,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: theme.fonts.gothamMedium,
  },
});
