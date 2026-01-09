import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { QuizResult } from '../types';
import { theme } from '../theme/theme';

interface ResultsModalProps {
  visible: boolean;
  result: QuizResult;
  onClose: () => void;
}

export default function ResultsModal({ visible, result, onClose }: ResultsModalProps) {
  const percentage = Math.round((result.score / result.answers.length) * 100);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Quiz Complete!</Text>
            <Text style={styles.subtitle}>Here's how you did</Text>
          </View>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Your Score</Text>
            <Text style={styles.scoreValue}>
              {result.score}/{result.answers.length}
            </Text>
            <Text style={styles.scorePercentage}>{percentage}%</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Streak</Text>
              <Text style={styles.statValue}>{result.streak}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Best Score</Text>
              <Text style={styles.statValue}>{result.bestScore}</Text>
            </View>
          </View>

          <View style={styles.answersSection}>
            <Text style={styles.answersTitle}>Answer Breakdown</Text>
            {result.answers.map((answer, index) => (
              <View key={answer.questionId} style={styles.answerItem}>
                <View style={styles.answerHeader}>
                  <Text style={styles.answerNumber}>Question {index + 1}</Text>
                  <Text
                    style={[
                      styles.answerIcon,
                      answer.isCorrect ? styles.answerIconCorrect : styles.answerIconIncorrect,
                    ]}
                  >
                    {answer.isCorrect ? '⚽️' : '❌'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    flex: 1,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 23,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  scoreCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.gothamBook,
  },
  scoreValue: {
    fontSize: 37,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  scorePercentage: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamMedium,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  statItem: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 13,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.xs,
    fontFamily: theme.fonts.gothamBook,
  },
  statValue: {
    fontSize: 21,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  answersSection: {
    marginBottom: theme.spacing.lg,
  },
  answersTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginBottom: theme.spacing.md,
  },
  answerItem: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
  },
  answerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  answerNumber: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  answerIcon: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  answerIconCorrect: {
    color: theme.colors.correct,
  },
  answerIconIncorrect: {
    color: theme.colors.incorrect,
  },
  closeButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
});
