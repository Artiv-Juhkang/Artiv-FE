/**
 * Card — surface for series/episode rows and grid posters.
 * Subtle elevation in light (poster-on-wall), flat in dark (separation
 * via surfaceElevated). Pressable when `onPress` given, with focus ring.
 */
import type { ReactNode } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

import { useTheme } from '../use-theme';
import type { Radius, Space } from '../tokens';

export type CardProps = ViewProps & {
  children: ReactNode;
  onPress?: () => void;
  padding?: Space; // default 'lg'
  radius?: Radius; // default 'lg'
  elevated?: boolean; // apply shadow.card (light) ; default true
  accessibilityLabel?: string;
};

export function Card({
  children,
  onPress,
  padding = 'lg',
  radius = 'lg',
  elevated = true,
  style,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const t = useTheme();
  const base = {
    backgroundColor: t.color.surface,
    borderRadius: t.radius[radius],
    padding: t.space[padding],
    ...(elevated ? t.shadow.card : t.shadow.none),
  } as const;

  if (!onPress) {
    return (
      <View style={[base, style]} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={(state) => {
        // react-native-web supplies `focused`; RN-core types omit it.
        const { pressed, focused } = state as { pressed: boolean; focused?: boolean };
        return [
          base,
          pressed ? { opacity: t.opacity.pressed } : null,
          focused ? { borderWidth: 2, borderColor: t.color.focusRing } : null,
        ];
      }}
    >
      {children}
    </Pressable>
  );
}
