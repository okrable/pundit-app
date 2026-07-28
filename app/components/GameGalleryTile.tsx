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
type ActionTone = 'primary' | 'muted' | 'unavailable';
type TitleVariant = 'gotham' | 'pundit';
type ArtworkPlacement = 'side' | 'wide';

interface GameGalleryTileProps {
  title: string;
  description: string;
  iconName?: IconName;
  artwork?: React.ReactNode;
  artworkPlacement?: ArtworkPlacement;
  titleVariant?: TitleVariant;
  badgeLabel?: string;
  badgeTone?: BadgeTone;
  actionLabel?: string;
  actionTone?: ActionTone;
  actionSummary?: React.ReactNode;
  showActionArrow?: boolean;
  width: number;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

export default function GameGalleryTile({
  title,
  description,
  iconName,
  artwork,
  artworkPlacement = 'side',
  titleVariant = 'gotham',
  badgeLabel,
  badgeTone = 'accent',
  actionLabel,
  actionTone = 'primary',
  actionSummary,
  showActionArrow = false,
  width,
  onPress,
  disabled = false,
  accessibilityHint,
  style,
}: GameGalleryTileProps) {
  const statusLabel = actionLabel ?? badgeLabel ?? '';
  const badgeStyle = styles[`${badgeTone}Badge`];
  const badgeTextStyle = styles[`${badgeTone}BadgeText`];
  const actionStyle = styles[`${actionTone}Action`];
  const actionTextStyle = styles[`${actionTone}ActionText`];
  const sideArtwork = artworkPlacement === 'side' ? artwork : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}. ${statusLabel}.`}
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
      <View style={styles.body}>
        <View style={styles.topRow}>
          <View style={styles.copyArea}>
            <Text
              style={[
                styles.title,
                titleVariant === 'pundit' && styles.punditTitle,
              ]}
              numberOfLines={titleVariant === 'pundit' ? 1 : 2}
              adjustsFontSizeToFit={titleVariant === 'pundit'}
              minimumFontScale={0.82}
            >
              {title}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          </View>

          {sideArtwork ? (
            <View style={styles.customSideArtwork}>{sideArtwork}</View>
          ) : iconName ? (
            <View style={styles.iconArea}>
              <Ionicons name={iconName} size={48} color={theme.colors.textDark} />
            </View>
          ) : null}
        </View>

        {artworkPlacement === 'wide' && artwork ? (
          <View style={styles.wideArtwork}>{artwork}</View>
        ) : null}

        {!actionLabel && badgeLabel ? (
          <View style={styles.conceptFooter}>
            <View style={[styles.badge, badgeStyle]}>
              <Text style={[styles.badgeText, badgeTextStyle]}>
                {badgeLabel}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {actionLabel ? (
        <View style={[styles.actionFooter, actionStyle]}>
          <Text style={[styles.actionLabel, actionTextStyle]}>
            {actionLabel}
          </Text>
          {actionSummary ? (
            <View style={styles.actionSummary}>{actionSummary}</View>
          ) : showActionArrow ? (
            <Ionicons
              name="arrow-forward"
              size={22}
              color={
                actionTone === 'primary'
                  ? theme.colors.white
                  : theme.colors.neutralDark
              }
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 280,
    overflow: 'hidden',
    borderRadius: theme.borderRadius.xl,
    backgroundColor: theme.colors.background,
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
  body: {
    flex: 1,
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
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
  punditTitle: {
    fontSize: 34,
    lineHeight: 37,
    fontFamily: theme.fonts.uniSansHeavy,
    letterSpacing: 0.8,
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
  customSideArtwork: {
    minWidth: 64,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideArtwork: {
    minHeight: 62,
    marginTop: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conceptFooter: {
    minHeight: 40,
    justifyContent: 'flex-end',
    marginTop: theme.spacing.lg,
  },
  badge: {
    minHeight: 28,
    alignSelf: 'flex-start',
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
  actionFooter: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  primaryAction: {
    backgroundColor: theme.colors.primary,
  },
  primaryActionText: {
    color: theme.colors.white,
  },
  mutedAction: {
    backgroundColor: theme.colors.lightGray,
  },
  mutedActionText: {
    color: theme.colors.neutralDark,
  },
  unavailableAction: {
    backgroundColor: theme.colors.incorrectBg,
  },
  unavailableActionText: {
    color: theme.colors.incorrect,
  },
  actionLabel: {
    flexShrink: 0,
    fontSize: 14,
    fontFamily: theme.fonts.gothamBold,
  },
  actionSummary: {
    flex: 1,
    alignItems: 'flex-end',
  },
});
