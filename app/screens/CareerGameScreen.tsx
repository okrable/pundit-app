import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Modal,
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
import { useFocusEffect } from '@react-navigation/native';
import { journeyShare } from '../../shared/journeyOutcome';
import { trackAnalyticsEvent } from '../services/analytics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { GamesStackParamList } from '../navigation/GamesNavigator';
import { useQuizStore } from '../state/useQuizStore';
import { useCareerGameStore } from '../state/useCareerGameStore';
import { useAuthStore } from '../state/useAuthStore';
import { getUserId } from '../storage/userStorage';
import PlayerNameSuggestions from '../components/PlayerNameSuggestions';
import JourneyGraphic from '../components/JourneyGraphic';
import CenteredWebContent, { webContentWidth } from '../components/ResponsiveLayout';
import { matchesCareerAnswer } from '../../shared/careerAnswer';
import { orderCareerRows } from '../../shared/careerGame';
import { theme } from '../theme/theme';
import { useMainTabSafeAreaEdges } from '../navigation/MainTabSafeArea';

type Props = NativeStackScreenProps<GamesStackParamList, 'CareerGame'>;

const logoImage = require('../../assets/logo/dark/pundit-black.png');

export default function CareerGameScreen({ navigation }: Props) {
  const safeAreaEdges = useMainTabSafeAreaEdges(['top', 'bottom']);
  const inputRef = useRef<TextInput>(null);
  const previousGameUserIdRef = useRef<string | null>(null);
  const [guess, setGuess] = useState('');
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);
  const startedAt = useRef(Date.now());
  const completionLock = useRef(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { quiz, fetchQuiz, isQuizLoading } = useQuizStore();
  const { user, isAuthenticated } = useAuthStore();
  const {
    userId: gameUserId,
    result,
    error,
    setUserId,
    hydrateFromCache,
    completeGame,
    retryPendingSubmission,
    isSubmitting,
  } = useCareerGameStore();

  useEffect(() => {
    const previousUserId = previousGameUserIdRef.current;
    previousGameUserIdRef.current = gameUserId;
    if (previousUserId === gameUserId) return;
    setConfirmGiveUp(false);
    startedAt.current = Date.now();
    setGuess('');
    setFeedback(null);
    Keyboard.dismiss();
  }, [gameUserId]);

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      const id = isAuthenticated && user ? user.sub : await getUserId();
      if (!active) return;
      setUserId(id);
      await Promise.all([hydrateFromCache(id), fetchQuiz()]);
    };
    void prepare();
    return () => { active = false; };
  }, [fetchQuiz, hydrateFromCache, isAuthenticated, setUserId, user]);
  const retry = useCallback(() => {
    if (gameUserId) void retryPendingSubmission(gameUserId);
  }, [gameUserId, retryPendingSubmission]);
  useFocusEffect(useCallback(() => { retry(); }, [retry]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if(state === 'active') retry(); });
    return () => sub.remove();
  }, [retry]);
  useEffect(() => {
    if (result?.syncState !== 'pending') return;
    const timers = [5000,15000,30000].map(delay => setTimeout(retry,delay));
    return () => timers.forEach(clearTimeout);
  }, [result?.gameId,result?.syncState,retry]);

  const game = quiz?.careerGame;
  const rows = useMemo(
    () => orderCareerRows(game?.career ?? []),
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
    await finish('solved', guess);
  };

  const finish = async (outcome: 'solved' | 'given_up', answer = '') => {
    if (!game || completionLock.current) return;
    completionLock.current = true;
    try {
      await completeGame(game,answer,outcome,Date.now()-startedAt.current);
    } catch (e) {
      if(useCareerGameStore.getState().userId === gameUserId)
        setFeedback(e instanceof Error ? e.message : 'Unable to save result. Please retry.');
    }
    finally { completionLock.current = false; }
  };

  const handleShare = async () => {
    if (!result) {
      return;
    }
    await Share.share({
      message: journeyShare(result.date,result.outcome ?? 'solved'),
    });
  };

  if (result) {
    return (
      <SafeAreaView style={styles.container} edges={safeAreaEdges}>
        <ScrollView contentContainerStyle={{flexGrow:1}}><CenteredWebContent maxWidth={webContentWidth.quiz} style={styles.resultContent}>
          <Image source={logoImage} style={styles.resultLogo} resizeMode="contain" />
          <View style={styles.resultCard}>
            <View style={styles.resultTick}>
              <Text style={styles.resultTickText}>{result.outcome === 'given_up' ? '?' : '✓'}</Text>
            </View>
            <Text style={styles.resultKicker}>{result.outcome === 'given_up' ? 'ANSWER REVEALED' : 'PLAYER FOUND'}</Text>
            <Text style={styles.resultName}>{result.canonicalName}</Text>
            <Text style={styles.resultCopy}>
              {result.outcome === 'given_up' ? 'You revealed today’s player. A new journey arrives tomorrow.' : 'You followed the journey and found today’s player.'}
            </Text>
            {result.syncState === 'pending' || result.syncState === 'failed' || error ? (
              <Text style={styles.syncText}>
                {error || 'Saved on this device. Syncing today’s outcome.'}
              </Text>
            ) : null}
          </View>
          <View style={styles.resultActions}>
            {result.syncState === 'pending' ? <TouchableOpacity accessibilityRole="button" style={styles.secondaryAction} onPress={retry} disabled={isSubmitting}>
              <Text style={styles.secondaryActionText}>{isSubmitting ? 'Syncing…' : 'Retry sync'}</Text>
            </TouchableOpacity> : null}
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryAction} onPress={handleShare}>
              <Text style={styles.secondaryActionText}>Share result</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button"
              style={styles.primaryAction}
              onPress={() => navigation.popToTop()}
            >
              <Text style={styles.primaryActionText}>Back to Games</Text>
            </TouchableOpacity>
          </View>
        </CenteredWebContent></ScrollView>
      </SafeAreaView>
    );
  }

  if (!game) {
    return (
      <SafeAreaView style={styles.container} edges={safeAreaEdges}>
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
          <TouchableOpacity accessibilityRole="button"
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
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
      <Modal visible={confirmGiveUp} transparent animationType="fade" onRequestClose={() => setConfirmGiveUp(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView style={{maxHeight:"90%"}} contentContainerStyle={styles.modalCard} accessibilityViewIsModal>
            <Text style={styles.stateTitle}>Reveal today’s player?</Text>
            <Text style={styles.stateCopy}>This finishes today’s Journey as given up. You cannot change it to a solve.</Text>
            <TouchableOpacity accessibilityRole="button" style={styles.secondaryAction} onPress={() => setConfirmGiveUp(false)}><Text style={styles.secondaryActionText}>Keep guessing</Text></TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.primaryAction} onPress={() => { setConfirmGiveUp(false); Keyboard.dismiss(); void finish('given_up'); }}><Text style={styles.primaryActionText}>Give Up and reveal</Text></TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
              <PlayerNameSuggestions value={guess} onSelect={name => { setGuess(name); setFeedback(null); }} actorType={isAuthenticated ? 'authenticated' : 'guest'} identityKey={gameUserId} />
              {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
              <TouchableOpacity accessibilityRole="button" style={styles.submitButton} onPress={() => void handleSubmit()}>
                <Text style={styles.submitButtonText}>Submit guess</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" style={styles.secondaryAction} onPress={() => setConfirmGiveUp(true)} accessibilityLabel="Give up and reveal the player">
                <Text style={styles.secondaryActionText}>Give Up</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => navigation.popToTop()}>
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
  modalBackdrop: {flex:1,backgroundColor:'rgba(0,0,0,0.45)',justifyContent:'center',padding:24},
  modalCard: {backgroundColor:theme.colors.background,padding:24,borderRadius:theme.borderRadius.lg,gap:16,width:'100%',maxWidth:440,alignSelf:'center'},
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
    backgroundColor: theme.colors.accent,
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
    backgroundColor: theme.colors.accent,
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
    backgroundColor: theme.colors.accent,
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
