import React from 'react';
import { isRunningInExpoGo } from 'expo';
import { Platform, UIManager } from 'react-native';
import * as ReactNativeScreens from 'react-native-screens';
import BottomTabNavigator from './BottomTabNavigator';
import IOSNativeTabNavigator from './IOSNativeTabNavigator';
import WebDrawerNavigator from './WebDrawerNavigator';
import { logWarn } from '../services/debugLog';
import {
  getNativeTabsFallbackReason,
  selectMainNavigator,
} from '../../shared/navigationPolicy';

export type MainSectionParamList = {
  Games: undefined;
  Challenge: undefined;
  'League Tables': undefined;
  Me: undefined;
};

function hasNativeIOSTabsHost(): boolean {
  const hasTabsHostComponent = Boolean(
    (
      ReactNativeScreens as typeof ReactNativeScreens & {
        Tabs?: { Host?: unknown };
      }
    ).Tabs?.Host
  );

  if (!hasTabsHostComponent) {
    return false;
  }

  try {
    return UIManager.hasViewManagerConfig('RNSTabsHostIOS');
  } catch {
    return false;
  }
}

export default function MainNavigator() {
  const isExpoGo = isRunningInExpoGo();
  const hasNativeTabsHost =
    Platform.OS === 'ios' ? hasNativeIOSTabsHost() : false;
  const capability = {
    platform: Platform.OS,
    isExpoGo,
    hasNativeTabsHost,
  };
  const navigatorKind = selectMainNavigator(capability);
  const fallbackReason = getNativeTabsFallbackReason(capability);

  React.useEffect(() => {
    if (fallbackReason) {
      logWarn('navigation.native_tabs.fallback', {
        reason: fallbackReason,
        isExpoGo,
        hasNativeTabsHost,
      });
    }
  }, [fallbackReason, hasNativeTabsHost, isExpoGo]);

  if (navigatorKind === 'web-drawer') {
    return <WebDrawerNavigator />;
  }

  if (navigatorKind === 'ios-native-tabs') {
    return <IOSNativeTabNavigator />;
  }

  return <BottomTabNavigator />;
}
