import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '../theme/theme';

interface NotificationDotProps {
  style?: StyleProp<ViewStyle>;
}

export default function NotificationDot({ style }: NotificationDotProps) {
  return (
    <View
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={[styles.dot, style]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.notification,
  },
});
