import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACHIEVEMENTS,
  AchievementDefinition,
  getAchievementProgress,
} from '../../shared/achievements';
import { useAchievementStore } from '../state/useAchievementStore';
import { theme } from '../theme/theme';

function formatUnlockDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

export default function AchievementShowcase() {
  const snapshot = useAchievementStore((state) => state.snapshot);
  const hydrated = useAchievementStore((state) => state.hydrated);
  const items = useMemo(() => {
    return [...ACHIEVEMENTS].sort((left, right) => {
      const leftUnlock = snapshot.unlocked[left.id]?.unlockedAt;
      const rightUnlock = snapshot.unlocked[right.id]?.unlockedAt;
      if (leftUnlock && rightUnlock) return rightUnlock.localeCompare(leftUnlock);
      if (leftUnlock) return -1;
      if (rightUnlock) return 1;
      return ACHIEVEMENTS.findIndex((item) => item.id === left.id) -
        ACHIEVEMENTS.findIndex((item) => item.id === right.id);
    });
  }, [snapshot]);
  const unlockedCount = Object.keys(snapshot.unlocked).length;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        <Text style={styles.summary}>{unlockedCount} / {ACHIEVEMENTS.length} unlocked</Text>
      </View>
      {!hydrated ? (
        <View style={styles.skeleton} />
      ) : (
        <View style={styles.list}>
          {items.map((definition) => (
            <AchievementCard
              key={definition.id}
              definition={definition}
              unlockedAt={snapshot.unlocked[definition.id]?.unlockedAt}
              progress={getAchievementProgress(snapshot, definition.id)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function AchievementCard({
  definition,
  unlockedAt,
  progress,
}: {
  definition: AchievementDefinition;
  unlockedAt?: string;
  progress: { current: number; target: number } | null;
}) {
  const unlocked = Boolean(unlockedAt);
  const mystery = definition.secret && !unlocked;
  return (
    <View style={[styles.card, !unlocked && styles.cardLocked]}>
      <View style={[styles.medal, unlocked && styles.medalUnlocked]}>
        <Ionicons
          name={(mystery ? 'help' : definition.icon) as React.ComponentProps<typeof Ionicons>['name']}
          size={23}
          color={unlocked ? theme.colors.white : theme.colors.mediumGray}
        />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, !unlocked && styles.lockedText]}>
            {mystery ? 'Mystery achievement' : definition.title}
          </Text>
          {unlockedAt ? <Text style={styles.date}>{formatUnlockDate(unlockedAt)}</Text> : null}
        </View>
        <Text style={styles.description}>{mystery ? definition.hint : definition.description}</Text>
        {!unlocked && !mystery && progress ? (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (progress.current / progress.target) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{progress.current}/{progress.target}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: theme.spacing.sm, marginBottom: theme.spacing.xxl },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: theme.spacing.md },
  sectionTitle: { fontFamily: theme.fonts.gothamBold, fontSize: 13, letterSpacing: 1, color: theme.colors.mediumGray },
  summary: { fontFamily: theme.fonts.gothamBook, fontSize: 12, color: theme.colors.mediumGray },
  list: { gap: theme.spacing.sm },
  skeleton: { height: 86, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.lightGray, opacity: 0.55 },
  card: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.white, gap: theme.spacing.md },
  cardLocked: { opacity: 0.72 },
  medal: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.lightGray },
  medalUnlocked: { backgroundColor: theme.colors.primary },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.sm },
  title: { flex: 1, fontFamily: theme.fonts.gothamBold, fontSize: 15, color: theme.colors.textDark },
  lockedText: { color: theme.colors.neutralDark },
  date: { fontFamily: theme.fonts.gothamBook, fontSize: 10, color: theme.colors.mediumGray },
  description: { fontFamily: theme.fonts.gothamBook, fontSize: 12, lineHeight: 17, color: theme.colors.mediumGray, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm },
  progressTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.colors.lightGray, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.accent },
  progressText: { minWidth: 28, textAlign: 'right', fontFamily: theme.fonts.gothamMedium, fontSize: 10, color: theme.colors.mediumGray },
});
