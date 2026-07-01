/**
 * SeriesGridCard — the cover-art-forward poster cell of the BROWSE grid.
 * ------------------------------------------------------------------
 * Glass Stack rule: the ART is the hero. This cell is a 2:3 poster with
 * the title (1–2 lines) + author (caption) UNDER it — NOT a photo+title+
 * author row with a side 구독 button (that was the old vertical list).
 *
 * Badge overlays sit ON the poster, each in its own corner so they never
 * collide on a dense grid (matches the Badge primitive's "distinct chip"
 * contract):
 *   - 19 (age gate)      → TOP-LEFT.  Derived locally from the summary
 *                          (`adultOnly` / `ageRating === 'AGE_19'`); the
 *                          card stays visible to minors — the age gate is
 *                          at the VIEWER, not here.
 *   - UP / new           → TOP-RIGHT. The SeriesSummary DTO carries NO
 *                          unread signal, so the parent supplies `isUp`
 *                          (e.g. from /api/me/subscriptions). Absent ⇒ no UP.
 *   - lock / 무료 카운트   → BOTTOM-LEFT. Parent supplies `locked` (+ optional
 *                          `freeAt`/`remainingMs` from the wait-free policy).
 *                          With a countdown we render the CountdownPill;
 *                          otherwise a bare lock Badge (자물쇠).
 *
 * COVER + TINT FALLBACK: when the parent passes `coverUrl` (SeriesSummary now
 * carries one — the V25 cover_url seam), the real art shows through. When it's
 * absent/null, AppImage falls back to a deterministic per-series tint (the same
 * idea as CoverWall's per-cell base color), so an artless slot reads as
 * intentional art, not a broken hole — zero layout change either way.
 *
 * RESPONSIVE: the cell width comes from the PARENT's column math — call
 * `seriesGridLayout(contentWidth, columns, gutter)` once for the grid and
 * feed each card `width={layout.cellWidth}`. The card never measures the
 * window itself (so it works identically in a FlatList row or a wrap grid).
 *
 * Reuses ONLY existing primitives: Card (press / focus-ring / a11y),
 * AppImage, Badge, Text, CountdownPill. No new token system.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AgeRating, SeriesSummary } from '@/api/types';
import { AppImage } from '@/ui/AppImage';
import { Badge, Card, CountdownPill, Text, useTheme } from '@/ui';

/* -------------------------------------------------------------------------- */
/*  UP(업데이트) 판정 — 최신 발행 회차로부터 24시간 윈도우.                        */
/* -------------------------------------------------------------------------- */

/** 'UP' 배지 유지 시간: 최신 발행(예약/업데이트 시각)로부터 24시간. 지나면 UP 소멸. */
export const UP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * `lastPublishedAt`(SeriesSummary, 최신 PUBLISHED 회차 시각)이 24시간 이내면 UP.
 * 없거나(회차 없음) 24시간이 지났으면 false — 시간이 지나면 업데이트 조건은 자동 소멸한다.
 */
export function isRecentlyUpdated(lastPublishedAt: string | null | undefined): boolean {
  if (!lastPublishedAt) return false;
  const then = new Date(lastPublishedAt).getTime();
  if (!Number.isFinite(then)) return false;
  return Date.now() - then < UP_WINDOW_MS;
}

/* -------------------------------------------------------------------------- */
/*  Grid metrics — the single source of geometry the card + grid share.       */
/* -------------------------------------------------------------------------- */

/** Poster aspect ratio: a 2:3 cover (width:height = 2:3 ⇒ height = width×1.5). */
export const POSTER_ASPECT = 2 / 3;

/** Design-blessed column counts: 2 on phone, 3 on tablet+ (the brief). */
export const SERIES_GRID_COLUMNS = { phone: 2, tablet: 3, large: 3 } as const;

/**
 * Grid metric tokens (multiples of the 4pt space scale). The grid GUTTER
 * (outer screen padding) is owned by <Screen padding>; this `gap` is the
 * INTER-cell spacing the FlatList/columnWrapper applies.
 */
