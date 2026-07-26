import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BottomTabNavigator from './app/navigation/BottomTabNavigator';
import ChallengeQuizScreen from './app/screens/ChallengeQuizScreen';
import ChallengeResultsScreen from './app/screens/ChallengeResultsScreen';
import useFonts from './app/hooks/useFonts';
import useAuthInit from './app/hooks/useAuthInit';
import useDeepLinkHandler from './app/hooks/useDeepLinkHandler';
import useAppBootstrap from './app/hooks/useAppBootstrap';
import BootstrapScreen from './app/components/BootstrapScreen';
import { prefetchDailyLoop } from './app/services/dailyLoop';
import { theme } from './app/theme/theme';
import { logError, logInfo, startDebugSession } from './app/services/debugLog';
import { MobileWebAppShell } from './app/components/ResponsiveLayout';
import UsernameOnboardingScreen from './app/components/UsernameOnboardingScreen';
import AuthSyncScreen from './app/components/AuthSyncScreen';
import AuthSyncFailureScreen from './app/components/AuthSyncFailureScreen';
import { useAuthStore } from './app/state/useAuthStore';
import {
  shouldShowIdentityFailure,
  shouldShowIdentitySync,
  shouldShowUsernameOnboarding,
} from './shared/clientIdentityPolicy';

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
  // Handle deep links for friend invites
  useDeepLinkHandler({
    onChallengeJoined: React.useCallback(() => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('ChallengeQuiz');
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

  return (
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
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ChallengeQuiz"
        component={ChallengeQuizScreen}
        options={{
          title: 'Challenge',
          headerBackTitle: 'Back',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="ChallengeResults"
        component={ChallengeResultsScreen}
        options={{
          title: 'Results',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}

function ReadyApp() {
  const { isAuthenticated, identityStatus, authSyncStatus } = useAuthStore();

  if (shouldShowUsernameOnboarding(isAuthenticated, identityStatus)) {
    return <UsernameOnboardingScreen />;
  }

  if (
    shouldShowIdentityFailure(
      isAuthenticated,
      identityStatus,
      authSyncStatus
    )
  ) {
    return <AuthSyncFailureScreen />;
  }

  if (shouldShowIdentitySync(isAuthenticated, identityStatus, authSyncStatus)) {
    return <AuthSyncScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <AppContent />
    </NavigationContainer>
  );
}

export default function App() {
  const fontsLoaded = useFonts();
  const authReady = useAuthInit();
  const appReady = useAppBootstrap(authReady);

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

    logInfo('app.render.state', { fontsLoaded, authReady, appReady });

    return () => {
      if (previousHandler && globalErrorUtils?.setGlobalHandler) {
        globalErrorUtils.setGlobalHandler(previousHandler);
      }
    };
  }, []);

  React.useEffect(() => {
    logInfo('app.render.state', { fontsLoaded, authReady, appReady });
  }, [fontsLoaded, authReady, appReady]);

  if (!fontsLoaded || !authReady || !appReady) {
    return <BootstrapScreen />;
  }

  return (
    <SafeAreaProvider>
      <MobileWebAppShell>
        <AppErrorBoundary>
          <ReadyApp />
        </AppErrorBoundary>
      </MobileWebAppShell>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
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
