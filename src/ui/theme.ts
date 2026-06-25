/**
 * AppToon theme — semantic roles for light + dark ("Glass Stack").
 * ------------------------------------------------------------------
 * Composes raw `tokens.palette` into NAMED ROLES that describe intent
 * ("surface", "onSurface", "accent", "glassBg", "lockFg") rather than
 * appearance. Primitives read these roles; they never import `palette`
 * directly.
 *
 * Surface families per the Glass Stack concept:
 *   - GLASS surfaces: `glassBg` / `glassField` (+ borders) — translucent
 *     frosted panels that float over blurred cover art behind the `scrim`;
 *   - opaque chrome:  `bg` / `surface` / `surfaceElevated` — the solid
 *     fallback ground for screens that are NOT over cover art;
 *   - viewer surface: `viewerBg` (TRUE BLACK in dark, white in light).
 * Keeping `viewerBg` separate is what makes the frame vanish around art.
 *
 * Color intent (Glass Stack rules):
 *   - PRIMARY CTA  = high-contrast NEUTRAL (`primaryBg` / `onPrimary`):
 *     ink-on-light, white-on-dark. NOT accent-filled.
 *   - `accent`     = INDIGO, used ONLY for links, focus ring, active /
 *     selected state, and the kicker overline.
 *   - `unlockWarm` = the SOLE warm ember tone, reserved for the
 *     unlock/countdown anticipation moment.
 *
 * Back-compat: re-exports a `Colors` object whose keys are a SUPERSET
 * of the legacy src/constants/theme.ts (text/background/backgroundElement
 * /backgroundSelected/textSecondary) so existing themed-text / themed-view
 * and the use-theme hook keep working during migration.
 */
import {
  fontFamily,
  fontSize,
  fontWeight,
  layout,
  letterSpacing,
  lineHeight,
  motion,
  opacity,
  palette as p,
  radius,
  shadow,
  space,
  zIndex,
} from './tokens';

export type ColorScheme = 'light' | 'dark';

// ── Semantic color roles ──────────────────────────────────────────
const lightColors = {
  // opaque chrome surfaces (solid ground when NOT over cover art)
  bg: p.bgLight,
  surface: p.ink0,
  surfaceElevated: p.ink0,
  surfaceSunken: p.bgLight,
  // viewer
  viewerBg: p.ink0, // light reading = paper white (art on white)
  // GLASS surfaces — translucent frosted panels over blurred art + scrim
  glassBg: p.glassBgLight,
  glassBorder: p.glassBorderLight,
  glassField: p.glassFieldLight,
  glassFieldBorder: p.glassFieldBorderLight,
  // text / icon
  onSurface: p.textLight,
  onSurfaceSecondary: p.secondaryLight,
  onSurfaceMuted: p.kickerLight,
  kicker: p.kickerLight, // overline / eyebrow above headings
  // PRIMARY CTA — high-contrast NEUTRAL (ink bg + white text), NOT accent
  primaryBg: p.ctaInk,
  primaryPressed: '#000000',
  onPrimary: p.ink0,
  onAccent: p.ink0, // legacy: text on a saturated fill (danger/badges)
  // accent (INDIGO) — links, focus, active/selected, kicker tint
  accent: p.indigo500,
  accentPressed: p.indigo600,
  accentSubtle: 'rgba(61,91,255,0.10)',
  accentBorder: 'rgba(61,91,255,0.35)',
  // unlock/countdown WARM moment (the sole ember in the system)
  unlockWarm: p.ember700,
  unlockWarmSubtle: p.emberSubtleLight,
  // locked state (cool/quiet, opposite of the warm unlock)
  lockBg: p.slate100,
  lockFg: p.slate600,
  // lines / dividers
  border: 'rgba(0,0,0,0.10)',
  borderStrong: 'rgba(0,0,0,0.18)',
  // functional
  success: p.success500,
  danger: p.danger500,
  warn: p.warn500,
  // focus ring (a11y visible focus) — indigo accent
  focusRing: p.indigo500,
  // badges
  badge19: p.badge19,
  badgeUp: p.badgeUp,
  badgeBest: p.badgeBest,
  badgeLockBg: p.badgeLockBg,
  // scrim — darkens the cover-art wall so glass + text stay legible.
  // Light scrim is a soft frost (pale), per the approved mockup.
  scrim: 'rgba(245,246,250,0.55)',
} as const;

