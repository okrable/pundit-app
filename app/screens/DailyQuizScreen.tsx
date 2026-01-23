import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import QuestionCard from '../components/QuestionCard';
import CountdownTimer from '../components/CountdownTimer';
import ResultsScreen from '../components/ResultsScreen';
import WelcomeScreen from '../components/WelcomeScreen';
import CompletedQuizScreen from '../components/CompletedQuizScreen';
import { useQuizStore } from '../state/useQuizStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { getTodayQuizResult, saveDailyQuizResult, getGuestTodayResult, clearGuestCache, CachedQuizResult } from '../storage/quizStorage';
import { getTodayResult, migrateGuestResult } from '../services/api';
import { theme } from '../theme/theme';

const AUTO_ADVANCE_DELAY = 2000; // 2 seconds
const TIMER_DURATION = 20; // 20 seconds per question

// Calculate points based on time remaining (correct answers only)
function calculatePoints(timeRemaining: number): number {
  if (timeRemaining >= 16) return 100; // Lightning
  if (timeRemaining >= 12) return 80;  // Quick
  if (timeRemaining >= 8) return 60;   // Steady
  if (timeRemaining >= 4) return 40;   // Careful
  return 20;                            // Slow (including timer expired)
}

export default function DailyQuizScreen() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showingResult, setShowingResult] = useState(false);
  const [score, setScore] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [cachedResult, setCachedResult] = useState<CachedQuizResult | null>(null);
  const [checkingCache, setCheckingCache] = useState(true);
  const [isHolding, setIsHolding] = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TIMER_DURATION);
  const [answerTimings, setAnswerTimings] = useState<Record<string, number>>({});
  const autoAdvanceTimer = useRef<NodeJS.Timeout | null>(null);
  const { quiz, loading, error, result, fetchQuiz, submitQuizAnswers, setUserId, resetQuiz } = useQuizStore();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const initialize = async () => {
      // Determine user ID
      const userId = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(userId);

      if (isAuthenticated && user) {
        // Auth0 user: check for guest result to migrate, then check DB
        const guestResult = await getGuestTodayResult();

        if (guestResult) {
          // Guest played today, now logged in - migrate result to auth0 user
          try {
            const userProfile = {
              displayName: user.name,
              email: user.email,
              avatarUrl: user.picture,
            };

            // Migrate the guest result to the authenticated user's account
            const migrationResult = await migrateGuestResult(
              user.sub,
              guestResult.quizId,
              guestResult.score,
              guestResult.totalQuestions,
              guestResult.answers,
              userProfile
            );

            // Clear guest cache after successful migration
            await clearGuestCache();

            // Update the cached result with the new streak/bestScore from DB
            const migratedResult: CachedQuizResult = {
              ...guestResult,
              streak: migrationResult.streak,
              bestScore: migrationResult.bestScore,
              cachedAt: new Date().toISOString(),
              userId: user.sub,
            };

            await saveDailyQuizResult(migratedResult, user.sub);
            setCachedResult(migratedResult);
            setCheckingCache(false);
            return;
          } catch (migrationError) {
            console.error('Error migrating guest result:', migrationError);
            // Fall through to check DB in case user already has a result
          }

          // Clear guest cache even if migration failed
          await clearGuestCache();
        }

        // Check auth0 user's local cache first
        const localResult = await getTodayQuizResult(user.sub);
        if (localResult) {
          setCachedResult(localResult);
          setCheckingCache(false);
          return;
        }

        // Check database for auth0 user's result
        try {
          const dbResult = await getTodayResult(user.sub);
          if (dbResult) {
            // Found in DB, cache it locally
            await saveDailyQuizResult(dbResult, user.sub);
            setCachedResult({ ...dbResult, cachedAt: new Date().toISOString() });
            setCheckingCache(false);
            return;
          }
        } catch (error) {
          console.error('Error fetching today result:', error);
        }
      } else {
        // Guest user: check local cache only
        const localResult = await getTodayQuizResult(userId);
        if (localResult) {
          setCachedResult(localResult);
          setCheckingCache(false);
          return;
        }
      }

      // No cached result found, proceed with quiz
      setCheckingCache(false);
      fetchQuiz();
    };
    initialize();
  }, [isAuthenticated, user]);

  // Re-check cache when screen comes into focus (e.g., after clearing cache in settings)
  useFocusEffect(
    useCallback(() => {
      const checkCache = async () => {
        const userId = isAuthenticated && user ? user.sub : await getUserId();
        const todayResult = await getTodayQuizResult(userId);
        if (!todayResult && cachedResult) {
          // Cache was cleared, reset everything to show welcome screen
          setCachedResult(null);
          setQuizStarted(false);
          setAnswers({});
          setScore(0);
          setCurrentQuestionIndex(0);
          resetQuiz();

          // Fetch fresh quiz if we don't have one
          if (!quiz) {
            setUserId(userId);
            fetchQuiz();
          }
        } else if (todayResult && !cachedResult) {
          // A result exists but we don't have it in state, set it
          setCachedResult(todayResult);
        }
      };
      checkCache();
    }, [cachedResult, quiz, isAuthenticated, user])
  );

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

  // Save result to cache when quiz is completed
  useEffect(() => {
    if (result) {
      const userId = isAuthenticated && user ? user.sub : undefined;
      saveDailyQuizResult(result, userId);
    }
  }, [result, isAuthenticated, user]);

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

    // Stop the timer and capture time remaining
    setTimerActive(false);
    const capturedTime = timeRemaining;

    // Record the answer and timing
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex,
    }));
    setAnswerTimings((prev) => ({
      ...prev,
      [questionId]: capturedTime * 1000, // Convert to ms
    }));

    // Check if correct and update score with speed-based points
    const isCorrect = currentQuestion.correctOptionIndex === optionIndex;
    if (isCorrect) {
      const points = calculatePoints(capturedTime);
      setScore((prev) => prev + points);
    }

    // Show the result (correct/incorrect highlighting)
    setShowingResult(true);

    // Auto-advance after delay
    autoAdvanceTimer.current = setTimeout(() => {
      setShowingResult(false);

      const isLastQuestion = currentQuestionIndex === (quiz?.questions.length ?? 0) - 1;

      if (isLastQuestion) {
        // Submit quiz automatically with timing data
        const updatedAnswers = { ...answers, [questionId]: optionIndex };
        const updatedTimings = { ...answerTimings, [questionId]: capturedTime * 1000 };
        const formattedAnswers = Object.entries(updatedAnswers).map(([qId, selectedOptionIndex]) => ({
          questionId: qId,
          selectedOptionIndex,
          timeRemainingMs: updatedTimings[qId] ?? 0,
        }));
        submitQuizAnswers(formattedAnswers);
      } else {
        // Move to next question and reset timer
        setCurrentQuestionIndex((prev) => prev + 1);
        setTimeRemaining(TIMER_DURATION);
      }
    }, AUTO_ADVANCE_DELAY);
  };

  // Handle timer expiry - allow answer but with minimum points
  const handleTimeUp = () => {
    setTimerActive(false);
    // Timer expired - user can still answer but timeRemaining is 0
    // Points will be minimum (20) if they answer correctly
  };

  // Start timer when question typing completes
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

    // Check if there's a cached result for today after closing results
    const userId = isAuthenticated && user ? user.sub : await getUserId();
    const todayResult = await getTodayQuizResult(userId);
    if (todayResult) {
      setCachedResult(todayResult);
    } else {
      fetchQuiz();
    }
  };

  const handleStartQuiz = () => {
    setQuizStarted(true);
  };

  // Show cached result screen if user already completed today's quiz
  if (cachedResult) {
    return <CompletedQuizScreen result={cachedResult} />;
  }

  // Show loading while checking cache
  if (checkingCache) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <View style={styles.header}>
            <Text style={styles.subtitle}>Question {currentQuestionIndex + 1} of {totalQuestions}</Text>
            <CountdownTimer
              duration={TIMER_DURATION}
              isActive={timerActive}
              onTimeUp={handleTimeUp}
              timeRemaining={timeRemaining}
              setTimeRemaining={setTimeRemaining}
            />
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
              isHolding={isHolding}
              onTypingComplete={handleTypingComplete}
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
  pressable: {
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
