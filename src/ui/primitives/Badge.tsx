/**
 * Badge — the webtoon vocabulary chips. Each variant is a DISTINCT
 * color/shape so LOCK / UP / 19 / BEST never blur into one another at a
 * glance on a dense series grid:
 *   - lock : cool slate chip + lock glyph (waiting / wait-free)
 *   - up   : green dot-pill "UP" (new/unread episode since last visit)
 *   - 19   : solid red square-ish chip "19" (AGE_19 age gate)
 *   - best : violet pill "BEST" (editorial pick — only cool pop, rare)
 * Labels are short Latin/numeric so `caps` tracking applies.
 */
import { View, type ViewProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from '../use-theme';

export type BadgeVariant = 'lock' | 'up' | 'nineteen' | 'best';

export type BadgeProps = ViewProps & {
  variant: BadgeVariant;
  label?: string; // override default; lock has no text by default
};

const DEFAULT_LABEL: Record<BadgeVariant, string> = {
  lock: '',
  up: 'UP',
  nineteen: '19',
  best: 'BEST',
};

const A11Y_LABEL: Record<BadgeVariant, string> = {
  lock: '잠긴 회차',
  up: '새 회차',
  nineteen: '19세 이용가',
  best: '베스트',
};

export function Badge({ variant, label, style, ...rest }: BadgeProps) {
  const t = useTheme();
  const text = label ?? DEFAULT_LABEL[variant];

  const bg =
    variant === 'lock'
      ? t.color.lockBg
      : variant === 'up'
        ? t.color.badgeUp
        : variant === 'nineteen'
          ? t.color.badge19
          : t.color.badgeBest;
  const fg = variant === 'lock' ? t.color.lockFg : t.color.onAccent;
  // 19 reads as a regulatory mark -> tighter radius; others are pills.
  const br = variant === 'nineteen' ? t.radius.sm : t.radius.pill;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={A11Y_LABEL[variant]}
      style={[
        {
          backgroundColor: bg,
          borderRadius: br,
          paddingHorizontal: variant === 'lock' ? t.space.xs : t.space.sm,
          paddingVertical: 2,
          minWidth: 20,
          minHeight: 18,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        },
        style,
      ]}
      {...rest}
    >
      {variant === 'lock' ? (
        <Text variant="micro" weight="bold" style={{ color: fg }}>
          {/* glyph stand-in; replace with expo-symbols 'lock.fill' in impl */}
          🔒
        </Text>
      ) : (
        <Text variant="micro" weight="bold" caps style={{ color: fg }}>
          {text}
        </Text>
      )}
    </View>
  );
}
