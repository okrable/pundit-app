import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type BadgeTone = 'accent' | 'complete' | 'muted' | 'unavailable';

interface GameGalleryTileProps {
  title: string;
  description: string;
  iconName: IconName;
  badgeLabel: string;
  badgeTone?: BadgeTone;
  width: number;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function GameGalleryTile({
  title,
  description,
  iconName,
  badgeLabel,
  badgeTone = 'accent',
  width,
  onPress,
  disabled = false,
  accessibilityHint,
  children,
  style,
}: GameGalleryTileProps) {
  const badgeStyle = styles[`${badgeTone}Badge`];
  const badgeTextStyle = styles[`${badgeTone}BadgeText`];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}. ${badgeLabel}.`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { width },
        disabled && styles.tileDisabled,
        pressed && !disabled && styles.tilePressed,
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.copyArea}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        </View>
        <View style={styles.iconArea}>
          <Ionicons name={iconName} size={48} color={theme.colors.textDark} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={[styles.badge, badgeStyle]}>
          <Text style={[styles.badgeText, badgeTextStyle]}>{badgeLabel}</Text>
        </View>
        {children ? <View style={styles.summary}>{children}</View> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 236,
    justifyContent: 'space-between',
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    shadowColor: '#5B2D22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
  },
  tileDisabled: {
    opacity: 0.72,
  },
  tilePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  copyArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 25,
    lineHeight: 29,
    fontFamily: theme.fonts.gothamBlack,
    color: theme.colors.textDark,
  },
  description: {
    marginTop: theme.spacing.sm,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.neutralDark,
  },
  iconArea: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(208, 113, 88, 0.14)',
  },
  footer: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  badge: {
    minHeight: 28,
    justifyContent: 'center',
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: theme.fonts.gothamBold,
    letterSpacing: 0.8,
  },
  accentBadge: {
    backgroundColor: 'rgba(208, 113, 88, 0.16)',
  },
  accentBadgeText: {
    color: theme.colors.accent,
  },
  completeBadge: {
    backgroundColor: theme.colors.primary,
  },
  completeBadgeText: {
    color: theme.colors.white,
  },
  mutedBadge: {
    backgroundColor: theme.colors.lightGray,
  },
  mutedBadgeText: {
    color: theme.colors.neutralDark,
  },
  unavailableBadge: {
    backgroundColor: theme.colors.incorrectBg,
  },
  unavailableBadgeText: {
    color: theme.colors.incorrect,
  },
  summary: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
