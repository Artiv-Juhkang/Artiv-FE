/**
 * 서재 (Library) — tab root. Two segments matching the confirmed reader model:
 *   - 관심  = SUBSCRIPTION list (작품 단위 관심, /api/me/subscriptions). UP + 이어보기.
 *   - 열람  = READ-HISTORY (자동 기록, /api/me/read-history). 마지막 본 화.
 * 회차 단위 북마크는 모델 밖이라 서재에 두지 않는다. "구독" 단어도 쓰지 않는다.
 *
 * Frame: <Screen header={{ variant:'solid', back:false, title:'서재' }}> — a tab
 * ROOT, so no back button (ScreenLayout convention). The segmented control is
 * fixed above each tab's own infinite list (FlatList owns the scroll).
 */
import { useCallback, useState, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';

import type { ReadHistoryResponse, SubscriptionResponse } from '@/api/types';
import { LibraryRow } from '@/features/library/components/LibraryRow';
import { useReadHistory, useSubscriptions } from '@/features/library/hooks';
import { isAppError } from '@/lib/errors';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { flattenInfinite, useInfiniteQuery } from '@/lib/query';
import { EmptyState, ErrorState, Screen, Skeleton, Text, useTheme } from '@/ui';

type LibraryTab = 'interest' | 'history';

export default function LibraryScreen() {
  const [tab, setTab] = useState<LibraryTab>('interest');
  return (
    <Screen header={{ variant: 'solid', back: false, title: '서재' }}>
      <View style={{ flex: 1 }}>
        <SegTabs value={tab} onChange={setTab} />
        {/* Only the active tab's query runs; React Query keeps both caches warm
            across switches (the inactive list unmounts but its data persists). */}
        {tab === 'interest' ? <InterestList /> : <HistoryList />}
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  Segmented control (관심 / 열람)                                            */
/* -------------------------------------------------------------------------- */

function SegTabs({ value, onChange }: { value: LibraryTab; onChange: (v: LibraryTab) => void }) {
  const t = useTheme();
  const items: readonly [LibraryTab, string][] = [
    ['interest', '관심'],
    ['history', '열람'],
  ];
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', gap: t.space.sm, paddingVertical: t.space.sm }}
    >
      {items.map(([key, label]) => {
        const on = value === key;
        return (
          <Text
            key={key}
            variant="label"
            weight={on ? 'bold' : 'medium'}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{
              color: on ? t.color.accent : t.color.onSurfaceSecondary,
              backgroundColor: on ? t.color.accentSubtle : 'transparent',
              paddingVertical: t.space.xs,
              paddingHorizontal: t.space.md,
              borderRadius: t.radius.pill,
              overflow: 'hidden',
            }}
          >
            {label}
          </Text>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  관심 (subscriptions) list                                                  */
/* -------------------------------------------------------------------------- */

function InterestList() {
  const nav = useGuardedNavigation();
  const q = useInfiniteQuery(useSubscriptions());
  // codegen widens seriesId to optional; server always sends it on list items.
  const items = flattenInfinite<SubscriptionResponse>(q.data, (s) => s.seriesId!);

  return (
    <LibraryListBody
      items={items}
      isLoading={q.isLoading}
      isError={q.isError}
      error={q.error}
      onRetry={() => void q.refetch()}
      isRefetching={q.isRefetching}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }}
      keyOf={(s) => String(s.seriesId)}
      emptyTitle="아직 관심 작품이 없어요"
      emptyDescription="작품 상세에서 ♥ 관심을 누르면 여기에 모여요."
      renderItem={(s) => {
        const last = s.lastReadEpisodeNo;
        const latest = s.latestEpisodeNo;
        const meta =
          s.up && typeof latest === 'number'
            ? `새 회차 ${latest}화`
            : typeof last === 'number'
              ? `${last}화까지 봤어요`
              : typeof latest === 'number'
                ? `${latest}화`
                : '';
        return (
          <LibraryRow
            title={s.title ?? '제목 없음'}
            meta={meta}
            up={s.up ?? false}
            onPress={() => nav.push({ pathname: '/series/[id]', params: { id: s.seriesId! } })}
          />
        );
      }}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  열람 (read-history) list                                                   */
/* -------------------------------------------------------------------------- */

function HistoryList() {
  const nav = useGuardedNavigation();
  const q = useInfiniteQuery(useReadHistory());
  const items = flattenInfinite<ReadHistoryResponse>(q.data, (h) => h.seriesId!);

  return (
    <LibraryListBody
      items={items}
      isLoading={q.isLoading}
      isError={q.isError}
      error={q.error}
      onRetry={() => void q.refetch()}
      isRefetching={q.isRefetching}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
      }}
      keyOf={(h) => String(h.seriesId)}
      emptyTitle="아직 열람한 작품이 없어요"
      emptyDescription="작품을 보면 마지막으로 본 화가 여기에 자동으로 기록돼요."
      renderItem={(h) => (
        <LibraryRow
          title={h.seriesTitle ?? '제목 없음'}
          meta={typeof h.lastReadEpisodeNo === 'number' ? `마지막으로 본 ${h.lastReadEpisodeNo}화` : ''}
          onPress={() => nav.push({ pathname: '/series/[id]', params: { id: h.seriesId! } })}
        />
      )}
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared list body (loading / error / empty / infinite list)                */
/* -------------------------------------------------------------------------- */

type LibraryListBodyProps<T> = {
  items: T[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isRefetching: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  emptyTitle: string;
  emptyDescription: string;
};

function LibraryListBody<T>({
  items,
  isLoading,
  isError,
  error,
  onRetry,
  isRefetching,
  hasNextPage,
  isFetchingNextPage,
  onEndReached,
  keyOf,
  renderItem,
  emptyTitle,
  emptyDescription,
}: LibraryListBodyProps<T>) {
  const t = useTheme();
  const renderRow = useCallback(
    ({ item }: { item: T }) => renderItem(item),
    [renderItem],
  );

  if (isLoading) return <LibraryListSkeleton />;

  if (isError) {
    const code = isAppError(error) ? error.code : 'UNKNOWN';
    return (
      <View style={{ flex: 1 }}>
        <ErrorState
          code={code === 'ENTITY_NOT_FOUND' ? 'ENTITY_NOT_FOUND' : 'UNKNOWN'}
          message={isAppError(error) ? error.message : undefined}
          onRetry={onRetry}
        />
      </View>
    );
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={keyOf}
      renderItem={renderRow}
      contentContainerStyle={{ paddingTop: t.space.xs, paddingBottom: t.space.xl, gap: t.space.xs }}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshing={isRefetching}
      onRefresh={onRetry}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ paddingTop: t.space.sm }}>
            <Skeleton height={64} radius="md" />
          </View>
        ) : null
      }
    />
  );
}

function LibraryListSkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.md, paddingTop: t.space.sm }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: t.space.md, alignItems: 'center' }}>
          <Skeleton width={48} height={64} radius="md" />
          <View style={{ flex: 1, gap: t.space.xs }}>
            <Skeleton width="60%" height={t.typography.fontSize.headline} />
            <Skeleton width="35%" height={t.typography.fontSize.caption} />
          </View>
        </View>
      ))}
    </View>
  );
}
