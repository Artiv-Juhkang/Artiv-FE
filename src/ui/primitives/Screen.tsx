/**
 * Screen — the app's ScreenLayout primitive: one place that owns OS chrome
 * (status bar / notch, the Android OS NAVIGATION BAR, the iOS home indicator),
 * keyboard avoidance, scroll-vs-fixed body, responsive content width, an
 * optional full-screen `background` layer, and the per-theme StatusBar. Screens
 * compose their content + an optional pinned footer; the layout makes sure
 * nothing the user must tap is ever swallowed by a system bar.
 *
 * WHY useSafeAreaInsets() and not <SafeAreaView/>:
 *   On SDK 56 Android edge-to-edge, content draws BEHIND the system bars and
 *   the per-edge insets ARE the contract. A pinned footer must apply the
 *   *bottom* inset to its OWN padding so it clears the Android nav bar / iOS
 *   home indicator. Reading raw insets lets us put each inset exactly where it
 *   belongs (top -> header band, bottom -> pinned footer / scroll content).
 *
 * BACKGROUND vs children:
 *   `background` renders as an ABSOLUTE, full-screen layer BEHIND the body +
 *   footer — it fills the WHOLE screen, not just the (often short) content
 *   height. This is what a glass surface needs: a <CoverWall/> art wall that
 *   covers everything while the form floats on top. Passing CoverWall as a
 *   normal child instead only covers the content column (a classic bug — the
 *   wall gets "cut off" below the form). Always use `background` for backdrops.
 *
 * surface='viewer' switches to the TRUE-BLACK / OLED reading surface and
 * disables horizontal gutters so episode art bleeds edge-to-edge.
 * surface='glass' paints the base bg and lets `background` show through.
 */
