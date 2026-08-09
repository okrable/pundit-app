import React, { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme/theme';

const COLORS = [
  theme.colors.accent,
  theme.colors.primary,
  theme.colors.correct,
  '#FFD54F',
  '#4FC3F7',
  '#BA68C8',
  '#FFFFFF',
] as const;

const ORIGINS = [
  { at: 0, x: 0.5, y: 70 },
  { at: 380, x: 0.18, y: 130 },
  { at: 760, x: 0.82, y: 120 },
  { at: 1140, x: 0.34, y: 210 },
  { at: 1520, x: 0.68, y: 220 },
  { at: 1900, x: 0.08, y: 280 },
  { at: 2280, x: 0.92, y: 270 },
  { at: 2660, x: 0.46, y: 330 },
  { at: 3040, x: 0.74, y: 360 },
] as const;

const PARTICLES_PER_BURST = 26;
const TIME_SCALE = 0.84;
const GRAVITY = 52;
const DRAG = 0.991;

interface FireworkPath {
  delay: number;
  originX: number;
  originY: number;
  velocityX: number;
  velocityY: number;
  life: number;
  size: number;
  color: string;
  twinkleOffset: number;
}

function randomBetween(minimum: number, maximum: number) {
  return minimum + Math.random() * (maximum - minimum);
}

function createPaths(width: number): FireworkPath[] {
  return ORIGINS.flatMap((origin) =>
    Array.from({ length: PARTICLES_PER_BURST }, (_, index) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(100, 280);
      const isLarge = Math.random() < 0.14;

      return {
        delay: origin.at,
        originX: width * origin.x + randomBetween(-24, 24),
        originY: origin.y + randomBetween(-24, 24),
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        life: randomBetween(3.8, 5.4),
        size: isLarge ? randomBetween(4.8, 7.5) : randomBetween(1.2, 3.4),
        color: COLORS[index % COLORS.length],
        twinkleOffset: Math.random() * Math.PI * 2,
      };
    })
  );
}

function FireworkParticle({ path }: { path: FireworkPath }) {
  const progress = useSharedValue(0);
  const duration = (path.life / TIME_SCALE) * 1000;

  useEffect(() => {
    progress.value = withDelay(path.delay, withTiming(1, { duration }));
  }, [duration, path.delay, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const time = progress.value * path.life;
    const drag = Math.pow(DRAG, time * 60);
    const translateX = path.velocityX * time * drag;
    const translateY =
      path.velocityY * time * drag + 0.5 * GRAVITY * time * time;
    const twinkle =
      0.72 + Math.sin(progress.value * 50 + path.twinkleOffset) * 0.28;

    return {
      opacity: Math.max(0, 1 - progress.value) * twinkle,
      transform: [{ translateX }, { translateY }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: path.originX,
          top: path.originY,
          width: path.size,
          height: path.size,
          borderRadius: path.size / 2,
          backgroundColor: path.color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function PerfectScoreFireworks() {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const paths = useMemo(() => createPaths(width), [width]);

  if (reduceMotion) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.overlay}
    >
      {paths.map((path, index) => (
        <FireworkParticle key={index} path={path} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
  },
});
