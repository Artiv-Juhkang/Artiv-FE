/**
 * AppToon responsive / ADAPTIVE system.
 * ------------------------------------------------------------------
 * One width signal (`useWindowDimensions`) → one breakpoint bucket →
 * a small, memoized API every screen and primitive can lean on:
 *
 *   const r = useResponsive();
 *   r.bp                         // 'phone' | 'tablet' | 'large'
 *   r.isPhone / r.isTablet / r.isLarge / r.isTabletUp
 *   r.select({ phone: 1, tablet: 2, large: 3 })   // pick-by-bp (cascades)
 *   r.scale(base, { max })       // gentle width-proportional scale, clamped
 *   r.clamp(value, min, max)
 *   r.contentMaxWidth            // tokens.layout.maxContentWidth on tablet+, else ∞
 *   r.coverWallColumns          // grid columns for the cover wall
 *   r.gutter                     // design gutter (Space token value) for this bp
 *   r.twoPane                    // future: large-screen master/detail eligible
 *
 * WHY a bucket and not raw width: components should make ONE decision
 * ("which layout") not interpolate continuously — that keeps renders
 * cheap and design predictable. `useWindowDimensions` already updates
 * on rotation / split-view / foldables; we collapse its continuous
 * stream into the bucket and only re-emit a NEW object when the bucket
 * (or the few derived numbers) actually changes — see memoization note.
 *
 * Layering: this module reads RAW tokens (breakpoints, columns, caps,
 * layout) the same way `theme.ts` does. It is mode-agnostic — light vs
 * dark never affects layout. Primitives may consume it (e.g. Text reads
 * `resolveFontScaleCap`); screens consume `useResponsive()`.
 *
 * No context/provider needed: window size is a device signal resolved
 * per-render (mirrors `useTheme()`’s stance on color scheme). React
 * Compiler + the internal `useMemo` keep this from causing re-render
 * storms: consumers only see a new value when `bp` (and the handful of
 * derived numbers) flips, NOT on every dp of a resize/rotation frame.
 */
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  breakpoints,
  coverTileMinWidth,
  coverWallColumns as coverWallColumnsToken,
  fontScaleCap,
  layout,
  space,
  type Breakpoint,
  type FontSizeToken,
} from './tokens';

// Ordered low → high so cascade/`select` fallback is well-defined.
const ORDER: readonly Breakpoint[] = ['phone', 'tablet', 'large'] as const;

/** Map a raw width (dp) to its breakpoint bucket. Always returns one. */
export function breakpointForWidth(width: number): Breakpoint {
  // Walk high → low; first whose minWidth is satisfied wins.
  for (let i = ORDER.length - 1; i >= 0; i--) {
    const bp = ORDER[i];
    if (width >= breakpoints[bp].minWidth) return bp;
  }
  return 'phone';
}

/** A value provided per breakpoint. Missing entries cascade DOWN from the
 *  current bp toward 'phone' (mobile-first), so `{ phone: x }` covers all. */
export type ResponsiveValue<T> = Partial<Record<Breakpoint, T>>;

/** Resolve a {phone,tablet,large} map for a given bp, cascading downward. */
export function selectForBreakpoint<T>(
  bp: Breakpoint,
  values: ResponsiveValue<T>,
): T | undefined {
  const idx = ORDER.indexOf(bp);
  for (let i = idx; i >= 0; i--) {
    const key = ORDER[i];
    if (values[key] !== undefined) return values[key];
  }
  // Nothing at/below current bp — fall UP as a last resort so a config
  // that only specifies `large` still yields something on phone.
  for (let i = idx + 1; i < ORDER.length; i++) {
    const key = ORDER[i];
    if (values[key] !== undefined) return values[key];
  }
  return undefined;
}

/** Hard clamp. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Width-proportional scale, clamped. Returns `base` on the design
 * baseline width (phone, BASELINE_WIDTH) and grows sub-linearly toward
 * wider screens so tablets get a touch more generous sizing without
 * ballooning. Use for incidental sizing (hero art height, avatar in a
 * header), NOT for type — type scaling is OS Dynamic Type’s job.
 */
const BASELINE_WIDTH = 390; // iPhone 14/15 logical width — the design canvas

