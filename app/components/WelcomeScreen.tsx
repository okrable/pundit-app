import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme/theme';
import LawsOfTheGameModal from './LawsOfTheGameModal';

const { width, height } = Dimensions.get('window');

const DAILY_TASKS = [
  'Warm up mindset',
  'Play today’s quiz',
  'Review your score',
  'Check the leaderboard',
  'Lock in for tomorrow',
];

const STREAK_STORAGE_KEY = 'daily_task_streak';
const STREAK_DATE_KEY = 'daily_task_streak_date';

interface WelcomeScreenProps {
  onStartQuiz: () => void;
}

interface AnimatedTaskCheckboxProps {
  checked: boolean;
  onPress: () => void;
}

function AnimatedTaskCheckbox({ checked, onPress }: AnimatedTaskCheckboxProps) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: checked ? 1.18 : 0.94,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        speed: 16,
        bounciness: checked ? 12 : 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [checked, scale]);

  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Animated.View
        style={[
          styles.checkbox,
          checked && styles.checkboxChecked,
          { transform: [{ scale }] },
        ]}
      >
        <Ionicons
          name={checked ? 'checkmark' : 'ellipse-outline'}
          size={18}
          color={checked ? theme.colors.white : theme.colors.mediumGray}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function WelcomeScreen({ onStartQuiz }: WelcomeScreenProps) {
  const [showLaws, setShowLaws] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<boolean[]>(() => DAILY_TASKS.map(() => false));
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [previousStreak, setPreviousStreak] = useState(0);

  const completionMessage = useMemo(() => {
    const messages: string[] = require('../data/congratsMessages.json');
    return messages[Math.floor(Math.random() * messages.length)];
  }, [showCompletionModal]);


  const updateStreak = async () => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [storedStreakRaw, storedDate] = await Promise.all([
      AsyncStorage.getItem(STREAK_STORAGE_KEY),
      AsyncStorage.getItem(STREAK_DATE_KEY),
    ]);

    const storedStreak = Number(storedStreakRaw ?? 0) || 0;
    setPreviousStreak(storedStreak);

    if (storedDate === today) {
      setCurrentStreak(storedStreak);
      return;
    }

    const nextStreak = storedDate === yesterday ? storedStreak + 1 : 1;
    setCurrentStreak(nextStreak);

    await Promise.all([
      AsyncStorage.setItem(STREAK_STORAGE_KEY, String(nextStreak)),
      AsyncStorage.setItem(STREAK_DATE_KEY, today),
    ]);
  };

  const handleToggleTask = async (index: number) => {
    const next = completedTasks.map((done, i) => (i === index ? !done : done));
    setCompletedTasks(next);

    if (!completedTasks[index] && next.every(Boolean)) {
      await updateStreak();
      setShowCompletionModal(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/logo/white/pundit-white.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.lightsRow}>
          {DAILY_TASKS.map((_, index) => (
            <View
              key={`light-${index}`}
              style={[
                styles.light,
                completedTasks[index] ? styles.lightComplete : styles.lightPending,
              ]}
            />
          ))}
        </View>

        <View style={styles.tasksContainer}>
          {DAILY_TASKS.map((task, index) => (
            <View key={task} style={styles.taskRow}>
              <AnimatedTaskCheckbox
                checked={completedTasks[index]}
                onPress={() => handleToggleTask(index)}
              />
              <Text style={[styles.taskText, completedTasks[index] && styles.taskTextDone]}>{task}</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.lawsButton} onPress={() => setShowLaws(true)}>
            <Text style={styles.lawsButtonText}>Laws of the Game</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.kickOffButton} onPress={onStartQuiz}>
            <Text style={styles.kickOffButtonText}>Kick Off</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal transparent visible={showCompletionModal} animationType="fade" onRequestClose={() => setShowCompletionModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Day Complete ✅</Text>
            <Text style={styles.modalStreak}>🔥 Streak: {previousStreak} → {currentStreak}</Text>
            <Text style={styles.modalMessage}>{completionMessage}</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setShowCompletionModal(false)}>
              <Text style={styles.modalButtonText}>Nice</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LawsOfTheGameModal visible={showLaws} onClose={() => setShowLaws(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.accent,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    transform: [{ translateY: -height * 0.06 }],
  },
  logo: {
    width: width * 0.65,
    height: 90,
    marginBottom: theme.spacing.lg,
  },
  lightsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  light: {
    width: 14,
    height: 14,
    borderRadius: 8,
  },
  lightPending: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  lightComplete: {
    backgroundColor: '#8AFFC1',
  },
  tasksContainer: {
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  checkbox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  taskText: {
    color: theme.colors.background,
    fontSize: 16,
    fontFamily: theme.fonts.gothamMedium,
  },
  taskTextDone: {
    textDecorationLine: 'line-through',
    opacity: 0.8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  lawsButton: {
    backgroundColor: theme.colors.background,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    minWidth: 140,
    alignItems: 'center',
  },
  lawsButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.textDark,
  },
  kickOffButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    minWidth: 100,
    alignItems: 'center',
  },
  kickOffButtonText: {
    fontSize: 14,
    fontFamily: theme.fonts.gothamMedium,
    color: theme.colors.white,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 24,
    color: theme.colors.textDark,
    fontFamily: theme.fonts.gothamBlack,
  },
  modalStreak: {
    fontSize: 16,
    color: theme.colors.textDark,
    fontFamily: theme.fonts.gothamBold,
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.mediumGray,
    fontFamily: theme.fonts.gothamBook,
  },
  modalButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
  },
  modalButtonText: {
    color: theme.colors.white,
    fontFamily: theme.fonts.gothamBold,
    fontSize: 14,
  },
});
