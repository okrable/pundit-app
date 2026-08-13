import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import CenteredWebContent, {
  webContentWidth,
} from '../components/ResponsiveLayout';
import { useMainTabSafeAreaEdges } from '../navigation/MainTabSafeArea';
import { theme } from '../theme/theme';

export default function ChallengeComingSoonScreen() {
  const safeAreaEdges = useMainTabSafeAreaEdges(['bottom']);

  return (
    <SafeAreaView style={styles.container} edges={safeAreaEdges}>
      <CenteredWebContent maxWidth={webContentWidth.quiz} style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="football-outline"
              size={42}
              color={theme.colors.white}
            />
          </View>
          <Text style={styles.eyebrow}>COMING SOON</Text>
          <Text style={styles.title}>Challenge</Text>
          <Text style={styles.message}>
            This feature is on the training ground. Check back for a future
            matchday.
          </Text>
        </View>
      </CenteredWebContent>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  card: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.white,
    shadowColor: theme.colors.textDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  iconContainer: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    borderRadius: 26,
    backgroundColor: theme.colors.accent,
  },
  eyebrow: {
    marginBottom: theme.spacing.sm,
    fontSize: 12,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.primary,
    letterSpacing: 2,
  },
  title: {
    fontSize: 34,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
    textAlign: 'center',
  },
  message: {
    maxWidth: 360,
    marginTop: theme.spacing.md,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.neutralDark,
    textAlign: 'center',
  },
});
