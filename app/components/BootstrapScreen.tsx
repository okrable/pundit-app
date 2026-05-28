import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { theme } from '../theme/theme';
import CenteredWebContent, { webContentWidth } from './ResponsiveLayout';
const LOADING_MESSAGES = [
  'Warming up',
  'Painting the lines',
  'Putting the cones out',
  'Checking the team sheet',
  'Lacing the boots',
];

export default function BootstrapScreen() {
  const [messageIndex, setMessageIndex] = React.useState(0);
  const { width } = useWindowDimensions();

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((currentIndex) => (currentIndex + 1) % LOADING_MESSAGES.length);
    }, 1400);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <CenteredWebContent maxWidth={webContentWidth.narrow} style={styles.content}>
        <Image
          source={require('../../assets/logo/white/pundit-white.png')}
          style={[styles.logo, { width: Math.min(width * 0.62, 320) }]}
          resizeMode="contain"
        />
        <Text style={styles.title}>{LOADING_MESSAGES[messageIndex]}</Text>
        <ActivityIndicator size="small" color={theme.colors.white} style={styles.spinner} />
      </CenteredWebContent>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    height: 82,
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 15,
    color: theme.colors.background,
    fontFamily: theme.fonts.gothamBook,
    textAlign: 'center',
  },
  spinner: {
    marginTop: theme.spacing.lg,
  },
});
