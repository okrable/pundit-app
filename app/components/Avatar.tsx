import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { theme } from '../theme/theme';
import { AVATAR_ASSETS } from '../constants/avatarAssets';
import { isAvatarId, type AvatarId } from '../../shared/avatarCatalog';

interface AvatarProps {
  userId: string;
  username?: string | null;
  imageUrl?: string | null;
  avatarId?: AvatarId | string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 24,
  md: 36,
  lg: 64,
  xl: 100,
};

// Generate deterministic color from userId
function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % theme.colors.avatarColors.length;
  return theme.colors.avatarColors[index];
}

function getInitials(username?: string | null): string {
  const name = username;
  if (!name) return '?';

  const trimmed = name.trim();
  if (!trimmed) return '?';

  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  // Single word - take first 1-2 characters
  return trimmed.substring(0, Math.min(2, trimmed.length)).toUpperCase();
}

export default function Avatar({
  userId,
  username,
  imageUrl,
  avatarId,
  size = 'md',
}: AvatarProps) {
  const pixelSize = SIZES[size];
  const fontSize = pixelSize * 0.4;
  const backgroundColor = getAvatarColor(userId);

  if (isAvatarId(avatarId)) {
    return (
      <Image
        source={AVATAR_ASSETS[avatarId]}
        style={{ width: pixelSize, height: pixelSize }}
        resizeMode="contain"
      />
    );
  }

  // If we have an image URL, render the image
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[
          styles.image,
          {
            width: pixelSize,
            height: pixelSize,
            borderRadius: pixelSize / 2,
          },
        ]}
      />
    );
  }

  // Otherwise render initials on colored background
  const initials = getInitials(username);

  return (
    <View
      style={[
        styles.initialsContainer,
        {
          width: pixelSize,
          height: pixelSize,
          borderRadius: pixelSize / 2,
          backgroundColor,
        },
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  initialsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamBold,
  },
});
