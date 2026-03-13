import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import QuestionCard from '../components/QuestionCard';
import ResultsScreen from '../components/ResultsScreen';
import WelcomeScreen from '../components/WelcomeScreen';
import CompletedQuizScreen from '../components/CompletedQuizScreen';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import {
  clearGuestCache,
  getGuestTodayResult,
  getTodayQuizResult,
  saveDailyQuizResult,
} from '../storage/quizStorage';
import { getTodayResult, migrateGuestResult } from '../services/api';
import { theme } from '../theme/theme';

const AUTO_ADVANCE_DELAY = 2000;
const TIMER_DURATION = 20;

function calculatePoints(timeRemaining: number): number {
  if (timeRemaining >= 16) return 100;
  if (timeRemaining >= 12) return 80;
  if (timeRemaining >= 8) return 60;
  if (timeRemaining >= 4) return 40;
  return 20;
}

export default function DailyQuizScreen() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showingResult, setShowingResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [startRequested, setStartRequested] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [answerTimings, setAnswerTimings] = useState<Record<string, number>>({});
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);

  const {
    quiz,
    cachedResult,
    quizError,
    submitError,
    result,
    fetchQuiz,
    submitQuizAnswers,
    createLocalResult,
    setUserId,
    setCachedResult,
    resetQuiz,
  } = useQuizStore();
  const { user, isAuthenticated, token } = useAuthStore();

  useEffect(() => {
    const loadWarmState = async () => {
      const userId = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(userId);
      void fetchQuiz();
    };

    void loadWarmState();
  }, [fetchQuiz, isAuthenticated, setUserId, user]);

  useEffect(() => {
    if (startRequested && quiz) {
      setQuizStarted(true);
      setStartRequested(false);
    }
  }, [quiz, startRequested]);

  useEffect(() => {
    if (quiz) {
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowingResult(false);
      setScore(0);
      setTimerActive(false);
      setTimeRemaining(TIMER_DURATION);
      setAnswerTimings({});
    }
  }, [quiz?.id]);

  useEffect(() => {
    if (!isAuthenticated || !user || !token) {
      return;
    }

    let isActive = true;

    const reconcileAuthenticatedState = async () => {
      const localResult = await getTodayQuizResult(user.sub);
      if (localResult) {
        setCachedResult(localResult);
        await clearGuestCache();
        return;
      }

      try {
        const dbResult = await getTodayResult(user.sub);
        if (dbResult && isActive) {
          await clearGuestCache();
          await saveDailyQuizResult(dbResult, user.sub, dbResult.syncState);
          const cachedDbResult = await getTodayQuizResult(user.sub);
          setCachedResult(cachedDbResult);
          return;
        }
      } catch (error) {
        console.error('Error fetching today result:', error);
      }

      const guestResult = await getGuestTodayResult();
      if (!guestResult) {
        return;
      }

      try {
        const migrationResult = await migrateGuestResult(
          user.sub,
          guestResult.quizId,
          guestResult.score,
          guestResult.totalQuestions,
          guestResult.answers,
          {
            displayName: user.name,
            email: user.email,
            avatarUrl: user.picture,
          }
        );

        const migratedResult = {
          ...guestResult,
          streak: migrationResult.streak,
          bestScore: migrationResult.bestScore,
          userId: user.sub,
        };

        await clearGuestCache();
        await saveDailyQuizResult(migratedResult, user.sub, migratedResult.syncState);
        if (isActive) {
          setCachedResult({
            ...migratedResult,
            cachedAt: new Date().toISOString(),
          });
        }
      } catch (migrationError) {
        console.error('Error migrating guest result:', migrationError);
        await clearGuestCache();
      }
    };

    void reconcileAuthenticatedState();

    return () => {
      isActive = false;
    };
  }, [isAuthenticated, setCachedResult, token, user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const syncCachedResult = async () => {
        const userId = isAuthenticated && user ? user.sub : await getUserId();
        const todayResult = await getTodayQuizResult(userId);

        if (!isActive) {
          return;
        }

        if (!todayResult && cachedResult) {
          setCachedResult(null);
          setQuizStarted(false);
          setAnswers({});
          setScore(0);
          setCurrentQuestionIndex(0);
          resetQuiz();
          void fetchQuiz();
        } else if (todayResult && !cachedResult) {
          setCachedResult(todayResult);
        }
      };

      void syncCachedResult();

      return () => {
        isActive = false;
      };
    }, [cachedResult, fetchQuiz, isAuthenticated, resetQuiz, setCachedResult, user])
  );

  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) {
        clearTimeout(autoAdvanceTimer.current);
      }
    };
  }, []);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (showingResult) return;

    const currentQuestion = quiz?.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setTimerActive(false);
    const capturedTime = timeRemaining;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
    setAnswerTimings((prev) => ({
      ...prev,
      [questionId]: capturedTime * 1000,
    }));

    const isCorrect = currentQuestion.correctOptionIndex === optionIndex;
    if (isCorrect) {
      const points = calculatePoints(capturedTime);
      setScore((prev) => prev + points);
    }

    setShowingResult(true);

    autoAdvanceTimer.current = setTimeout(() => {
      setShowingResult(false);

      const isLastQuestion = currentQuestionIndex === (quiz?.questions.length ?? 0) - 1;

      if (isLastQuestion) {
        const updatedAnswers = { ...answers, [questionId]: optionIndex };
        const updatedTimings = { ...answerTimings, [questionId]: capturedTime * 1000 };
        const formattedAnswers = Object.entries(updatedAnswers).map(
          ([qId, selectedOptionIndex]) => ({
            questionId: qId,
            selectedOptionIndex,
            timeRemainingMs: updatedTimings[qId] ?? 0,
          })
        );

        void createLocalResult(formattedAnswers);
        void submitQuizAnswers(formattedAnswers);
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

  const totalQuestions = quiz?.questions.length ?? 0;
  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const currentAnswer =
    currentQuestion && answers[currentQuestion.id] !== undefined
      ? answers[currentQuestion.id]
      : null;

  const handleCloseResults = async () => {
    setAnswers({});
    setScore(0);
    setQuizStarted(false);
    setTimerActive(false);
    setTimeRemaining(TIMER_DURATION);
    setAnswerTimings({});
    resetQuiz();

    const userId = isAuthenticated && user ? user.sub : await getUserId();
    const todayResult = await getTodayQuizResult(userId);
    setCachedResult(todayResult);
    if (!todayResult) {
      void fetchQuiz();
    }
  };

  const handleStartQuiz = () => {
    if (quiz) {
      setQuizStarted(true);
      return;
    }

    setStartRequested(true);
    void fetchQuiz();
  };

  const helperText = quizError
    ? quizError
    : submitError
      ? submitError
      : startRequested && !quiz
        ? 'Today’s questions are warming up.'
        : null;

  if (cachedResult) {
    return <CompletedQuizScreen result={cachedResult} />;
  }

  if (!quizStarted) {
    return (
      <WelcomeScreen
        onStartQuiz={handleStartQuiz}
        isPreparing={startRequested && !quiz}
        helperText={helperText}
      />
    );
  }

  if (result && quiz) {
    return <ResultsScreen result={result} quiz={quiz} onPlayAgain={handleCloseResults} />;
  }

  if (!quiz) {
    return (
      <WelcomeScreen
        onStartQuiz={handleStartQuiz}
        isPreparing
        helperText={helperText || 'Today’s quiz is still warming up.'}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
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
  pressable: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
