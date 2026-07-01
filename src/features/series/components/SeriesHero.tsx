/**
 * SeriesHero — the art-led, presentation-only hero of the series detail screen.
 * ------------------------------------------------------------------
 * FULL-BLEED HERO (frontend-screenlayout §5.2): the transparent header floats
 * absolutely OVER this hero, and the cover art bleeds from the notch down. The
 * art itself is the <CoverWall> rendered by the SCREEN's `background` layer
 * (absoluteFill, top:0) — NOT by this component — so it fills the whole screen
 * behind the body regardless of content height. This hero paints the bottom
 * legibility scrim and floats a <GlassCard> info panel over the art:
 *
 *   title
 *   작가 행            (Avatar 이니셜 + nickname — STATIC; see note below)
 *   상태/19/기다리면무료  (status + age-gate + wait-free chips)
 *   genre + tags        (가로 ScrollView 클램프)
 *   description          (없으면 블록 전체 숨김 · 더보기/접기 토글)
 *
 * BLEED MECHANICS: the Screen body applies a horizontal gutter (+ safe-area
 * left/right) to every child. This hero is full-bleed, so it cancels that gutter
 * with negative horizontal margins (= gutter + insets.left/right) and re-pads
 * its own inner content. It also reserves top space = insets.top +
 * HEADER_BAND_HEIGHT so the panel clears the floating transparent header.
 *
 * PURE PROPS: no data fetching, no navigation. Every field is guarded because
 * the codegen widens them all to optional — an artless / partial DTO must
 * still render as intentional, not a broken hole.
 *
 * COVER SEAM: SeriesDetailResponse has NO cover/thumbnail field today (verified
 * against openapi.json), so the screen's CoverWall runs in its aurora
 * placeholder mode (`covers={[]}`). The instant the API grows a cover URL, pass
 * `covers={[coverUrl]}` to the Screen's `background` CoverWall — this hero's
 * structure does not change.
 *
 * AUTHOR SEAM: the DTO carries only `authorNickname` (no authorId / avatarUrl),
 * so the author row is a STATIC label (Avatar falls back to the nickname
 * initial). It is intentionally not tappable — a 작가 프로필 route needs an
 * authorId the backend does not expose yet.
 *
 * Reuses ONLY existing primitives (GlassCard, Avatar, Badge, Text) + the
 * header band height token — no new tokens.
 */
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
  AgeRating,
  Genre,
  ReleasePolicy,
  SeriesDetail,
  SeriesStatus,
} from '@/api/types';
import {
  Avatar,
  Badge,
  GlassCard,
  HEADER_BAND_HEIGHT,
  Text,
  useTheme,
} from '@/ui';

export type SeriesHeroProps = { series: SeriesDetail };

/* -------------------------------------------------------------------------- */
/*  Localized vocabulary maps (presentation only).                            */
/* -------------------------------------------------------------------------- */

const STATUS_LABEL: Record<SeriesStatus, string> = {
  ONGOING: '연재중',
  COMPLETED: '완결',
  HIATUS: '휴재',
};

const GENRE_LABEL: Record<Genre, string> = {
  ROMANCE: '로맨스',
  FANTASY: '판타지',
  ACTION: '액션',
  DRAMA: '드라마',
  DAILY: '일상',
  COMEDY: '코미디',
  THRILLER: '스릴러',
  SPORTS: '스포츠',
  HORROR: '공포',
  ETC: '기타',
};

/** Description is clamped until expanded; this many lines show collapsed. */
const COLLAPSED_LINES = 3;

/**
 * How far the bottom legibility scrim rises from the panel base. The CoverWall
 * already carries its own gentle wash; this is the extra darkening that keeps
 * the title/author/chips readable directly over art on a bright cover.
 */
const HERO_SCRIM_HEIGHT = 200;

