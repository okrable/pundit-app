import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import QuestionCard from '../components/QuestionCard';
import ResultsScreen from '../components/ResultsScreen';
import WelcomeScreen from '../components/WelcomeScreen';
import CompletedQuizScreen from '../components/CompletedQuizScreen';
import AuthSyncScreen from '../components/AuthSyncScreen';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { getTodayQuizResult } from '../storage/quizStorage';
import { theme } from '../theme/theme';

const REVEAL_SUSPENSE_DELAY = 1000;
const RESULT_HOLD_DELAY = 1650;
const QUESTION_EXIT_DELAY = 1700;
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
  const [isQuestionExiting, setIsQuestionExiting] = useState(false);
  const revealTimer = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const questionExitTimer = useRef<NodeJS.Timeout | null>(null);

  const {
    quiz,
    cachedResult,
    quizError,
    submitError,
    result,
    userId: quizUserId,
    isReconcilingIdentity,
    fetchQuiz,
    submitQuizAnswers,
    createLocalResult,
    reconcileIdentity,
    setUserId,
    setCachedResult,
    resetQuiz,
  } = useQuizStore();
  const { user, isAuthenticated, token } = useAuthStore();

  const clearQuestionTimers = () => {
    if (revealTimer.current) {
      clearTimeout(revealTimer.current);
      revealTimer.current = null;
    }
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    if (questionExitTimer.current) {
      clearTimeout(questionExitTimer.current);
      questionExitTimer.current = null;
    }
  };

  const resetPlayState = () => {
    clearQuestionTimers();
    setCurrentQuestionIndex(0);
    setAnswers({});
    setShowingResult(false);
    setScore(0);
    setTimerActive(false);
    setTimeRemaining(TIMER_DURATION);
    setAnswerTimings({});
    setIsQuestionExiting(false);
  };

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
      resetPlayState();
    }
  }, [quiz?.id]);

  useLayoutEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    resetPlayState();
    setQuizStarted(false);

    if (!token) {
      return;
    }

    void reconcileIdentity(user.sub, {
      displayName: user.name,
      email: user.email,
      avatarUrl: user.picture,
    });
  }, [isAuthenticated, reconcileIdentity, token, user]);

  useLayoutEffect(() => {
    if (!isReconcilingIdentity) {
      return;
    }

    resetPlayState();
    setQuizStarted(false);
  }, [isReconcilingIdentity]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const syncCachedResult = async () => {
        if (useQuizStore.getState().isReconcilingIdentity) {
          return;
        }

        const userId = isAuthenticated && user ? user.sub : await getUserId();
        const todayResult = await getTodayQuizResult(userId);

        if (!isActive) {
          return;
        }

        if (!todayResult && cachedResult) {
          setCachedResult(null);
          setQuizStarted(false);
          resetPlayState();
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

  useFocusEffect(
    useCallback(() => {
      return () => {
        const state = useQuizStore.getState();
        if (state.result && state.cachedResult) {
          state.resetQuiz();
        }
      };
    }, [])
  );

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

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (showingResult || answers[questionId] !== undefined) return;

    const currentQuestion = quiz?.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setTimerActive(false);
    const capturedTime = timeRemaining;
    const updatedAnswers = { ...answers, [questionId]: optionIndex };
    const updatedTimings = { ...answerTimings, [questionId]: capturedTime * 1000 };

    setAnswers(updatedAnswers);
    setAnswerTimings(updatedTimings);

    const isCorrect = currentQuestion.correctOptionIndex === optionIndex;
    const points = isCorrect ? calculatePoints(capturedTime) : 0;

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

      autoAdvanceTimer.current = setTimeout(() => {
        setIsQuestionExiting(true);

        questionExitTimer.current = setTimeout(() => {
          setShowingResult(false);
          setIsQuestionExiting(false);

          const isLastQuestion = currentQuestionIndex === (quiz?.questions.length ?? 0) - 1;

          if (isLastQuestion) {
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
        }, QUESTION_EXIT_DELAY);
      }, RESULT_HOLD_DELAY);
    }, REVEAL_SUSPENSE_DELAY);
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
    resetPlayState();
    setQuizStarted(false);
    resetQuiz();

    const userId = isAuthenticated && user ? user.sub : await getUserId();
    const todayResult = await getTodayQuizResult(userId);
    setCachedResult(todayResult);
    if (!todayResult) {
      void fetchQuiz();
    }
  };

  const handleStartQuiz = () => {
    resetPlayState();
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

  const shouldShowReconciliation =
    isReconcilingIdentity ||
    Boolean(isAuthenticated && user?.sub && token && quizUserId !== user.sub);

  if (shouldShowReconciliation) {
    return (
      <AuthSyncScreen
        title="Syncing your play..."
        subtitle="Just getting today’s result ready."
      />
    );
  }

  if (result && quiz) {
    return <ResultsScreen result={result} quiz={quiz} onPlayAgain={handleCloseResults} />;
  }

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
              question={currentQuestion}
              selectedOption={currentAnswer}
              onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
              isExiting={isQuestionExiting}
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
