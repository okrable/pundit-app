import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MainNavigator from './app/navigation/MainNavigator';
import useFonts from './app/hooks/useFonts';
import useAuthInit from './app/hooks/useAuthInit';
import useDeepLinkHandler from './app/hooks/useDeepLinkHandler';
import SharedLinkAcceptanceModal from './app/components/SharedLinkAcceptanceModal';
import { SharedLinkProvider } from './app/context/SharedLinkContext';
import useAppBootstrap from './app/hooks/useAppBootstrap';
import BootstrapScreen from './app/components/BootstrapScreen';
import { prefetchDailyLoop } from './app/services/dailyLoop';
import { theme } from './app/theme/theme';
import { logError, logInfo, startDebugSession } from './app/services/debugLog';
import { ResponsiveAppShell } from './app/components/ResponsiveLayout';
import UsernameOnboardingScreen from './app/components/UsernameOnboardingScreen';
import AuthSyncScreen from './app/components/AuthSyncScreen';
import AuthSyncFailureScreen from './app/components/AuthSyncFailureScreen';
import AccountSyncBanner from './app/components/AccountSyncBanner';
import AchievementRevealHost from './app/components/AchievementRevealHost';
import { useAuthStore } from './app/state/useAuthStore';
import {
  shouldShowIdentityFailure,
  shouldShowIdentitySync,
  shouldShowUsernameOnboarding,
} from './shared/clientIdentityPolicy';
import { getAppLaunchDuration, trackAnalyticsEvent } from './app/services/analytics';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef<any>();

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError('app.react_error_boundary', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <View style={styles.errorBoundaryContainer}>
        <View style={styles.errorBoundaryContent}>
          <Text style={styles.errorBoundaryTitle}>Something went wrong</Text>
          <Text style={styles.errorBoundaryMessage}>
            The app hit a display error. Your quiz progress and account data are kept separately from this screen.
          </Text>
          <TouchableOpacity style={styles.errorBoundaryButton} onPress={this.handleRetry}>
            <Text style={styles.errorBoundaryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

// Separate component to use hooks that need navigation context
function AppContent() {
  const sharedLink = useDeepLinkHandler({
    onChallengeUnavailable: React.useCallback(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main', { screen: 'Challenge' });
      }
    }, []),
  });
  const hasSeenActiveState = React.useRef(false);

  React.useEffect(() => {
    logInfo('app.navigation.mounted');
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      logInfo('app.state.change', { nextState, hasSeenActiveState: hasSeenActiveState.current });
      if (nextState === 'active' && hasSeenActiveState.current) {
        void prefetchDailyLoop({ mode: 'public-warm' });
      }

      if (nextState === 'active') {
        hasSeenActiveState.current = true;
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const navigateToMainSection = React.useCallback((screen: 'Me' | 'League Tables'): boolean => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Main', { screen });
      return true;
    }
    return false;
  }, []);

  return (
    <SharedLinkProvider value={{ openSharedAction: sharedLink.openAction }}>
      <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.accent,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontFamily: theme.fonts.gothamBlack,
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen
        name="Main"
        component={MainNavigator}
        options={{ headerShown: false }}
      />
      </Stack.Navigator>
      <SharedLinkAcceptanceModal
        visible={sharedLink.visible}
        phase={sharedLink.phase}
        preview={sharedLink.preview}
        message={sharedLink.message}
        onAccept={() => void sharedLink.accept()}
        onDismiss={() => void sharedLink.dismiss()}
        onRetry={sharedLink.retry}
        onSignIn={() => {
          sharedLink.deferForSignIn();
          navigateToMainSection('Me');
        }}
        onViewFriends={() => {
          if (!navigateToMainSection('League Tables')) {
            void sharedLink.dismiss();
            return;
          }

          // Keep the modal covering the previous tab until the programmatic
          // navigation has committed, then begin its fade-out over League Tables.
          requestAnimationFrame(() => {
            void sharedLink.dismiss();
          });
        }}
      />
      <AchievementRevealHost />
    </SharedLinkProvider>
  );
}

function ReadyApp() {
  const {
    isAuthenticated,
    identityStatus,
    authSyncStatus,
    restoredShellEligible,
  } = useAuthStore();

  if (shouldShowUsernameOnboarding(isAuthenticated, identityStatus)) {
    return <UsernameOnboardingScreen />;
  }

  if (
    shouldShowIdentityFailure(
      isAuthenticated,
      identityStatus,
      authSyncStatus,
      restoredShellEligible
    )
  ) {
    return <AuthSyncFailureScreen />;
  }

  if (
    shouldShowIdentitySync(
      isAuthenticated,
      identityStatus,
      authSyncStatus,
      restoredShellEligible
    )
  ) {
    return <AuthSyncScreen />;
  }

  const showBackgroundSyncFailure =
    restoredShellEligible &&
    (identityStatus === 'failed' || authSyncStatus === 'failed');

  return (
    <View style={styles.readyAppContainer}>
      {showBackgroundSyncFailure ? <AccountSyncBanner /> : null}
      <NavigationContainer ref={navigationRef}>
        <AppContent />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  const fontsLoaded = useFonts();
  const { localAuthReady, restoreSettled } = useAuthInit();
  const shellReady = useAppBootstrap(localAuthReady);
  const { isAuthenticated, authStatus, identityStatus, authSyncStatus } = useAuthStore();
  const fullAppReady =
    restoreSettled &&
    shellReady &&
    (!isAuthenticated ||
      (authStatus === 'authenticated' &&
        identityStatus === 'complete' &&
        authSyncStatus === 'ready'));
  const shellReadyEventSent = React.useRef(false);
  const readyEventSent = React.useRef(false);

  React.useEffect(() => {
    void startDebugSession('app-launch');

    const globalErrorUtils = (global as unknown as {
      ErrorUtils?: {
        getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
        setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
      };
    }).ErrorUtils;

    const previousHandler = globalErrorUtils?.getGlobalHandler?.();
    globalErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      logError('app.global_error', { isFatal: Boolean(isFatal), message: error.message, stack: error.stack });
      previousHandler?.(error, isFatal);
    });

    logInfo('app.render.state', { fontsLoaded, localAuthReady, restoreSettled, shellReady, fullAppReady });

    return () => {
      if (previousHandler && globalErrorUtils?.setGlobalHandler) {
        globalErrorUtils.setGlobalHandler(previousHandler);
      }
    };
  }, []);

  React.useEffect(() => {
    logInfo('app.render.state', { fontsLoaded, localAuthReady, restoreSettled, shellReady, fullAppReady });
  }, [fontsLoaded, fullAppReady, localAuthReady, restoreSettled, shellReady]);

  React.useEffect(() => {
    if (!fontsLoaded || !localAuthReady || !shellReady || shellReadyEventSent.current) return;
    shellReadyEventSent.current = true;
    const authState = useAuthStore.getState();
    trackAnalyticsEvent(
      'app_shell_ready',
      authState.isAuthenticated ? 'authenticated' : 'guest',
      { durationMs: getAppLaunchDuration(), source: 'cache' }
    );
  }, [fontsLoaded, localAuthReady, shellReady]);

  React.useEffect(() => {
    if (!fontsLoaded || !fullAppReady || readyEventSent.current) return;
    readyEventSent.current = true;
    const authState = useAuthStore.getState();
    trackAnalyticsEvent(
      'app_ready',
      authState.isAuthenticated ? 'authenticated' : 'guest',
      { durationMs: getAppLaunchDuration(), source: 'unknown' }
    );
  }, [fontsLoaded, fullAppReady]);

  if (!fontsLoaded || !localAuthReady || !shellReady) {
    return <BootstrapScreen />;
  }

  return (
    <SafeAreaProvider>
      <ResponsiveAppShell>
        <AppErrorBoundary>
          <ReadyApp />
        </AppErrorBoundary>
      </ResponsiveAppShell>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  readyAppContainer: {
    flex: 1,
  },
  errorBoundaryContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  errorBoundaryContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  errorBoundaryTitle: {
    fontFamily: theme.fonts.gothamBlack,
    fontSize: 24,
    color: theme.colors.textDark,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  errorBoundaryMessage: {
    fontFamily: theme.fonts.gothamBook,
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.neutralDark,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  errorBoundaryButton: {
    minHeight: 48,
    minWidth: 132,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  errorBoundaryButtonText: {
    fontFamily: theme.fonts.gothamBold,
    fontSize: 16,
    color: theme.colors.white,
  },
});
