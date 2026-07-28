import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
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
import CenteredWebContent, {
  useMobileLayoutMetrics,
  webContentWidth,
} from '../components/ResponsiveLayout';
import { theme } from '../theme/theme';
import { getGamesHubCompletionState } from '../../shared/gamesHub';

type Props = NativeStackScreenProps<GamesStackParamList, 'GamesHome'>;
type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ConceptGame {
  title: string;
  description: string;
  iconName: IconName;
}

const whiteLogo = require('../../assets/logo/white/pundit-white.png');

const moreGames: ConceptGame[] = [
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
  {
    title: 'Deadline Day',
    description: 'Match the player to the move.',
    iconName: 'swap-horizontal-outline',
  },
];

const quickGames: ConceptGame[] = [
  {
    title: 'Final Whistle',
    description: 'Race through football’s fastest quiz.',
    iconName: 'timer-outline',
  },
  {
    title: 'Derby Days',
    description: 'Know the rivals, cities and stories.',
    iconName: 'shield-half-outline',
  },
];

interface GallerySectionProps {
  title: string;
  cardWidth: number;
  children: React.ReactNode;
}

function GallerySection({ title, cardWidth, children }: GallerySectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.swipeHint}>SWIPE</Text>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        snapToAlignment="start"
        snapToInterval={cardWidth + theme.spacing.md}
        contentContainerStyle={styles.railContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export default function GamesHomeScreen({ navigation }: Props) {
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
    error: careerError,
    setUserId: setCareerUserId,
    hydrateFromCache: hydrateCareerResult,
  } = useCareerGameStore();

  useFocusEffect(
    useCallback(() => {
      let active = true;
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
            hydrateCareerResult(userId),
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
      hydrateCareerResult,
      isAuthenticated,
      setCachedResult,
      setCareerUserId,
      setUserId,
      user,
    ])
  );

  const cardWidth = useMemo(() => {
    const availableWidth = appWidth - screenPadding * 2;
    return Math.min(360, Math.max(246, Math.round(availableWidth * 0.86)));
  }, [appWidth, screenPadding]);

  const quizEmojis = cachedResult?.answers
    .map((isCorrect) => (isCorrect ? '⚽️' : '❌'))
    .join('');
  const quizCorrect = cachedResult?.answers.filter(Boolean).length ?? 0;
  const quizAvailable = Boolean(quiz?.questions.length);
  const careerAvailable = Boolean(quiz?.careerGame);
  const isDailyPayloadLoading = isHubRefreshing || isQuizLoading;
  const careerUnavailableError = careerError || quizError;
  const hubState = getGamesHubCompletionState(
    Boolean(cachedResult),
    Boolean(careerResult)
  );

  const quizBadge =
    hubState.quiz === 'completed'
      ? 'COMPLETE'
      : quizAvailable
        ? 'PLAY TODAY'
        : isDailyPayloadLoading
          ? 'LOADING'
          : 'UNAVAILABLE';
  const careerBadge =
    hubState.career === 'completed'
      ? 'COMPLETE'
      : careerAvailable
        ? 'PLAY TODAY'
        : isDailyPayloadLoading
          ? 'LOADING'
          : 'UNAVAILABLE';

  const quizDisabled =
    hubState.quiz !== 'completed' &&
    (!quizAvailable || isDailyPayloadLoading);
  const careerDisabled =
    hubState.career !== 'completed' &&
    (!careerAvailable || isDailyPayloadLoading);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <CenteredWebContent maxWidth={webContentWidth.narrow}>
          <View style={[styles.headerRow, { paddingHorizontal: screenPadding }]}>
            <Image source={whiteLogo} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.gamesLabel}>GAMES</Text>
          </View>

          <GallerySection title="Today" cardWidth={cardWidth}>
            <GameGalleryTile
              title="Pundit"
              description="Five questions. One daily score."
              iconName="football-outline"
              badgeLabel={quizBadge}
              badgeTone={
                hubState.quiz === 'completed'
                  ? 'complete'
                  : quizAvailable
                    ? 'accent'
                    : quizError
                      ? 'unavailable'
                      : 'muted'
              }
              width={cardWidth}
              disabled={quizDisabled}
              accessibilityHint={
                hubState.quiz === 'completed'
                  ? 'Opens today’s quiz recap'
                  : 'Starts today’s five-question quiz'
              }
              onPress={() =>
                navigation.navigate(
                  'DailyQuiz',
                  hubState.quiz === 'completed' ? undefined : { autoStart: true }
                )
              }
            >
              {cachedResult ? (
                <>
                  <Text style={styles.quizScore}>{cachedResult.score} pts</Text>
                  <Text style={styles.quizRecap}>
                    {quizEmojis} · {quizCorrect}/{cachedResult.totalQuestions}
                  </Text>
                </>
              ) : quizError ? (
                <Text style={styles.statusCopy}>Try again later</Text>
              ) : null}
            </GameGalleryTile>

            <GameGalleryTile
              title="Whose journey is this?"
              description="Trace the clubs. Guess the player."
              iconName="git-branch-outline"
              badgeLabel={careerBadge}
              badgeTone={
                hubState.career === 'completed'
                  ? 'complete'
                  : careerAvailable
                    ? 'accent'
                    : careerUnavailableError
                      ? 'unavailable'
                      : 'muted'
              }
              width={cardWidth}
              disabled={careerDisabled}
              accessibilityHint={
                hubState.career === 'completed'
                  ? 'Opens today’s completed career result'
                  : 'Starts today’s career game'
              }
              onPress={() => navigation.navigate('CareerGame')}
            >
              {careerResult ? (
                <View style={styles.playerFound}>
                  <Ionicons
                    name="checkmark-circle"
                    size={23}
                    color={theme.colors.primary}
                  />
                  <Text style={styles.playerFoundText}>Player found</Text>
                </View>
              ) : careerUnavailableError ? (
                <Text style={styles.statusCopy}>Try again later</Text>
              ) : null}
            </GameGalleryTile>
          </GallerySection>

          <GallerySection title="More games" cardWidth={cardWidth}>
            {moreGames.map((game) => (
              <GameGalleryTile
                key={game.title}
                {...game}
                badgeLabel="COMING SOON"
                badgeTone="muted"
                width={cardWidth}
                accessibilityHint="Shows a coming soon message"
                onPress={() => setComingSoonTitle(game.title)}
              />
            ))}
          </GallerySection>

          <GallerySection title="Quick games" cardWidth={cardWidth}>
            {quickGames.map((game) => (
              <GameGalleryTile
                key={game.title}
                {...game}
                badgeLabel="COMING SOON"
                badgeTone="muted"
                width={cardWidth}
                accessibilityHint="Shows a coming soon message"
                onPress={() => setComingSoonTitle(game.title)}
              />
            ))}
          </GallerySection>
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
  section: {
    marginTop: theme.spacing.xl,
  },
  sectionHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  swipeHint: {
    fontSize: 9,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.background,
    letterSpacing: 1.2,
  },
  railContent: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  quizScore: {
    fontSize: 21,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  quizRecap: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.neutralDark,
  },
  playerFound: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  playerFoundText: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
  },
  statusCopy: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.incorrect,
  },
});
