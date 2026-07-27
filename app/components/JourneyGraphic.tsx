import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { theme } from '../theme/theme';

export default function JourneyGraphic({ width = 250 }: { width?: number }) {
  return (
    <Svg
      width={width}
      height={74}
      viewBox="0 0 250 74"
      accessibilityLabel="A football journey through several club stops"
    >
      <Line
        x1="24"
        y1="34"
        x2="226"
        y2="34"
        stroke={theme.colors.textDark}
        strokeWidth="3"
      />
      {[26, 76, 126, 176].map((cx) => (
        <Circle
          key={cx}
          cx={cx}
          cy="34"
          r="10"
          fill={theme.colors.background}
          stroke={theme.colors.textDark}
          strokeWidth="3"
        />
      ))}
      <Circle
        cx="226"
        cy="34"
        r="13"
        fill={theme.colors.primary}
        stroke={theme.colors.textDark}
        strokeWidth="3"
      />
      <Path
        d="M219 28l7-3 7 5-2 8-8 2-5-6zM226 25v15M218 34h16"
        fill="none"
        stroke={theme.colors.white}
        strokeWidth="1.5"
      />
    </Svg>
  );
}
