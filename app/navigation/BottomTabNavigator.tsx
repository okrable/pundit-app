import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GamesNavigator from './GamesNavigator';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import MeScreen from '../screens/MeScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import { theme } from '../theme/theme';

const Tab = createBottomTabNavigator();
const NATIVE_TAB_BAR_CONTENT_HEIGHT = 50;

export default function BottomTabNavigator() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  return (
    <Tab.Navigator
      screenOptions={{
        lazy: true,
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.colors.accent,
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontFamily: theme.fonts.gothamBlack,
          fontSize: 18,
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.mediumGray,
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.lightGray,
          height: isWeb ? 66 : NATIVE_TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: isWeb ? 8 : insets.bottom,
          paddingTop: isWeb ? 6 : 4,
        },
        tabBarPosition: 'bottom',
        tabBarLabelStyle: {
          fontFamily: theme.fonts.gothamMedium,
          fontSize: 11,
        },
      }}
    >
      <Tab.Screen
        name="Games"
        component={GamesNavigator}
        options={{
          title: 'Games',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="football-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Challenge"
        component={ChallengeScreen}
        options={{
          title: 'Challenge',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="League Tables"
        component={LeaderboardScreen}
        options={{
          title: 'League Tables',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="trophy-outline" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{
          title: 'Me',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
