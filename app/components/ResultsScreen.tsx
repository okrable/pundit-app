import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Quiz, QuizResultImmediate } from '../types';
import { theme } from '../theme/theme';

interface ResultsScreenProps {
  result: QuizResultImmediate;
  quiz: Quiz;
  onPlayAgain: () => void;
}

export default function ResultsScreen({ result, quiz, onPlayAgain }: ResultsScreenProps) {
  const maxScore = result.totalQuestions * 100; // 500 for 5 questions
  const percentage = Math.round((result.score / maxScore) * 100);
  const correctCount = result.answers.filter(a => a.isCorrect).length;

  const getMessage = () => {
    if (percentage === 100) return "Perfect! You're a true pundit!";
    if (percentage >= 80) return "Great job! Lightning fast!";
    if (percentage >= 60) return "Solid performance!";
    if (percentage >= 40) return "Not bad! Keep practicing!";
    if (percentage >= 20) return "Room for improvement!";
    return "Better luck next time!";
  };

  const getAnswerInfo = (questionId: string, selectedIndex: number, correctIndex?: number) => {
    const question = quiz.questions.find(q => q.id === questionId);
    if (!question) return { correctAnswer: '', userAnswer: '' };

    const correctAnswer = question.options[correctIndex ?? question.correctOptionIndex ?? 0];
    const userAnswer = question.options[selectedIndex];

    return { correctAnswer, userAnswer };
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Full Time!</Text>
          <Text style={styles.subtitle}>{getMessage()}</Text>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreValue}>{result.score}</Text>
            <Text style={styles.scoreLabel}>points</Text>
            <Text style={styles.correctCount}>{correctCount}/{result.totalQuestions} correct</Text>
          </View>
          <View style={styles.statsColumn}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{result.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{result.bestScore}</Text>
              <Text style={styles.statLabel}>Best</Text>
            </View>
          </View>
        </View>

        <View style={styles.answersSection}>
          {result.answers.map((answer) => {
            const { correctAnswer, userAnswer } = getAnswerInfo(
              answer.questionId,
              answer.selectedOptionIndex,
              answer.correctOptionIndex
            );
            const isCorrect = answer.isCorrect;

            return (
              <View
                key={answer.questionId}
                style={[
                  styles.answerItem,
                  isCorrect ? styles.answerItemCorrect : styles.answerItemIncorrect,
                ]}
              >
                <View style={styles.answerContent}>
                  {isCorrect ? (
                    <Text style={styles.answerText}>{correctAnswer}</Text>
                  ) : (
                    <View style={styles.wrongAnswerContent}>
                      <Text style={styles.userAnswerText}>{userAnswer}</Text>
                      <Text style={styles.correctAnswerText}>{correctAnswer}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.answerIcon}>
                  {isCorrect ? '⚽️' : '❌'}
                </Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.playAgainButton} onPress={onPlayAgain}>
          <Text style={styles.playAgainButtonText}>Play Again</Text>
        </TouchableOpacity>
      </View>
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
    padding: theme.spacing.lg,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: 26,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
    textAlign: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  scoreCard: {
    flex: 2,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  scoreValue: {
    fontSize: 36,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.primary,
  },
  scoreLabel: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  correctCount: {
    fontSize: 12,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
    marginTop: theme.spacing.xs,
  },
  statsColumn: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  statItem: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  answersSection: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  answerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  answerItemCorrect: {
    backgroundColor: theme.colors.correctBg,
  },
  answerItemIncorrect: {
    backgroundColor: theme.colors.incorrectBg,
  },
  answerContent: {
    flex: 1,
  },
  answerText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  wrongAnswerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  userAnswerText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.incorrect,
    textDecorationLine: 'line-through',
  },
  correctAnswerText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  answerIcon: {
    fontSize: 16,
    marginLeft: theme.spacing.sm,
  },
  playAgainButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  playAgainButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
  },
});
