/**
 * header-actions — the SINGLE home for header leaf buttons + ready-made actions.
 * ==================================================================
 * Every chrome control that can live in a `ScreenHeader` (back ‹, the one
 * reusable round icon button, the title text, and the ready-made
 * Search/Notification/More/Bookmark actions) is defined HERE — once.
 * `ScreenHeader.tsx` composes these; nothing else redefines them.
 *
 * tone-awareness (the whole reason these are shared)
 *   `tone='solid'`        → painted on the surface band → ink follows the theme
 *                           (onSurface), no chip backing.
 *   `tone='transparent'`  → painted OVER cover art (the detail hero) → each
 *                           leaf renders on a 44pt round GLASS chip
 *                           (GlassCard → glassBg + glassBorder, degrades under
 *                           Reduce Transparency) and the glyph ink is FORCED
 *                           white (#FFFFFF) so contrast holds over ANY art.
 *
 * a11y + double-tap: every leaf is a 44pt (`layout.minHitTarget`) hit target
 * with `accessibilityRole="button"` + a Korean label; the icon button runs
 * through `useAsyncPress` so a double-tap can never double-fire.
 *
 * LAYERING: `guardedBack` is imported by its DIRECT path
 * (`@/lib/navigation/useGuardedNavigation`), NOT through the `@/ui` barrel —
 * `ui` is a pure presentation leaf and never re-exports the router layer.
 * `guardedBack` is a documented router indirection (it already holds the
 * `router.canGoBack()` guard + the module-level 500ms double-back gate); we
 * do not reimplement that here.
 *
 * SymbolView: an SF Symbol string only renders on iOS/tvOS, so EVERY
 * SymbolView passes a Text `fallback` → Android/web keep a legible tap target.
 * The `name` cast (`as Parameters<typeof SymbolView>[0]['name']`) mirrors the
 * existing SupportButton / SocialButtonRow pattern.
 *
 * Tokens only — no raw hex except the fixed INK_ON_ART white that must stay
 * legible over arbitrary cover art regardless of theme.
 *
 * Layering note: imports `useTheme` from '../use-theme' (the source hook) and
 * the sibling primitives by relative path — going through the '@/ui' barrel
 * would be a circular import since these leaves are re-exported by the barrel.
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { guardedBack } from '@/lib/navigation/useGuardedNavigation';

import { useTheme } from '../use-theme';
import { useAsyncPress } from '../use-async-press';
import { Text } from './Text';
import { GlassCard } from './GlassCard';

/**
 * Threaded through every leaf. `transparent` => glass chip backing + forced
 * white ink so the control reads over cover art. `solid` => themed ink, no chip.
 */
export type HeaderTone = 'solid' | 'transparent';

/** Forced white ink for `transparent` tone — legible over ANY cover art. */
const INK_ON_ART = '#FFFFFF';

/** Cast an SF-Symbol string to SymbolView's `name` prop type (shared pattern). */
type SymbolName = Parameters<typeof SymbolView>[0]['name'];

/**
 * Round 44pt chip wrapper shared by every leaf. For `transparent` tone it is a
 * GlassCard (frosted chip over art, degrades to painted glass under Reduce
 * Transparency); for `solid` it is a plain transparent View so the glyph sits
 * directly on the surface band. Keeps the hit target a perfect circle.
 */
function HeaderChip({ tone, children }: { tone: HeaderTone; children: ReactNode }) {
  const t = useTheme();
  const size = t.layout.minHitTarget;
  const center = {
    width: size,
    height: size,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  if (tone === 'transparent') {
    return (
      <GlassCard radius="pill" intensity="clear" style={center}>
        {children}
      </GlassCard>
    );
  }
  return <View style={center}>{children}</View>;
}

/**
 * HeaderBackButton — the ‹ back control. onPress = `onBack ?? guardedBack`
 * (`guardedBack` already no-ops via `router.canGoBack()` on the first screen).
 * a11y label '뒤로 가기', 44pt. SymbolView 'chevron.left' + Text '‹' fallback.
 */
export function HeaderBackButton({
  tone = 'solid',
  onBack,
}: {
  tone?: HeaderTone;
  onBack?: () => void;
}) {
  const t = useTheme();
  const ink = tone === 'transparent' ? INK_ON_ART : t.color.onSurface;
  const { onPress } = useAsyncPress(onBack ?? guardedBack);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="뒤로 가기"
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? t.opacity.pressed : 1 })}
    >
      <HeaderChip tone={tone}>
        <SymbolView
          name={'chevron.left' as SymbolName}
          size={24}
          weight="semibold"
          tintColor={ink}
          fallback={
            <Text variant="title" weight="semibold" style={{ color: ink }}>
              ‹
            </Text>
          }
        />
      </HeaderChip>
    </Pressable>
  );
}

/**
 * HeaderIconButton — the ONE reusable round icon button. SymbolView + Text
 * fallback, `useAsyncPress` (double-tap safe), 44pt, `accessibilityRole=button`
 * + `accessibilityState.selected`. `transparent` tone => glass chip + white
 * ink; `active` => accent tint.
 */
