import React, { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { ACHIEVEMENTS } from '../../shared/achievements';
import { useAchievementStore } from '../state/useAchievementStore';
import { theme } from '../theme/theme';

export default function AchievementRevealHost() {
  const reduceMotion = useReducedMotion();
  const activeRevealIds = useAchievementStore((state) => state.activeRevealIds);
  const immediateRevealIds = useAchievementStore((state) => state.immediateRevealIds);
  const dailyGameActive = useAchievementStore((state) => state.dailyGameActive);
  const beginReveal = useAchievementStore((state) => state.beginReveal);
  const dismissReveal = useAchievementStore((state) => state.dismissReveal);

  useEffect(() => {
    if (!dailyGameActive && immediateRevealIds.length > 0 && activeRevealIds.length === 0) {
      beginReveal();
    }
  }, [activeRevealIds.length, beginReveal, dailyGameActive, immediateRevealIds.length]);

  const definitions = ACHIEVEMENTS.filter((item) => activeRevealIds.includes(item.id));
  return (
    <Modal
      visible={definitions.length > 0}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => void dismissReveal()}
    >
      <View style={styles.backdrop}>
        <Animated.View
          entering={reduceMotion ? undefined : ZoomIn.duration(220)}
          style={styles.panel}
          accessibilityViewIsModal
        >
          <View style={styles.headerIcon}>
            <Ionicons name="trophy" size={30} color={theme.colors.white} />
          </View>
          <Text style={styles.eyebrow}>ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.title}>
            {definitions.length === 1 ? 'A new badge is yours!' : `${definitions.length} new badges!`}
          </Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {definitions.map((achievement, index) => (
              <Animated.View
                key={achievement.id}
                entering={reduceMotion ? undefined : FadeInDown.delay(index * 100).duration(220)}
                style={styles.row}
              >
                <View style={styles.medal}>
                  <Ionicons
                    name={achievement.icon as React.ComponentProps<typeof Ionicons>['name']}
                    size={24}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.copy}>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                  <Text style={styles.description}>{achievement.description}</Text>
                </View>
              </Animated.View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={() => void dismissReveal()}>
            <Text style={styles.buttonText}>Brilliant!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(47, 41, 38, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '82%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  headerIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  eyebrow: { fontFamily: theme.fonts.gothamBold, fontSize: 11, letterSpacing: 1.2, color: theme.colors.accent },
  title: { fontFamily: theme.fonts.gothamBlack, fontSize: 22, color: theme.colors.textDark, textAlign: 'center', marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg },
  list: { width: '100%', flexGrow: 0 },
  listContent: { gap: theme.spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.white, gap: theme.spacing.md },
  medal: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  achievementTitle: { fontFamily: theme.fonts.gothamBold, fontSize: 16, color: theme.colors.textDark },
  description: { fontFamily: theme.fonts.gothamBook, fontSize: 13, lineHeight: 18, color: theme.colors.mediumGray, marginTop: 2 },
  button: { width: '100%', marginTop: theme.spacing.lg, backgroundColor: theme.colors.primary, paddingVertical: theme.spacing.md, borderRadius: theme.borderRadius.md, alignItems: 'center' },
  buttonText: { fontFamily: theme.fonts.gothamBold, fontSize: 16, color: theme.colors.white },
});
