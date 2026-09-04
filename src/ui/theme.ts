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
 * Color intent (warm ground, cool accent):
 *   - NEUTRALS     = warm (off-white `bgLight`, warm near-black text, warm
 *     charcoal chrome). The ground is what carries the warmth.
 *   - PRIMARY CTA  = ORCHID fill (`primaryBg` / `onPrimary`): a deep fill +
 *     white text in light, a bright fill + dark ink in dark.
 *     Colorful and inviting (was neutral ink). Contrast-verified ≥4.5:1.
 *   - `accent`     = ORCHID, used for links, focus ring, active /
 *     selected state, and the kicker overline. Cool on a warm ground —
 *     that temperature gap is what makes it read as accent.
 *   - `unlockWarm` = the SOLE ember tone, reserved for the
 *     unlock/countdown anticipation moment. **Nothing else may be warm-red**;
 *     an accent sharing this hue would kill the signal (see tokens.ts).
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
  // PRIMARY CTA — ORCHID fill + white text (was neutral ink). Cool accent
  // inviting, AA-verified (≈4.8:1). Color now signals the primary action.
  primaryBg: p.orchidFillLight,
  primaryPressed: p.orchidPressedLight,
  onPrimary: p.ink0,
  onAccent: p.ink0, // legacy: text on a saturated fill (danger/badges)
  // accent (ORCHID) — links, focus, active/selected, kicker tint
  accent: p.orchidTextLight,
  accentPressed: p.orchidPressedLight,
  accentSubtle: 'rgba(154,59,181,0.12)',
  accentBorder: 'rgba(154,59,181,0.42)',
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
  // focus ring (a11y visible focus) — orchid accent
  focusRing: p.orchidFillLight,
  // badges
  badge19: p.badge19,
  badgeUp: p.badgeUp,
  badgeBest: p.badgeBest,
  badgeLockBg: p.badgeLockBg,
  // scrim — darkens the cover-art wall so glass + text stay legible.
  // Light scrim is a soft WARM frost (pale), matching the warm neutral ground.
  scrim: 'rgba(246,243,238,0.55)',
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
  // PRIMARY CTA — bright ORCHID fill + dark ink text (was neutral white).
  // Bright-on-dark pops warmly; dark ink rides it at AA (≈6.3:1).
  primaryBg: p.orchidFillDark,
  primaryPressed: p.orchidPressedDark,
  onPrimary: p.orchidInkDark,
  onAccent: p.ink0, // legacy: text on a saturated fill (danger/badges)
  // accent (ORCHID) — links, focus, active/selected, kicker tint
  accent: p.orchidTextDark,
  accentPressed: p.orchidFillDark,
  accentSubtle: 'rgba(212,155,236,0.18)',
  accentBorder: 'rgba(212,155,236,0.42)',
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
  focusRing: p.orchidTextDark,
  badge19: p.badge19,
  badgeUp: p.badgeUp,
  badgeBest: p.badgeBest,
  badgeLockBg: p.badgeLockBg,
  // scrim — darkens the cover-art wall so glass + text stay legible (warm).
  scrim: 'rgba(20,18,16,0.62)',
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
