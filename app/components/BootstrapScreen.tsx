import React from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, Dimensions } from 'react-native';
import { theme } from '../theme/theme';
import { DebugLogEntry, getLatestDebugEntry, subscribeToLatestDebugEntry } from '../services/debugLog';

const { width } = Dimensions.get('window');

export default function BootstrapScreen() {
  const [latestEntry, setLatestEntry] = React.useState<DebugLogEntry | null>(() => getLatestDebugEntry());

  React.useEffect(() => {
    return subscribeToLatestDebugEntry((entry) => {
      setLatestEntry(entry);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/logo/white/pundit-white.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Getting the dressing room ready</Text>
      <ActivityIndicator size="small" color={theme.colors.white} style={styles.spinner} />
      {latestEntry ? (
        <Text style={styles.debugText} numberOfLines={3}>
          {latestEntry.event}
        </Text>
      ) : null}
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
  debugText: {
    marginTop: theme.spacing.md,
    fontSize: 11,
    color: theme.colors.background,
    fontFamily: theme.fonts.gothamBook,
    textAlign: 'center',
    opacity: 0.85,
  },
});
