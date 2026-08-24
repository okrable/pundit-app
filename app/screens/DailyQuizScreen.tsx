import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import {
  DAILY_QUIZ_REVEAL_DELAY_MS,
  DAILY_QUIZ_TIMER_MS,
  getDailyQuizRemainingSeconds,
  normalizeDailyQuizAttempt,
} from '../../shared/dailyQuizAttempt';

type Props = NativeStackScreenProps<GamesStackParamList, 'DailyQuiz'>;

export default function DailyQuizScreen({ navigation, route }: Props) {
  const safeAreaEdges = useMainTabSafeAreaEdges(['bottom']);
  const centeredQuizStyle = useCenteredWebStyle(webContentWidth.quiz);
  const [startRequested, setStartRequested] = useState(false);
  const [isHolding, setIsHolding] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const completionStartedRef = useRef<string | null>(null);
  const resumedAttemptRef = useRef<string | null>(null);
  const recapEventKeyRef = useRef<string | null>(null);
  const firstQuestionReadySent = useRef(false);

  const {
    quiz, cachedResult, quizError, submitError, result,
    userId: quizUserId, activeAttempt, activeAttemptSource, attemptError,
    fetchQuiz, completeQuiz, setUserId, setCachedResult, resetQuiz,
    beginDailyQuizAttempt, updateDailyQuizAttempt, hydrateActiveAttempt,
  } = useQuizStore();
  const { user, isAuthenticated } = useAuthStore();
  const setDailyGameActive = useAchievementStore((state) => state.setDailyGameActive);
  const releaseDailyReveals = useAchievementStore((state) => state.releaseDailyReveals);
  const actorType = !quizUserId || quizUserId.startsWith('guest_')
    ? 'guest' as const
    : 'authenticated' as const;
  const currentQuizDate = getQuizDate();
  const quizIsCurrent = isQuizForDate(quiz, currentQuizDate);
  const attemptIsCurrent = Boolean(
    activeAttempt && activeAttempt.userId === quizUserId &&
    activeAttempt.quizId === quiz?.id && activeAttempt.quizDate === currentQuizDate
  );

  useEffect(() => {
    const showingResult = Boolean(result?.date === currentQuizDate);
    const showingCached = Boolean(cachedResult?.date === currentQuizDate);
    setDailyGameActive(attemptIsCurrent && !showingResult && !showingCached);
    if (showingResult || showingCached) void releaseDailyReveals();
  }, [attemptIsCurrent, cachedResult, currentQuizDate, releaseDailyReveals, result, setDailyGameActive]);
  useEffect(() => () => setDailyGameActive(false), [setDailyGameActive]);
  useEffect(() => () => {
    if (useQuizStore.getState().activeAttempt) {
      useQuizStore.setState({ activeAttemptSource: 'cache' });
    }
  }, []);

  useEffect(() => {
    const loadWarmState = async () => {
      const userId = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(userId);
      await fetchQuiz();
    };
    void loadWarmState();
  }, [fetchQuiz, isAuthenticated, setUserId, user]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const syncCachedResult = async () => {
      if (useQuizStore.getState().isReconcilingIdentity) return;
      const userId = isAuthenticated && user ? user.sub : await getUserId();
      const todayResult = await getTodayQuizResult(userId);
      if (!active) return;
      if (!todayResult && cachedResult) {
        setCachedResult(null);
        resetQuiz();
        void fetchQuiz();
      } else if (todayResult && !cachedResult) {
        setCachedResult(todayResult);
      }
    };
    void syncCachedResult();
    return () => { active = false; };
  }, [cachedResult, fetchQuiz, isAuthenticated, resetQuiz, setCachedResult, user]));

  useFocusEffect(useCallback(() => () => {
    const state = useQuizStore.getState();
    if (state.result && state.cachedResult) state.resetQuiz();
  }, []));

  const startAttempt = useCallback(async () => {
    const attempt = await beginDailyQuizAttempt();
    if (attempt) {
      setStartRequested(false);
    }
  }, [beginDailyQuizAttempt]);

  useEffect(() => {
    if (startRequested && quizIsCurrent && quizUserId) void startAttempt();
  }, [quizIsCurrent, quizUserId, startAttempt, startRequested]);

  useEffect(() => {
    if (!route.params?.autoStart || cachedResult || attemptIsCurrent) return;
    navigation.setParams({ autoStart: false });
    setStartRequested(true);
    if (!quizIsCurrent) void fetchQuiz();
  }, [attemptIsCurrent, cachedResult, fetchQuiz, navigation, quizIsCurrent, route.params?.autoStart]);

  useEffect(() => {
    if (!activeAttempt || !quiz || !attemptIsCurrent) return;
    const key = `${activeAttempt.userId}:${activeAttempt.quizId}:${activeAttempt.startedAt}`;
    if (activeAttemptSource === 'cache' && resumedAttemptRef.current !== key) {
      resumedAttemptRef.current = key;
      markAnalyticsTiming('daily-quiz-session');
      trackAnalyticsEvent('quiz_attempt_resumed', actorType, {
        quizDate: activeAttempt.quizDate,
        questionNumber: activeAttempt.questionIndex + 1,
        totalQuestions: quiz.questions.length,
        source: 'cache',
      });
    }
  }, [activeAttempt, activeAttemptSource, actorType, attemptIsCurrent, quiz]);

  useEffect(() => {
    if (!activeAttempt || !quiz || !attemptIsCurrent) return;
    const normalized = normalizeDailyQuizAttempt(activeAttempt, quiz.questions.length);
    if (normalized.phase !== activeAttempt.phase ||
        normalized.questionIndex !== activeAttempt.questionIndex ||
        normalized.score !== activeAttempt.score) {
      void updateDailyQuizAttempt(() => normalized);
      return;
    }
    if (activeAttempt.phaseEndsAt === null) return;
    const delay = Math.max(activeAttempt.phaseEndsAt - Date.now(), 0);
    const timer = setTimeout(() => {
      void updateDailyQuizAttempt((attempt) =>
        normalizeDailyQuizAttempt(attempt, quiz.questions.length));
    }, Math.min(delay + 10, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [activeAttempt, attemptIsCurrent, quiz, updateDailyQuizAttempt]);

  useEffect(() => {
    if (!activeAttempt || activeAttempt.phase !== 'answering') return;
    const syncRemaining = () => setTimeRemaining(getDailyQuizRemainingSeconds(activeAttempt));
    syncRemaining();
    const timer = setInterval(syncRemaining, 250);
    return () => clearInterval(timer);
  }, [activeAttempt]);
  useEffect(() => {
    if (!activeAttempt || activeAttempt.phase === 'answering') return;
    const currentQuestionId = quiz?.questions[activeAttempt.questionIndex]?.id;
    const capturedMs = currentQuestionId
      ? activeAttempt.answerTimings[currentQuestionId]
      : undefined;
    setTimeRemaining(
      activeAttempt.phase === 'preparing'
        ? 20
        : Math.ceil((capturedMs ?? 0) / 1000)
    );
  }, [activeAttempt, quiz]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (!activeAttempt || !quiz) return;
      if (nextState === 'active') void hydrateActiveAttempt(activeAttempt.userId, quiz);
      else void updateDailyQuizAttempt((attempt) =>
        normalizeDailyQuizAttempt(attempt, quiz.questions.length));
    });
    return () => subscription.remove();
  }, [activeAttempt, hydrateActiveAttempt, quiz, updateDailyQuizAttempt]);

  useEffect(() => {
    if (!activeAttempt || !quiz || activeAttempt.phase !== 'completing' ||
        completionStartedRef.current === activeAttempt.quizId) return;
    completionStartedRef.current = activeAttempt.quizId;
    const answers = quiz.questions.map((question) => ({
      questionId: question.id,
      selectedOptionIndex: activeAttempt.answers[question.id],
      timeRemainingMs: activeAttempt.answerTimings[question.id] ?? 0,
    }));
    if (answers.some((answer) => answer.selectedOptionIndex === undefined)) {
      completionStartedRef.current = null;
      return;
    }
    void completeQuiz(answers).finally(() => { completionStartedRef.current = null; });
  }, [activeAttempt, completeQuiz, quiz]);

  useEffect(() => {
    const recapResult = result?.date === currentQuizDate ? result : cachedResult;
    if (!recapResult || recapEventKeyRef.current === recapResult.quizId) return;
    recapEventKeyRef.current = recapResult.quizId;
    trackAnalyticsEvent('quiz_recap_viewed', actorType, {
      quizDate: recapResult.date, score: recapResult.score,
      totalQuestions: recapResult.totalQuestions,
    });
  }, [actorType, cachedResult, currentQuizDate, result]);

  const handleOptionsReady = () => {
    if (!activeAttempt || activeAttempt.phase !== 'preparing') return;
    const now = Date.now();
    void updateDailyQuizAttempt((attempt) => ({
      ...attempt, phase: 'answering', timerEndsAt: now + DAILY_QUIZ_TIMER_MS,
      phaseEndsAt: null,
    }));
    if (activeAttempt.questionIndex === 0 && !firstQuestionReadySent.current && quiz) {
      firstQuestionReadySent.current = true;
      trackAnalyticsEvent('quiz_first_question_ready', actorType, {
        quizDate: currentQuizDate,
        durationMs: getAnalyticsTimingDuration('daily-quiz-session'), source: 'unknown',
      });
    }
  };

  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (!activeAttempt || activeAttempt.phase !== 'answering' || !quiz) return;
    if (activeAttempt.answers[questionId] !== undefined) return;
    const question = quiz.questions[activeAttempt.questionIndex];
    if (!question || question.id !== questionId) return;
    const now = Date.now();
    const capturedTimeMs = Math.max((activeAttempt.timerEndsAt ?? now) - now, 0);
    const points = question.correctOptionIndex === optionIndex
      ? calculateQuizPoints(capturedTimeMs) : 0;
    if (Object.keys(activeAttempt.answers).length === 0) {
      trackAnalyticsEvent('quiz_started', actorType, {
        quizDate: quiz.date, totalQuestions: quiz.questions.length,
      });
    }
    trackAnalyticsEvent('quiz_question_answered', actorType, {
      quizDate: quiz.date,
      durationMs: Math.max(DAILY_QUIZ_TIMER_MS - capturedTimeMs, 0),
      questionNumber: activeAttempt.questionIndex + 1,
      totalQuestions: quiz.questions.length, score: points,
    });
    void updateDailyQuizAttempt((attempt) => ({
      ...attempt,
      answers: { ...attempt.answers, [questionId]: optionIndex },
      answerTimings: { ...attempt.answerTimings, [questionId]: capturedTimeMs },
      pendingPoints: points, phase: 'answer_locked', timerEndsAt: null,
      phaseEndsAt: now + DAILY_QUIZ_REVEAL_DELAY_MS,
    }));
  };

  const handleStartQuiz = () => {
    markAnalyticsTiming('daily-quiz-session');
    trackAnalyticsEvent('quiz_start_requested', actorType, {
      quizDate: currentQuizDate, source: quizIsCurrent ? 'cache' : 'network',
    });
    setStartRequested(true);
    if (!quizIsCurrent) void fetchQuiz();
  };
  const handleRetryAttemptSave = () => {
    if (activeAttempt?.phase === 'completing' && quiz) {
      const answers = quiz.questions.map((question) => ({
        questionId: question.id,
        selectedOptionIndex: activeAttempt.answers[question.id],
        timeRemainingMs: activeAttempt.answerTimings[question.id] ?? 0,
      }));
      if (!answers.some((answer) => answer.selectedOptionIndex === undefined)) {
        void completeQuiz(answers);
      }
    } else if (activeAttempt) {
      void updateDailyQuizAttempt((attempt) => ({ ...attempt }));
    }
    else if (quizIsCurrent) setStartRequested(true);
  };
  const handleReturnToGames = () => { resetQuiz(); navigation.popToTop(); };

  if (result?.date === currentQuizDate && quizIsCurrent && quiz) {
    return (
      <View style={styles.resultContainer}>
        {attemptError ? (
          <Pressable style={styles.saveError} onPress={handleRetryAttemptSave}>
            <Text style={styles.saveErrorText}>{attemptError} Retry</Text>
          </Pressable>
        ) : null}
        <ResultsScreen result={result} quiz={quiz} onReturnToGames={handleReturnToGames} />
      </View>
    );
  }
  if (cachedResult?.date === currentQuizDate) {
    return <CompletedQuizScreen result={cachedResult} onReturnToGames={handleReturnToGames} />;
  }
  const helperText = attemptError || quizError || submitError ||
    (startRequested && !quizIsCurrent ? 'Today’s questions are warming up.' : null);
  if (!attemptIsCurrent || !activeAttempt) {
    return <WelcomeScreen onStartQuiz={handleStartQuiz}
      isPreparing={startRequested && !quizIsCurrent} helperText={helperText} />;
  }
  if (!quizIsCurrent || !quiz) {
    return <WelcomeScreen onStartQuiz={handleStartQuiz} isPreparing
      helperText={helperText || 'Today’s quiz is still warming up.'} />;
  }

  const currentQuestion = quiz.questions[activeAttempt.questionIndex];
  const selectedOption = currentQuestion
    ? activeAttempt.answers[currentQuestion.id] ?? null : null;
  const showingResult = activeAttempt.phase === 'result_reveal' ||
    activeAttempt.phase === 'exiting';
  const answeringEnabled = activeAttempt.phase === 'answering' && !attemptError;
  return (
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
      {attemptError ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Retry saving quiz progress"
          style={styles.saveError} onPress={handleRetryAttemptSave}>
          <Text style={styles.saveErrorText}>{attemptError} Retry</Text>
        </Pressable>
      ) : null}
      <Pressable style={styles.pressable} onPressIn={() => setIsHolding(true)}
        onPressOut={() => setIsHolding(false)}>
        <ScrollView style={styles.scrollView}
          contentContainerStyle={[styles.contentContainer, centeredQuizStyle]}
          showsVerticalScrollIndicator={false}>
          {currentQuestion ? (
            <QuestionCard question={currentQuestion} selectedOption={selectedOption}
              onSelectOption={(optionIndex) => handleSelectOption(currentQuestion.id, optionIndex)}
              disabled={!answeringEnabled} isExiting={activeAttempt.phase === 'exiting'}
              showResult={showingResult} correctOptionIndex={currentQuestion.correctOptionIndex}
              isHolding={isHolding} onOptionsReady={handleOptionsReady}
              revealImmediately={activeAttempt.phase !== 'preparing'}
              questionNumber={activeAttempt.questionIndex + 1}
              totalQuestions={quiz.questions.length} score={activeAttempt.score}
              timerDuration={20} timerActive={activeAttempt.phase === 'answering' && timeRemaining > 0}
              timeRemaining={timeRemaining} setTimeRemaining={setTimeRemaining}
              onTimeUp={() => setTimeRemaining(0)} />
          ) : null}
        </ScrollView>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  resultContainer: { flex: 1 },
  pressable: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { flexGrow: 1 },
  saveError: {
    backgroundColor: theme.colors.incorrect,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  saveErrorText: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamMedium,
    fontSize: 13,
    textAlign: 'center',
  },
});