export const SERIES_GRID = {
  /** Space between cells (both axes). tokens.space.md = 12. */
  gap: 12,
  /** Poster corner radius — tokens.radius.lg (the "card/poster" radius). */
  posterRadius: 'lg',
  /** Inset of overlay badges from the poster edge. tokens.space.sm = 8. */
  badgeInset: 8,
  /** Gap between poster and the text block under it. tokens.space.sm = 8. */
  textGap: 8,
} as const;

export type SeriesGridMetrics = {
  /** Width of one poster cell (dp). */
  cellWidth: number;
  /** Height of the poster image at 2:3 (dp). */
  posterHeight: number;
  /** Resolved column count. */
  columns: number;
};

/**
 * Derive per-cell geometry from the CONTENT width (already inside Screen's
 * gutters) and a column count. `gap` is the inter-cell spacing; with N
 * columns there are N-1 gaps, so each cell is (width - gap×(N-1)) / N.
 *
 *   const { cellWidth, posterHeight } =
 *     seriesGridLayout(contentWidth, r.isTabletUp ? 3 : 2);
 */
export function seriesGridLayout(
  contentWidth: number,
  columns: number,
  gap: number = SERIES_GRID.gap,
): SeriesGridMetrics {
  const cols = Math.max(1, Math.floor(columns));
  const cellWidth = Math.floor((contentWidth - gap * (cols - 1)) / cols);
  return {
    cellWidth,
    posterHeight: Math.round(cellWidth / POSTER_ASPECT),
    columns: cols,
  };
}

/* -------------------------------------------------------------------------- */
/*  Tint placeholder — deterministic per-series hue (no cover field exists).  */
/* -------------------------------------------------------------------------- */

// Cool Glass-Stack-friendly tints (indigo/violet/blue/teal/slate). One is
// picked per series id so a given series always gets the same placeholder
// (stable across grid recycling), echoing CoverWall's soft aurora bases.
const TINTS_DARK = ['#23314f', '#2c2a4d', '#1f3a45', '#322840', '#283447', '#2a3340'] as const;
const TINTS_LIGHT = ['#d7def0', '#ddd9ef', '#d2e6e6', '#e4dcef', '#d8e0ef', '#dde3ef'] as const;

