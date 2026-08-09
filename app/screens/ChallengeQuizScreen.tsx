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
import type { AnswerWithTiming } from '../types';
import { useCenteredWebStyle, webContentWidth } from '../components/ResponsiveLayout';
import { calculateQuizPoints } from '../../shared/scoring';

const REVEAL_SUSPENSE_DELAY = 1000;
const RESULT_HOLD_DELAY = 1650;
const QUESTION_EXIT_DELAY = 1700;
const TIMER_DURATION = 20;

export default function ChallengeQuizScreen() {
  const centeredQuizStyle = useCenteredWebStyle(webContentWidth.quiz);
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
  const [answeringEnabled, setAnsweringEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [answerTimings, setAnswerTimings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [isQuestionExiting, setIsQuestionExiting] = useState(false);

  const revealTimer = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const questionExitTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadUserId = async () => {
      const id = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(id);
    };
    loadUserId();
  }, [isAuthenticated, user]);

  useEffect(() => {
    return () => {
      if (revealTimer.current) {
        clearTimeout(revealTimer.current);
      }
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
      if (questionExitTimer.current) {
        clearTimeout(questionExitTimer.current);
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
      setAnsweringEnabled(false);
      setTimeRemaining(TIMER_DURATION);
      setAnswerTimings({});
      setIsQuestionExiting(false);
    }
  }, [currentChallenge?.challengeId]);

  const handleSelectOption = async (questionId: string, optionIndex: number) => {
    if (
      !answeringEnabled ||
      showingResult ||
      answers[questionId] !== undefined ||
      !currentChallenge ||
      !userId
    ) return;

    const currentQuestion = currentChallenge.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setAnsweringEnabled(false);
    setTimerActive(false);
    const capturedTime = timeRemaining;
    const updatedAnswers = { ...answers, [questionId]: optionIndex };
    const updatedTimings = { ...answerTimings, [questionId]: capturedTime * 1000 };

    setAnswers(updatedAnswers);
    setAnswerTimings(updatedTimings);

    const isCorrect = currentQuestion.correctOptionIndex === optionIndex;
    const points = isCorrect ? calculateQuizPoints(capturedTime * 1000) : 0;

    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
    }
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
    }
    if (questionExitTimer.current) {
      clearTimeout(questionExitTimer.current);
    }

    revealTimer.current = setTimeout(() => {
      if (points > 0) {
        setScore((prev) => prev + points);
      }

      setShowingResult(true);

      autoAdvanceTimer.current = setTimeout(async () => {
        setIsQuestionExiting(true);

        questionExitTimer.current = setTimeout(async () => {
          setShowingResult(false);
          setIsQuestionExiting(false);

          const isLastQuestion = currentQuestionIndex === currentChallenge.questions.length - 1;

          if (isLastQuestion) {
            setSubmitting(true);

            const formattedAnswers: AnswerWithTiming[] = Object.entries(updatedAnswers).map(
              ([qId, selectedOptionIndex]) => ({
                questionId: qId,
                selectedOptionIndex,
                timeRemainingMs: updatedTimings[qId] ?? 0,
              })
            );

            try {
              const result = await submitAnswers(userId, formattedAnswers);
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
            setTimerActive(false);
            setAnsweringEnabled(false);
            setTimeRemaining(TIMER_DURATION);
            setCurrentQuestionIndex((prev) => prev + 1);
          }
        }, QUESTION_EXIT_DELAY);
      }, RESULT_HOLD_DELAY);
    }, REVEAL_SUSPENSE_DELAY);
  };

  const handleTimeUp = () => {
    setTimerActive(false);
  };

  const handleOptionsReady = () => {
    setAnsweringEnabled(true);
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
      <Pressable
        style={styles.pressable}
        onPressIn={() => setIsHolding(true)}
        onPressOut={() => setIsHolding(false)}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, centeredQuizStyle]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.challengeContext}>
            <Text style={styles.challengeLabel}>Challenge Mode</Text>
            {currentChallenge.opponentName ? (
              <Text
                style={styles.opponentText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                vs {currentChallenge.opponentName}
              </Text>
            ) : (
              <Text style={styles.opponentText}>Code {currentChallenge.code}</Text>
            )}
          </View>

          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              selectedOption={currentAnswer}
              onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
              disabled={!answeringEnabled}
              isExiting={isQuestionExiting}
              showResult={showingResult}
              correctOptionIndex={currentQuestion.correctOptionIndex}
              isHolding={isHolding}
              onOptionsReady={handleOptionsReady}
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
  challengeContext: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    minHeight: 28,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#EFE7D9',
    borderWidth: 1,
    borderColor: '#E0D6C7',
  },
  challengeLabel: {
    fontSize: 11,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    textTransform: 'uppercase',
  },
  opponentText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: 11,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  pressable: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
