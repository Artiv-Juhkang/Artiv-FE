/**
 * Button — primary action primitive.
 * `primary` is the Glass Stack high-contrast NEUTRAL CTA (ink-on-light /
 * white-on-dark via the `primaryBg`/`onPrimary` roles) — NOT accent-filled.
 * The indigo accent role is reserved for `ghost` borders, links and focus.
 * Min hit target enforced from tokens; visible focus ring for keyboard/web
 * a11y; press feedback respects reduced motion (opacity step, not scale).
 *
 * INTERACTION SAFETY (req #2): every action button is double-tap / rapid-press
 * safe BY DEFAULT. `onPress` is routed through `useAsyncPress`, which holds a
 * synchronous lock for the whole handler (sync OR Promise) plus a trailing
 * cooldown, so the button can never double-submit or double-load. The handler
 * may therefore be `async` and be passed directly — no `void` wrapper needed.
 * While an async handler is in flight the button shows the SAME spinner as the
 * legacy `loading` prop (`busy = loading || pending`), and a bare cooldown
 * (sync handler) silently blocks the second tap WITHOUT a spinner.
 */
import { ActivityIndicator, Pressable, type PressableProps, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from '../use-theme';
import { useAsyncPress, type AsyncPressHandler } from '../use-async-press';

/** RN-core omits `focused` from the press state; react-native-web supplies it. */
type PressableVisualState = { pressed: boolean; focused?: boolean };

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children' | 'style' | 'onPress'> & {
  label: string; // Korean copy, e.g. "다음 화 보기"
  variant?: ButtonVariant; // default 'primary'
  size?: ButtonSize; // default 'md'
  loading?: boolean;
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  /** Sync OR async press handler — held single-fire by useAsyncPress. */
  onPress?: AsyncPressHandler;
  /** Trailing lock window (ms). Default 350; 0 under reduced motion. */
  cooldownMs?: number;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leadingIcon,
  disabled,
  onPress,
  cooldownMs,
  ...rest
}: ButtonProps) {
  const t = useTheme();

  // Press path: route through the async-press lock. `disabled` short-circuits
  // inside the hook too; we OR all the busy signals into one disabled state.
  const { onPress: guardedPress, pending } = useAsyncPress(onPress, {
    cooldownMs,
    disabled: Boolean(disabled) || loading,
  });

  // `busy` drives the spinner: explicit `loading` (legacy, back-compat) OR an
  // async handler currently in flight. A bare cooldown does NOT set `pending`,
  // so a sync-handler double-tap is blocked without ever showing a spinner.
  const busy = loading || pending;
  const isDisabled = Boolean(disabled) || busy;

  const height = size === 'sm' ? 36 : size === 'lg' ? 52 : t.layout.minHitTarget;
  const padX = size === 'sm' ? t.space.md : t.space.xl;

  const bg =
    variant === 'primary'
      ? t.color.primaryBg // high-contrast neutral CTA (ink-on-light / white-on-dark)
      : variant === 'danger'
        ? t.color.danger
        : variant === 'secondary'
          ? t.color.surfaceElevated
          : 'transparent';
  const fg =
    variant === 'primary'
      ? t.color.onPrimary
      : variant === 'danger'
        ? t.color.onAccent
        : variant === 'secondary'
          ? t.color.onSurface
          : t.color.accent; // ghost label = indigo link tint

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy }}
      disabled={isDisabled}
      onPress={guardedPress}
      hitSlop={size === 'sm' ? 6 : 0}
      style={(state) => {
        // `focused` is provided by react-native-web at runtime; RN core
        // types omit it, so we widen the state object here.
        const { pressed, focused } = state as PressableVisualState;
        return [
          {
            minHeight: height,
            paddingHorizontal: padX,
            borderRadius: t.radius.md,
            backgroundColor: bg,
            opacity: isDisabled ? t.opacity.disabled : pressed ? t.opacity.pressed : 1,
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            flexDirection: 'row' as const,
            alignSelf: (fullWidth ? 'stretch' : 'flex-start') as 'stretch' | 'flex-start',
            borderWidth: variant === 'ghost' ? 1 : 0,
            borderColor: variant === 'ghost' ? t.color.accentBorder : 'transparent',
          },
          // visible focus ring (a11y floor)
          focused ? { borderWidth: 2, borderColor: t.color.focusRing } : null,
        ];
      }}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {leadingIcon ? <View style={{ marginRight: t.space.sm }}>{leadingIcon}</View> : null}
          <Text
            variant={size === 'sm' ? 'label' : 'callout'}
            weight="semibold"
            style={{ color: fg }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
