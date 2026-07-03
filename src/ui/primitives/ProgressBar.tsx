/**
 * ProgressBar — determinate horizontal progress (0–100). A quiet accent fill on
 * a sunken track. Used by the studio upload footer to show a single honest
 * aggregate bar (a multipart POST yields overall bytes, not per-file percents).
 */
import { View } from 'react-native';

import { useTheme } from '../use-theme';

export type ProgressBarProps = {
  /** 0–100. Clamped. */
  value: number;
  /** Track/fill height in px. @default 6 */
  height?: number;
};

export function ProgressBar({ value, height = 6 }: ProgressBarProps) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: pct, min: 0, max: 100 }}
      style={{
        height,
        borderRadius: t.radius.pill,
        backgroundColor: t.color.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: t.color.accent,
          borderRadius: t.radius.pill,
        }}
      />
    </View>
  );
}
