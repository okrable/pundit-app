import React from 'react';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import GamesNavigator from './GamesNavigator';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import MeScreen from '../screens/MeScreen';
import ChallengeScreen from '../screens/ChallengeScreen';
import { theme } from '../theme/theme';
import type { MainSectionParamList } from './MainNavigator';

const Tab = createNativeBottomTabNavigator<MainSectionParamList>();

export default function IOSNativeTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
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
        tabBarControllerMode: 'auto',
      }}
    >
      <Tab.Screen
        name="Games"
        component={GamesNavigator}
        options={{
          title: 'Games',
          headerShown: false,
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? 'house.fill' : 'house',
          }),
        }}
      />
      <Tab.Screen
        name="Challenge"
        component={ChallengeScreen}
        options={{
          title: 'Challenge',
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? 'bolt.fill' : 'bolt',
          }),
        }}
      />
      <Tab.Screen
        name="League Tables"
        component={LeaderboardScreen}
        options={{
          title: 'League Tables',
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? 'trophy.fill' : 'trophy',
          }),
        }}
      />
      <Tab.Screen
        name="Me"
        component={MeScreen}
        options={{
          title: 'Me',
          tabBarIcon: ({ focused }) => ({
            type: 'sfSymbol',
            name: focused ? 'person.crop.circle.fill' : 'person.crop.circle',
          }),
        }}
      />
    </Tab.Navigator>
  );
}
