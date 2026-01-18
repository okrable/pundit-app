import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuestionCard from '../components/QuestionCard';
import ResultsScreen from '../components/ResultsScreen';
import WelcomeScreen from '../components/WelcomeScreen';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { theme } from '../theme/theme';

const AUTO_ADVANCE_DELAY = 2000; // 2 seconds

export default function DailyQuizScreen() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showingResult, setShowingResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
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
      setShowingResult(false);
      setScore(0);
    }
  }, [quiz?.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (showingResult) return; // Prevent selecting while showing result

    const currentQuestion = quiz?.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    // Record the answer
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));

    // Check if correct and update score
    const isCorrect = currentQuestion.correctOptionIndex === optionIndex;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    // Show the result (correct/incorrect highlighting)
    setShowingResult(true);

    // Auto-advance after delay
    autoAdvanceTimer.current = setTimeout(() => {
      setShowingResult(false);

      const isLastQuestion = currentQuestionIndex === (quiz?.questions.length ?? 0) - 1;

      if (isLastQuestion) {
        // Submit quiz automatically
        const formattedAnswers = Object.entries({
          ...answers,
          [questionId]: optionIndex,
        }).map(([qId, selectedOptionIndex]) => ({
          questionId: qId,
          selectedOptionIndex,
        }));
        submitQuizAnswers(formattedAnswers);
      } else {
        // Move to next question
        setCurrentQuestionIndex((prev) => prev + 1);
      }
    }, AUTO_ADVANCE_DELAY);
  };

  const totalQuestions = quiz?.questions.length ?? 0;
  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const currentAnswer =
    currentQuestion && answers[currentQuestion.id] !== undefined
      ? answers[currentQuestion.id]
      : null;

  const handleCloseResults = () => {
    setAnswers({});
    setScore(0);
    setQuizStarted(false);
    resetQuiz();
    fetchQuiz();
  };

  const handleStartQuiz = () => {
    setQuizStarted(true);
  };

  // Show welcome screen before quiz starts
  if (!quizStarted) {
    return <WelcomeScreen onStartQuiz={handleStartQuiz} />;
  }

  // Show results screen when quiz is complete
  if (result && quiz) {
    return <ResultsScreen result={result} quiz={quiz} onPlayAgain={handleCloseResults} />;
  }

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
          <Text style={styles.subtitle}>SCORE: {score}</Text>
        </View>

        {currentQuestion && (
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            selectedOption={currentAnswer}
            onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
            showResult={showingResult}
            correctOptionIndex={currentQuestion.correctOptionIndex}
          />
        )}

      </ScrollView>
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
    paddingBottom: theme.spacing.lg,
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
});
