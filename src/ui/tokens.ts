/**
 * AppToon design tokens — "Glass Stack"
 * ------------------------------------------------------------------
 * Raw, mode-agnostic primitives. These are the only place hex/number
 * literals live. `theme.ts` composes these into semantic light/dark
 * roles; primitives in `ui/primitives/*` read SEMANTIC roles, never
 * these raw values directly.
 *
 * Concept: a frosted-glass form/surface floats over a living wall of
 * (blurred) cover art. The art / content is the HERO; chrome recedes
 * behind translucent "glass" panels.
 *   1. the CHROME (browse/library/community/auth): a cool neutral ground
 *      with frosted GLASS surfaces (glassBg / glassField) sitting over
 *      blurred cover art behind a darkening SCRIM;
 *   2. the VIEWER (immersive vertical scroll): a TRUE-BLACK / OLED
 *      surface so the frame disappears around the art.
 * The PRIMARY CTA is high-contrast NEUTRAL (white-on-dark / ink-on-light),
 * never accent-filled; the INDIGO accent is reserved for links, focus,
 * active/selected state, and the kicker overline. One warm "ember"
 * highlight survives for the single unlock/countdown anticipation moment.
 */

// ── Color scales (raw) ────────────────────────────────────────────
// The neutral ramp is cool-indigo-leaning so large fields read as cool
// frosted glass, not warm paper.
export const palette = {
  // Signature accent — INDIGO. Owns links, focus ring, active/selected
  // state, and the kicker overline. NOT the primary fill (that is the
  // neutral high-contrast CTA below).
  indigo400: '#9AA6FF', // dark-mode accent (links / focus / active / kicker)
  indigo450: '#6C7CFF', // dark-mode accent pressed / active-strong
  indigo500: '#3D5BFF', // light-mode accent (links / focus / active / kicker)
  indigo600: '#2E45D6', // light-mode accent pressed

  // Warm "Ember" highlight — SURVIVES only for the unlock/countdown
  // anticipation moment ("지금 무료" pulse). Everywhere else is indigo or
  // neutral. Light uses a darker ember so it clears AA on the pale bg.
  ember300: '#FF9C7A', // dark unlock warm fg (≈9.3:1 on dark bg)
  ember500: '#F2542D',
  ember700: '#A82E12', // light unlock warm fg (≈5.8:1 on light bg)
  emberSubtleDark: 'rgba(255,156,122,0.16)',
  emberSubtleLight: 'rgba(168,46,18,0.10)',

  // Neutral high-contrast CTA ground (the PRIMARY button fill).
  ctaInk: '#16171D', // light-mode CTA bg (ink); white text on it
  ctaInkText: '#10121A', // dark-mode CTA text (on white bg)

  // Ink / neutral ramp — text + opaque (non-glass) chrome surfaces.
  ink0: '#FFFFFF', // pure white (light surfaces / dark CTA bg / dark text)
  bgLight: '#EAEBF0', // light app background (cool neutral)
  textLight: '#14151A', // light primary text
  secondaryLight: '#3C3E48', // light secondary text
  kickerLight: '#6A6E80', // light kicker / muted
  ink800: '#22242C', // dark opaque chrome surface (behind glass / non-glass)
  ink850: '#191B22', // dark chrome elevated
  bgDark: '#0E1014', // dark app background
  textDark: '#FFFFFF', // dark primary text
  secondaryDark: '#C7CCDC', // dark secondary text
  kickerDark: '#A7AEC6', // dark kicker / muted
  trueBlack: '#000000', // VIEWER surface only — OLED, art disappears into it

  // Glass surface ROLES (translucent — sit over blurred cover art + scrim).
  // Dark
  glassBgDark: 'rgba(255,255,255,0.10)',
  glassBorderDark: 'rgba(255,255,255,0.26)',
  glassFieldDark: 'rgba(255,255,255,0.13)',
  glassFieldBorderDark: 'rgba(255,255,255,0.22)',
  // Light
  glassBgLight: 'rgba(255,255,255,0.55)',
  glassBorderLight: 'rgba(255,255,255,0.9)',
  glassFieldLight: 'rgba(255,255,255,0.78)',
  glassFieldBorderLight: 'rgba(0,0,0,0.08)',

  // Locked state — desaturated slate so a locked episode reads "waiting",
  // visually cooler/quieter than the warm ember of "free now".
  slate100: '#E4E6EA',
  slate400: '#7E8794',
  slate600: '#4C545F',
  slate800: '#2A2E35',

  // Functional
  success500: '#1FA971', // read / done / online
  danger500: '#E5484D', // errors, destructive, report
  warn500: '#E0A106', // caution, scheduled

  // Badge-specific (distinct so LOCK / UP / 19 / BEST never blur together)
  badge19: '#E5484D', // 19+ age gate — unmistakable red
  badgeUp: '#1FA971', // new/unread episode "UP"
  badgeBest: '#7C5CFF', // editorial "BEST" — the only cool/violet pop, used sparingly
  badgeLockBg: '#00000099', // scrim over thumbnail for the lock chip

  // Media-type colors (Ambient 진화, design-system §12.1). Drive the ambient
  // glow / placard chip bg / media hairline per ContentType. Mode-agnostic
  // bright tones (like badges); dark text rides on them. New ContentType →
  // add one color here + a case in mediaColor() below.
  mediaWebtoon: '#F2A65A', // amber
  mediaIllustration: '#F2789F', // rose
  mediaDesign: '#FF8A66', // coral
  mediaPhoto: '#6FB3F2', // sky
  mediaNovel: '#9B8CFF', // violet
  mediaAudio: '#4FD1C0', // teal
} as const;

