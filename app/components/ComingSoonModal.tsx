import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

interface ComingSoonModalProps {
  title: string | null;
  onClose: () => void;
}

export default function ComingSoonModal({
  title,
  onClose,
}: ComingSoonModalProps) {
  return (
    <Modal
      visible={Boolean(title)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close coming soon message"
        style={styles.overlay}
        onPress={onClose}
      >
        <Pressable
          accessibilityRole="none"
          style={styles.modal}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.icon}>
            <Ionicons
              name="sparkles-outline"
              size={34}
              color={theme.colors.accent}
            />
          </View>
          <Text style={styles.kicker}>COMING SOON</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>
            This game is still on the training ground. Check back for a future
            matchday.
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>Got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(47, 41, 38, 0.62)',
    padding: theme.spacing.xl,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xxl,
  },
  icon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(208, 113, 88, 0.14)',
  },
  kicker: {
    marginTop: theme.spacing.lg,
    fontSize: 11,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    letterSpacing: 1.4,
  },
  title: {
    marginTop: theme.spacing.xs,
    fontSize: 26,
    lineHeight: 31,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  copy: {
    marginTop: theme.spacing.sm,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.neutralDark,
    textAlign: 'center',
  },
  closeButton: {
    minWidth: 132,
    minHeight: 46,
    marginTop: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
  },
  closeButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.white,
  },
});