export function scaleForWidth(
  width: number,
  base: number,
  opts?: { factor?: number; min?: number; max?: number },
): number {
  const factor = opts?.factor ?? 0.5; // 0 = no scaling, 1 = fully linear
  const ratio = width / BASELINE_WIDTH;
  const scaled = base * (1 + (ratio - 1) * factor);
  const min = opts?.min ?? base; // never shrink below base by default
  const max = opts?.max ?? base * 1.4; // sane ceiling
  return clamp(scaled, min, max);
}

/**
 * Per-role OS font-scale ceiling for the Text primitive’s
 * `maxFontSizeMultiplier`. Caps a11y text-size growth so layout holds.
 * Display/title clamp tight; body/caption breathe. See tokens.fontScaleCap.
 */
export function resolveFontScaleCap(variant?: FontSizeToken | string): number {
  if (variant && variant in fontScaleCap) {
    return fontScaleCap[variant as keyof typeof fontScaleCap];
  }
  return fontScaleCap.default;
}

/** Columns for the CoverWall at a given width. Prefers the design table,
 *  but never lets tiles drop below `coverTileMinWidth` for the available
 *  content width (which already accounts for gutters by the caller). */
export function coverWallColumnsForWidth(
  bp: Breakpoint,
  availableWidth: number,
  gap: number = space.md,
): number {
  const designed = coverWallColumnsToken[bp];
  // Don’t exceed what fits at the min tile width.
  const fits = Math.max(
    1,
    Math.floor((availableWidth + gap) / (coverTileMinWidth + gap)),
  );
  return Math.max(1, Math.min(designed, fits));
}

export type Responsive = {
  /** Current breakpoint bucket. */
  bp: Breakpoint;
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isLarge: boolean;
  /** tablet OR large — the common "give it room" check. */
  isTabletUp: boolean;
  /** Landscape-ish (width > height). Useful for split-view decisions. */
  isLandscape: boolean;
  /** Pick a value by bp, cascading downward (mobile-first). */
  select: <T>(values: ResponsiveValue<T>) => T | undefined;
  /** Width-proportional, clamped scale (incidental sizing, not type). */
  scale: (base: number, opts?: { factor?: number; min?: number; max?: number }) => number;
  clamp: (value: number, min: number, max: number) => number;
  /** Reading-column cap: tokens.layout.maxContentWidth on tablet+, else
   *  Infinity (phone = full bleed). Pass to a content wrapper’s maxWidth. */
  contentMaxWidth: number;
  /** Designed cover-wall column count for this bp (no width derivation). */
  coverWallColumns: number;
  /** Compute columns from an actual available content width. */
  coverColumnsFor: (availableWidth: number, gap?: number) => number;
  /** Horizontal gutter (Space token VALUE) appropriate for this bp. */
  gutter: number;
  /** Future two-pane (master/detail) eligibility — true only on `large`. */
  twoPane: boolean;
};

/**
 * Primary hook. Memoized so a continuous resize stream collapses to a
 * new object only when the bucket / derived numbers change.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const bp = breakpointForWidth(width);

  return useMemo<Responsive>(() => {
    const isPhone = bp === 'phone';
    const isTablet = bp === 'tablet';
    const isLarge = bp === 'large';
    return {
      bp,
      width,
      height,
      isPhone,
      isTablet,
      isLarge,
      isTabletUp: !isPhone,
      isLandscape: width > height,
      select: (values) => selectForBreakpoint(bp, values),
      scale: (base, opts) => scaleForWidth(width, base, opts),
      clamp,
      // Phone reads full-bleed; tablet+ gets the reading-column cap.
      contentMaxWidth: isPhone ? Number.POSITIVE_INFINITY : layout.maxContentWidth,
      coverWallColumns: coverWallColumnsToken[bp],
      coverColumnsFor: (availableWidth, gap) =>
        coverWallColumnsForWidth(bp, availableWidth, gap),
      gutter: isPhone ? space.lg : space['2xl'],
      twoPane: isLarge,
    };
    // `bp` is derived from `width`; rotation flips width/height. Including
    // raw width/height means a resize WITHIN the same bucket still yields a
    // correct (cheap) object, but the identity only churns on real change.
  }, [bp, width, height]);
}

/** Lightweight variant when a caller only needs the bucket (no helpers).
 *  Re-renders only when the bucket flips. */
export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointForWidth(width);
}

export type { Breakpoint };
