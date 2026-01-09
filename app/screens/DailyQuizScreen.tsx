import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuestionCard from '../components/QuestionCard';
import ResultsModal from '../components/ResultsModal';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { theme } from '../theme/theme';

export default function DailyQuizScreen() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const { quiz, loading, error, result, fetchQuiz, submitQuizAnswers, setUserId, resetQuiz } = useQuizStore();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const initialize = async () => {
      // Use Auth0 user ID if authenticated, otherwise use guest ID
      const userId = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(userId);
      fetchQuiz();
    };
    initialize();
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (quiz) {
      setCurrentQuestionIndex(0);
      setAnswers({});
    }
  }, [quiz?.id]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
  };

  const allQuestionsAnswered = quiz?.questions.every((q) => answers[q.id] !== undefined) ?? false;
  const totalQuestions = quiz?.questions.length ?? 0;
  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const currentAnswer =
    currentQuestion && answers[currentQuestion.id] !== undefined
      ? answers[currentQuestion.id]
      : null;
  const isLastQuestion = totalQuestions > 0 && currentQuestionIndex === totalQuestions - 1;
  const canAdvance = currentQuestion && answers[currentQuestion.id] !== undefined;

  const handleSubmit = () => {
    if (!quiz) return;

    const formattedAnswers = Object.entries(answers).map(([questionId, selectedOptionIndex]) => ({
      questionId,
      selectedOptionIndex,
    }));

    submitQuizAnswers(formattedAnswers);
  };

  const handleCloseResults = () => {
    setAnswers({});
    resetQuiz();
    fetchQuiz();
  };

  const goToNextQuestion = () => {
    if (!quiz) return;
    setCurrentQuestionIndex((prev) => Math.min(prev + 1, quiz.questions.length - 1));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading quiz...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchQuiz()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!quiz) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No quiz available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.subtitle}>Question {currentQuestionIndex + 1} of {totalQuestions}</Text>
          <Text style={styles.subtitle}>SCORE: 0</Text>
        </View>

        {currentQuestion && (
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            selectedOption={currentAnswer}
            onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
          />
        )}

      </ScrollView>

      <View style={styles.bottomAction}>
        {!isLastQuestion ? (
          <TouchableOpacity
            style={[styles.primaryActionButton, !canAdvance && styles.navButtonDisabled]}
            onPress={goToNextQuestion}
            disabled={!canAdvance}
          >
            <Text style={[styles.primaryActionText, !canAdvance && styles.navButtonTextDisabled]}>
              Next
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, !allQuestionsAnswered && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!allQuestionsAnswered}
          >
            <Text style={[styles.submitButtonText, !allQuestionsAnswered && styles.submitButtonTextDisabled]}>
              Submit Answers
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {result && <ResultsModal visible={true} result={result} onClose={handleCloseResults} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  errorText: {
    fontSize: 14,
    color: theme.colors.incorrect,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.gothamBook,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
  },
  retryButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  header: {
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  subtitle: {
    fontSize: 11,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  submitButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  submitButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  submitButtonText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  submitButtonTextDisabled: {
    color: theme.colors.mediumGray,
  },
  bottomAction: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    alignItems: 'center',
  },
  primaryActionButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    minWidth: 220,
  },
  navButtonDisabled: {
    backgroundColor: theme.colors.lightGray,
  },
  primaryActionText: {
    color: theme.colors.white,
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
  },
  navButtonTextDisabled: {
    color: theme.colors.mediumGray,
  },
});
