import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Question } from '../types';
import { theme } from '../theme/theme';
import CountdownTimer from './CountdownTimer';
import { useMobileLayoutMetrics } from './ResponsiveLayout';

const TYPING_SPEED = 30;
const TYPING_SPEED_FAST = 8;
const OPTION_FADE_DURATION = 300;
const OPTION_STAGGER_DELAY = 220;
const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const logoImage = require('../../assets/logo/dark/pundit-black.png');

const REVEAL_PHRASE_SETS = [
  { locked: 'Shoots...', correct: 'Scores!', incorrect: 'Saved!' },
  { locked: 'Takes aim...', correct: 'Top bins!', incorrect: 'Off target!' },
  { locked: 'Chance!', correct: 'GOAL!', incorrect: 'Denied!' },
  { locked: 'Locked in!', correct: 'In the net!', incorrect: 'Wide!' },
  { locked: 'Goes for it!', correct: 'What a finish!', incorrect: 'Not this time!' },
] as const;

const usedRevealPhraseIndexes = new Set<number>();

function pickRevealPhraseSetIndex(): number {
  if (usedRevealPhraseIndexes.size >= REVEAL_PHRASE_SETS.length) {
    usedRevealPhraseIndexes.clear();
  }

  const availableIndexes = REVEAL_PHRASE_SETS
    .map((_, index) => index)
    .filter((index) => !usedRevealPhraseIndexes.has(index));
  const phraseIndex =
    availableIndexes[Math.floor(Math.random() * availableIndexes.length)] ?? 0;
  usedRevealPhraseIndexes.add(phraseIndex);
  return phraseIndex;
}

interface QuestionCardProps {
  question: Question;
  selectedOption: number | null;
  onSelectOption: (optionIndex: number) => void;
  disabled?: boolean;
  isExiting?: boolean;
  showResult?: boolean;
  correctOptionIndex?: number;
  isHolding?: boolean;
  onOptionsReady?: () => void;
  revealImmediately?: boolean;
  questionNumber: number;
  totalQuestions: number;
  score: number;
  timerDuration: number;
  timerActive: boolean;
  timeRemaining: number;
  setTimeRemaining: (time: number) => void;
  onTimeUp: () => void;
}

interface OptionTileProps {
  option: string;
  index: number;
  isSelected: boolean;
  isLocked: boolean;
  showResult: boolean;
  isCorrectOption: boolean;
  isWrongSelected: boolean;
  onPress: () => void;
  minHeight: number;
  padding: number;
  useSingleColumn: boolean;
  animateEntry: boolean;
}

