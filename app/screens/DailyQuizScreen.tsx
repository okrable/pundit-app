import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QuestionCard from '../components/QuestionCard';
import ResultsModal from '../components/ResultsModal';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';

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
  const isFirstQuestion = currentQuestionIndex === 0;
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

  const goToPreviousQuestion = () => {
    setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0));
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
          <Text style={styles.title}>Daily Quiz</Text>
          <Text style={styles.subtitle}>Answer all 5 questions</Text>
        </View>

        {currentQuestion && (
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentQuestionIndex + 1}
            selectedOption={currentAnswer}
            onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
          />
        )}

        <View style={styles.navigationRow}>
          <TouchableOpacity
            style={[styles.navButton, isFirstQuestion && styles.navButtonDisabled]}
            onPress={goToPreviousQuestion}
            disabled={isFirstQuestion}
          >
            <Text style={[styles.navButtonText, isFirstQuestion && styles.navButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>

          {!isLastQuestion ? (
            <TouchableOpacity
              style={[styles.navButton, !canAdvance && styles.navButtonDisabled]}
              onPress={goToNextQuestion}
              disabled={!canAdvance}
            >
              <Text style={[styles.navButtonText, !canAdvance && styles.navButtonTextDisabled]}>
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
      </ScrollView>

      {result && <ResultsModal visible={true} result={result} onClose={handleCloseResults} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#8E8E93',
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  navButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#8E8E93',
  },
});
