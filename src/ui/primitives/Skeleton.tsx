/**
 * Skeleton — loading placeholder. Gentle opacity shimmer that FREEZES
 * (static block) under reduced motion. Used heavily for series grids /
 * episode lists while React Query fetches.
 */
import { useEffect } from 'react';
import { type DimensionValue, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMotion, useTheme } from '../use-theme';
import type { Radius } from '../tokens';

export type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: Radius; // default 'md'
};

export function Skeleton({ width = '100%', height = 16, radius = 'md' }: SkeletonProps) {
  const t = useTheme();
  const { duration } = useMotion();
  const o = useSharedValue(0.6);

  useEffect(() => {
    if (duration.slow === 0) {
      o.value = 0.7; // reduced motion: static
      return;
    }
    o.value = withRepeat(withTiming(1, { duration: duration.slow }), -1, true);
    return () => cancelAnimation(o);
  }, [duration.slow, o]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: t.radius[radius],
          backgroundColor: t.color.surfaceSunken,
        },
        animatedStyle,
      ]}
    />
  );
}

export const skeletonStyles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
