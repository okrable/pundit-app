import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GamesStackParamList } from '../navigation/GamesNavigator';
import { useQuizStore } from '../state/useQuizStore';
import { useCareerGameStore } from '../state/useCareerGameStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import JourneyGraphic from '../components/JourneyGraphic';
import CenteredWebContent, { webContentWidth } from '../components/ResponsiveLayout';
import { matchesCareerAnswer } from '../../shared/careerAnswer';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<GamesStackParamList, 'CareerGame'>;

const logoImage = require('../../assets/logo/dark/pundit-black.png');

export default function CareerGameScreen({ navigation }: Props) {
  const inputRef = useRef<TextInput>(null);
  const [guess, setGuess] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const { quiz, fetchQuiz, isQuizLoading } = useQuizStore();
  const { user, isAuthenticated } = useAuthStore();
  const {
    result,
    error,
    setUserId,
    hydrateFromCache,
    completeGame,
  } = useCareerGameStore();

  useEffect(() => {
    const prepare = async () => {
      const userId = isAuthenticated && user ? user.sub : await getUserId();
      setUserId(userId);
      await Promise.all([hydrateFromCache(userId), fetchQuiz()]);
    };
    void prepare();
  }, [fetchQuiz, hydrateFromCache, isAuthenticated, setUserId, user]);

  const game = quiz?.careerGame;
  const rows = useMemo(
    () =>
      game?.career
        .slice()
        .sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0)) ?? [],
    [game]
  );

  const handleSubmit = async () => {
    if (!game || !guess.trim()) {
      setFeedback('Enter a player name first.');
      return;
    }

    if (!matchesCareerAnswer(guess, game)) {
      setFeedback('Not quite — have another go.');
      setGuess('');
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    Keyboard.dismiss();
    setFeedback(null);
    await completeGame(game, guess);
  };

  const handleShare = async () => {
    if (!result) {
      return;
    }
    await Share.share({
      message: `Pundit - ${result.date}\nPlayer found ✅`,
    });
  };

  if (result) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <CenteredWebContent maxWidth={webContentWidth.quiz} style={styles.resultContent}>
          <Image source={logoImage} style={styles.resultLogo} resizeMode="contain" />
          <View style={styles.resultCard}>
            <View style={styles.resultTick}>
              <Text style={styles.resultTickText}>✓</Text>
            </View>
            <Text style={styles.resultKicker}>PLAYER FOUND</Text>
            <Text style={styles.resultName}>{result.canonicalName}</Text>
            <Text style={styles.resultCopy}>
              You followed the journey and found today’s player.
            </Text>
            {result.syncState === 'failed' || error ? (
              <Text style={styles.syncText}>
                Solved on this device. We’ll retry syncing later.
              </Text>
            ) : null}
          </View>
          <View style={styles.resultActions}>
            <TouchableOpacity style={styles.secondaryAction} onPress={handleShare}>
              <Text style={styles.secondaryActionText}>Share result</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => navigation.popToTop()}
            >
              <Text style={styles.primaryActionText}>Back to Games</Text>
            </TouchableOpacity>
          </View>
        </CenteredWebContent>
      </SafeAreaView>
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.centerState}>
          <JourneyGraphic />
          <Text style={styles.stateTitle}>
            {isQuizLoading ? 'Warming up today’s journey…' : 'Journey unavailable'}
          </Text>
          <Text style={styles.stateCopy}>
            {isQuizLoading
              ? 'The career card will be ready in a moment.'
              : 'The daily quiz is still available from Games.'}
          </Text>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => navigation.popToTop()}
          >
            <Text style={styles.primaryActionText}>Back to Games</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <CenteredWebContent maxWidth={webContentWidth.quiz} style={styles.content}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Image source={logoImage} style={styles.logo} resizeMode="contain" />
                {game.number !== undefined ? (
                  <Text style={styles.gameNumber}>#{game.number}</Text>
                ) : null}
              </View>

              <Text style={styles.prompt}>{game.prompt}</Text>

              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.heading, styles.yearsColumn]}>Years</Text>
                  <Text style={[styles.heading, styles.teamColumn]}>Team</Text>
                  <Text style={[styles.heading, styles.numberColumn]}>Apps</Text>
                  <Text style={[styles.heading, styles.numberColumn]}>Gls</Text>
                </View>
                {rows.map((row) => (
                  <View key={`${row.rank ?? row.years}-${row.team}`} style={styles.tableRow}>
                    <Text style={[styles.cell, styles.yearsColumn]}>{row.years}</Text>
                    <Text
                      style={[styles.cell, styles.teamColumn]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.82}
                    >
                      {row.team}
                    </Text>
                    <Text style={[styles.cell, styles.numberColumn]}>
                      {row.appearances}
                    </Text>
                    <Text style={[styles.cell, styles.numberColumn]}>{row.goals}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.answerArea}>
              <Text style={styles.answerLabel}>Who is the player?</Text>
              <TextInput
                ref={inputRef}
                value={guess}
                onChangeText={(value) => {
                  setGuess(value);
                  if (feedback) {
                    setFeedback(null);
                  }
                }}
                onSubmitEditing={() => void handleSubmit()}
                placeholder="Enter full name or surname"
                placeholderTextColor={theme.colors.mediumGray}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                style={styles.input}
                accessibilityLabel="Player name"
              />
              {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
              <TouchableOpacity style={styles.submitButton} onPress={() => void handleSubmit()}>
                <Text style={styles.submitButtonText}>Submit guess</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.popToTop()}>
                <Text style={styles.backText}>Back to Games</Text>
              </TouchableOpacity>
            </View>
          </CenteredWebContent>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: theme.spacing.md,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E7DFD2',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  cardHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    width: 142,
    height: 46,
  },
  gameNumber: {
    fontSize: 28,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  prompt: {
    fontSize: 20,
    lineHeight: 27,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  table: {
    gap: theme.spacing.xs,
  },
  tableRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableHeader: {
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#E7DFD2',
  },
  heading: {
    fontSize: 11,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  cell: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  yearsColumn: {
    width: 84,
  },
  teamColumn: {
    flex: 1,
  },
  numberColumn: {
    width: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  answerArea: {
    paddingHorizontal: theme.spacing.xs,
    gap: theme.spacing.sm,
  },
  answerLabel: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#D9D0C1',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.md,
    fontSize: 16,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
  },
  feedback: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.incorrect,
    textAlign: 'center',
  },
  submitButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
  backText: {
    paddingVertical: theme.spacing.sm,
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    textAlign: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  stateTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  stateCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
  resultContent: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  resultLogo: {
    alignSelf: 'center',
    width: 150,
    height: 50,
  },
  resultCard: {
    alignItems: 'center',
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E7DFD2',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  resultTick: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTickText: {
    fontSize: 30,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
  resultKicker: {
    marginTop: theme.spacing.sm,
    fontSize: 11,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    letterSpacing: 1.4,
  },
  resultName: {
    fontSize: 29,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  resultCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
  syncText: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
  },
  resultActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  primaryAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
  },
  primaryActionText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
  secondaryAction: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9D0C1',
    backgroundColor: theme.colors.white,
    paddingHorizontal: theme.spacing.lg,
  },
  secondaryActionText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
});
