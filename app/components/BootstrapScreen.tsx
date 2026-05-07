import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Dimensions } from 'react-native';
import { theme } from '../theme/theme';

const { width } = Dimensions.get('window');
const LOADING_MESSAGES = [
  'Warming up',
  'Painting the lines',
  'Putting the cones out',
  'Checking the team sheet',
  'Lacing the boots',
];

export default function BootstrapScreen() {
  const [messageIndex, setMessageIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((currentIndex) => (currentIndex + 1) % LOADING_MESSAGES.length);
    }, 1400);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo/white/pundit-white.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>{LOADING_MESSAGES[messageIndex]}</Text>
      <ActivityIndicator size="small" color={theme.colors.white} style={styles.spinner} />
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
  logo: {
    width: width * 0.62,
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
