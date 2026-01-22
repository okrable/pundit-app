import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, Animated } from 'react-native';
import { Question } from '../types';
import { theme } from '../theme/theme';

const TYPING_SPEED = 30; // milliseconds per character
const TYPING_SPEED_FAST = 8; // milliseconds per character when holding
const OPTION_FADE_DURATION = 200; // milliseconds for each option fade
const OPTION_STAGGER_DELAY = 100; // milliseconds between each option appearing

interface QuestionCardProps {
  question: Question;
  selectedOption: number | null;
  onSelectOption: (optionIndex: number) => void;
  disabled?: boolean;
  showResult?: boolean;
  correctOptionIndex?: number;
  isHolding?: boolean;
}

export default function QuestionCard({
  question,
  selectedOption,
  onSelectOption,
  disabled = false,
  showResult = false,
  correctOptionIndex,
  isHolding = false,
}: QuestionCardProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const isHoldingRef = useRef(false); // Use ref to access current value in timeout callback

  useEffect(() => {
    isHoldingRef.current = isHolding;
  }, [isHolding]);

  // Create animated values for each option (max 4 options)
  const optionAnimations = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Typewriter effect for question prompt
  useEffect(() => {
    // Reset when question changes
    setDisplayedText('');
    setIsTypingComplete(false);

    // Reset option animations
    optionAnimations.forEach(anim => anim.setValue(0));

    const fullText = question.prompt;
    let currentIndex = 0;

    const typeNextChar = () => {
      if (currentIndex < fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex + 1));
        currentIndex++;
        const speed = isHoldingRef.current ? TYPING_SPEED_FAST : TYPING_SPEED;
        typingTimer.current = setTimeout(typeNextChar, speed);
      } else {
        setIsTypingComplete(true);
        // Start staggered fade-in for options
        const animations = question.options.map((_, index) =>
          Animated.timing(optionAnimations[index], {
            toValue: 1,
            duration: OPTION_FADE_DURATION,
            delay: index * OPTION_STAGGER_DELAY,
            useNativeDriver: true,
          })
        );
        Animated.parallel(animations).start();
      }
    };

    typingTimer.current = setTimeout(typeNextChar, TYPING_SPEED);

    return () => {
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
    };
  }, [question.id]);

  const getOptionStyle = (index: number): ViewStyle[] => {
    const baseStyles: ViewStyle[] = [styles.optionButton];

    if (showResult && correctOptionIndex !== undefined) {
      if (index === correctOptionIndex) {
        baseStyles.push(styles.optionButtonCorrect);
      } else if (index === selectedOption && index !== correctOptionIndex) {
        baseStyles.push(styles.optionButtonIncorrect);
      }
    } else if (selectedOption === index) {
      baseStyles.push(styles.optionButtonSelected);
    }

    return baseStyles;
  };

  const getOptionTextStyle = (index: number): TextStyle[] => {
    const baseStyles: TextStyle[] = [styles.optionText];

    if (showResult && correctOptionIndex !== undefined) {
      if (index === correctOptionIndex) {
        baseStyles.push(styles.optionTextCorrect);
      } else if (index === selectedOption && index !== correctOptionIndex) {
        baseStyles.push(styles.optionTextIncorrect);
      }
    } else if (selectedOption === index) {
      baseStyles.push(styles.optionTextSelected);
    }

    return baseStyles;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{displayedText}</Text>
      {isTypingComplete && (
        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => (
            <Animated.View
              key={index}
              style={{ opacity: optionAnimations[index], width: '48%' }}
            >
              <TouchableOpacity
                style={getOptionStyle(index)}
                onPress={() => onSelectOption(index)}
                disabled={disabled || showResult}
              >
                <Text style={getOptionTextStyle(index)}>
                  {option}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  prompt: {
    fontSize: 20,
    fontFamily: theme.fonts.gothamBook,
    marginBottom: theme.spacing.md,
    color: theme.colors.textDark,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: theme.spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  optionButton: {
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.lightGray,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionButtonCorrect: {
    backgroundColor: theme.colors.correct,
    borderColor: theme.colors.correct,
  },
  optionButtonIncorrect: {
    backgroundColor: theme.colors.incorrect,
    borderColor: theme.colors.incorrect,
  },
  optionText: {
    fontSize: 15,
    color: theme.colors.textDark,
    fontFamily: theme.fonts.gothamBook,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamMedium,
  },
  optionTextCorrect: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamMedium,
  },
  optionTextIncorrect: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamMedium,
  },
});
