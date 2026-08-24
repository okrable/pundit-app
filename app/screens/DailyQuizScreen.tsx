import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import QuestionCard from '../components/QuestionCard';
import ResultsScreen from '../components/ResultsScreen';
import WelcomeScreen from '../components/WelcomeScreen';
import CompletedQuizScreen from '../components/CompletedQuizScreen';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { getTodayQuizResult } from '../storage/quizStorage';
import { theme } from '../theme/theme';
import { useCenteredWebStyle, webContentWidth } from '../components/ResponsiveLayout';
import { calculateQuizPoints } from '../../shared/scoring';
import {
  getAnalyticsTimingDuration,
  markAnalyticsTiming,
  trackAnalyticsEvent,
} from '../services/analytics';
import type { GamesStackParamList } from '../navigation/GamesNavigator';
import { useMainTabSafeAreaEdges } from '../navigation/MainTabSafeArea';
import { getQuizDate } from '../utils/quizDate';
import { isQuizForDate } from '../../shared/dailyQuiz';
import { useAchievementStore } from '../state/useAchievementStore';

const REVEAL_SUSPENSE_DELAY = 1000;
const RESULT_HOLD_DELAY = 1650;
const QUESTION_EXIT_DELAY = 1700;
const TIMER_DURATION = 20;

type Props = NativeStackScreenProps<GamesStackParamList, 'DailyQuiz'>;

