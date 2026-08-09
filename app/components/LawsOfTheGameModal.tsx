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
          <Text style={styles.title}>LAWS OF THE GAME</Text>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.rule}>
              <Text style={styles.ruleTitle}>Choose Wisely</Text>
              <Text style={styles.ruleText}>
                Four choices, but only one winner.{"\n"}
                Who's your pick?
              </Text>
            </View>

            <View style={styles.rule}>
              <Text style={styles.ruleTitle}>Beat the Clock</Text>
              <Text style={styles.ruleText}>
                You've got 20 seconds per question!{"\n"}
                Faster answers mean more points.
              </Text>
            </View>

            <View style={styles.rule}>
              <Text style={styles.ruleTitle}>Score Big</Text>
              <Text style={styles.ruleText}>
                Score 100 before the first tick, then points drop by 10.{"\n"}
                Correct answers after zero still score 10.{"\n"}
                Don't get caught in possession!
              </Text>
            </View>

            <Text style={styles.closingLine}>
              Think fast, play smart, and let's see what you've got!
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Cheers, Jeff.</Text>
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
    marginBottom: theme.spacing.lg,
  },
  ruleTitle: {
    fontSize: 17,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  ruleText: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
    lineHeight: 22,
    textAlign: 'center',
  },
  closingLine: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
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