/**
 * Resolve a content type to its signature media color (ambient / placard /
 * hairline). Keys are the lowercase ContentType from the API; an unknown or
 * absent type falls back to the indigo brand accent.
 */
export function mediaColor(contentType: string | null | undefined): string {
  switch (contentType) {
    case 'webtoon':
      return palette.mediaWebtoon;
    case 'illustration':
      return palette.mediaIllustration;
    case 'design':
      return palette.mediaDesign;
    case 'photo':
      return palette.mediaPhoto;
    case 'novel':
      return palette.mediaNovel;
    case 'audio':
      return palette.mediaAudio;
    default:
      return palette.indigo400;
  }
}

// ── Opacity tokens (for scrims, overlays, disabled) ───────────────
export const opacity = {
  disabled: 0.4,
  scrimLight: 0.32,
  scrimHeavy: 0.66,
  pressed: 0.88,
} as const;

// ── Spacing scale (4pt base) ──────────────────────────────────────
// Named numeric steps; viewer uses `none` for zero-gutter art bleed.
export const space = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 48,
  '5xl': 64,
} as const;

// ── Radius scale ──────────────────────────────────────────────────
// Cards are gently rounded (poster feel); pills/badges fully round;
// the viewer image bleeds full-width with radius `none`.
export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 14, // series/episode cards
  xl: 20, // sheets, big surfaces
  pill: 999, // badges, countdown pill, chips
} as const;

// ── Type scale + roles ────────────────────────────────────────────
// Mixed Hangul + Latin. Korean glyphs are visually taller/denser than
// Latin, so EVERY role carries a generous lineHeight (≈1.4–1.55 body,
// ≈1.25–1.3 display) — tighter Latin-style leading clips Hangul
// ascenders/descenders and crowds 받침. letterSpacing stays 0 for
// Hangul (negative tracking damages legibility); only ALL-CAPS Latin
// labels (badges) get positive tracking.
export const fontSize = {
  display: 28, // screen titles, series title on detail hero
  title: 22, // section headers, episode title in viewer header
  headline: 18, // card title, list-row primary
  body: 16, // default reading/UI text
  callout: 15,
  label: 14, // buttons, secondary rows
  caption: 12, // metadata, timestamps, counts
  micro: 11, // badge text, overline
} as const;

export const lineHeight = {
  display: 36, // 1.29 — Hangul-safe display leading
  title: 30, // 1.36
  headline: 26, // 1.44
  body: 24, // 1.50 — comfortable for Hangul body
  callout: 22,
  label: 20,
  caption: 16,
  micro: 14,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const letterSpacing = {
  tightLatin: -0.2, // optional, Latin display only
  normal: 0, // ALL Hangul text
  caps: 0.6, // ALL-CAPS Latin badge labels (UP / BEST / 19)
} as const;

/**
 * Font family ROLES.
 * Strategy: ship ONE variable Korean+Latin family via expo-font so
 * Hangul and Latin share metrics (no Latin-fallback jump), plus the
 * system mono for codes/counts.
 *
 *  - Pretendard (OFL, expo-font loadable as a static/variable .ttf):
 *    excellent Hangul + Latin coverage, modern neutral grotesque —
 *    used for BOTH display and body (weight does the work, not family
 *    switching) to keep the reading surface calm.
 *  - System fallback chain ends at the platform Korean system face
 *    (Apple SD Gothic Neo / Noto Sans KR) so first paint before the
 *    custom font loads still renders Hangul correctly.
 *
 * These are font-family *names*; the actual assets are registered in
 * app layout via useFonts. `display`/`body` intentionally point at the
 * same family — the type system expresses hierarchy through size +
 * weight, the studio-restraint move for a content app.
 */
export const fontFamily = {
  display: 'Pretendard',
  body: 'Pretendard',
  // captions/data — same family for cohesion; mono only for true code.
  caption: 'Pretendard',
  mono: 'SpaceMono', // counts/IDs in dev tooling only
} as const;

// ── Elevation / shadow tokens ─────────────────────────────────────
// Elevation is SUBTLE in chrome (posters carry their own contrast) and
// ABSENT in the viewer. Dark mode leans on surface lightness, not
// shadow, so shadow tokens degrade to flat there (see theme.ts).
export const shadow = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  toast: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
} as const;

