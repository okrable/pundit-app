import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme/theme';

interface AuthSyncScreenProps {
  title?: string;
  subtitle?: string;
}

export default function AuthSyncScreen({
  title = 'Warming up',
  subtitle = 'Putting the cones out.',
}: AuthSyncScreenProps) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo/white/pundit-white.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <ActivityIndicator size="small" color={theme.colors.background} style={styles.spinner} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  logo: {
    width: 210,
    height: 74,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.background,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.background,
    textAlign: 'center',
    opacity: 0.9,
  },
  spinner: {
    marginTop: theme.spacing.lg,
  },
});
