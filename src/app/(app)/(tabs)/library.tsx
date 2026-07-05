/**
 * 서재 (Library) — tab root. 2계층 IA (improvement §3, L1):
 *   1차: 창작물 | 커뮤니티 (분류 우선순위 1)
 *   2차(창작물): 관심(SUBSCRIPTION) / 열람(READ-HISTORY) / 팔로우(FOLLOWING — 작가 축)
 *   2차(커뮤니티): 내 글/내 댓글/추천 — L2에서 배선(지금은 안내 EmptyState)
 * 회차 단위 북마크는 모델 밖. "구독" 단어는 쓰지 않는다. 친구(상호팔로우)는 탭3 소관.
 *
 * Frame: <Screen surface="ambient" header={{ variant:'ambient', back:false, title:'서재' }}>
 * — a tab ROOT, so no back button (ScreenLayout convention). The segmented control
 * is fixed above each tab's own infinite list (FlatList owns the scroll).
 */
import { useCallback, useState, type ReactElement } from 'react';
import { FlatList, View } from 'react-native';

import type { ReadHistoryResponse, SubscriptionResponse } from '@/api/types';
import { FollowRow } from '@/features/library/components/FollowRow';
import { LibraryRow } from '@/features/library/components/LibraryRow';
import { useMyFollowing, useReadHistory, useSubscriptions } from '@/features/library/hooks';
import { isAppError } from '@/lib/errors';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { flattenInfinite, useInfiniteQuery } from '@/lib/query';
import { EmptyState, ErrorState, Screen, Skeleton, Text, useTheme } from '@/ui';

type LibraryGroup = 'creation' | 'community';
type CreationTab = 'interest' | 'history' | 'follow';

export default function LibraryScreen() {
  const [group, setGroup] = useState<LibraryGroup>('creation');
  const [creationTab, setCreationTab] = useState<CreationTab>('interest');
  return (
    <Screen surface="ambient" header={{ variant: 'ambient', back: false, title: '서재' }}>
      <View style={{ flex: 1 }}>
        {/* 1차: 창작물 | 커뮤니티 — 그룹 전환 시 2차 세그는 그룹별 상태를 유지한다. */}
        <SegTabs<LibraryGroup>
          items={[
            ['creation', '창작물'],
            ['community', '커뮤니티'],
          ]}
          value={group}
          onChange={setGroup}
        />
        {group === 'creation' ? (
          <>
            <SegTabs<CreationTab>
              items={[
                ['interest', '관심'],
                ['history', '열람'],
                ['follow', '팔로우'],
              ]}
              value={creationTab}
              onChange={setCreationTab}
            />
            {/* Only the active tab's query runs; React Query keeps caches warm
                across switches (the inactive list unmounts but its data persists). */}
            {creationTab === 'interest' ? (
              <InterestList />
            ) : creationTab === 'history' ? (
              <HistoryList />
            ) : (
              <FollowList />
            )}
          </>
        ) : (
          // 커뮤니티 그룹 — L2(내 글/내 댓글/추천)에서 배선. 죽은 세그를 미리 만들지 않는다.
          <EmptyState
            title="커뮤니티 활동 기록이 곧 여기 모여요"
            description="내가 쓴 글, 댓글, 추천한 글을 한곳에서 볼 수 있게 준비하고 있어요."
          />
        )}
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  Segmented control — 1차(그룹)·2차(그룹 내 탭)가 같은 문법을 공유(제네릭).      */
/* -------------------------------------------------------------------------- */

function SegTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
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
/*  팔로우 (following) list — 비페이지 List(무한스크롤 없음).                     */
/* -------------------------------------------------------------------------- */

function FollowList() {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const q = useMyFollowing();

  if (q.isLoading) return <LibraryListSkeleton />;
  if (q.isError) {
    return (
      <ErrorState
        code={isAppError(q.error) ? (q.error.code === 'ENTITY_NOT_FOUND' ? 'ENTITY_NOT_FOUND' : 'UNKNOWN') : 'UNKNOWN'}
        message={isAppError(q.error) ? q.error.message : undefined}
        onRetry={() => void q.refetch()}
      />
    );
  }
  const users = q.data ?? [];
  if (users.length === 0) {
    return (
      <EmptyState
        title="아직 팔로우한 작가가 없어요"
        description="마음에 드는 작가를 팔로우하면 여기에 모여요."
      />
    );
  }
  return (
    <FlatList
      data={users}
      keyExtractor={(u) => String(u.userId)}
      contentContainerStyle={{ paddingTop: t.space.xs, paddingBottom: t.space.xl }}
      showsVerticalScrollIndicator={false}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
      renderItem={({ item }) => (
        <FollowRow
          user={item}
          // CH1(공개 프로필) 도착 전까지는 기존 작가 작품 그리드로 진입(§5 크로스컷).
          onPress={() =>
            nav.push({
              pathname: '/authors/[id]',
              params: { id: item.userId!, nickname: item.nickname ?? '' },
            })
          }
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
