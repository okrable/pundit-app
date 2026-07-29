import React from 'react';
import { Platform } from 'react-native';
import BottomTabNavigator from './BottomTabNavigator';
import IOSNativeTabNavigator from './IOSNativeTabNavigator';
import WebDrawerNavigator from './WebDrawerNavigator';

export type MainSectionParamList = {
  Games: undefined;
  Challenge: undefined;
  'League Tables': undefined;
  Me: undefined;
};

export default function MainNavigator() {
  if (Platform.OS === 'web') {
    return <WebDrawerNavigator />;
  }

  if (Platform.OS === 'ios') {
    return <IOSNativeTabNavigator />;
  }

  return <BottomTabNavigator />;
}