export default function DailyQuizScreen({ navigation, route }: Props) {
  const safeAreaEdges = useMainTabSafeAreaEdges(['bottom']);
  const centeredQuizStyle = useCenteredWebStyle(webContentWidth.quiz);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showingResult, setShowingResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [startRequested, setStartRequested] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [answeringEnabled, setAnsweringEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [answerTimings, setAnswerTimings] = useState<Record<string, number>>({});
  const [isQuestionExiting, setIsQuestionExiting] = useState(false);
  const revealTimer = useRef<NodeJS.Timeout | null>(null);
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const questionExitTimer = useRef<NodeJS.Timeout | null>(null);
  const firstQuestionReadySent = useRef(false);
  const answeredCountRef = useRef(0);
  const completedRef = useRef(false);
  const actorTypeRef = useRef<'guest' | 'authenticated'>('guest');
  const recapEventKeyRef = useRef<string | null>(null);

  const {
    quiz,
    cachedResult,
    quizError,
    submitError,
    result,
    userId: quizUserId,
    isReconcilingIdentity,
    guestResetVersion,
    fetchQuiz,
    completeQuiz,
    setUserId,
    setCachedResult,
    resetQuiz,
  } = useQuizStore();
  const { user, isAuthenticated } = useAuthStore();
  const previousQuizUserIdRef = useRef<string | null>(null);
  const setDailyGameActive = useAchievementStore((state) => state.setDailyGameActive);
  const releaseDailyReveals = useAchievementStore((state) => state.releaseDailyReveals);
  actorTypeRef.current =
    !quizUserId || quizUserId.startsWith('guest_') ? 'guest' : 'authenticated';

  useEffect(() => {
    const showingImmediateResults = Boolean(result?.date === getQuizDate());
    const showingCompletedResult = Boolean(cachedResult?.date === getQuizDate());
    setDailyGameActive(quizStarted && !showingImmediateResults && !showingCompletedResult);
    if (showingImmediateResults || showingCompletedResult) void releaseDailyReveals();
  }, [cachedResult, quizStarted, releaseDailyReveals, result?.date, setDailyGameActive]);

  useEffect(() => () => setDailyGameActive(false), [setDailyGameActive]);

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
    setAnsweringEnabled(false);
    setTimeRemaining(TIMER_DURATION);
    setAnswerTimings({});
    setIsQuestionExiting(false);
    firstQuestionReadySent.current = false;
    answeredCountRef.current = 0;
    completedRef.current = false;
  };

  useEffect(() => {
    if (guestResetVersion === 0) return;
    resetPlayState();
    setQuizStarted(false);
    setStartRequested(false);
  }, [guestResetVersion]);

  useEffect(() => {
    const loadWarmState = async () => {
      const userId = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(userId);
      void fetchQuiz();
    };

    void loadWarmState();
  }, [fetchQuiz, isAuthenticated, setUserId, user]);

  useEffect(() => {
    const previousUserId = previousQuizUserIdRef.current;
    previousQuizUserIdRef.current = quizUserId;
    if (!previousUserId || !quizUserId || previousUserId === quizUserId) return;

    resetPlayState();
    setQuizStarted(false);
    setStartRequested(false);
  }, [quizUserId]);

  useEffect(() => {
    if (startRequested && isQuizForDate(quiz, getQuizDate())) {
      setQuizStarted(true);
      setStartRequested(false);
    }
  }, [quiz, startRequested]);

  useEffect(() => {
    if (!route.params?.autoStart || cachedResult || quizStarted) {
      return;
    }

    resetPlayState();
    if (isQuizForDate(quiz, getQuizDate())) {
      setQuizStarted(true);
    } else {
      setStartRequested(true);
      void fetchQuiz();
    }
    navigation.setParams({ autoStart: false });
  }, [
    cachedResult,
    fetchQuiz,
    navigation,
    quiz,
    quizStarted,
    route.params?.autoStart,
  ]);

  useEffect(() => {
    if (quiz) {
      resetPlayState();
    } else {
      resetPlayState();
      setQuizStarted(false);
    }
  }, [quiz?.id]);

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
      if (answeredCountRef.current > 0 && !completedRef.current) {
        trackAnalyticsEvent('quiz_abandoned', actorTypeRef.current, {
          quizDate: getQuizDate(),
          durationMs: getAnalyticsTimingDuration('daily-quiz-session'),
          questionNumber: answeredCountRef.current,
          totalQuestions: useQuizStore.getState().quiz?.questions.length ?? 0,
          exitReason: 'screen_exit',
        });
      }
    };
  }, []);

  useEffect(() => {
    const recapResult = result?.date === getQuizDate() ? result : cachedResult;
    if (!recapResult || recapEventKeyRef.current === recapResult.quizId) return;
    recapEventKeyRef.current = recapResult.quizId;
    trackAnalyticsEvent('quiz_recap_viewed', actorTypeRef.current, {
      quizDate: recapResult.date,
      score: recapResult.score,
      totalQuestions: recapResult.totalQuestions,
    });
  }, [cachedResult, result]);

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (!answeringEnabled || showingResult || answers[questionId] !== undefined) return;

    const currentQuestion = quiz?.questions[currentQuestionIndex];
    if (!currentQuestion) return;

    if (Object.keys(answers).length === 0) {
      trackAnalyticsEvent(
        'quiz_started',
        actorTypeRef.current,
        {
          quizDate: quiz.date,
          totalQuestions: quiz.questions.length,
        }
      );
    }

    setAnsweringEnabled(false);
    setTimerActive(false);
    const capturedTime = timeRemaining;
    const updatedAnswers = { ...answers, [questionId]: optionIndex };
    const updatedTimings = { ...answerTimings, [questionId]: capturedTime * 1000 };

    setAnswers(updatedAnswers);
    setAnswerTimings(updatedTimings);

    const isCorrect = currentQuestion.correctOptionIndex === optionIndex;
    const points = isCorrect ? calculateQuizPoints(capturedTime * 1000) : 0;
    answeredCountRef.current = Object.keys(updatedAnswers).length;
    trackAnalyticsEvent('quiz_question_answered', actorTypeRef.current, {
      quizDate: quiz.date,
      durationMs: (TIMER_DURATION - capturedTime) * 1000,
      questionNumber: currentQuestionIndex + 1,
      totalQuestions: quiz.questions.length,
      score: points,
    });

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
            completedRef.current = true;
            const formattedAnswers = Object.entries(updatedAnswers).map(
              ([qId, selectedOptionIndex]) => ({
                questionId: qId,
                selectedOptionIndex,
                timeRemainingMs: updatedTimings[qId] ?? 0,
              })
            );

            void completeQuiz(formattedAnswers);
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
    if (currentQuestionIndex === 0 && !firstQuestionReadySent.current && quizIsCurrent) {
      firstQuestionReadySent.current = true;
      trackAnalyticsEvent('quiz_first_question_ready', actorTypeRef.current, {
        quizDate: currentQuizDate,
        durationMs: getAnalyticsTimingDuration('daily-quiz-session'),
        source: 'unknown',
      });
    }
  };

  const currentQuizDate = getQuizDate();
  const quizIsCurrent = isQuizForDate(quiz, currentQuizDate);
  const totalQuestions = quizIsCurrent ? quiz?.questions.length ?? 0 : 0;
  const currentQuestion = quizIsCurrent ? quiz?.questions[currentQuestionIndex] : undefined;
  const currentAnswer =
    currentQuestion && answers[currentQuestion.id] !== undefined
      ? answers[currentQuestion.id]
      : null;

  const handleReturnToGames = () => {
    resetPlayState();
    setQuizStarted(false);
    resetQuiz();
    navigation.popToTop();
  };

  const handleStartQuiz = () => {
    resetPlayState();
    markAnalyticsTiming('daily-quiz-session');
    trackAnalyticsEvent('quiz_start_requested', actorTypeRef.current, {
      quizDate: getQuizDate(),
      source: isQuizForDate(quiz, getQuizDate()) ? 'cache' : 'network',
    });
    if (isQuizForDate(quiz, getQuizDate())) {
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
      : startRequested && !quizIsCurrent
        ? 'Today’s questions are warming up.'
        : null;

  if (result?.date === currentQuizDate && quizIsCurrent && quiz) {
    return (
      <ResultsScreen
        result={result}
        quiz={quiz}
        onReturnToGames={handleReturnToGames}
      />
    );
  }

  if (cachedResult?.date === currentQuizDate) {
    return (
      <CompletedQuizScreen
        result={cachedResult}
        onReturnToGames={handleReturnToGames}
      />
    );
  }

  if (!quizStarted) {
    return (
      <WelcomeScreen
        onStartQuiz={handleStartQuiz}
        isPreparing={startRequested && !quizIsCurrent}
        helperText={helperText}
      />
    );
  }

  if (!quizIsCurrent) {
    return (
      <WelcomeScreen
        onStartQuiz={handleStartQuiz}
        isPreparing
        helperText={helperText || 'Today’s quiz is still warming up.'}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
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
