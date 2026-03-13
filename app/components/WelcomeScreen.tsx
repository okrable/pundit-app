import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { theme } from '../theme/theme';
import LawsOfTheGameModal from './LawsOfTheGameModal';

const { width, height } = Dimensions.get('window');

interface WelcomeScreenProps {
  onStartQuiz: () => void;
  isPreparing?: boolean;
  helperText?: string | null;
}

export default function WelcomeScreen({
  onStartQuiz,
  isPreparing = false,
  helperText = null,
}: WelcomeScreenProps) {
  const [showLaws, setShowLaws] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo/white/pundit-white.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.tagline}>5 Questions. Don't bottle it.</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.lawsButton}
            onPress={() => setShowLaws(true)}
          >
            <Text style={styles.lawsButtonText}>Laws of the Game</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kickOffButton}
            onPress={onStartQuiz}
            disabled={isPreparing}
          >
            <Text style={styles.kickOffButtonText}>
              {isPreparing ? 'Warming Up...' : 'Kick Off'}
            </Text>
          </TouchableOpacity>
        </View>

        {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      </View>

      <LawsOfTheGameModal
        visible={showLaws}
        onClose={() => setShowLaws(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    transform: [{ translateY: -height * 0.125 }],
  },
  logo: {
    width: width * 0.7,
    height: 100,
    marginBottom: theme.spacing.lg,
  },
  tagline: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.background,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  lawsButton: {
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    minWidth: 140,
    alignItems: 'center',
  },
  lawsButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  kickOffButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    minWidth: 100,
    alignItems: 'center',
  },
  kickOffButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.white,
  },
  helperText: {
    marginTop: theme.spacing.md,
    fontSize: 13,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.background,
    textAlign: 'center',
  },
});
