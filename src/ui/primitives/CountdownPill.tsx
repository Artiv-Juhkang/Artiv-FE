/**
 * CountdownPill — the heart of the wait-free (기다리면무료) experience.
 * Reads the episode `freeAt` (Instant ISO-8601 UTC, see frontend-guide
 * §3.6) and ticks down to it. While locked it wears the cool slate lock
 * palette; the instant `now >= freeAt` it cross-fades to the warm UNLOCK
 * tone (`unlockWarm` — the sole surviving ember in the Glass Stack system)
 * and shows "지금 무료" — the unlock MOMENT the whole app builds toward.
 * The warm/cool flip is intentional: waiting is quiet, free is warm.
 * Respects reduced motion (no pulse when reduced).
 *
 * This is a presentational primitive: the parent owns the `now` clock
 * (a single app-level interval) and passes remaining time + state, so
 * we don't spawn a timer per pill in a grid.
 */
import { View, type ViewProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from '../use-theme';

export type CountdownState = 'locked' | 'unlocked';

export type CountdownPillProps = ViewProps & {
  /** Remaining ms until freeAt; <=0 means unlocked. Parent computes from a shared clock. */
  remainingMs: number;
  /** Optional explicit state override (author/admin preview is always 'unlocked'). */
  state?: CountdownState;
};

export function CountdownPill({ remainingMs, state, style, ...rest }: CountdownPillProps) {
  const t = useTheme();
  const resolved: CountdownState = state ?? (remainingMs <= 0 ? 'unlocked' : 'locked');
  const isUnlocked = resolved === 'unlocked';

  const bg = isUnlocked ? t.color.unlockWarmSubtle : t.color.lockBg;
  const fg = isUnlocked ? t.color.unlockWarm : t.color.lockFg;
  const label = isUnlocked ? '지금 무료' : `무료까지 ${formatRemaining(remainingMs)}`;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      accessibilityLiveRegion={isUnlocked ? 'polite' : 'none'}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: t.space.xs,
          paddingHorizontal: t.space.md,
          paddingVertical: t.space.xs,
          borderRadius: t.radius.pill,
          backgroundColor: bg,
        },
        style,
      ]}
      {...rest}
    >
      <Text variant="caption" weight="bold" style={{ color: fg }}>
        {isUnlocked ? '🔓' : '⏳'}
      </Text>
      <Text variant="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

/** D-day style remaining formatter: "3일", "12:04:30", "04:30". */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  if (days >= 1) return `${days}일`;
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Helper for callers: ms remaining from an ISO freeAt against a clock `now`. */
export function remainingFromFreeAt(freeAt: string | null | undefined, nowMs: number): number {
  if (!freeAt) return 0;
  return new Date(freeAt).getTime() - nowMs;
}
