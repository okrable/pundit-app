import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import type { GamesStackParamList } from '../navigation/GamesNavigator';
import { useQuizStore } from '../state/useQuizStore';
import { useCareerGameStore } from '../state/useCareerGameStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import { getTodayQuizResult } from '../storage/quizStorage';
import ComingSoonModal from '../components/ComingSoonModal';
import GameGalleryTile from '../components/GameGalleryTile';
import JourneyGraphic from '../components/JourneyGraphic';
import CenteredWebContent, {
  useMobileLayoutMetrics,
  webContentWidth,
} from '../components/ResponsiveLayout';
import { theme } from '../theme/theme';
import {
  getCareerTileState,
  getGamesHubCompletionState,
} from '../../shared/gamesHub';
import { useMainTabSafeAreaEdges } from '../navigation/MainTabSafeArea';
import { getQuizDate } from '../utils/quizDate';
import { isQuizForDate } from '../../shared/dailyQuiz';
import { getCareerResultForDate } from '../../shared/careerGame';
import { markAnalyticsTiming, trackAnalyticsEvent } from '../services/analytics';

type Props = NativeStackScreenProps<GamesStackParamList, 'GamesHome'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ConceptGame {
  title: string;
  description: string;
  iconName: IconName;
}

const whiteLogo = require('../../assets/logo/white/pundit-white.png');

const conceptGames: ConceptGame[] = [
  {
    title: 'Starting XI',
    description: 'Build the team from eleven clues.',
    iconName: 'people-outline',
  },
  {
    title: 'The Link Up',
    description: 'Find what connects the players.',
    iconName: 'link-outline',
  },
];

interface GameRowProps {
  cardWidth: number;
  horizontalPadding: number;
  children: React.ReactNode;
}

