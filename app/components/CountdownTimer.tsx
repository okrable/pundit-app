import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../theme/theme';

const TIMER_SIZE = 56;
const STROKE_WIDTH = 4;

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
    if (ratio > 0.25) return '#FFC107'; // Yellow/Amber
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
          toValue: 1.15,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeRemaining, isActive]);

  const color = getColor();
  const progress = timeRemaining / duration;

  // Calculate rotation for progress indicator
  const progressDegrees = progress * 360;

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ scale: pulseAnim }] },
      ]}
    >
      {/* Background circle */}
      <View style={[styles.backgroundCircle, { borderColor: theme.colors.lightGray }]} />

      {/* Progress circle using clip and rotation */}
      <View style={styles.progressContainer}>
        {/* Right half */}
        <View style={styles.halfCircleContainer}>
          <View
            style={[
              styles.halfCircle,
              styles.rightHalf,
              {
                borderColor: color,
                transform: [
                  { rotate: `${Math.min(progressDegrees, 180)}deg` },
                ],
              },
            ]}
          />
        </View>
        {/* Left half - only visible when > 50% */}
        {progress > 0.5 && (
          <View style={[styles.halfCircleContainer, styles.leftContainer]}>
            <View
              style={[
                styles.halfCircle,
                styles.leftHalf,
                {
                  borderColor: color,
                  transform: [
                    { rotate: `${progressDegrees - 180}deg` },
                  ],
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* Center text */}
      <View style={styles.centerContent}>
        <Text style={[styles.timeText, { color }]}>
          {timeRemaining}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundCircle: {
    position: 'absolute',
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    borderRadius: TIMER_SIZE / 2,
    borderWidth: STROKE_WIDTH,
    borderColor: theme.colors.lightGray,
  },
  progressContainer: {
    position: 'absolute',
    width: TIMER_SIZE,
    height: TIMER_SIZE,
  },
  halfCircleContainer: {
    position: 'absolute',
    width: TIMER_SIZE / 2,
    height: TIMER_SIZE,
    right: 0,
    overflow: 'hidden',
  },
  leftContainer: {
    right: undefined,
    left: 0,
  },
  halfCircle: {
    width: TIMER_SIZE,
    height: TIMER_SIZE,
    borderRadius: TIMER_SIZE / 2,
    borderWidth: STROKE_WIDTH,
    borderColor: 'transparent',
    position: 'absolute',
  },
  rightHalf: {
    right: 0,
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    transformOrigin: 'center center',
  },
  leftHalf: {
    left: 0,
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    transformOrigin: 'center center',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 18,
    fontFamily: theme.fonts.gothamBold,
  },
});
