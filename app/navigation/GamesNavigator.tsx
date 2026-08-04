import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import GamesHomeScreen from '../screens/GamesHomeScreen';
import DailyQuizScreen from '../screens/DailyQuizScreen';
import CareerGameScreen from '../screens/CareerGameScreen';

export type GamesStackParamList = {
  GamesHome: undefined;
  DailyQuiz: { autoStart?: boolean } | undefined;
  CareerGame: undefined;
};

const Stack = createNativeStackNavigator<GamesStackParamList>();

export default function GamesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GamesHome" component={GamesHomeScreen} />
      <Stack.Screen name="DailyQuiz" component={DailyQuizScreen} />
      <Stack.Screen name="CareerGame" component={CareerGameScreen} />
    </Stack.Navigator>
  );
}
