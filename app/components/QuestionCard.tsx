import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Question } from '../types';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  selectedOption: number | null;
  onSelectOption: (optionIndex: number) => void;
  disabled?: boolean;
}

export default function QuestionCard({
  question,
  questionNumber,
  selectedOption,
  onSelectOption,
  disabled = false,
}: QuestionCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.questionNumber}>Question {questionNumber}</Text>
      <Text style={styles.prompt}>{question.prompt}</Text>
      <View style={styles.optionsContainer}>
        {question.options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.optionButton,
              selectedOption === index && styles.optionButtonSelected,
            ]}
            onPress={() => onSelectOption(index)}
            disabled={disabled}
          >
            <Text
              style={[
                styles.optionText,
                selectedOption === index && styles.optionTextSelected,
              ]}
            >
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
    marginBottom: 16,
  },
  questionNumber: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  prompt: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#F2F2F7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#000',
  },
  optionTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
});
