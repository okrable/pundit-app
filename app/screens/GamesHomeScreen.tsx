import React, { useCallback, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { GamesStackParamList } from '../navigation/GamesNavigator';
import { useQuizStore } from '../state/useQuizStore';
import { useCareerGameStore } from '../state/useCareerGameStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { getTodayQuizResult } from '../storage/quizStorage';
import LawsOfTheGameModal from '../components/LawsOfTheGameModal';
import CareerRulesModal from '../components/CareerRulesModal';
import JourneyGraphic from '../components/JourneyGraphic';
import CenteredWebContent, { webContentWidth } from '../components/ResponsiveLayout';
import { theme } from '../theme/theme';
import { getGamesHubCompletionState } from '../../shared/gamesHub';

type Props = NativeStackScreenProps<GamesStackParamList, 'GamesHome'>;

const whiteLogo = require('../../assets/logo/white/pundit-white.png');

export default function GamesHomeScreen({ navigation }: Props) {
  const [showQuizRules, setShowQuizRules] = useState(false);
  const [showCareerRules, setShowCareerRules] = useState(false);
  const { user, isAuthenticated } = useAuthStore();
  const { quiz, cachedResult, fetchQuiz, setUserId, setCachedResult } = useQuizStore();
  const {
    result: careerResult,
    error: careerError,
    setUserId: setCareerUserId,
    hydrateFromCache: hydrateCareerResult,
  } = useCareerGameStore();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const refresh = async () => {
        const userId = isAuthenticated && user ? user.sub : await getUserId();
        if (!active) {
          return;
        }
        setUserId(userId);
        setCareerUserId(userId);
        const [quizResult] = await Promise.all([
          getTodayQuizResult(userId),
          hydrateCareerResult(userId),
          fetchQuiz(),
        ]);
        if (active) {
          setCachedResult(quizResult);
        }
      };

      void refresh();
      return () => {
        active = false;
      };
    }, [
      fetchQuiz,
      hydrateCareerResult,
      isAuthenticated,
      setCachedResult,
      setCareerUserId,
      setUserId,
      user,
    ])
  );

  const quizEmojis = cachedResult?.answers
    .map((isCorrect) => (isCorrect ? '⚽️' : '❌'))
    .join('');
  const quizCorrect = cachedResult?.answers.filter(Boolean).length ?? 0;
  const careerAvailable = Boolean(quiz?.careerGame);
  const hubState = getGamesHubCompletionState(
    Boolean(cachedResult),
    Boolean(careerResult)
  );

  const startCareer = () => {
    setShowCareerRules(false);
    navigation.navigate('CareerGame');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CenteredWebContent maxWidth={webContentWidth.narrow} style={styles.content}>
          <View style={styles.headerRow}>
            <Image source={whiteLogo} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.gamesLabel}>GAMES</Text>
          </View>

          <View style={styles.modeSection}>
            {hubState.career === 'completed' ? (
              <>
                <View style={styles.completedIcon}>
                  <Text style={styles.completedIconText}>✓</Text>
                </View>
                <Text style={styles.modeTitle}>Player found</Text>
                <Text style={styles.modeSubtitle}>Today’s journey is complete.</Text>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('CareerGame')}
                >
                  <Text style={styles.secondaryButtonText}>View result</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <JourneyGraphic />
                <Text style={styles.modeTitle}>Whose journey is this?</Text>
                <Text style={styles.modeSubtitle}>Trace the clubs. Guess the player.</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setShowCareerRules(true)}
                  >
                    <Text style={styles.secondaryButtonText}>How it works</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryButton, !careerAvailable && styles.buttonDisabled]}
                    onPress={startCareer}
                    disabled={!careerAvailable}
                  >
                    <Text style={styles.primaryButtonText}>
                      {careerAvailable ? 'Start guessing' : 'Warming up'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {careerError ? <Text style={styles.helperText}>{careerError}</Text> : null}
              </>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.modeSection}>
            {hubState.quiz === 'completed' && cachedResult ? (
              <>
                <Text style={styles.completedKicker}>DAILY QUIZ COMPLETE</Text>
                <Text style={styles.scoreText}>{cachedResult.score} points</Text>
                <Text style={styles.emojiText}>{quizEmojis}</Text>
                <Text style={styles.modeSubtitle}>
                  {quizCorrect}/{cachedResult.totalQuestions} correct
                </Text>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => navigation.navigate('DailyQuiz')}
                >
                  <Text style={styles.secondaryButtonText}>View recap</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Image source={whiteLogo} style={styles.quizLogo} resizeMode="contain" />
                <Text style={styles.modeSubtitle}>5 Questions. Don’t bottle it.</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => setShowQuizRules(true)}
                  >
                    <Text style={styles.secondaryButtonText}>Laws of the Game</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() =>
                      navigation.navigate('DailyQuiz', { autoStart: true })
                    }
                  >
                    <Text style={styles.primaryButtonText}>Kick Off</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </CenteredWebContent>
      </ScrollView>

      <CareerRulesModal
        visible={showCareerRules}
        onClose={() => setShowCareerRules(false)}
        onStart={startCareer}
      />
      <LawsOfTheGameModal
        visible={showQuizRules}
        onClose={() => setShowQuizRules(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: theme.spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  headerRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLogo: {
    width: 112,
    height: 38,
  },
  gamesLabel: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.background,
    letterSpacing: 2,
  },
  modeSection: {
    flex: 1,
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xl,
  },
  modeTitle: {
    fontSize: 24,
    lineHeight: 29,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  modeSubtitle: {
    marginTop: theme.spacing.xs,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.background,
    textAlign: 'center',
  },
  actions: {
    marginTop: theme.spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  primaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  helperText: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.background,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(249, 246, 237, 0.42)',
  },
  quizLogo: {
    width: 230,
    height: 78,
  },
  completedIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: theme.colors.primary,
    marginBottom: theme.spacing.md,
  },
  completedIconText: {
    fontSize: 28,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
  completedKicker: {
    fontSize: 11,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.background,
    letterSpacing: 1.3,
  },
  scoreText: {
    marginTop: theme.spacing.xs,
    fontSize: 30,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    textTransform: 'uppercase',
  },
  emojiText: {
    marginTop: theme.spacing.sm,
    fontSize: 23,
    letterSpacing: 4,
  },
});
