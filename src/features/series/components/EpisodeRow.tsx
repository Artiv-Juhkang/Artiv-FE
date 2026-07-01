/**
 * EpisodeRow — a single 회차 row in the series-detail 회차 목록.
 * ------------------------------------------------------------------
 * PURE PRESENTATION. It fetches nothing and owns no clock: the parent
 * (EpisodeList) runs ONE app-level interval and passes `remainingMs`
 * (computed from the episode `freeAt` against a shared `now`) plus the
 * read-history-derived `isRead` / `isContinue` flags. This keeps a long
 * episode list from spawning a timer (or a query) per row.
 *
 * DTO REALITY (verified against openapi.json — EpisodeSummaryResponse):
 *   { episodeNo?, title?, locked?, freeAt?, publishAt? }
 * There is NO thumbnail / viewCount / likeCount / lockReason field, so we render
 * NONE of them. The row is text-led: "{n}화" + title + relative time, with a
 * lock/countdown cluster and a chevron affordance on the right.
 *
 * Per the confirmed reader model (팔로우/관심/열람), there is NO per-episode
 * bookmark control here — 관심 is the WORK-level subscription (the detail header
 * heart), and 열람 is automatic read-history. The episode-bookmark API still
 * exists (useEpisodeBookmarkToggle / setEpisodeBookmark) for a possible future
 * explicit "북마크" feature, but it is intentionally not surfaced on the row.
 *
 * Codegen widens every field to optional, so each read is guarded — a row never
 * crashes on a missing field.
 *
 * LOCK (wait-free): when `locked`, we show a lock Badge + CountdownPill fed by
 * the parent's `remainingMs`. The ROW does not gate the tap; the parent blocks
 * navigation + markRead for locked rows.
 *
 * READ STATE: `isRead` dims the row + shows a read check; `isContinue` (the
 * boundary row = lastRead+1) shows an "이어보기" chip so the reader can resume at
 * a glance. Reuses ONLY existing primitives (Card press + focus ring + a11y,
 * Badge, CountdownPill, Text).
 */
import { useMemo } from 'react';
import { View } from 'react-native';

import type { EpisodeSummary } from '@/api/types';
import { Badge, Card, CountdownPill, Text, useTheme } from '@/ui';

import { isRecentlyUpdated } from './SeriesGridCard';

export type EpisodeRowProps = {
  /** The episode summary (codegen-optional fields are guarded internally). */
  episode: EpisodeSummary;
  /** This episode is at/under the last-read mark → dim + read check. */
  isRead: boolean;
  /** This is the resume boundary (lastRead+1) → "이어보기" chip. */
  isContinue: boolean;
  /**
   * Remaining ms until `freeAt`, computed by the parent's single clock.
   * Only meaningful while `episode.locked`; <=0 ⇒ CountdownPill flips warm.
   */
  remainingMs: number;
  /** Open the episode (parent blocks this for locked rows + guards it). */
  onPress: () => void | Promise<void>;
};

export function EpisodeRow({ episode, isRead, isContinue, remainingMs, onPress }: EpisodeRowProps) {
  const t = useTheme();

  // Codegen widens these to optional; guard every read.
  const episodeNo = episode.episodeNo;
  const title = episode.title ?? '';
  const locked = episode.locked === true;
  // 이 회차가 최근(24h) 발행됐으면 UP — 카드의 작품 UP와 같은 배지·판정을 회차 단위로 재사용.
  const isUp = isRecentlyUpdated(episode.publishAt);
  const publishedLabel = useMemo(
    () => formatRelativeTime(episode.publishAt),
    [episode.publishAt],
  );

  const noLabel = typeof episodeNo === 'number' ? `${episodeNo}화` : '';

  // One screen-reader sentence describing the whole row state.
  const a11yLabel = useMemo(() => {
    const parts: string[] = [];
    if (noLabel) parts.push(noLabel);
    if (title) parts.push(title);
    if (isUp) parts.push('새 회차');
    if (locked) parts.push('잠긴 회차');
    if (isRead) parts.push('읽음');
    if (isContinue) parts.push('이어보기');
    return parts.join(', ');
  }, [noLabel, title, isUp, locked, isRead, isContinue]);

  return (
    <Card
      onPress={onPress}
      padding="md"
      radius="md"
      elevated={false}
      accessibilityLabel={a11yLabel}
      style={{
        backgroundColor: 'transparent',
        opacity: isRead ? 0.55 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.md,
        minHeight: t.layout.rowMinHeight,
      }}
    >
      {/* ── Read marker (left rail) ─────────────────────────────────── */}
      <View style={{ width: 18, alignItems: 'center', justifyContent: 'center' }}>
        {isRead ? (
          <Text variant="caption" weight="bold" style={{ color: t.color.success }}>
            ✓
          </Text>
        ) : (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: t.color.onSurfaceMuted,
              opacity: 0.5,
            }}
          />
        )}
      </View>

      {/* ── Title + meta (flex column) ──────────────────────────────── */}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.xs }}>
          {locked ? <Badge variant="lock" /> : null}
          {isUp ? <Badge variant="up" /> : null}
          {isContinue ? (
            <View
              style={{
                paddingHorizontal: t.space.sm,
                paddingVertical: 2,
                borderRadius: t.radius.pill,
                backgroundColor: t.color.glassField,
              }}
            >
              <Text variant="micro" weight="bold" style={{ color: t.color.accent }}>
                이어보기
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="headline" weight="semibold" numberOfLines={1}>
          {noLabel ? `${noLabel}  ` : ''}
          <Text variant="headline" weight="regular">
            {title}
          </Text>
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
          {publishedLabel ? (
            <Text variant="caption" color="onSurfaceMuted" numberOfLines={1}>
              {publishedLabel}
            </Text>
          ) : null}
          {locked ? <CountdownPill remainingMs={remainingMs} /> : null}
        </View>
      </View>

      {/* ── Chevron affordance (the whole row opens the episode) ────── */}
      <Text variant="title" color="onSurfaceMuted" style={{ opacity: 0.5 }}>
        ›
      </Text>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Relative time — local helper ('방금 전' / '3분 전' / '3일 전' / 'YYYY.MM.DD'). */
/* -------------------------------------------------------------------------- */

/**
 * Format an ISO `publishAt` as a short Korean relative time. Falls back to an
 * absolute date past ~30 days (relative loses meaning) and returns '' for a
 * missing / unparseable value so the caller can omit the line entirely.
 */
function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';

  const diffMs = Date.now() - then;
  // Future publish (scheduled clock skew) → just show the date.
  if (diffMs < 0) return formatDate(then);

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  return formatDate(then);
}

/** Absolute 'YYYY.MM.DD' for old publishes. */
function formatDate(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}
