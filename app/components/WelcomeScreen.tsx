import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';
import LawsOfTheGameModal from './LawsOfTheGameModal';
import CenteredWebContent, { webContentWidth } from './ResponsiveLayout';

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
  const { width, fontScale } = useWindowDimensions();
  const stackActions = width < 380 || fontScale > 1.15;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <CenteredWebContent maxWidth={webContentWidth.quiz} style={styles.content}>
          <Image
            source={require('../../assets/logo/white/pundit-white.png')}
            style={[styles.logo, { width: Math.min(width * 0.7, 360) }]}
            resizeMode="contain"
          />

          <Text style={styles.tagline}>5 Questions. Don't bottle it.</Text>

          <View style={[styles.buttonContainer, stackActions && styles.buttonContainerStacked]}>
            <TouchableOpacity
              style={[styles.lawsButton, stackActions && styles.buttonStacked]}
              onPress={() => setShowLaws(true)}
            >
              <Text style={styles.lawsButtonText}>Laws of the Game</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.kickOffButton, stackActions && styles.buttonStacked]}
              onPress={onStartQuiz}
              disabled={isPreparing}
            >
              <Text style={styles.kickOffButtonText}>
                {isPreparing ? 'Warming Up...' : 'Kick Off'}
              </Text>
            </TouchableOpacity>
          </View>

          {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
        </CenteredWebContent>
      </ScrollView>

      <LawsOfTheGameModal
        visible={showLaws}
        onClose={() => setShowLaws(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
  },
  logo: {
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
  buttonContainerStacked: {
    width: '100%',
    maxWidth: 280,
    flexDirection: 'column',
  },
  buttonStacked: {
    width: '100%',
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