import { isValidElement, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { type Edge, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../use-theme';
import { useResponsive } from '../responsive';
import type { Space } from '../tokens';
import { ScreenHeader, type HeaderConfig } from './ScreenHeader';

export type ScreenSurface = 'chrome' | 'viewer' | 'glass';

export type ScreenProps = ViewProps & {
  children: ReactNode;

  /** Background family. @default 'chrome' */
  surface?: ScreenSurface;

  /**
   * Horizontal gutter applied to the body (and footer). Ignored when
   * surface='viewer' (art bleeds full-width). @default 'lg'
   */
  padding?: Space;

  /**
   * Safe-area edges the BODY honors as padding. Defaults to ['top','bottom']
   * for chrome/glass and ['top'] for viewer. When a `footer` is provided, the
   * body never applies the bottom inset itself — the footer owns it.
   */
  edges?: readonly Edge[];

  /**
   * Scroll variant. true -> body is a keyboard-aware ScrollView; false -> a
   * fixed flex:1 View (lists/viewers own their scroller). @default false
   */
  scroll?: boolean;

  /** Extra props forwarded to the internal ScrollView when `scroll`. */
  scrollProps?: Omit<ScrollViewProps, 'children' | 'style' | 'contentContainerStyle'>;

  /**
   * Vertically center the body content when it is shorter than the screen.
   * Content still scrolls when it overflows (or the keyboard opens) in scroll
   * mode. Ideal for short centered forms (sign-in). @default false
   */
  center?: boolean;

  /**
   * Pinned footer slot, flush to the screen bottom ABOVE the bottom safe-area
   * inset (Android nav bar / iOS home indicator). Outside the scroller, so
   * primary CTAs stay put while the body scrolls; rises with the keyboard.
   */
  footer?: ReactNode;

  /**
   * Absolute, FULL-SCREEN backdrop rendered behind the body + footer (e.g. a
   * <CoverWall/>). Fills the entire screen regardless of content height.
   * pointerEvents are box-none so the backdrop's own interactive children work
   * while taps still reach the form. Use this for glass-surface art walls.
   */
  background?: ReactNode;

  /**
   * Content max-width on wide screens (tablets). `true` (default) = responsive
   * cap (layout.maxContentWidth on tablet+; viewerMaxWidth for the viewer);
   * a NUMBER forces an explicit cap on every breakpoint; `false` opts out.
   */
  maxWidth?: number | boolean;

  /** Disable built-in keyboard avoidance. @default false */
  disableKeyboardAvoiding?: boolean;

  /**
   * Override the system-bar glyph style. Default: viewer/glass force light
   * glyphs; chrome follows the theme (light glyphs on dark, dark on light).
   */
  statusBarStyle?: 'auto' | 'light' | 'dark';

  /**
   * The screen's header. A `HeaderConfig` is rendered through `<ScreenHeader/>`
   * (the framework owns back-convention / top inset / scrim / a11y in ONE
   * place); a raw `ReactNode` is an escape hatch rendered as-is (treated as a
   * flow header for the body offset — the caller manages its own top inset).
   *
   * Body-offset contract (the SINGLE rule): a flow header (solid/large) OWNS
   * the top inset, so the body drops its topPad to 0; a transparent header
   * FLOATS (absolute), so the body keeps topPad=insets.top and the art bleeds
   * under it via the `background` layer. With no header the topPad math is
   * byte-for-byte unchanged.
   */
  header?: HeaderConfig | ReactNode;
};

/** A HeaderConfig is a plain object; a raw ReactNode header is a React element. */
function isHeaderConfig(header: HeaderConfig | ReactNode): header is HeaderConfig {
  return header != null && !isValidElement(header);
}

export function Screen({
  children,
  surface = 'chrome',
  padding = 'lg',
  edges,
  scroll = false,
  scrollProps,
  center = false,
  footer,
  background,
  maxWidth = true,
  disableKeyboardAvoiding = false,
  statusBarStyle,
  header,
  style,
  ...rest
}: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const r = useResponsive();

  const isViewer = surface === 'viewer';
  const isGlass = surface === 'glass';

  // Base background. 'glass' paints the theme bg (a stable base behind the
  // full-screen `background` art layer — never transparent, so a 1px seam can
  // never flash the navigator's white).
  const backgroundColor = isViewer ? t.color.viewerBg : t.color.bg;

  const gutter = isViewer ? t.space.none : t.space[padding];

  const resolvedEdges = edges ?? (isViewer ? (['top'] as const) : (['top', 'bottom'] as const));
  const wantTop = resolvedEdges.includes('top');
  // A footer OWNS the bottom inset, so the body must not also apply it.
  const bodyWantsBottom = resolvedEdges.includes('bottom') && !footer;

  const responsiveCap = isViewer ? t.layout.viewerMaxWidth : r.contentMaxWidth;
  const contentMaxWidth = typeof maxWidth === 'number' ? maxWidth : responsiveCap;
  const applyMaxWidth =
    maxWidth !== false &&
    Number.isFinite(contentMaxWidth) &&
    (typeof maxWidth === 'number' || r.isTabletUp);

  // viewer/glass sit over dark/media -> light glyphs; chrome follows theme.
  const barStyle: 'auto' | 'light' | 'dark' =
    statusBarStyle ?? (isViewer || isGlass ? 'light' : t.isDark ? 'light' : 'dark');

  const horizontalPad = {
    paddingLeft: gutter + insets.left,
    paddingRight: gutter + insets.right,
  } as const;

  // Header presence + family. A `hidden` config is "no header" for offsetting.
  // A raw ReactNode escape hatch is treated as a flow header (caller-managed).
  const headerIsConfig = isHeaderConfig(header);
  const hasHeader =
    header != null && !(headerIsConfig && (header as HeaderConfig).variant === 'hidden');
  const isFloating =
    hasHeader && headerIsConfig && (header as HeaderConfig).variant === 'transparent';
  // solid / large (config) and the raw-node escape hatch are flow headers.
  const hasFlowHeader = hasHeader && !isFloating;

  // SINGLE body-offset rule: a flow header OWNS the top inset, so the body
  // drops its topPad to 0; otherwise (no header / transparent float / hidden)
  // the original math is preserved exactly.
  const topPad = wantTop && !hasFlowHeader ? insets.top : 0;
  const bodyBottomPad = bodyWantsBottom ? Math.max(insets.bottom, t.space.lg) : 0;

  const columnStyle = applyMaxWidth
    ? ({ width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' } as const)
    : ({ width: '100%' } as const);

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        // `center` vertically centers short content; it still scrolls when the
        // content (or keyboard) makes it taller than the viewport.
        justifyContent: center ? 'center' : 'flex-start',
        paddingTop: topPad,
        paddingBottom: bodyBottomPad,
        ...horizontalPad,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={!isViewer && !isGlass}
      {...scrollProps}
    >
      <View style={columnStyle}>{children}</View>
    </ScrollView>
  ) : (
    <View
      style={{
        flex: 1,
        justifyContent: center ? 'center' : 'flex-start',
        paddingTop: topPad,
        paddingBottom: bodyBottomPad,
        ...horizontalPad,
      }}
    >
      <View style={[center ? null : { flex: 1 }, columnStyle]}>{children}</View>
    </View>
  );

  const footerNode = footer ? (
    <View
      style={[
        {
          paddingTop: t.space.md,
          // The line that keeps interactive footers off the Android nav bar /
          // iOS home indicator. Floored at space.lg for zero-inset devices.
          paddingBottom: Math.max(insets.bottom, t.space.lg),
          paddingLeft: gutter + insets.left,
          paddingRight: gutter + insets.right,
        },
        isGlass || isViewer ? null : { backgroundColor },
      ]}
    >
      <View style={columnStyle}>{footer}</View>
    </View>
  ) : null;

  // The header node. A HeaderConfig flows through <ScreenHeader/> (which owns
  // the top inset + scrim + back convention); a raw ReactNode is passed as-is.
  // columnStyle aligns the inner header row with the body column on tablets.
  const headerNode = hasHeader
    ? headerIsConfig
      ? <ScreenHeader {...(header as HeaderConfig)} columnStyle={columnStyle} />
      : header
    : null;

  const inner = (
    <>
      {/* Flow header (solid/large/escape-hatch) sits ABOVE the body in flow —
          it owns the top inset, so the body's topPad was dropped to 0. */}
      {hasFlowHeader ? headerNode : null}
      {body}
      {footerNode}
      {/* Transparent header floats LAST as an absolute overlay (zIndex
          stickyHeader) so it paints on top of the full-bleed hero. */}
      {isFloating ? headerNode : null}
    </>
  );

  return (
    <View style={[{ flex: 1, backgroundColor }, style]} {...rest}>
      <StatusBar style={barStyle} />
      {/* Full-screen backdrop (e.g. CoverWall). Absolute, behind everything.
          box-none so the form on top still receives touches. */}
      {background ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {background}
        </View>
      ) : null}
      {disableKeyboardAvoiding ? (
        inner
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {inner}
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

/** Box — themed View that reads a semantic surface role. */
export type BoxProps = ViewProps & {
  surface?: 'bg' | 'surface' | 'surfaceElevated' | 'surfaceSunken' | 'viewerBg' | 'transparent';
};

export function Box({ surface = 'transparent', style, ...rest }: BoxProps) {
  const t = useTheme();
  const bg = surface === 'transparent' ? 'transparent' : t.color[surface];
  return <View style={[{ backgroundColor: bg }, style]} {...rest} />;
}
