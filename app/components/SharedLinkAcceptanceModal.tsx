import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from './Avatar';
import { theme } from '../theme/theme';
import type {
  SharedLinkPhase,
  SharedLinkPreview,
} from '../hooks/useDeepLinkHandler';
import type { SharedCodeAction } from '../services/sharedCode';
import { formatPublicPlayerName } from '../utils/publicIdentity';

interface Props {
  visible: boolean;
  action: SharedCodeAction | null;
  phase: SharedLinkPhase;
  preview: SharedLinkPreview | null;
  message: string | null;
  onAccept: () => void;
  onDismiss: () => void;
  onRetry: () => void;
  onSignIn: () => void;
  onViewFriends: () => void;
}

export default function SharedLinkAcceptanceModal({
  visible,
  action,
  phase,
  preview,
  message,
  onAccept,
  onDismiss,
  onRetry,
  onSignIn,
  onViewFriends,
}: Props) {
  const insets = useSafeAreaInsets();
  const isFriend = action?.kind === 'friendInvite';
  const friendPreview = preview?.kind === 'friendInvite' ? preview.data : null;
  const challengePreview = preview?.kind === 'challenge' ? preview.data : null;
  const player = friendPreview?.inviter || challengePreview?.creator || null;
  const playerName = player
    ? formatPublicPlayerName(player.username, 'legacyLabel' in player ? player.legacyLabel : null, 'Player')
    : 'Player';
  const expiry = friendPreview?.expiresAt || challengePreview?.expiresAt;
  const expiryLabel = expiry
    ? new Date(expiry).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;
  const showPreview = Boolean(preview) && ['ready', 'accepting'].includes(phase);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(theme.spacing.xxl, insets.bottom + theme.spacing.lg) },
            Platform.OS === 'web' && styles.sheetWeb,
          ]}
          accessibilityViewIsModal
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close invitation"
            disabled={phase === 'accepting'}
          >
            <Ionicons name="close" size={24} color={theme.colors.mediumGray} />
          </TouchableOpacity>

          <Ionicons
            name={isFriend ? 'person-add' : 'flash'}
            size={42}
            color={isFriend ? theme.colors.primary : theme.colors.accent}
          />
          <Text style={styles.title}>
            {isFriend ? 'Friend invitation' : 'Challenge invitation'}
          </Text>

          {phase === 'sign_in_required' ? (
            <>
              <Text style={styles.body}>
                Sign in to review and accept this {isFriend ? 'friend invitation' : 'challenge'}.
              </Text>
              <TouchableOpacity style={styles.primaryButton} onPress={onSignIn}>
                <Text style={styles.primaryButtonText}>Sign In to Continue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
                <Text style={styles.secondaryButtonText}>Not Now</Text>
              </TouchableOpacity>
            </>
          ) : phase === 'loading' ? (
            <View style={styles.loadingBlock} accessibilityLabel="Loading invitation">
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Checking invitation…</Text>
            </View>
          ) : showPreview ? (
            <>
              {player && (
                <Avatar
                  userId={player.userId}
                  username={player.username}
                  avatarId={'avatarId' in player ? player.avatarId : undefined}
                  imageUrl={'avatarUrl' in player ? player.avatarUrl : undefined}
                  size="lg"
                />
              )}
              <Text style={styles.playerName}>{playerName}</Text>
              <Text style={styles.body}>
                {isFriend
                  ? 'Add this player to your friends leaderboard?'
                  : 'Accept this challenge and start today’s quiz now?'}
              </Text>
              {expiryLabel && <Text style={styles.expiry}>Available until {expiryLabel}</Text>}
              <TouchableOpacity
                style={[styles.primaryButton, phase === 'accepting' && styles.buttonDisabled]}
                onPress={onAccept}
                disabled={phase === 'accepting'}
                accessibilityState={{ disabled: phase === 'accepting', busy: phase === 'accepting' }}
              >
                {phase === 'accepting' ? (
                  <ActivityIndicator size="small" color={theme.colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isFriend
                      ? friendPreview?.state === 'already_friends'
                        ? 'View Friendship'
                        : `Add ${playerName}`
                      : 'Accept & Play'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onDismiss}
                disabled={phase === 'accepting'}
              >
                <Text style={styles.secondaryButtonText}>Not Now</Text>
              </TouchableOpacity>
            </>
          ) : phase === 'success' ? (
            <>
              <Ionicons name="checkmark-circle" size={52} color={theme.colors.correct} />
              <Text style={styles.successText}>{message}</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={onViewFriends}>
                <Text style={styles.primaryButtonText}>View League Tables</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
                <Text style={styles.secondaryButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text accessibilityRole="alert" style={styles.errorText}>
                {message || 'This invitation is unavailable.'}
              </Text>
              {phase === 'error' && (
                <TouchableOpacity style={styles.primaryButton} onPress={onRetry}>
                  <Text style={styles.primaryButtonText}>Try Again</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.secondaryButton} onPress={onDismiss}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xxl,
    alignItems: 'center',
  },
  sheetWeb: {
    maxWidth: 420,
    marginBottom: 32,
    borderRadius: theme.borderRadius.xl,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.sm,
  },
  title: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.fonts.gothamBlack,
    fontSize: 23,
    color: theme.colors.textDark,
  },
  body: {
    fontFamily: theme.fonts.gothamBook,
    fontSize: 15,
    lineHeight: 21,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  loadingBlock: { alignItems: 'center', paddingVertical: theme.spacing.xl },
  loadingText: {
    marginTop: theme.spacing.md,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  playerName: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.fonts.gothamBold,
    fontSize: 19,
    color: theme.colors.textDark,
  },
  expiry: {
    fontFamily: theme.fonts.gothamBook,
    fontSize: 12,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.lg,
  },
  primaryButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: {
    fontFamily: theme.fonts.gothamBold,
    fontSize: 15,
    color: theme.colors.white,
  },
  secondaryButton: { padding: theme.spacing.md, marginTop: theme.spacing.xs },
  secondaryButtonText: {
    fontFamily: theme.fonts.gothamMedium,
    fontSize: 14,
    color: theme.colors.mediumGray,
  },
  successText: {
    fontFamily: theme.fonts.gothamMedium,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.colors.textDark,
    marginVertical: theme.spacing.lg,
  },
  errorText: {
    fontFamily: theme.fonts.gothamMedium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: theme.colors.incorrect,
    marginBottom: theme.spacing.lg,
  },
});