// ── Z-index scale ─────────────────────────────────────────────────
// Viewer chrome (tap-to-toggle header/footer) sits ABOVE content but
// BELOW global overlays; toast is always topmost.
export const zIndex = {
  base: 0,
  content: 1,
  stickyHeader: 10,
  viewerChrome: 20, // viewer's auto-hiding top/bottom bars
  fab: 30,
  bottomSheet: 40,
  modal: 50,
  toast: 60,
} as const;

// ── Hit targets & layout ──────────────────────────────────────────
export const layout = {
  minHitTarget: 44, // iOS HIG / Android a11y floor — every tappable
  iconButton: 44,
  rowMinHeight: 56,
  maxContentWidth: 720, // tablet/web reading column cap
  viewerMaxWidth: 900, // viewer art column cap on wide screens
} as const;

// ── Responsive / adaptive breakpoints ─────────────────────────────
// Width thresholds (dp). A device is in bucket B when its width is
// >= breakpoints[B].minWidth and < the next bucket's minWidth. Phones
// start at 0 so there is always exactly one match. These are the ONLY
// place breakpoint numbers live; `responsive.ts` reads them.
//   phone   <600   single column, full-bleed content
//   tablet  600–1023  content max-width caps, denser grids
//   large   >=1024  two-pane candidate, widest grids
export const breakpoints = {
  phone: { minWidth: 0 },
  tablet: { minWidth: 600 },
  large: { minWidth: 1024 },
} as const;

// CoverWall responsive grid: target columns per breakpoint. The hook
// may still derive columns from an item min-width, but these are the
// design-blessed defaults / clamps.
export const coverWallColumns = {
  phone: 3,
  tablet: 5,
  large: 7,
} as const;

// Minimum sensible cover tile width (dp) used when deriving columns
// from available width instead of the fixed table above.
export const coverTileMinWidth = 104;

// Font-scale clamp caps (OS Dynamic Type / Android font scale).
// `maxFontSizeMultiplier` ceilings per text role so a11y text-size
// boosts legibility without shattering layout. Display/title clamp
// tighter (they already dominate); body/caption allow more growth.
export const fontScaleCap = {
  display: 1.3,
  title: 1.35,
  headline: 1.4,
  body: 1.6,
  callout: 1.6,
  label: 1.5,
  caption: 1.7,
  micro: 1.5,
  default: 1.6,
} as const;

// ── Motion tokens (respect reduced-motion) ────────────────────────
// `duration.instant` is the value primitives swap to when the OS
// reduce-motion flag is on — see useMotion() in ui/primitives.
export const motion = {
  duration: {
    instant: 0, // reduced-motion target
    fast: 120, // press feedback, badge appear
    base: 220, // standard enter/exit
    slow: 360, // viewer chrome fade, unlock celebration
  },
  easing: {
    // cubic-bezier control points (consume via Reanimated Easing.bezier)
    standard: [0.2, 0, 0, 1] as const,
    decelerate: [0, 0, 0.2, 1] as const,
    accelerate: [0.4, 0, 1, 1] as const,
  },
  // The unlock moment: when a locked episode crosses freeAt, the lock
  // chip cross-fades to the WARM ember "지금 무료" pulse (the sole warm
  // accent in an otherwise indigo/neutral Glass Stack system). This is
  // the one celebratory motion; everything else stays quiet.
  unlockPulseScale: 1.06,
} as const;

export type Space = keyof typeof space;
export type Radius = keyof typeof radius;
export type FontSizeToken = keyof typeof fontSize;
export type ZIndex = keyof typeof zIndex;
export type Breakpoint = keyof typeof breakpoints;
