import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme/theme';

const SIZE = 58;
const STROKE_WIDTH = 5;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CountdownTimerProps {
  duration: number;
  isActive: boolean;
  onTimeUp: () => void;
  timeRemaining: number;
  setTimeRemaining: (time: number) => void;
}

export default function CountdownTimer({
  duration,
  isActive,
  onTimeUp,
  timeRemaining,
  setTimeRemaining,
}: CountdownTimerProps) {
  const progress = useSharedValue(timeRemaining / duration);
  const pulse = useSharedValue(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCalledTimeUpRef = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  const setTimeRemainingRef = useRef(setTimeRemaining);

  const getColor = () => {
    const ratio = timeRemaining / duration;
    if (ratio > 0.5) return theme.colors.correct;
    if (ratio > 0.25) return '#D88927';
    return theme.colors.incorrect;
  };

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
    setTimeRemainingRef.current = setTimeRemaining;
  }, [onTimeUp, setTimeRemaining]);

  useEffect(() => {
    if (!isActive || timeRemaining > 0) {
      hasCalledTimeUpRef.current = false;
    }
  }, [isActive, timeRemaining]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isActive && timeRemaining > 0) {
      progress.value = withTiming((timeRemaining - 1) / duration, {
        duration: 1000,
        easing: Easing.linear,
      });

      intervalRef.current = setInterval(() => {
        setTimeRemainingRef.current(Math.max(timeRemaining - 1, 0));
      }, 1000);
    } else {
      progress.value = withTiming(timeRemaining / duration, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
      });
    }

    if (isActive && timeRemaining === 0 && !hasCalledTimeUpRef.current) {
      hasCalledTimeUpRef.current = true;
      onTimeUpRef.current();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [duration, isActive, progress, timeRemaining]);

  useEffect(() => {
    if (isActive && timeRemaining <= 5 && timeRemaining > 0) {
      pulse.value = withSequence(
        withTiming(1.08, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) })
      );
    }
  }, [isActive, pulse, timeRemaining]);

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const color = getColor();

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.colors.lightGray}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          animatedProps={animatedCircleProps}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={[styles.timeText, { color }]}>
          {timeRemaining}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
  },
  textContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
    fontVariant: ['tabular-nums'],
  },
});
