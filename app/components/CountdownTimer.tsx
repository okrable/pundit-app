import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme/theme';

const SIZE = 56;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get color based on time remaining
  const getColor = () => {
    const ratio = timeRemaining / duration;
    if (ratio > 0.5) return theme.colors.correct; // Green
    if (ratio > 0.25) return '#FFA500'; // Orange
    return theme.colors.incorrect; // Red
  };

  // Countdown logic
  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
    } else if (timeRemaining === 0 && isActive) {
      onTimeUp();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, timeRemaining]);

  // Pulse animation when time is low
  useEffect(() => {
    if (isActive && timeRemaining <= 5 && timeRemaining > 0) {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeRemaining, isActive]);

  const color = getColor();
  const progress = timeRemaining / duration;
  // strokeDashoffset: 0 = full circle, CIRCUMFERENCE = empty circle
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      <Svg width={SIZE} height={SIZE} style={styles.svg}>
        {/* Background circle (track) */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={theme.colors.lightGray}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
        />
        {/* Progress circle */}
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      {/* Center text */}
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
  },
});
