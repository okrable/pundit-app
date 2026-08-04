import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { theme } from '../theme/theme';

interface CareerRulesModalProps {
  visible: boolean;
  onClose: () => void;
  onStart: () => void;
}

const exampleRows = [
  ['2004–2008', 'Northbridge FC', '72', '11'],
  ['2008–2012', 'Racing Athletic', '98', '24'],
  ['2012–2015', 'Example United', '61', '8'],
];

export default function CareerRulesModal({
  visible,
  onClose,
  onStart,
}: CareerRulesModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>HOW IT WORKS</Text>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Study the journey</Text>
            <Text style={styles.copy}>
              Use the clue and career record to identify the player.
            </Text>

            <View style={styles.exampleCard}>
              <Text style={styles.exampleLabel}>EXAMPLE</Text>
              <Text style={styles.examplePrompt}>
                This tireless midfielder made three memorable stops. Who is it?
              </Text>
              <View style={styles.tableRow}>
                <Text style={[styles.tableHeading, styles.years]}>Years</Text>
                <Text style={[styles.tableHeading, styles.team]}>Team</Text>
                <Text style={[styles.tableHeading, styles.number]}>Apps</Text>
                <Text style={[styles.tableHeading, styles.number]}>Gls</Text>
              </View>
              {exampleRows.map((row) => (
                <View key={`${row[0]}-${row[1]}`} style={styles.tableRow}>
                  <Text style={[styles.tableText, styles.years]}>{row[0]}</Text>
                  <Text style={[styles.tableText, styles.team]} numberOfLines={1}>
                    {row[1]}
                  </Text>
                  <Text style={[styles.tableText, styles.number]}>{row[2]}</Text>
                  <Text style={[styles.tableText, styles.number]}>{row[3]}</Text>
                </View>
              ))}
              <View style={styles.exampleInput}>
                <Text style={styles.exampleInputText}>Alex Taylor</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Submit your guess</Text>
            <Text style={styles.copy}>
              Enter a full name or surname. Capitalisation, accents, apostrophes,
              hyphens and supported spelling variations will not trip you up.
            </Text>

            <Text style={styles.sectionTitle}>Keep going</Text>
            <Text style={styles.copy}>
              Wrong guesses carry no penalty. There is no timer or attempt
              score, so keep guessing until you find the player.
            </Text>

            <Text style={styles.sectionTitle}>Independent daily game</Text>
            <Text style={styles.copy}>
              Solving this card completes only this mode. Your five-question
              quiz and its score remain separate.
            </Text>
          </ScrollView>

          <TouchableOpacity style={styles.startButton} onPress={onStart}>
            <Text style={styles.startButtonText}>Got it — start guessing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    alignSelf: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: 22,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.sm,
  },
  sectionTitle: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    fontSize: 16,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
  },
  exampleCard: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#D9D0C1',
    backgroundColor: theme.colors.white,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  exampleLabel: {
    fontSize: 10,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    letterSpacing: 1,
  },
  examplePrompt: {
    marginBottom: theme.spacing.sm,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableHeading: {
    fontSize: 10,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
  },
  tableText: {
    fontSize: 10,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.textDark,
  },
  years: {
    width: 70,
  },
  team: {
    flex: 1,
  },
  number: {
    width: 32,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  exampleInput: {
    marginTop: theme.spacing.sm,
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D9D0C1',
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  exampleInputText: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  startButton: {
    marginTop: theme.spacing.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
  },
  startButtonText: {
    fontSize: 15,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
});
