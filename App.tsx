import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import BottomTabNavigator from './app/navigation/BottomTabNavigator';
import ChallengeQuizScreen from './app/screens/ChallengeQuizScreen';
import ChallengeResultsScreen from './app/screens/ChallengeResultsScreen';
import useFonts from './app/hooks/useFonts';
import useAuthInit from './app/hooks/useAuthInit';
import useDeepLinkHandler from './app/hooks/useDeepLinkHandler';
import { theme } from './app/theme/theme';

const Stack = createNativeStackNavigator();

// Separate component to use hooks that need navigation context
function AppContent() {
  // Handle deep links for friend invites
  useDeepLinkHandler();

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

export default function App() {
  const fontsLoaded = useFonts();
  const authReady = useAuthInit();

  if (!fontsLoaded || !authReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
});
