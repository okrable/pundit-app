import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { theme } from '../theme/theme';

interface ShareChallengeModalProps {
  visible: boolean;
  code: string;
  shareUrl: string;
  onClose: () => void;
  onPlayNow: () => void;
}

export default function ShareChallengeModal({
  visible,
  code,
  shareUrl,
  onClose,
  onPlayNow,
}: ShareChallengeModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    await Clipboard.setStringAsync(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I challenge you to beat my score on Pundit! ${shareUrl}`,
        title: 'Pundit Challenge',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.mediumGray} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="flash" size={40} color={theme.colors.accent} />
            <Text style={styles.title}>Challenge Created!</Text>
            <Text style={styles.subtitle}>
              Share this link with a friend to start the challenge
            </Text>
          </View>

          {/* Code Display */}
          <TouchableOpacity style={styles.codeContainer} onPress={handleCopyLink}>
            <Text style={styles.codeLabel}>Your Challenge Code</Text>
            <Text style={styles.code}>{code}</Text>
            <View style={styles.copyHint}>
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={16}
                color={copied ? theme.colors.correct : theme.colors.mediumGray}
              />
              <Text style={[styles.copyHintText, copied && styles.copiedText]}>
                {copied ? 'Link copied!' : 'Tap to copy link'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={theme.colors.white} />
              <Text style={styles.shareButtonText}>Share Link</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playButton} onPress={onPlayNow}>
              <Text style={styles.playButtonText}>Play Now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.laterButton} onPress={onClose}>
              <Text style={styles.laterButtonText}>Play Later</Text>
            </TouchableOpacity>
          </View>

          {/* Expiry Note */}
          <Text style={styles.expiryNote}>
            Challenge expires in 48 hours
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modal: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.md,
  },
  title: {
    fontSize: 22,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.textDark,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeContainer: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  codeLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginBottom: theme.spacing.sm,
  },
  code: {
    fontSize: 36,
    fontFamily: theme.fonts.gothamBold,
    color: theme.colors.accent,
    letterSpacing: 6,
    marginBottom: theme.spacing.sm,
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  copyHintText: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
  },
  copiedText: {
    color: theme.colors.correct,
  },
  buttons: {
    width: '100%',
    gap: theme.spacing.md,
  },
  shareButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  shareButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  playButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  playButtonText: {
    color: theme.colors.white,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  laterButton: {
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
  },
  laterButtonText: {
    color: theme.colors.mediumGray,
    fontSize: 14,
    fontFamily: theme.fonts.gothamBook,
  },
  expiryNote: {
    fontSize: 12,
    fontFamily: theme.fonts.gothamBook,
    color: theme.colors.mediumGray,
    marginTop: theme.spacing.lg,
  },
});
