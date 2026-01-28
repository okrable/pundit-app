import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import QuestionCard from '../components/QuestionCard';
import { useChallengeStore } from '../state/useChallengeStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { theme } from '../theme/theme';
import type { AnswerWithTiming, ChallengeSubmitResult } from '../types';

const AUTO_ADVANCE_DELAY = 2000;
const TIMER_DURATION = 20;

function calculatePoints(timeRemaining: number): number {
  if (timeRemaining >= 16) return 100;
  if (timeRemaining >= 12) return 80;
  if (timeRemaining >= 8) return 60;
  if (timeRemaining >= 4) return 40;
  return 20;
}

export default function ChallengeQuizScreen() {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuthStore();
  const { currentChallenge, submitAnswers, clearCurrentChallenge, isLoading } = useChallengeStore();

  const [userId, setUserId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showingResult, setShowingResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [answerTimings, setAnswerTimings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadUserId = async () => {
      const id = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(id);
    };
    loadUserId();
  }, [isAuthenticated, user]);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  // Reset state when challenge changes
  useEffect(() => {
    if (currentChallenge) {
      setCurrentQuestionIndex(0);
      setAnswers({});
      setScore(0);
      setShowingResult(false);
      setTimerActive(false);
      setTimeRemaining(TIMER_DURATION);
      setAnswerTimings({});
    }
  }, [currentChallenge?.challengeId]);

  const handleSelectOption = async (questionId: string, optionIndex: number) => {
    if (showingResult || !currentChallenge || !userId) return;

    const currentQuestion = currentChallenge.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setTimerActive(false);
    const capturedTime = timeRemaining;

    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    setAnswerTimings((prev) => ({ ...prev, [questionId]: capturedTime * 1000 }));

    const isCorrect = currentQuestion.correctOptionIndex === optionIndex;
    if (isCorrect) {
      const points = calculatePoints(capturedTime);
      setScore((prev) => prev + points);
    }

    setShowingResult(true);

    autoAdvanceTimer.current = setTimeout(async () => {
      setShowingResult(false);

      const isLastQuestion = currentQuestionIndex === currentChallenge.questions.length - 1;

      if (isLastQuestion) {
        // Submit answers
        setSubmitting(true);
        const updatedAnswers = { ...answers, [questionId]: optionIndex };
        const updatedTimings = { ...answerTimings, [questionId]: capturedTime * 1000 };

        const formattedAnswers: AnswerWithTiming[] = Object.entries(updatedAnswers).map(
          ([qId, selectedOptionIndex]) => ({
            questionId: qId,
            selectedOptionIndex,
            timeRemainingMs: updatedTimings[qId] ?? 0,
          })
        );

        try {
          const result = await submitAnswers(userId, formattedAnswers);
          // Navigate to results screen with the result
          navigation.replace('ChallengeResults', {
            result,
            code: currentChallenge.code,
            opponentName: currentChallenge.opponentName,
            isCreator: currentChallenge.isCreator,
          });
        } catch (error) {
          console.error('Failed to submit answers:', error);
          setSubmitting(false);
        }
      } else {
        setCurrentQuestionIndex((prev) => prev + 1);
        setTimeRemaining(TIMER_DURATION);
      }
    }, AUTO_ADVANCE_DELAY);
  };

  const handleTimeUp = () => {
    setTimerActive(false);
  };

  const handleTypingComplete = () => {
    setTimerActive(true);
  };

  // No challenge loaded
  if (!currentChallenge) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No challenge loaded</Text>
          <Text style={styles.hintText}>Please create or join a challenge first</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Submitting
  if (submitting) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Submitting answers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalQuestions = currentChallenge.questions.length;
  const currentQuestion = currentChallenge.questions[currentQuestionIndex];
  const currentAnswer =
    currentQuestion && answers[currentQuestion.id] !== undefined
      ? answers[currentQuestion.id]
      : null;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Challenge Header */}
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeLabel}>Challenge Mode</Text>
        {currentChallenge.opponentName && (
          <Text style={styles.opponentText}>
            vs {currentChallenge.opponentName}
          </Text>
        )}
      </View>

      <Pressable
        style={styles.pressable}
        onPressIn={() => setIsHolding(true)}
        onPressOut={() => setIsHolding(false)}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {currentQuestion && (
            <QuestionCard
              key={currentQuestion.id}
              question={currentQuestion}
              selectedOption={currentAnswer}
              onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
              showResult={showingResult}
              correctOptionIndex={currentQuestion.correctOptionIndex}
              isHolding={isHolding}
              onTypingComplete={handleTypingComplete}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={totalQuestions}
              score={score}
              timerDuration={TIMER_DURATION}
              timerActive={timerActive}
              timeRemaining={timeRemaining}
              setTimeRemaining={setTimeRemaining}
              onTimeUp={handleTimeUp}
            />
          )}
        </ScrollView>
      </Pressable>
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
    fontSize: 16,
    color: theme.colors.textDark,
    fontFamily: theme.fonts.gothamMedium,
    marginBottom: theme.spacing.sm,
  },
  hintText: {
    fontSize: 14,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  challengeHeader: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeLabel: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
  opponentText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.white,
  },
  scrollView: {
    flex: 1,
  },
  pressable: {
    flex: 1,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
});