function tintForId(id: number | undefined, palette: readonly string[]): string {
  const n = typeof id === 'number' && Number.isFinite(id) ? Math.abs(id) : 0;
  return palette[n % palette.length];
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export type SeriesGridCardProps = {
  series: SeriesSummary;
  /** Cell width (dp) from `seriesGridLayout(...).cellWidth`. */
  width: number;
  /** Navigate to detail. id is guaranteed by the server (codegen widens it). */
  onPress: () => void;

  /**
   * Cover url (SeriesSummary.coverUrl — the V25 cover_url seam). When present
   * the real art shows through; absent/null ⇒ the deterministic tint shows.
   */
  coverUrl?: string | null;

  /**
   * UP / new badge. The summary carries no unread signal; the parent derives
   * this (e.g. from /api/me/subscriptions). Default false ⇒ no UP badge.
   */
  isUp?: boolean;

  /**
   * Lock state (wait-free monetization). The summary has no per-series lock,
   * so the parent supplies it (e.g. a day-list lock flag). When `remainingMs`
   * is also given we render the CountdownPill (무료까지 …); otherwise a bare
   * lock Badge (자물쇠).
   */
  locked?: boolean;
  /** Remaining ms until free (from a shared app clock + episode `freeAt`). */
  remainingMs?: number;
};

export function SeriesGridCard({
  series,
  width,
  onPress,
  coverUrl,
  isUp = false,
  locked = false,
  remainingMs,
}: SeriesGridCardProps) {
  const t = useTheme();

  const posterHeight = Math.round(width / POSTER_ASPECT);
  const tint = tintForId(series.id, t.isDark ? TINTS_DARK : TINTS_LIGHT);

  // 19 gate derives from the summary itself (visible to all; gated at viewer).
  const is19 = series.adultOnly === true || (series.ageRating as AgeRating) === 'AGE_19';

  const title = series.title ?? '';
  const author = series.authorNickname ?? '';

  // One screen-reader sentence for the whole cell (the Card is the button).
  const a11yLabel = useMemo(() => {
    const parts = [title];
    if (author) parts.push(`작가 ${author}`);
    if (is19) parts.push('19세 이용가');
    if (isUp) parts.push('새 회차');
    if (locked) parts.push('잠긴 회차');
    return parts.join(', ');
  }, [title, author, is19, isUp, locked]);

  const inset = SERIES_GRID.badgeInset;

  return (
    <Card
      onPress={onPress}
      // The poster IS the surface — no card chrome/padding around the art.
      padding="none"
      radius="lg"
      elevated={false}
      accessibilityLabel={a11yLabel}
      style={{ width, backgroundColor: 'transparent' }}
    >
      {/* ── Poster (2:3, the hero) ─────────────────────────────────────── */}
      <View
        style={{
          width,
          height: posterHeight,
          borderRadius: t.radius.lg,
          overflow: 'hidden',
          backgroundColor: tint, // shows through when there is no cover art
        }}
      >
        <AppImage
          url={coverUrl}
          recyclingKey={`series-${series.id ?? 'x'}`}
          contentFit="cover"
          // The tinted box behind already conveys "표지" to sighted users; the
          // a11y sentence lives on the Card, so keep the image itself silent.
          style={StyleSheet.absoluteFill}
        />

        {/* Badge overlays — one per corner so they never collide. */}
        {is19 ? (
          <View style={{ position: 'absolute', top: inset, left: inset }}>
            <Badge variant="nineteen" />
          </View>
        ) : null}

        {isUp ? (
          <View style={{ position: 'absolute', top: inset, right: inset }}>
            <Badge variant="up" />
          </View>
        ) : null}

        {locked ? (
          <View style={{ position: 'absolute', bottom: inset, left: inset, right: inset }}>
            {typeof remainingMs === 'number' ? (
              <CountdownPill remainingMs={remainingMs} />
            ) : (
              <Badge variant="lock" />
            )}
          </View>
        ) : null}
      </View>

      {/* ── Text block (under the poster) ─────────────────────────────── */}
      {/* Poster stays full-bleed (Card padding="none"); the TEXT gets its own
          inner inset so title/author never glue to the cell's left/bottom edges. */}
      <View
        style={{
          paddingHorizontal: t.space.sm,
          paddingTop: SERIES_GRID.textGap,
          paddingBottom: t.space.sm,
          gap: 2,
        }}
      >
        <Text variant="callout" weight="semibold" numberOfLines={2}>
          {title}
        </Text>
        {author ? (
          <Text variant="caption" color="onSurfaceSecondary" numberOfLines={1}>
            {author}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton — matches the cell footprint for grid loading states.            */
/* -------------------------------------------------------------------------- */

/** Static poster-shaped placeholder (pair with the Skeleton primitive's
 *  shimmer in the grid, or use standalone). Sized identically to a real cell
 *  so the grid doesn't reflow when data arrives. */
export function SeriesGridCardSkeleton({ width }: { width: number }) {
  const t = useTheme();
  const posterHeight = Math.round(width / POSTER_ASPECT);
  return (
    <View style={{ width }}>
      <View
        style={{
          width,
          height: posterHeight,
          borderRadius: t.radius.lg,
          backgroundColor: t.color.surfaceSunken,
        }}
      />
      <View
        style={{
          paddingHorizontal: t.space.sm,
          paddingTop: SERIES_GRID.textGap,
          paddingBottom: t.space.sm,
          gap: t.space.xs,
        }}
      >
        <View
          style={{
            width: '80%',
            height: t.typography.fontSize.callout,
            borderRadius: t.radius.sm,
            backgroundColor: t.color.surfaceSunken,
          }}
        />
        <View
          style={{
            width: '50%',
            height: t.typography.fontSize.caption,
            borderRadius: t.radius.sm,
            backgroundColor: t.color.surfaceSunken,
          }}
        />
      </View>
    </View>
  );
}
