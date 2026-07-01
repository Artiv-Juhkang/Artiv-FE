/**
 * EpisodeList — the 회차 목록 container, mounted inline inside the series
 * detail screen (it owns the episode data layer; the detail screen owns the
 * hero / action bar / CTA above it).
 * ------------------------------------------------------------------
 * RESPONSIBILITIES (frontend-content-screens §5):
 *   1. Infinite Slice query of /api/series/{id}/episodes via the episode-hooks
 *      OPTIONS builder (useEpisodeList → useInfiniteQuery), flattened +
 *      de-duped on episodeNo (Slice paging can repeat a tail item when a new
 *      episode shifts the page boundary).
 *   2. A SINGLE `now` clock (one setInterval(1000)) shared by every locked
 *      row's CountdownPill — only running while at least one visible row is
 *      locked, cleared on unmount. No per-row timers.
 *   3. 1↔N sort toggle done as a CLIENT-SIDE reverse of the loaded pages — the
 *      query key / request never changes (fixed-sort list). Caveat: oldest-first
 *      is an approximation until all pages are loaded (documented).
 *   4. read-history → isRead / isContinue mapping (useReadState). Per-episode
 *      bookmark is intentionally NOT surfaced (off the 팔로우/관심/열람 model).
 *   5. State branches: loading → Skeleton, error → ErrorState (ADULT_ONLY /
 *      ENTITY_NOT_FOUND mapped via isAppError; only the LIST area is gated — the
 *      hero above stays), empty → EmptyState, slice end → no footer spinner.
 *   6. LOCK-SAFE navigation: a locked row tap does NOT navigate and does NOT
 *      markRead — it shows a "준비 중" countdown toast and returns. An unlocked
 *      row taps through to the multimedia viewer via guardedPush.
 *
 * The viewer route (/series/[id]/[episodeNo]) is the real multimedia reader;
 * this guarded-pushes the typed route with string params (URL segments).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import type { EpisodeSummary } from '@/api/types';
import { useEpisodeList, useReadState } from '@/features/series/episode-hooks';
import { isAppError } from '@/lib/errors';
import { flattenInfinite, useInfiniteQuery } from '@/lib/query';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  Button,
  EmptyState,
  ErrorState,
  remainingFromFreeAt,
  Skeleton,
  Text,
  useTheme,
  useToast,
  type ApiErrorCode,
} from '@/ui';

import { EpisodeRow } from './EpisodeRow';

type SortOrder = 'latest' | 'oldest';

export function EpisodeList({ seriesId }: { seriesId: number }) {
  const t = useTheme();
  const toast = useToast();
  const nav = useGuardedNavigation();

  const q = useInfiniteQuery(useEpisodeList(seriesId));
  const { lastReadEpisodeNo } = useReadState(seriesId);

  // 1↔N order toggle — pure client reverse of the loaded slice (no refetch,
  // query key unchanged). Default 'latest' = newest-first (server order).
  const [order, setOrder] = useState<SortOrder>('latest');

  // Flatten + de-dupe on episodeNo (page-boundary tail duplicates).
  const episodes = useMemo(
    () => flattenInfinite(q.data, (e) => e.episodeNo ?? -1),
    [q.data],
  );

  const ordered = useMemo(
    () => (order === 'oldest' ? [...episodes].reverse() : episodes),
    [episodes, order],
  );

  // Any locked row visible? Only then do we run the shared 1s clock.
  const hasLocked = useMemo(
    () => episodes.some((e) => e.locked === true),
    [episodes],
  );

  // ── Single shared `now` clock (one interval, only while a row is locked) ──
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasLocked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasLocked]);

  // Row tap handler: a locked row shows a countdown toast (no nav, no markRead);
  // an unlocked row guarded-pushes to the (future) viewer route.
  const onPressRow = useCallback(
    (episode: EpisodeSummary) => {
      const no = episode.episodeNo;
      // Locked → no navigation, no markRead; surface the countdown calmly.
      if (episode.locked === true) {
        toast.show({
          tone: 'neutral',
          message: '아직 잠긴 회차예요. 무료 공개까지 기다려 주세요.',
        });
        return;
      }
      if (typeof no !== 'number') return; // can't route without an episodeNo
      // 회차 뷰어로 이동. params 는 URL 세그먼트라 문자열로 넘긴다.
      nav.push({
        pathname: '/series/[id]/[episodeNo]',
        params: { id: String(seriesId), episodeNo: String(no) },
      });
    },
    [nav, seriesId, toast],
  );

  // Load-more guard (mirrors index.tsx onEndReached) — never double-fetch.
  const loadMore = useCallback(() => {
    if (q.hasNextPage && !q.isFetchingNextPage) {
      q.fetchNextPage();
    }
  }, [q]);

  // ── Loading (first page) ────────────────────────────────────────────────
  if (q.isLoading) {
    return <EpisodeListSkeleton />;
  }

  // ── Error (age gate / not found / generic) ──────────────────────────────
  if (q.isError) {
    const code = errorCode(q.error);
    return (
      <View style={{ minHeight: 240 }}>
        <ErrorState
          code={code}
          onRetry={code === 'UNKNOWN' || code === 'NETWORK' ? () => q.refetch() : undefined}
        />
      </View>
    );
  }

  // ── Empty (fetch ok, zero published episodes) ───────────────────────────
  if (ordered.length === 0) {
    return (
      <View style={{ minHeight: 240 }}>
        <EmptyState
          title="아직 공개된 회차가 없어요"
          description="새 회차가 올라오면 여기에서 바로 볼 수 있어요."
        />
      </View>
    );
  }

  return (
    <View style={{ gap: t.space.sm }}>
      {/* ── Sort toggle (1화부터 / 최신화부터) ───────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: t.space.xs,
        }}
      >
        <Text variant="caption" color="onSurfaceMuted">
          총 {episodes.length}화{q.hasNextPage ? '+' : ''}
        </Text>
        <SortToggle order={order} onToggle={setOrder} />
      </View>

      {/* Rows are rendered as a plain mapped list (NOT a FlatList): this list
          mounts INLINE inside the detail screen's outer scroller, so a nested
          VirtualizedList would warn + fight the parent scroll. Episode lists
          are bounded (a few hundred rows at most) and paginate on demand. */}
      <View>
        {ordered.map((item, index) => {
          const no = item.episodeNo;
          const isRead =
            typeof lastReadEpisodeNo === 'number' &&
            typeof no === 'number' &&
            no <= lastReadEpisodeNo;
          const isContinue =
            typeof lastReadEpisodeNo === 'number' &&
            typeof no === 'number' &&
            no === lastReadEpisodeNo + 1;
          const remainingMs =
            item.locked === true ? remainingFromFreeAt(item.freeAt, now) : 0;

          return (
            <View key={keyExtractor(item, index)}>
              {index > 0 ? <Separator /> : null}
              <EpisodeRow
                episode={item}
                isRead={isRead}
                isContinue={isContinue}
                remainingMs={remainingMs}
                onPress={() => onPressRow(item)}
              />
            </View>
          );
        })}
      </View>

      {/* Load-more — explicit footer trigger (the inline list can't fire
          onEndReached). Hidden at the slice end (hasNext false) → no footer
          spinner, per the contract. Button's useAsyncPress makes it
          double-tap-safe; the in-flight guard prevents duplicate page fetches. */}
      {q.hasNextPage ? (
        <View style={{ paddingTop: t.space.sm }}>
          <Button
            label="다음 회차 더 보기"
            variant="secondary"
            fullWidth
            loading={q.isFetchingNextPage}
            onPress={loadMore}
          />
        </View>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sort toggle chip                                                           */
/* -------------------------------------------------------------------------- */

function SortToggle({
  order,
  onToggle,
}: {
  order: SortOrder;
  onToggle: (next: SortOrder) => void;
}) {
  const t = useTheme();
  const label = order === 'latest' ? '최신화부터' : '1화부터';
  return (
    <Text
      variant="caption"
      weight="semibold"
      onPress={() => onToggle(order === 'latest' ? 'oldest' : 'latest')}
      accessibilityRole="button"
      accessibilityLabel={`정렬 ${label}, 탭하면 전환`}
      style={{
        color: t.color.accent,
        paddingVertical: t.space.xs,
        paddingHorizontal: t.space.sm,
      }}
    >
      {label} ⇅
    </Text>
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton + small helpers                                                   */
/* -------------------------------------------------------------------------- */

function EpisodeListSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.md, paddingVertical: t.space.sm }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.md,
            minHeight: t.layout.rowMinHeight,
          }}
        >
          <View style={{ flex: 1, gap: t.space.xs }}>
            <Skeleton width="70%" height={t.typography.fontSize.headline} />
            <Skeleton width="35%" height={t.typography.fontSize.caption} />
          </View>
          <Skeleton width={28} height={28} radius="pill" />
        </View>
      ))}
    </View>
  );
}

function Separator() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.color.border }} />;
}

/** Stable key — episodeNo when present, else a synthetic index-free fallback. */
function keyExtractor(item: EpisodeSummary, index: number): string {
  return typeof item.episodeNo === 'number'
    ? `ep-${item.episodeNo}`
    : `ep-idx-${index}`;
}

/** Map a thrown query error to an ErrorState code (age gate / not found). */
function errorCode(error: unknown): ApiErrorCode {
  if (isAppError(error)) {
    if (error.code === 'ADULT_ONLY') return 'ADULT_ONLY';
    if (error.code === 'ENTITY_NOT_FOUND') return 'ENTITY_NOT_FOUND';
    if (error.code === 'FORBIDDEN') return 'FORBIDDEN';
    if (error.isNetwork) return 'NETWORK';
  }
  return 'UNKNOWN';
}
