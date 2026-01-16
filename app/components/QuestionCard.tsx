import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Question } from '../types';
import { theme } from '../theme/theme';

interface QuestionCardProps {
  question: Question;
  selectedOption: number | null;
  onSelectOption: (optionIndex: number) => void;
  disabled?: boolean;
  showResult?: boolean;
  correctOptionIndex?: number;
}

export default function QuestionCard({
  question,
  selectedOption,
  onSelectOption,
  disabled = false,
  showResult = false,
  correctOptionIndex,
}: QuestionCardProps) {
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
      <Text style={styles.prompt}>{question.prompt}</Text>
      <View style={styles.optionsContainer}>
        {question.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={getOptionStyle(index)}
            onPress={() => onSelectOption(index)}
            disabled={disabled || showResult}
          >
            <Text style={getOptionTextStyle(index)}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
    width: '48%',
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