export function SeriesHero({ series }: SeriesHeroProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  // 설명이 3줄을 넘을 때만 더보기/접기를 노출한다(onTextLayout으로 실제 줄 수 측정).
  // 3줄 이하면 클램프도 토글도 없이 전문을 그대로 보여준다.
  const [needsToggle, setNeedsToggle] = useState(false);

  // Full-bleed: cancel the Screen body's horizontal gutter (space.lg) + the
  // safe-area left/right so the hero spans edge-to-edge, then re-pad inside.
  const sideBleed = t.space.lg + insets.left;
  const sideBleedRight = t.space.lg + insets.right;
  // The Screen body keeps topPad = insets.top (transparent header floats), so
  // here we only reserve the header band height to clear the floating header.
  const topReserve = HEADER_BAND_HEIGHT + t.space.lg;

  const title = series.title ?? '제목 없음';
  // DTO has only authorNickname; absent ⇒ a calm fallback (still no tap target).
  const authorNickname = series.authorNickname ?? '작가';

  const status = series.status as SeriesStatus | undefined;
  const statusLabel = status ? STATUS_LABEL[status] : undefined;

  const is19 =
    series.adultOnly === true || (series.ageRating as AgeRating) === 'AGE_19';
  const isWaitFree = (series.releasePolicy as ReleasePolicy) === 'WAIT_FREE';

  const genreLabel = series.genre
    ? GENRE_LABEL[series.genre as Genre]
    : undefined;

  // Guard tags: codegen array is optional; drop empties so a stray '' never
  // renders an empty chip.
  const tags = useMemo(
    () => (series.tags ?? []).filter((tag): tag is string => !!tag?.trim()),
    [series.tags],
  );

  const description = series.description?.trim();
  const hasDescription = !!description;

  return (
    <View
      style={{
        // Full-bleed: pull out past the body gutter, reserve header clearance.
        marginTop: -t.space.lg,
        marginLeft: -sideBleed,
        marginRight: -sideBleedRight,
        paddingTop: topReserve,
        // Re-pad inner content to the original gutter so the panel aligns with
        // the rest of the body column.
        paddingHorizontal: t.space.lg,
        paddingBottom: t.space.lg,
        justifyContent: 'flex-end',
      }}
    >
      {/* ── Bottom legibility scrim ─────────────────────────────────────────
          A bottom-anchored wash so the glass panel + its text read over art on
          a bright cover. CSS gradient (New-Arch), with a token base under it so
          it is never bare if the gradient prop is unsupported. */}
      <View
        pointerEvents="none"
        style={[
          styles.scrim,
          {
            height: HERO_SCRIM_HEIGHT,
            experimental_backgroundImage: t.isDark
              ? 'linear-gradient(to bottom, rgba(14,16,20,0) 0%, rgba(14,16,20,0.55) 100%)'
              : 'linear-gradient(to bottom, rgba(14,16,20,0) 0%, rgba(14,16,20,0.28) 100%)',
          },
        ]}
      />

      {/* ── Glass information panel ───────────────────────────────────────── */}
      <GlassCard radius="xl" style={{ padding: t.space.lg, gap: t.space.md }}>
        <Text variant="title" weight="bold" numberOfLines={2}>
          {title}
        </Text>

        {/* 작가 행 — static (no authorId/avatarUrl ⇒ not tappable). */}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}
        >
          <Avatar uri={null} nickname={authorNickname} size="sm" />
          <Text variant="callout" color="onSurfaceSecondary" numberOfLines={1}>
            {authorNickname}
          </Text>
        </View>

        {/* 상태 / 19 / 기다리면무료 chips. */}
        {statusLabel || is19 || isWaitFree ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: t.space.xs,
            }}
          >
            {statusLabel ? (
              <Chip>
                <Text variant="micro" weight="semibold" color="onSurface">
                  {statusLabel}
                </Text>
              </Chip>
            ) : null}
            {is19 ? <Badge variant="nineteen" /> : null}
            {isWaitFree ? (
              <Chip tone="warm">
                <Text variant="micro" weight="semibold" color="unlockWarm">
                  기다리면무료
                </Text>
              </Chip>
            ) : null}
          </View>
        ) : null}

        {/* genre + tags — horizontal scroll, each chip clamps to 1 line. */}
        {genreLabel || tags.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: t.space.xs, alignItems: 'center' }}
          >
            {genreLabel ? (
              <Chip tone="accent">
                <Text variant="micro" weight="semibold" color="accent">
                  {genreLabel}
                </Text>
              </Chip>
            ) : null}
            {tags.map((tag) => (
              <Chip key={tag}>
                <Text
                  variant="micro"
                  color="onSurfaceSecondary"
                  numberOfLines={1}
                  style={{ maxWidth: 160 }}
                >
                  #{tag}
                </Text>
              </Chip>
            ))}
          </ScrollView>
        ) : null}

        {/* description — 없으면 블록 전체 숨김. 3줄 초과일 때만 클램프(…)+더보기/접기,
            3줄 이하는 전문 그대로(토글 없음). 줄 수는 onTextLayout으로 측정한다. */}
        {hasDescription ? (
          <View style={{ gap: t.space.xs }}>
            <Text
              variant="body"
              color="onSurfaceSecondary"
              numberOfLines={expanded || !needsToggle ? undefined : COLLAPSED_LINES}
              onTextLayout={(e) => {
                if (!needsToggle && e.nativeEvent.lines.length > COLLAPSED_LINES) {
                  setNeedsToggle(true);
                }
              }}
            >
              {description}
            </Text>
            {needsToggle ? (
              <Text
                variant="caption"
                weight="semibold"
                color="accent"
                accessibilityRole="button"
                onPress={() => setExpanded((v) => !v)}
              >
                {expanded ? '접기' : '더보기'}
              </Text>
            ) : null}
          </View>
        ) : null}
      </GlassCard>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chip — a small glass/token pill used for status & taxonomy.               */
/* -------------------------------------------------------------------------- */

function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'accent' | 'warm';
}) {
  const t = useTheme();
  const bg =
    tone === 'accent'
      ? t.color.accentSubtle
      : tone === 'warm'
        ? t.color.unlockWarmSubtle
        : t.color.glassField;
  const borderColor =
    tone === 'accent' ? t.color.accentBorder : t.color.glassFieldBorder;
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor,
        paddingHorizontal: t.space.sm,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