function GameRow({ cardWidth, horizontalPadding, children }: GameRowProps) {
  return (
    <View style={styles.gameRow}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToAlignment="start"
        snapToInterval={cardWidth + theme.spacing.md}
        contentContainerStyle={[
          styles.railContent,
          { paddingHorizontal: horizontalPadding },
          Platform.OS === 'web' && styles.webRailContent,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export default function GamesHomeScreen({ navigation }: Props) {
  const safeAreaEdges = useMainTabSafeAreaEdges(['top', 'bottom']);
  const [comingSoonTitle, setComingSoonTitle] = useState<string | null>(null);
  const [isHubRefreshing, setIsHubRefreshing] = useState(true);
  const { appWidth, screenPadding } = useMobileLayoutMetrics();
  const { user, isAuthenticated } = useAuthStore();
  const {
    quiz,
    cachedResult,
    quizError,
    isQuizLoading,
    fetchQuiz,
    setUserId,
    setCachedResult,
  } = useQuizStore();
  const {
    result: careerResult,
    setUserId: setCareerUserId,
    hydrateFromCache: hydrateCareerFromCache,
  } = useCareerGameStore();
  useFocusEffect(
    useCallback(() => {
      let active = true;
      trackAnalyticsEvent(
        'today_viewed',
        isAuthenticated ? 'authenticated' : 'guest',
        { quizDate: getQuizDate() }
      );
      const refresh = async () => {
        setIsHubRefreshing(true);
        try {
          const userId = isAuthenticated && user ? user.sub : await getUserId();
          if (!active) {
            return;
          }
          setUserId(userId);
          setCareerUserId(userId);
          const [quizResult] = await Promise.all([
            getTodayQuizResult(userId),
            hydrateCareerFromCache(userId),
            fetchQuiz(),
          ]);
          if (active) {
            setCachedResult(quizResult);
          }
        } finally {
          if (active) {
            setIsHubRefreshing(false);
          }
        }
      };

      void refresh();
      return () => {
        active = false;
      };
    }, [
      fetchQuiz,
      isAuthenticated,
      hydrateCareerFromCache,
      setCareerUserId,
      setCachedResult,
      setUserId,
      user,
    ])
  );

  const cardWidth = useMemo(() => {
    const availableWidth =
      Math.min(appWidth, webContentWidth.wide) - screenPadding * 2;

    if (Platform.OS === 'web' && appWidth >= 600) {
      return Math.min(
        webContentWidth.quiz,
        Math.max(320, Math.round(availableWidth))
      );
    }

    return Math.min(360, Math.max(246, Math.round(availableWidth * 0.86)));
  }, [appWidth, screenPadding]);
  const rowHorizontalPadding =
    Platform.OS === 'web'
      ? screenPadding
      : Math.max(screenPadding, Math.round((appWidth - cardWidth) / 2));

  const currentQuizDate = getQuizDate();
  const currentCachedResult =
    cachedResult?.date === currentQuizDate ? cachedResult : null;
  const quizEmojis = currentCachedResult?.answers
    .map((isCorrect) => (isCorrect ? '⚽️' : '❌'))
    .join('');
  const quizCorrect = currentCachedResult?.answers.filter(Boolean).length ?? 0;
  const quizAvailable =
    isQuizForDate(quiz, currentQuizDate) && Boolean(quiz?.questions.length);
  const isDailyPayloadLoading = isHubRefreshing || isQuizLoading;
  const currentCareerResult = getCareerResultForDate(
    careerResult,
    currentQuizDate
  );
  const careerAvailable =
    isQuizForDate(quiz, currentQuizDate) && Boolean(quiz?.careerGame);
  const hubState = getGamesHubCompletionState(
    Boolean(currentCachedResult),
    Boolean(currentCareerResult)
  );
  const careerTileState = getCareerTileState({
    hasGame: careerAvailable,
    hasResult: hubState.career === 'completed',
    isLoading: isDailyPayloadLoading,
  });

  const quizActionLabel =
    hubState.quiz === 'completed'
      ? 'View recap'
      : quizAvailable
        ? 'Kick Off'
        : isDailyPayloadLoading
          ? 'Warming up'
          : 'Unavailable';
  const quizActionTone =
    quizAvailable || hubState.quiz === 'completed'
      ? 'primary'
      : quizError
        ? 'unavailable'
        : 'muted';
  const quizDisabled =
    hubState.quiz !== 'completed' &&
    (!quizAvailable || isDailyPayloadLoading);
  const careerActionLabel =
    careerTileState === 'completed'
      ? 'Player found'
      : careerTileState === 'available'
        ? 'Play'
        : careerTileState === 'loading'
          ? 'Warming up'
          : 'Unavailable';
  const careerActionTone =
    careerTileState === 'available' || careerTileState === 'completed'
      ? 'primary'
      : careerTileState === 'unavailable'
        ? 'unavailable'
        : 'muted';
  const careerDisabled =
    careerTileState === 'loading' || careerTileState === 'unavailable';

  const actorType = isAuthenticated ? 'authenticated' : 'guest';
  const handleOpenQuiz = () => {
    if (!currentCachedResult) {
      markAnalyticsTiming('daily-quiz-session');
      trackAnalyticsEvent('quiz_start_requested', actorType, {
        quizDate: currentQuizDate,
        source: quizAvailable ? 'cache' : 'network',
      });
    }
    navigation.navigate(
      'DailyQuiz',
      currentCachedResult ? undefined : { autoStart: true }
    );
  };

  const handleOpenJourney = () => {
    if (!currentCareerResult) {
      trackAnalyticsEvent('journey_started', actorType, {
        quizDate: currentQuizDate,
        source: careerAvailable ? 'cache' : 'network',
      });
    }
    navigation.navigate('CareerGame');
  };

  return (
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <CenteredWebContent maxWidth={webContentWidth.wide}>
          {Platform.OS !== 'web' ? (
            <View style={[styles.headerRow, { paddingHorizontal: screenPadding }]}>
              <Image source={whiteLogo} style={styles.headerLogo} resizeMode="contain" />
              <Text style={styles.gamesLabel}>GAMES</Text>
            </View>
          ) : null}

          <GameRow
            cardWidth={cardWidth}
            horizontalPadding={rowHorizontalPadding}
          >
            <GameGalleryTile
              title="PUNDIT"
              titleVariant="pundit"
              description="5 Questions. Don’t bottle it."
              artwork={
                <View style={styles.punditFootball}>
                  <Ionicons
                    name="football"
                    size={42}
                    color={theme.colors.white}
                  />
                </View>
              }
              actionLabel={quizActionLabel}
              actionTone={quizActionTone}
              showActionArrow={quizAvailable && !currentCachedResult}
              actionSummary={
                currentCachedResult ? (
                  <View style={styles.quizSummary}>
                    <Text style={styles.quizScore}>
                      {currentCachedResult.score} pts
                    </Text>
                    <Text style={styles.quizRecap}>
                      {quizEmojis} · {quizCorrect}/{currentCachedResult.totalQuestions}
                    </Text>
                  </View>
                ) : quizError ? (
                  <Text style={styles.unavailableCopy}>Try again later</Text>
                ) : undefined
              }
              width={cardWidth}
              disabled={quizDisabled}
              accessibilityHint={
                hubState.quiz === 'completed'
                  ? 'Opens today’s quiz recap'
                  : 'Starts today’s five-question quiz'
              }
              onPress={handleOpenQuiz}
            />
          </GameRow>

          <GameRow
            cardWidth={cardWidth}
            horizontalPadding={rowHorizontalPadding}
          >
            <GameGalleryTile
              title="Whose journey is this?"
              description="Trace the clubs. Guess the player."
              artwork={<JourneyGraphic width={86} />}
              actionLabel={careerActionLabel}
              actionTone={careerActionTone}
              actionSummary={
                currentCareerResult ? (
                  <Text style={styles.careerResultName} numberOfLines={1}>
                    {currentCareerResult.canonicalName}
                  </Text>
                ) : undefined
              }
              showActionArrow={careerTileState === 'available'}
              width={cardWidth}
              disabled={careerDisabled}
              accessibilityHint={
                careerTileState === 'completed'
                  ? 'Opens today’s completed player journey'
                  : 'Starts today’s player journey game'
              }
              onPress={handleOpenJourney}
            />
          </GameRow>

          {conceptGames.map((game) => (
            <GameRow
              key={game.title}
              cardWidth={cardWidth}
              horizontalPadding={rowHorizontalPadding}
            >
              <GameGalleryTile
                {...game}
                badgeLabel="COMING SOON"
                badgeTone="muted"
                width={cardWidth}
                accessibilityHint="Shows a coming soon message"
                onPress={() => setComingSoonTitle(game.title)}
              />
            </GameRow>
          ))}
        </CenteredWebContent>
      </ScrollView>

      <ComingSoonModal
        title={comingSoonTitle}
        onClose={() => setComingSoonTitle(null)}
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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
  headerRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
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
  gameRow: {
    marginTop: theme.spacing.md,
  },
  railContent: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  webRailContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  punditFootball: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
  },
  quizSummary: {
    alignItems: 'flex-end',
  },
  quizScore: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.white,
  },
  quizRecap: {
    marginTop: 2,
    fontSize: 9,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.white,
  },
  unavailableCopy: {
    fontSize: 11,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.incorrect,
  },
  careerResultName: {
    maxWidth: 150,
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
    textAlign: 'right',
  },
});
