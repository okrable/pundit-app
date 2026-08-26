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
import { getQuizLayoutPolicy } from '../../shared/quizLayout';

export const webBreakpoint = {
  compact: 600,
  desktop: 900,
} as const;

export const webContentWidth = {
  narrow: 560,
  quiz: 760,
  standard: 960,
  wide: 1200,
} as const;

export function useMobileLayoutMetrics() {
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const appWidth = width;
  const isCompactWidth = appWidth < (isWeb ? webBreakpoint.compact : 390);
  const isShortHeight = height < 720;
  const isTallPhone = height >= 840;
  const isTight = isCompactWidth || isShortHeight;
  const responsiveScreenPadding = isWeb
    ? appWidth < webBreakpoint.compact
      ? theme.spacing.lg
      : appWidth < webBreakpoint.desktop
        ? theme.spacing.xl
        : 40
    : isCompactWidth
      ? theme.spacing.md
      : theme.spacing.lg;

  return {
    appWidth,
    isCompactWidth,
    isShortHeight,
    isTallPhone,
    isTight,
    webLayout:
      !isWeb
        ? 'native'
        : appWidth < webBreakpoint.compact
          ? 'compact'
          : appWidth < webBreakpoint.desktop
            ? 'tablet'
            : 'desktop',
    screenPadding: responsiveScreenPadding,
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

export function useQuizLayoutMetrics(viewportHeight?: number) {
  const { width, height, fontScale } = useWindowDimensions();
  const mobileLayout = useMobileLayoutMetrics();
  const policy = getQuizLayoutPolicy({
    width,
    viewportHeight: viewportHeight && viewportHeight > 0 ? viewportHeight : height,
    fontScale,
  });

  return {
    ...mobileLayout,
    ...policy,
    fontScale,
  };
}

export function useCenteredWebStyle(
  maxWidth: number = webContentWidth.standard
): StyleProp<ViewStyle> {
  if (Platform.OS !== 'web') {
    return null;
  }

  return [styles.centered, { maxWidth }];
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

export function ResponsiveAppShell({ children }: { children: React.ReactNode }) {
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
    backgroundColor: theme.colors.background,
  },
  webShell: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.background,
  },
});
