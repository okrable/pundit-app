import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import { theme } from '../theme/theme';

interface StreakFootballIconProps {
  active: boolean;
  size?: number;
}

const FOOTBALL_PANEL = 'M18 13.5L22.2 16.5L20.6 21.5H15.4L13.8 16.5L18 13.5Z';
const FOOTBALL_CONNECTIONS =
  'M18 13.5V7M22.2 16.5L28 14.5M20.6 21.5L24.5 27M15.4 21.5L11.5 27M13.8 16.5L8 14.5';
const BURNING_PANEL = 'M18 17L22 19.8L20.5 24.5H15.5L14 19.8L18 17Z';
const BURNING_CONNECTIONS =
  'M18 17V13M22 19.8L27 18.2M20.5 24.5L24 29.2M15.5 24.5L12 29.2M14 19.8L9 18.2';

export default function StreakFootballIcon({
  active,
  size = 32,
}: StreakFootballIconProps) {
  if (active) {
    return (
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Path
          d="M18 2C20.5 6.2 27 8.4 27 15.2C29.3 13.5 30.2 11.8 30.4 9.4C33 14 33.3 19.2 31 24.2C28.5 29.8 23.8 33 18 33C10.2 33 4 28 4 20.5C4 15.8 6.7 12.2 10 9.2C9.7 13.3 11 15.7 13.4 15C16.2 14.1 16.3 8.2 18 2Z"
          fill={theme.colors.accent}
        />
        <Path
          d={BURNING_PANEL}
          fill={theme.colors.background}
          stroke={theme.colors.textDark}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <Path
          d={BURNING_CONNECTIONS}
          fill="none"
          stroke={theme.colors.textDark}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 36 36">
      <Circle
        cx={18}
        cy={19}
        r={12}
        fill="none"
        stroke={theme.colors.mediumGray}
        strokeWidth={1.75}
      />
      <Path
        d={FOOTBALL_PANEL}
        fill="none"
        stroke={theme.colors.mediumGray}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <Path
        d={FOOTBALL_CONNECTIONS}
        fill="none"
        stroke={theme.colors.mediumGray}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
