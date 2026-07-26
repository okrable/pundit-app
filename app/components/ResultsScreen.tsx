import React, { useMemo } from 'react';
import {
  Image,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Quiz, QuizResultImmediate } from '../types';
import { theme } from '../theme/theme';
import CenteredWebContent, { webContentWidth } from './ResponsiveLayout';
import { formatStreakLabel } from '../../shared/streak';

const logoImage = require('../../assets/logo/dark/pundit-black.png');
const celebrationImage = require('../../assets/images/Asset 9.png');

interface ResultsScreenProps {
  result: QuizResultImmediate;
  quiz: Quiz;
  onPlayAgain: () => void;
}

interface SummaryAnswer {
  questionNumber: number;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function ResultsScreen({ result, quiz }: ResultsScreenProps) {
  const summaryAnswers = useMemo<SummaryAnswer[]>(
    () =>
      result.answers.map((answer, index) => {
        const question = quiz.questions.find(q => q.id === answer.questionId);
        const correctOptionIndex = answer.correctOptionIndex ?? question?.correctOptionIndex ?? 0;
        const correctAnswer = question?.options[correctOptionIndex] ?? 'Unknown';

        return {
          questionNumber: index + 1,
          correctAnswer,
          isCorrect: answer.isCorrect,
        };
      }),
    [quiz.questions, result.answers]
  );

  const correctCount = summaryAnswers.filter(answer => answer.isCorrect).length;
  const answerEmojiRow = summaryAnswers.map(answer => (answer.isCorrect ? '⚽️' : '❌')).join('');
  const syncMessage =
    result.syncState === 'pending'
      ? 'Stats syncing in the background.'
      : result.syncState === 'failed'
        ? 'Your result is saved on this device. We’ll retry when the app next syncs.'
        : null;

  const handleShare = async () => {
    const streakLine =
      typeof result.streak === 'number' ? formatStreakLabel(result.streak) : '';
    const shareText = [
      `Pundit Daily Quiz - ${result.date}`,
      `Final score: ${result.score}`,
      `${correctCount}/${result.totalQuestions} correct ${answerEmojiRow}`,
      streakLine,
    ]
      .filter(Boolean)
      .join('\n');

    await Share.share({ message: shareText });
  };

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
                Thanks for playing!
              </Text>
              <Text style={styles.tomorrowText}>Come back tomorrow for a fresh five.</Text>
            </View>
          </View>

          <View style={styles.scoreBand}>
            <Text style={styles.finalScoreLabel}>FINAL SCORE</Text>
            <Text style={styles.finalScoreValue}>{result.score}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.answersList}>
            {summaryAnswers.map(answer => (
              <View key={`${answer.questionNumber}-${answer.correctAnswer}`} style={styles.answerRow}>
                <Text style={styles.questionLabel}>Q{answer.questionNumber}</Text>
                <Text
                  style={styles.answerName}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                  numberOfLines={1}
                >
                  {answer.correctAnswer.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.answerIcon,
                    answer.isCorrect ? styles.correctIcon : styles.incorrectIcon,
                  ]}
                >
                  {answer.isCorrect ? '⚽️' : '❌'}
                </Text>
              </View>
            ))}
          </View>

          {syncMessage ? <Text style={styles.syncText}>{syncMessage}</Text> : null}
        </View>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.86}>
          <Text style={styles.shareButtonText}>Share result</Text>
        </TouchableOpacity>
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
    borderLeftColor: theme.colors.accent,
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
    fontSize: 36,
    lineHeight: 40,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    fontVariant: ['tabular-nums'],
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
  answerName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  answerIcon: {
    width: 28,
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 21,
  },
  correctIcon: {
    color: theme.colors.correct,
  },
  incorrectIcon: {
    color: theme.colors.incorrect,
  },
  syncText: {
    marginTop: 'auto',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
  shareButton: {
    alignSelf: 'center',
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
});
