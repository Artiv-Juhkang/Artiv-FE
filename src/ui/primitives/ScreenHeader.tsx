/**
 * ScreenHeader — the SINGLE header frame for every screen.
 * ==================================================================
 * One config-object API renders the left / title / right zones for four
 * variants, owns the TOP safe-area inset for its band (so the body never
 * double-applies it), and owns the scrim/glass legibility for the
 * transparent-over-art variant. It COMPOSES the leaf controls from
 * `header-actions.tsx` — it never redefines a back button / icon button / title.
 *
 * Variants (see docs/frontend-screenlayout.md §3):
 *   solid       — in-flow band (surface bg + bottom hairline). Tab roots,
 *                 ordinary pushed screens.
 *   transparent — absolute float over a full-bleed hero. Top→clear scrim band
 *                 + per-leaf glass chips; glyph ink forced white.
 *   large       — in-flow, 2 rows (compact action row + a big left title row).
 *   hidden      — renders null (immersive viewer).
 *
 * SAFE-AREA OWNERSHIP (Expo SDK 56 rule: exactly one element owns each edge):
 *   The band's paddingTop = insets.top, so the content row sits BELOW the
 *   notch/status bar. The body in `Screen` yields its top inset for flow
 *   headers (solid/large) and keeps it for transparent (the band floats).
 *
 * The left zone is a FIXED 44pt width (matching the right zone when present)
 * so a centered title stays optically centered. No shared-value reads in
 * render — the scrim/chips are static, so the header is reduced-motion safe by
 * construction.
 *
 * Layering: imports `useTheme` from the source hook and the leaves by relative
 * path (barrel would be circular). Does NOT import the router — back lives
 * inside `HeaderBackButton` (which imports `guardedBack` directly).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../use-theme';
import { Text } from './Text';
import {
  HeaderBackButton,
  HeaderTitle,
  type HeaderTone,
} from './header-actions';

export type HeaderVariant = 'solid' | 'transparent' | 'large' | 'hidden';
export type HeaderTitleAlign = 'left' | 'center';

/**
 * The single canonical header prop shape. `back` defaults to true (pushed
 * convention); roots pass `back:false`.
 */
export type HeaderConfig = {
  /** Title — a string (rendered via HeaderTitle) or a custom node (logo/field). */
  title?: string | ReactNode;
  /** Show the ‹ back control. @default true (pushed). Roots pass false. */
  back?: boolean;
  /** Override for back onPress (deep-link first entry, etc). @default guardedBack */
  onBack?: () => void;
  /** Custom left node. When present it WINS over `back`. */
  left?: ReactNode;
  /** Right action zone — compose HeaderIconButton/ready-made actions into a row. */
  right?: ReactNode;
  /** @default 'solid' */
  variant?: HeaderVariant;
  /** @default 'center' (solid/transparent), 'left' (large) */
  titleAlign?: HeaderTitleAlign;
};

/** Content row height ABOVE insets.top; band minHeight = insets.top + this. */
export const HEADER_BAND_HEIGHT = 52;

/** Map a variant to the tone threaded into the leaf controls. */
function toneForVariant(variant: HeaderVariant): HeaderTone {
  return variant === 'transparent' ? 'transparent' : 'solid';
}

export function ScreenHeader({
  title,
  back = true,
  onBack,
  left,
  right,
  variant = 'solid',
  titleAlign,
  columnStyle,
}: HeaderConfig & { columnStyle?: ViewStyle }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  if (variant === 'hidden') return null;

  const tone = toneForVariant(variant);
  const isTransparent = variant === 'transparent';
  const isLarge = variant === 'large';
  const align: HeaderTitleAlign = titleAlign ?? (isLarge ? 'left' : 'center');

  // Left precedence: custom left ?? (back ? back button : spacer). The fixed
  // 44pt zone keeps a centered title optically centered even with no back.
  const leftNode = left ?? (back ? <HeaderBackButton tone={tone} onBack={onBack} /> : null);
  const zoneWidth = t.layout.minHitTarget;

  const titleNode =
    typeof title === 'string' ? (
      <HeaderTitle tone={tone} align={align}>
        {title}
      </HeaderTitle>
    ) : (
      title ?? null
    );

  // The compact content row: [left zone] [title] [right zone]. Title flexes
  // between the two fixed zones; numberOfLines=1 ellipsizes inside HeaderTitle.
  const compactRow = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: HEADER_BAND_HEIGHT,
      }}
    >
      <View style={{ width: zoneWidth, alignItems: 'flex-start', justifyContent: 'center' }}>
        {leftNode}
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
        }}
      >
        {!isLarge ? titleNode : null}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: t.space.xs,
          // Reserve at least one hit target so a lone title stays centered.
          minWidth: zoneWidth,
        }}
      >
        {right ?? null}
      </View>
    </View>
  );

  // large: a second row carries the big display title under the compact row.
  const largeTitleRow =
    isLarge && title != null ? (
      <View style={{ paddingTop: t.space.xs, paddingBottom: t.space.sm }}>
        {typeof title === 'string' ? (
          // large display title — bigger than the compact row, up to 2 lines.
          <Text variant="display" weight="bold" numberOfLines={2}>
            {title}
          </Text>
        ) : (
          titleNode
        )}
      </View>
    ) : null;

  // Inner content uses Screen's column (maxWidth + center) so the row aligns
  // with the body; horizontal gutter keeps controls off the screen edge.
  const inner = (
    <View style={[columnStyle, { paddingHorizontal: t.space.lg }]}>
      {compactRow}
      {largeTitleRow}
    </View>
  );

  if (isTransparent) {
    // Absolute float over the hero. Static top→clear scrim band gives the white
    // glyphs/chips contrast on bright art; leaves render their own glass chips.
    return (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: t.zIndex.stickyHeader,
          paddingTop: insets.top,
        }}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: t.color.scrim, opacity: t.opacity.scrimLight },
          ]}
        />
        {inner}
      </View>
    );
  }

  // solid / large: in-flow band. Owns the top inset; bottom hairline separates
  // it from the body. Full-width bg; inner row capped by columnStyle.
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: t.color.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.color.border,
        zIndex: t.zIndex.stickyHeader,
      }}
    >
      {inner}
    </View>
  );
}
