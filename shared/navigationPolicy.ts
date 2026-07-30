export type MainNavigatorKind = 'web-drawer' | 'ios-native-tabs' | 'js-tabs';

export interface MainNavigatorCapability {
  platform: string;
  isExpoGo: boolean;
  hasNativeTabsHost: boolean;
}

export function selectMainNavigator({
  platform,
  isExpoGo,
  hasNativeTabsHost,
}: MainNavigatorCapability): MainNavigatorKind {
  if (platform === 'web') {
    return 'web-drawer';
  }

  if (platform === 'ios' && !isExpoGo && hasNativeTabsHost) {
    return 'ios-native-tabs';
  }

  return 'js-tabs';
}

export function getNativeTabsFallbackReason({
  platform,
  isExpoGo,
  hasNativeTabsHost,
}: MainNavigatorCapability): 'expo-go' | 'tabs-host-unavailable' | null {
  if (platform !== 'ios') {
    return null;
  }

  if (isExpoGo) {
    return 'expo-go';
  }

  if (!hasNativeTabsHost) {
    return 'tabs-host-unavailable';
  }

  return null;
}
