import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

export const DESKTOP_WEB_BREAKPOINT = 900;

export const webContentWidth = {
  narrow: 520,
  quiz: 760,
  standard: 880,
  wide: 1040,
} as const;

export function useIsDesktopWeb() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= DESKTOP_WEB_BREAKPOINT;
}

export function useCenteredWebStyle(
  maxWidth: number = webContentWidth.standard
): StyleProp<ViewStyle> {
  const isDesktopWeb = useIsDesktopWeb();

  if (!isDesktopWeb) {
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

const styles = StyleSheet.create({
  centered: {
    width: '100%',
    alignSelf: 'center',
  },
});