function OptionTile({
  option,
  index,
  isSelected,
  isLocked,
  showResult,
  isCorrectOption,
  isWrongSelected,
  onPress,
  minHeight,
  padding,
  useSingleColumn,
  animateEntry,
}: OptionTileProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isSelected && !showResult) {
      scale.value = withSequence(
        withTiming(0.96, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withSpring(1.02, { damping: 12, stiffness: 240 }),
        withSpring(1, { damping: 14, stiffness: 220 })
      );
    }
  }, [isSelected, scale, showResult]);

  useEffect(() => {
    if (showResult && isCorrectOption) {
      scale.value = withSequence(
        withTiming(1.07, { duration: 230, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 210, easing: Easing.in(Easing.cubic) }),
        withTiming(1.06, { duration: 230, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 210, easing: Easing.in(Easing.cubic) }),
        withTiming(1.05, { duration: 230, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 18, stiffness: 130 })
      );
    }
  }, [isCorrectOption, scale, showResult]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tileStyles: ViewStyle[] = [styles.optionButton];
  const labelStyles: TextStyle[] = [styles.optionLabel];
  const textStyles: TextStyle[] = [styles.optionText];

  if (showResult) {
    if (isCorrectOption) {
      tileStyles.push(styles.optionButtonCorrect);
      labelStyles.push(styles.optionLabelStrong);
      textStyles.push(styles.optionTextStrong);
    } else if (isWrongSelected) {
      tileStyles.push(styles.optionButtonIncorrect);
      labelStyles.push(styles.optionLabelStrong);
      textStyles.push(styles.optionTextStrong);
    } else {
      tileStyles.push(styles.optionButtonDimmed);
    }
  } else if (isSelected) {
    tileStyles.push(styles.optionButtonSelected);
    labelStyles.push(styles.optionLabelSelected);
    textStyles.push(styles.optionTextSelected);
  }

  return (
    <Animated.View
      layout={LinearTransition.duration(180)}
      style={[
        styles.optionWrapper,
        useSingleColumn ? styles.optionWrapperSingleColumn : null,
        animatedStyle,
      ]}
    >
      <Animated.View
        entering={
          animateEntry
            ? FadeIn.duration(OPTION_FADE_DURATION).delay(index * OPTION_STAGGER_DELAY)
            : undefined
        }
      >
        <Pressable
          style={({ pressed }) => [
            tileStyles,
            { minHeight, padding },
            pressed && !isLocked ? styles.optionButtonPressed : null,
          ]}
          onPress={onPress}
          disabled={isLocked}
        >
          <View style={styles.optionLabelBadge}>
            <Text style={labelStyles}>{OPTION_LABELS[index]}</Text>
          </View>
          <Text
            style={textStyles}
            numberOfLines={3}
            adjustsFontSizeToFit
            minimumFontScale={0.78}
          >
            {option}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default function QuestionCard({
  question,
  selectedOption,
  onSelectOption,
  disabled = false,
  isExiting = false,
  showResult = false,
  correctOptionIndex,
  isHolding = false,
  onOptionsReady,
  revealImmediately = false,
  questionNumber,
  totalQuestions,
  score,
  timerDuration,
  timerActive,
  timeRemaining,
  setTimeRemaining,
  onTimeUp,
}: QuestionCardProps) {
  const [displayedText, setDisplayedText] = useState('');
  const layout = useMobileLayoutMetrics();
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [revealPhraseSetIndex, setRevealPhraseSetIndex] = useState<number | null>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const optionReadyTimer = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false);
  const onOptionsReadyRef = useRef(onOptionsReady);
  const questionContentOpacity = useSharedValue(1);
  const questionContentScale = useSharedValue(1);

  useEffect(() => {
    questionContentOpacity.value = withTiming(isExiting ? 0 : 1, {
      duration: isExiting ? 950 : 220,
      easing: Easing.out(Easing.cubic),
    });
    questionContentScale.value = withTiming(isExiting ? 0.94 : 1, {
      duration: isExiting ? 950 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isExiting, questionContentOpacity, questionContentScale]);

  const questionContentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: questionContentOpacity.value,
    transform: [{ scale: questionContentScale.value }],
  }));

  useEffect(() => {
    isHoldingRef.current = isHolding;
  }, [isHolding]);

  useEffect(() => {
    onOptionsReadyRef.current = onOptionsReady;
  }, [onOptionsReady]);

  useEffect(() => {
    setDisplayedText('');
    setIsTypingComplete(false);
    setRevealPhraseSetIndex(null);

    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }
    if (optionReadyTimer.current) {
      clearTimeout(optionReadyTimer.current);
    }

    const fullText = question.prompt;
    if (revealImmediately) {
      setDisplayedText(fullText);
      setIsTypingComplete(true);
      return;
    }
    let currentIndex = 0;

    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex + 1));
        currentIndex += 1;
        const speed = isHoldingRef.current ? TYPING_SPEED_FAST : TYPING_SPEED;
        typingTimer.current = setTimeout(typeNextChar, speed);
        return;
      }

      setIsTypingComplete(true);
      const optionRevealMs =
        OPTION_STAGGER_DELAY * Math.max(question.options.length - 1, 0) + OPTION_FADE_DURATION;
      optionReadyTimer.current = setTimeout(() => {
        onOptionsReadyRef.current?.();
      }, optionRevealMs);
    };

    typingTimer.current = setTimeout(typeNextChar, TYPING_SPEED);

    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      if (optionReadyTimer.current) {
        clearTimeout(optionReadyTimer.current);
      }
    };
  }, [question.id, question.options.length, question.prompt, revealImmediately]);

  useEffect(() => {
    if (selectedOption === null) {
      setRevealPhraseSetIndex(null);
      return;
    }

    setRevealPhraseSetIndex((currentIndex) =>
      currentIndex === null ? pickRevealPhraseSetIndex() : currentIndex
    );
  }, [selectedOption]);

  const isLocked = disabled || selectedOption !== null;
  const revealPhraseSet =
    revealPhraseSetIndex === null ? null : REVEAL_PHRASE_SETS[revealPhraseSetIndex];
  const revealTone =
    showResult && selectedOption !== null
      ? selectedOption === correctOptionIndex
        ? 'correct'
        : 'incorrect'
      : selectedOption !== null
        ? 'locked'
        : null;
  const revealText =
    selectedOption === null || !revealPhraseSet
      ? ''
      : showResult
        ? selectedOption === correctOptionIndex
          ? revealPhraseSet.correct
          : revealPhraseSet.incorrect
        : revealPhraseSet.locked;

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: layout.screenPadding,
          paddingTop: layout.quizTopPadding,
          paddingBottom: layout.quizBottomPadding,
          gap: layout.verticalGap,
        },
      ]}
    >
      <View style={styles.topBar}>
        <Image
          source={logoImage}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.progressBlock}>
          <Text style={styles.questionNumber}>
            {questionNumber}/{totalQuestions}
          </Text>
          <View style={styles.progressDots}>
            {Array.from({ length: totalQuestions }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < questionNumber ? styles.progressDotActive : null,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.scorePill}>
          <Text style={styles.scoreLabel}>Score</Text>
          <Text style={styles.scoreText}>{score}</Text>
        </View>
      </View>

      <Animated.View
        key={question.id}
        entering={FadeIn.duration(220)}
        style={[
          styles.questionContent,
          { gap: layout.verticalGap },
          questionContentAnimatedStyle,
        ]}
      >
        <View
          style={[
            styles.playArea,
            {
              minHeight: layout.playAreaMinHeight,
              padding: layout.cardPadding,
              gap: layout.verticalGap,
            },
          ]}
        >
          <View style={styles.timerRow}>
            <CountdownTimer
              duration={timerDuration}
              isActive={timerActive}
              onTimeUp={onTimeUp}
              timeRemaining={timeRemaining}
              setTimeRemaining={setTimeRemaining}
            />
            <View style={styles.timerCopy}>
              <Text style={styles.timerTitle}>
                {timerActive ? 'On the clock' : timeRemaining === 0 ? 'Minimum score' : 'Read first'}
              </Text>
              <Text style={styles.timerHint}>
                {timeRemaining === 0
                  ? 'Answer when ready.'
                  : timerActive
                    ? 'Faster correct answers score more.'
                    : 'Timer starts after the options appear.'}
              </Text>
            </View>
          </View>

          <View style={styles.promptFrame}>
            <Animated.Text
              entering={FadeIn.duration(160)}
              style={[
                styles.prompt,
                {
                  fontSize: layout.promptFontSize,
                  lineHeight: layout.promptLineHeight,
                },
              ]}
            >
              {displayedText}
            </Animated.Text>
          </View>
        </View>

        <View style={styles.revealRow}>
          <Text
            style={[
              styles.revealText,
              revealTone === 'correct' ? styles.revealTextCorrect : null,
              revealTone === 'incorrect' ? styles.revealTextIncorrect : null,
            ]}
          >
            {revealText}
          </Text>
        </View>

        <View style={[styles.optionsStage, { minHeight: layout.optionStageMinHeight }]}>
          {isTypingComplete && (
            <View style={styles.optionsContainer}>
              {question.options.map((option, index) => {
                const isSelected = selectedOption === index;
                const isCorrectOption = showResult && correctOptionIndex === index;
                const isWrongSelected =
                  showResult && isSelected && correctOptionIndex !== undefined && index !== correctOptionIndex;

                return (
                  <OptionTile
                    key={`${question.id}-${index}`}
                    option={option}
                    index={index}
                    isSelected={isSelected}
                    isLocked={isLocked}
                    showResult={showResult}
                    isCorrectOption={isCorrectOption}
                    isWrongSelected={isWrongSelected}
                    onPress={() => onSelectOption(index)}
                    minHeight={layout.optionMinHeight}
                    padding={layout.optionPadding}
                    useSingleColumn={layout.useSingleColumnOptions}
                    animateEntry={!revealImmediately}
                  />
                );
              })}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  topBar: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  logo: {
    width: 92,
    height: 32,
  },
  progressBlock: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  questionNumber: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  progressDots: {
    flexDirection: 'row',
    gap: 5,
  },
  progressDot: {
    width: 18,
    height: 5,
    borderRadius: 99,
    backgroundColor: '#DED8C9',
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary,
  },
  scorePill: {
    minWidth: 74,
    borderRadius: 999,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: '#E7DFD2',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 10,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textTransform: 'uppercase',
  },
  scoreText: {
    fontSize: 17,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    fontVariant: ['tabular-nums'],
  },
  questionContent: {
    flex: 1,
    gap: theme.spacing.md,
  },
  playArea: {
    flex: 1,
    minHeight: 190,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#E7DFD2',
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    justifyContent: 'flex-start',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  timerCopy: {
    flex: 1,
    gap: 2,
  },
  timerTitle: {
    fontSize: 13,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  timerHint: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    lineHeight: 16,
  },
  promptFrame: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  prompt: {
    fontSize: 25,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    lineHeight: 32,
  },
  revealRow: {
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  revealText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  revealTextCorrect: {
    color: theme.colors.correct,
  },
  revealTextIncorrect: {
    color: theme.colors.incorrect,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  optionsStage: {
    minHeight: 164,
  },
  optionWrapper: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  optionWrapperSingleColumn: {
    flexBasis: '100%',
  },
  optionButton: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: '#D9D0C1',
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  optionButtonPressed: {
    transform: [{ scale: 0.98 }],
    borderColor: theme.colors.primary,
  },
  optionButtonSelected: {
    backgroundColor: theme.colors.textDark,
    borderColor: theme.colors.textDark,
  },
  optionButtonCorrect: {
    backgroundColor: theme.colors.correct,
    borderColor: theme.colors.correct,
  },
  optionButtonIncorrect: {
    backgroundColor: theme.colors.incorrect,
    borderColor: theme.colors.incorrect,
  },
  optionButtonDimmed: {
    opacity: 0.42,
  },
  optionLabelBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  optionLabelSelected: {
    color: theme.colors.textDark,
  },
  optionLabelStrong: {
    color: theme.colors.textDark,
  },
  optionText: {
    fontSize: 15,
    color: theme.colors.textDark,
    fontFamily: theme.fonts.gothamMedium,
    lineHeight: 19,
  },
  optionTextSelected: {
    color: theme.colors.white,
  },
  optionTextStrong: {
    color: theme.colors.white,
  },
});