const darkColors = {
  // opaque chrome surfaces (solid ground when NOT over cover art)
  bg: p.bgDark,
  surface: p.ink800,
  surfaceElevated: p.ink850,
  surfaceSunken: p.trueBlack,
  // viewer — TRUE BLACK / OLED so the chrome disappears around the art
  viewerBg: p.trueBlack,
  // GLASS surfaces — translucent frosted panels over blurred art + scrim
  glassBg: p.glassBgDark,
  glassBorder: p.glassBorderDark,
  glassField: p.glassFieldDark,
  glassFieldBorder: p.glassFieldBorderDark,
  // text / icon
  onSurface: p.textDark,
  onSurfaceSecondary: p.secondaryDark,
  onSurfaceMuted: p.kickerDark,
  kicker: p.kickerDark, // overline / eyebrow above headings
  // PRIMARY CTA — high-contrast NEUTRAL (white bg + ink text), NOT accent
  primaryBg: p.ink0,
  primaryPressed: '#E6E7EE',
  onPrimary: p.ctaInkText,
  onAccent: p.ink0, // legacy: text on a saturated fill (danger/badges)
  // accent (INDIGO) — links, focus, active/selected, kicker tint
  accent: p.indigo400,
  accentPressed: p.indigo450,
  accentSubtle: 'rgba(154,166,255,0.16)',
  accentBorder: 'rgba(154,166,255,0.40)',
  // unlock/countdown WARM moment (the sole ember in the system)
  unlockWarm: p.ember300,
  unlockWarmSubtle: p.emberSubtleDark,
  // locked
  lockBg: p.slate800,
  lockFg: p.slate400,
  // lines
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.18)',
  // functional
  success: p.success500,
  danger: p.danger500,
  warn: p.warn500,
  focusRing: p.indigo400,
  badge19: p.badge19,
  badgeUp: p.badgeUp,
  badgeBest: p.badgeBest,
  badgeLockBg: p.badgeLockBg,
  // scrim — darkens the cover-art wall so glass + text stay legible.
  scrim: 'rgba(14,16,20,0.62)',
} as const;

export type ColorRoleName = keyof typeof lightColors;

// In dark mode, chrome shadows read poorly (black on black) — degrade
// `card` to flat and rely on surface lightness for separation.
const lightShadow = shadow;
const darkShadow = {
  none: shadow.none,
  card: shadow.none, // dark separation comes from surfaceElevated, not shadow
  sheet: shadow.sheet,
  toast: shadow.toast,
} as const;

function makeTheme(scheme: ColorScheme) {
  const isDark = scheme === 'dark';
  return {
    scheme,
    isDark,
    color: isDark ? darkColors : lightColors,
    shadow: isDark ? darkShadow : lightShadow,
    // structural tokens are mode-independent
    space,
    radius,
    zIndex,
    layout,
    motion,
    opacity,
    typography: { fontSize, lineHeight, fontWeight, fontFamily, letterSpacing },
  } as const;
}

export const themes = {
  light: makeTheme('light'),
  dark: makeTheme('dark'),
} as const;

export type Theme = ReturnType<typeof makeTheme>;

// ── Back-compat shim for legacy constants/theme.ts consumers ──────
// Existing themed-text.tsx / themed-view.tsx / use-theme.ts read
// Colors[scheme][...]. Keep those keys alive (mapped to new roles) so
// nothing breaks while screens migrate to useTheme() below.
export const Colors = {
  light: {
    ...lightColors,
    text: lightColors.onSurface,
    background: lightColors.bg,
    backgroundElement: lightColors.surfaceSunken,
    backgroundSelected: lightColors.border,
    textSecondary: lightColors.onSurfaceSecondary,
  },
  dark: {
    ...darkColors,
    text: darkColors.onSurface,
    background: darkColors.bg,
    backgroundElement: darkColors.surfaceElevated,
    backgroundSelected: darkColors.borderStrong,
    textSecondary: darkColors.onSurfaceSecondary,
  },
} as const;
