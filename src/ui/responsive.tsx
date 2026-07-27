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
 * WIDTH SIGNAL = 창이 아니라 콘텐츠가 실제로 쓰는 폭. 보통은 둘이 같아서 윈도 폭을 쓰지만,
 * 웹 셸은 240px 레일이 폭을 먼저 떼어 간다 — 그때 윈도 폭으로 판정하면 800px 창이 'tablet'로
 * 분류되면서 실제 콘텐츠 영역(560px)에는 phone 레이아웃이 맞는데도 tablet 컬럼·거터·캡이
 * 적용돼 그리드가 넘치거나 잘린다. 그래서 폭을 훔치는 쪽(WebShell)이 남은 폭을
 * ContentWidthProvider로 알려주고, 이 훅은 그 값을 우선한다.
 *
 * 컨테이너 측정(onLayout) 기반 브레이크포인트로 가지 않은 이유: 폭을 떼어 가는 크롬이
 * 레일 하나뿐인데 모든 소비처를 측정 컨테이너 안에 넣는 건 과하고, 첫 프레임 폭 0으로 인한
 * 깜빡임을 감수해야 한다. 알려진 인셋 하나는 명시적으로 빼는 편이 단순하고 정확하다.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
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
  /**
   * 실제로 콘텐츠가 그려지는 폭 — `width`에 리딩 컬럼 캡(contentMaxWidth)까지 적용한 값.
   * 그리드가 셀 폭을 계산할 때 써야 하는 값이다. `width`만 보고 계산하면 Screen이 캡을
   * 씌운 뒤라 합계가 컬럼을 넘어 잘린다.
   */
  contentWidth: number;
  /** Future two-pane (master/detail) eligibility — true only on `large`. */
  twoPane: boolean;
};

/**
 * Primary hook. Memoized so a continuous resize stream collapses to a
 * new object only when the bucket / derived numbers change.
 */
export function useResponsive(): Responsive {
  const { width: windowWidth, height } = useWindowDimensions();
  const provided = useContext(ContentWidthContext);
  const width = provided ?? windowWidth;
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
      contentWidth: Math.min(width, isPhone ? Number.POSITIVE_INFINITY : layout.maxContentWidth),
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
  const { width: windowWidth } = useWindowDimensions();
  const provided = useContext(ContentWidthContext);
  return breakpointForWidth(provided ?? windowWidth);
}

/**
 * 콘텐츠가 실제로 쓰는 폭. null이면 "창 전체"라는 뜻이다(네이티브·풀블리드 라우트).
 * 웹 셸처럼 폭을 먼저 떼어 가는 쪽만 값을 넣는다.
 */
const ContentWidthContext = createContext<number | null>(null);

/** 남은 폭을 하위 트리에 알린다 — 레일 등 고정 크롬을 뺀 값. */
export function ContentWidthProvider({
  width,
  children,
}: {
  width: number;
  children: ReactNode;
}) {
  return <ContentWidthContext.Provider value={width}>{children}</ContentWidthContext.Provider>;
}

export type { Breakpoint };
