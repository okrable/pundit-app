import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { QuizResult } from '../types';

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
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
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
              <View
                key={answer.questionId}
                style={[
                  styles.answerItem,
                  answer.isCorrect ? styles.answerCorrect : styles.answerIncorrect,
                ]}
              >
                <View style={styles.answerHeader}>
                  <Text style={styles.answerNumber}>Question {index + 1}</Text>
                  <Text
                    style={[
                      styles.answerBadge,
                      answer.isCorrect ? styles.answerBadgeCorrect : styles.answerBadgeIncorrect,
                    ]}
                  >
                    {answer.isCorrect ? 'Correct' : 'Incorrect'}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Continue</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingTop: 32,
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  scoreCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  scorePercentage: {
    fontSize: 20,
    color: '#8E8E93',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  answersSection: {
    marginBottom: 24,
  },
  answersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
  },
  answerItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
  },
  answerCorrect: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  answerIncorrect: {
    backgroundColor: '#FFEBEE',
    borderColor: '#F44336',
  },
  answerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  answerNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  answerBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  answerBadgeCorrect: {
    backgroundColor: '#4CAF50',
    color: '#FFF',
  },
  answerBadgeIncorrect: {
    backgroundColor: '#F44336',
    color: '#FFF',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
