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
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../use-theme';
import { Text } from './Text';
import {
  HeaderBackButton,
  HeaderTitle,
  type HeaderTone,
} from './header-actions';

export type HeaderVariant = 'solid' | 'transparent' | 'large' | 'ambient' | 'hidden';
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
  /**
   * Media-color accent: a 3px hairline (left-aligned, ~60% width) UNDER the app
   * bar that fades to transparent, quietly signalling the media you're viewing
   * (웹툰=amber, 일러스트=rose, …). See frontend-design-system §12.2. In-flow
   * bands only (solid/large); a transparent float over art has no band to
   * underline. Omitted ⇒ no hairline. Pass `mediaColor(contentType.toLowerCase())`.
   */
  mediaColor?: string;
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
  mediaColor,
  columnStyle,
}: HeaderConfig & { columnStyle?: ViewStyle }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  if (variant === 'hidden') return null;

  const tone = toneForVariant(variant);
  const isTransparent = variant === 'transparent';
  const isLarge = variant === 'large';
  // 'ambient' = an in-flow band identical to 'solid' (owns top inset, bottom
  // hairline, themed ink, §12.2 media hairline) but TRANSPARENT so the §12.3
  // root CoverWall shows through, with a left-aligned brand title by default.
  const isAmbient = variant === 'ambient';
  const align: HeaderTitleAlign = titleAlign ?? (isLarge || isAmbient ? 'left' : 'center');

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
      <View
        style={{
          // Collapse the 44pt back-spacer when there is no left control AND the
          // title is left-aligned, so a brand title (ambient 'Artiv') sits flush
          // to the gutter instead of indented by a phantom spacer.
          width: leftNode || align === 'center' ? zoneWidth : 0,
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
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

  // §12.2 media hairline — a 3px accent UNDER the app bar that fades out,
  // left-aligned 60%. The CSS gradient renders on native (New-Arch experimental
  // background image, same path as CoverWall); web ignores that prop, so it
  // falls back to a solid media-color line and the signal still reads. In-flow
  // bands only (transparent floats over art carry no band to underline).
  const mediaHairline =
    mediaColor && !isTransparent ? (
      <View
        pointerEvents="none"
        style={{
          height: 3,
          width: '60%',
          borderRadius: 1.5,
          marginTop: t.space.sm,
          marginBottom: t.space.xs,
          backgroundColor: Platform.OS === 'web' ? mediaColor : 'transparent',
          experimental_backgroundImage: `linear-gradient(to right, ${mediaColor}, transparent)`,
        }}
      />
    ) : null;

  // Inner content uses Screen's column (maxWidth + center) so the row aligns
  // with the body; horizontal gutter keeps controls off the screen edge.
  const inner = (
    <View style={[columnStyle, { paddingHorizontal: t.space.lg }]}>
      {compactRow}
      {largeTitleRow}
      {mediaHairline}
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

  // solid / large / ambient: in-flow band. Owns the top inset; bottom hairline
  // separates it from the body. ambient is transparent so the root CoverWall
  // (§12.3) shows through; the others paint the surface. Inner row capped by
  // columnStyle.
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: isAmbient ? 'transparent' : t.color.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: t.color.border,
        zIndex: t.zIndex.stickyHeader,
      }}
    >
      {inner}
    </View>
  );
}
