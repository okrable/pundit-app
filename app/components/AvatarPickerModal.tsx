import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  AVATAR_DEFINITIONS,
  type AvatarDefinition,
  type AvatarId,
} from '../../shared/avatarCatalog';
import { AVATAR_ASSETS } from '../constants/avatarAssets';
import { theme } from '../theme/theme';

interface AvatarPickerModalProps {
  visible: boolean;
  currentAvatarId: AvatarId;
  title?: string;
  confirmLabel?: string;
  allowCurrentSelection?: boolean;
  onClose: () => void;
  onConfirm: (avatarId: AvatarId) => void | Promise<void>;
}

export default function AvatarPickerModal({
  visible,
  currentAvatarId,
  title = 'Edit Avatar',
  confirmLabel = 'Save',
  allowCurrentSelection = false,
  onClose,
  onConfirm,
}: AvatarPickerModalProps) {
  const [selectedAvatarId, setSelectedAvatarId] = useState(currentAvatarId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedAvatarId(currentAvatarId);
      setError(null);
      setIsSaving(false);
    }
  }, [currentAvatarId, visible]);

  const canConfirm =
    !isSaving && (allowCurrentSelection || selectedAvatarId !== currentAvatarId);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setIsSaving(true);
    setError(null);
    try {
      await onConfirm(selectedAvatarId);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save your avatar. Please try again.'
      );
      setIsSaving(false);
    }
  };

  const renderAvatar = (avatar: AvatarDefinition) => {
    const selected = avatar.id === selectedAvatarId;
    return (
      <TouchableOpacity
        key={avatar.id}
        style={[styles.avatarButton, selected && styles.avatarButtonSelected]}
        onPress={() => {
          setSelectedAvatarId(avatar.id);
          setError(null);
        }}
        disabled={isSaving}
        accessibilityRole="radio"
        accessibilityLabel={avatar.label}
        accessibilityState={{ selected, disabled: isSaving }}
      >
        <Image source={AVATAR_ASSETS[avatar.id]} style={styles.avatarImage} resizeMode="contain" />
        {selected ? (
          <View style={styles.checkBadge}>
            <Ionicons name="checkmark" size={14} color={theme.colors.white} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const symbols = AVATAR_DEFINITIONS.filter((avatar) => avatar.type === 'symbol');
  const letters = AVATAR_DEFINITIONS.filter((avatar) => avatar.type === 'letter');

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={isSaving ? undefined : onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={isSaving} style={styles.headerAction}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity
            onPress={() => void handleConfirm()}
            disabled={!canConfirm}
            style={[styles.headerAction, styles.saveAction]}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Text style={[styles.saveText, !canConfirm && styles.saveTextDisabled]}>
                {confirmLabel}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>FOOTBALL</Text>
          <View style={styles.grid}>{symbols.map(renderAvatar)}</View>
          <Text style={[styles.sectionTitle, styles.lettersTitle]}>LETTERS</Text>
          <View style={styles.grid}>{letters.map(renderAvatar)}</View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.lightGray,
  },
  headerAction: { minWidth: 72, paddingVertical: theme.spacing.sm },
  saveAction: { alignItems: 'flex-end' },
  cancelText: { fontFamily: theme.fonts.gothamBook, fontSize: 16, color: theme.colors.textDark },
  title: { fontFamily: theme.fonts.gothamBold, fontSize: 18, color: theme.colors.textDark },
  saveText: { fontFamily: theme.fonts.gothamBold, fontSize: 16, color: theme.colors.primary },
  saveTextDisabled: { color: theme.colors.mediumGray },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  sectionTitle: { fontFamily: theme.fonts.gothamBold, fontSize: 12, color: theme.colors.mediumGray, marginBottom: theme.spacing.md },
  lettersTitle: { marginTop: theme.spacing.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: theme.spacing.md },
  avatarButton: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButtonSelected: { borderColor: theme.colors.primary },
  avatarImage: { width: '100%', height: '100%' },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  error: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.incorrect,
    fontFamily: theme.fonts.gothamBook,
    textAlign: 'center',
  },
});