export function HeaderIconButton({
  name,
  fallback,
  tone = 'solid',
  onPress,
  accessibilityLabel,
  active = false,
}: {
  name: string;
  fallback: string;
  tone?: HeaderTone;
  onPress: () => void | Promise<void>;
  accessibilityLabel: string;
  active?: boolean;
}) {
  const t = useTheme();
  // active wins (accent), then tone (white over art), else themed ink.
  const ink = active
    ? t.color.accent
    : tone === 'transparent'
      ? INK_ON_ART
      : t.color.onSurface;
  const { onPress: guardedOnPress } = useAsyncPress(onPress);
  return (
    <Pressable
      onPress={guardedOnPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? t.opacity.pressed : 1 })}
    >
      <HeaderChip tone={tone}>
        <SymbolView
          name={name as SymbolName}
          size={22}
          weight="semibold"
          tintColor={ink}
          fallback={
            <Text variant="label" weight="semibold" style={{ color: ink }}>
              {fallback}
            </Text>
          }
        />
      </HeaderChip>
    </Pressable>
  );
}

/**
 * HeaderTitle — the header's title text. Variant 'headline' / semibold,
 * single line, flexShrink so it never shoves the action zones. `transparent`
 * tone => white over art.
 */
export function HeaderTitle({
  children,
  tone = 'solid',
  align = 'center',
}: {
  children: string;
  tone?: HeaderTone;
  align?: 'left' | 'center';
}) {
  const t = useTheme();
  const ink = tone === 'transparent' ? INK_ON_ART : t.color.onSurface;
  return (
    <Text
      variant="headline"
      weight="semibold"
      numberOfLines={1}
      style={{
        flexShrink: 1,
        textAlign: align,
        color: ink,
      }}
    >
      {children}
    </Text>
  );
}

// ── Ready-made actions — thin wrappers over HeaderIconButton ─────────

/** 검색 — magnifyingglass / '검색' fallback. */
export function SearchAction({
  tone = 'solid',
  onPress,
}: {
  tone?: HeaderTone;
  onPress: () => void;
}) {
  return (
    <HeaderIconButton
      name="magnifyingglass"
      fallback="검색"
      tone={tone}
      onPress={onPress}
      accessibilityLabel="검색"
    />
  );
}

/**
 * 알림 — bell / '알림' fallback. `unreadCount` is an OPTIONAL placeholder (no
 * unread-count hook exists yet; a parent injects one in a single line later).
 * `>0` shows a hand-rolled dot; `>99` clamps to '99+' so it never overflows the
 * 44pt target. a11y label folds the count in ('알림 N개').
 */
export function NotificationAction({
  tone = 'solid',
  onPress,
  unreadCount,
}: {
  tone?: HeaderTone;
  onPress: () => void;
  unreadCount?: number;
}) {
  const t = useTheme();
  const hasUnread = typeof unreadCount === 'number' && unreadCount > 0;
  const badgeText = hasUnread ? (unreadCount > 99 ? '99+' : String(unreadCount)) : '';
  const label = hasUnread ? `알림 ${unreadCount}개` : '알림';
  return (
    <View>
      <HeaderIconButton
        name="bell"
        fallback="알림"
        tone={tone}
        onPress={onPress}
        accessibilityLabel={label}
      />
      {hasUnread ? (
        <View
          // Hand-rolled unread dot pinned to the top-right of the 44pt chip.
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 3,
            borderRadius: t.radius.pill,
            backgroundColor: t.color.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            variant="micro"
            weight="bold"
            maxFontSizeMultiplier={1}
            style={{ color: t.color.onAccent, lineHeight: 12 }}
          >
            {badgeText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** 더보기 — ellipsis / '···' fallback. */
export function MoreAction({
  tone = 'solid',
  onPress,
}: {
  tone?: HeaderTone;
  onPress: () => void;
}) {
  return (
    <HeaderIconButton
      name="ellipsis"
      fallback="···"
      tone={tone}
      onPress={onPress}
      accessibilityLabel="더보기"
    />
  );
}

/**
 * 관심(heart) — CONTROLLED toggle (no internal state). The SCREEN binds
 * `onToggle` to whatever real toggle exists (on the detail screen this is the
 * subscription toggle — the only real series-level intent). `heart.fill` +
 * accent tint when active; label flips '관심 등록' ⇄ '관심 해제'.
 */
export function BookmarkAction({
  tone = 'solid',
  active,
  onToggle,
}: {
  tone?: HeaderTone;
  active: boolean;
  onToggle: () => void | Promise<void>;
}) {
  return (
    <HeaderIconButton
      name={active ? 'heart.fill' : 'heart'}
      fallback={active ? '♥' : '♡'}
      tone={tone}
      active={active}
      onPress={onToggle}
      accessibilityLabel={active ? '관심 해제' : '관심 등록'}
    />
  );
}
