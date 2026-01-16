import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { theme } from '../theme/theme';

interface LawsOfTheGameModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function LawsOfTheGameModal({ visible, onClose }: LawsOfTheGameModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Laws of the Game</Text>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.rule}>
              <Text style={styles.ruleNumber}>1.</Text>
              <Text style={styles.ruleText}>
                Answer 5 questions about football trivia
              </Text>
            </View>

            <View style={styles.rule}>
              <Text style={styles.ruleNumber}>2.</Text>
              <Text style={styles.ruleText}>
                Tap on your answer - no second chances!
              </Text>
            </View>

            <View style={styles.rule}>
              <Text style={styles.ruleNumber}>3.</Text>
              <Text style={styles.ruleText}>
                Correct answers are shown in green, wrong ones in red
              </Text>
            </View>

            <View style={styles.rule}>
              <Text style={styles.ruleNumber}>4.</Text>
              <Text style={styles.ruleText}>
                New quiz available daily - come back tomorrow!
              </Text>
            </View>

            <View style={styles.rule}>
              <Text style={styles.ruleNumber}>5.</Text>
              <Text style={styles.ruleText}>
                Build your streak by playing every day
              </Text>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Got it!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  container: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
  },
  title: {
    fontSize: 22,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  content: {
    marginBottom: theme.spacing.lg,
  },
  rule: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    alignItems: 'flex-start',
  },
  ruleNumber: {
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    width: 24,
  },
  ruleText: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    flex: 1,
    lineHeight: 22,
  },
  closeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
  },
  closeButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
});
