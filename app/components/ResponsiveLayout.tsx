import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { theme } from '../theme/theme';

export const MOBILE_WEB_SHELL_MAX_WIDTH = 460;

export const webContentWidth = {
  narrow: MOBILE_WEB_SHELL_MAX_WIDTH,
  quiz: MOBILE_WEB_SHELL_MAX_WIDTH,
  standard: MOBILE_WEB_SHELL_MAX_WIDTH,
  wide: MOBILE_WEB_SHELL_MAX_WIDTH,
} as const;

export function useMobileLayoutMetrics() {
  const { width, height } = useWindowDimensions();
  const appWidth = Platform.OS === 'web'
    ? Math.min(width, MOBILE_WEB_SHELL_MAX_WIDTH)
    : width;
  const isCompactWidth = appWidth < 390;
  const isShortHeight = height < 720;
  const isTallPhone = height >= 840;
  const isTight = isCompactWidth || isShortHeight;

  return {
    appWidth,
    isCompactWidth,
    isShortHeight,
    isTallPhone,
    isTight,
    screenPadding: isCompactWidth ? theme.spacing.md : theme.spacing.lg,
    quizTopPadding: isShortHeight ? theme.spacing.xs : theme.spacing.md,
    quizBottomPadding: isShortHeight ? theme.spacing.md : theme.spacing.lg,
    verticalGap: isShortHeight ? theme.spacing.sm : theme.spacing.md,
    cardPadding: isTight ? theme.spacing.md : theme.spacing.lg,
    promptFontSize: isTight ? 21 : 25,
    promptLineHeight: isTight ? 28 : 32,
    playAreaMinHeight: isShortHeight ? 164 : 190,
    optionMinHeight: isShortHeight ? 68 : 78,
    optionStageMinHeight: isShortHeight ? 144 : 164,
    optionPadding: isTight ? theme.spacing.sm : theme.spacing.md,
    useSingleColumnOptions: appWidth < 350,
  };
}

export function useCenteredWebStyle(
  maxWidth: number = webContentWidth.standard
): StyleProp<ViewStyle> {
  if (Platform.OS !== 'web') {
    return null;
  }

  return [styles.centered, { maxWidth: Math.min(maxWidth, MOBILE_WEB_SHELL_MAX_WIDTH) }];
}

interface CenteredWebContentProps {
  children: React.ReactNode;
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

export default function CenteredWebContent({
  children,
  maxWidth = webContentWidth.standard,
  style,
}: CenteredWebContentProps) {
  const centeredStyle = useCenteredWebStyle(maxWidth);

  return <View style={[centeredStyle, style]}>{children}</View>;
}

export function MobileWebAppShell({ children }: { children: React.ReactNode }) {
  const { height } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return (
    <View style={[styles.webViewport, { minHeight: height }]}>
      <View style={styles.webShell}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    width: '100%',
    alignSelf: 'center',
  },
  webViewport: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  webShell: {
    flex: 1,
    width: '100%',
    maxWidth: MOBILE_WEB_SHELL_MAX_WIDTH,
    backgroundColor: theme.colors.background,
  },
});
