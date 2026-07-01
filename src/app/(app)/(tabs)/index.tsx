/**
 * 홈 — 요일별 그리드 (WeekdayTabs + 반응형 SeriesGrid).
 * ------------------------------------------------------------------
 * 기존 vertical list(표지+제목+작가+구독 버튼 행)를 폐기하고, 콘텐츠-포워드
 * Glass Stack 홈으로 재작성한다. 두 영역:
 *
 *   1) WeekdayTabs 밴드 — 상단 고정(스티키). 월~일 7개 칩, 기본 = 오늘.
 *      `day` 상태의 유일한 소비처(= controlled value/onChange).
 *   2) SeriesGrid — 반응형 2열(phone)/3열(tablet+) 포스터 그리드, 무한 스크롤.
 *
 * 데이터: `useSeriesList({ sort:'LATEST', day })`(무한 Page OPTIONS) →
 * 소비부 `useInfiniteQuery`. day가 바뀌면 keys.series.list가 day를 키에 정규화해
 * 요일마다 별도 캐시 엔트리가 생기고, React Query가 캐시를 스왑한다(수동 refetch 없음).
 *
 * 셀: 정본 SeriesGridCard(부모-계산 width 주입, 셀 자체 push 금지 — 네비게이션은
 * 부모 onPress). UP/lock/cover는 미전달(미래 시드 — SeriesSummary DTO에 없음).
 *
 * 쉘: Screen(edges top) > FeatureErrorBoundary > Suspense(grid skeleton) >
 * HomeContent. (boundary OUTSIDE Suspense — 정본 패턴.)
 *
 * Edge cases:
 *  - 요일별 빈 결과   → EmptyState('이 요일 작품이 아직 없어요').
 *  - isError          → ErrorState(ENTITY_NOT_FOUND|UNKNOWN) + retry.
 *  - 로딩             → 포스터형 grid skeleton(SeriesGridCardSkeleton, cols 매칭).
 *  - 컬럼 변경(회전/split) → FlatList key={`grid-${cols}`} remount + columnWrapper는 cols>1만.
 *  - onEndReached     → hasNextPage && !isFetchingNextPage 가드(중복 페이지 차단).
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { getUnreadCount } from '@/api/endpoints/notifications';
import type { DayOfWeek, SeriesSummary } from '@/api/types';
import { FeatureErrorBoundary } from '@/components/feedback';
import { useSeriesList } from '@/features/series/hooks';
import { WeekdayTabs, todayDay } from '@/features/series/components/WeekdayTabs';
import { TypeChips } from '@/features/creativity/TypeChips';
import { DiscoverRails } from '@/features/creativity/DiscoverRails';
import {
  SeriesGridCard,
  SeriesGridCardSkeleton,
  seriesGridLayout,
  SERIES_GRID,
} from '@/features/series/components/SeriesGridCard';
import { isAppError } from '@/lib/errors';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { flattenInfinite, useInfiniteQuery } from '@/lib/query';
import {
  EmptyState,
  ErrorState,
  NotificationAction,
  Screen,
  SearchAction,
  useAmbient,
  useResponsive,
  useTheme,
} from '@/ui';
import { mediaColor } from '@/ui/tokens';

export default function SeriesHomeScreen() {
  const router = useRouter();

  // 창작 타입은 헤더(로고 아래 매체색 헤어라인)와 본문(타입 칩·그리드/레일)이 함께 쓰므로
  // Suspense 경계 위인 이 컴포넌트가 소유하고 본문으로 내린다. 기본 = '전체'(매체별 레일).
  const [contentType, setContentType] = useState('ALL');

  // 헤더 벨 미읽음 배지 — 폴링(가벼운 카운트). 알림함에서 읽으면 invalidate로 갱신된다.
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadCount,
  });

  // §12.3 영속 ambient — 현재 창작 타입의 매체색으로 루트 배경을 cross-fade.
  const { setAmbient } = useAmbient();
  useEffect(() => {
    setAmbient(mediaColor(contentType.toLowerCase()));
  }, [contentType, setAmbient]);

  return (
    <Screen
      edges={['top']}
      // 투명 surface → (app)/_layout의 영속 CoverWall ambient가 비쳐 보인다.
      surface="ambient"
      // 홈 ROOT 헤더: ambient(투명) 밴드 — §12.3 루트 CoverWall이 헤더 뒤로 비친다.
      // 브랜드 'Artiv'는 좌측 정렬(ambient 기본), 액션은 우측, 하단 헤어라인으로 본문과 구분.
      // 헤더가 top inset을 소유 → body topPad=0, WeekdayTabs가 헤더 바로 아래 flush.
      header={{
        variant: 'ambient',
        back: false,
        title: 'Artiv',
        // §12.2 로고 아래 매체색 헤어라인 — 지금 보고 있는 창작 타입을 신호(웹툰=amber…).
        mediaColor: mediaColor(contentType.toLowerCase()),
        right: (
          <View style={{ flexDirection: 'row' }}>
            <SearchAction onPress={() => router.push('/search')} />
            <NotificationAction
              onPress={() => router.push('/notifications')}
              unreadCount={unread?.count}
            />
          </View>
        ),
      }}
    >
      <View style={{ flex: 1 }}>
        <FeatureErrorBoundary>
          <Suspense fallback={<HomeGridSkeleton />}>
            <HomeContent contentType={contentType} onContentTypeChange={setContentType} />
          </Suspense>
        </FeatureErrorBoundary>
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  HomeContent — 타입 칩 + (전체=매체별 레일 | 단일 타입=그리드) 분기.          */
/* -------------------------------------------------------------------------- */

function HomeContent({
  contentType,
  onContentTypeChange,
}: {
  contentType: string;
  onContentTypeChange: (key: string) => void;
}) {
  // '전체'(ALL)이면 매체별 레일 미리보기, 아니면 해당 타입 단일 그리드.
  // 그리드 훅(useSeriesList — 'ALL'은 백엔드 ContentType이 아님)이 ALL에서 돌지 않도록
  // 그리드 로직을 TypeGridView로 분리해 ALL일 땐 아예 마운트하지 않는다.
  const isAll = contentType === 'ALL';

  return (
    <View style={{ flex: 1 }}>
      {/* 타입 칩 — '전체' + 레지스트리 매체. 활성 칩은 매체색. */}
      <TypeChips value={contentType} onChange={onContentTypeChange} />

      {isAll ? (
        <DiscoverRails onSeeAll={onContentTypeChange} />
      ) : (
        <TypeGridView contentType={contentType} />
      )}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  TypeGridView — 단일 매체 타입 그리드(웹툰만 요일축). owns the `day` state.   */
/* -------------------------------------------------------------------------- */

function TypeGridView({ contentType }: { contentType: string }) {
  const t = useTheme();
  const r = useResponsive();
  const nav = useGuardedNavigation();

  // 비웹툰 타입은 요일축이 없으므로 WeekdayTabs를 숨기고 최신 그리드만 보인다.
  const isWebtoon = contentType === 'WEBTOON';

  // 유일한 day 출처(use-weekday-axis 금지). 시드 = 오늘(Mon-first).
  const [day, setDay] = useState<DayOfWeek>(() => todayDay());

  // 컬럼 정책: 2(phone) / 3(tablet+). cellWidth는 Screen gutter를 뺀 콘텐츠 폭에서 도출.
  const cols = r.select({ phone: 2, tablet: 3, large: 3 }) ?? 2;
  // Screen 기본 padding='lg' → 좌우 gutter = t.space.lg. r.width는 측정된 윈도 폭.
  const gutter = t.space.lg;
  const contentWidth = r.width - gutter * 2;
  const { cellWidth } = seriesGridLayout(contentWidth, cols);

  // useSeriesList는 무한쿼리 OPTIONS만 빌드(훅 자체 호출 X — react-compiler 안전);
  // 소비부에서 useInfiniteQuery 실행해 호출부가 무조건적으로 유지된다.
  const query = useInfiniteQuery(
    useSeriesList({ sort: 'LATEST', day: isWebtoon ? day : undefined, contentType }),
  );
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = query;

  // 페이지 경계 꼬리 중복을 series id로 de-dupe.
  // codegen은 id를 optional로 표기하지만 서버는 목록 항목에 항상 id를 포함한다.
  const series = flattenInfinite<SeriesSummary>(data, (s) => s.id!);

  const onEndReached = useCallback(() => {
    // 가드: 페이지가 비행 중이면 추가 페치 금지.
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: SeriesSummary }) => (
      <SeriesGridCard
        series={item}
        width={cellWidth}
        coverUrl={item.coverUrl}
        onPress={() =>
          // 셀은 자체 push 안 함 — 네비게이션은 부모가 주입(typedRoutes 객체 형태 필수).
          nav.push({ pathname: '/series/[id]', params: { id: item.id! } })
        }
      />
    ),
    [cellWidth, nav],
  );

  return (
    <>
      {/* WeekdayTabs 밴드 — 웹툰일 때만(연재 요일축). FlatList 바깥(스티키). */}
      {isWebtoon ? <WeekdayTabs value={day} onChange={setDay} /> : null}

      <HomeGridBody
        cols={cols}
        cellWidth={cellWidth}
        series={series}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => void refetch()}
        isRefetching={isRefetching}
        isFetchingNextPage={isFetchingNextPage}
        onEndReached={onEndReached}
        renderItem={renderItem}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  HomeGridBody — the state-machine body (loading / error / empty / grid).    */
/* -------------------------------------------------------------------------- */

type HomeGridBodyProps = {
  cols: number;
  cellWidth: number;
  series: SeriesSummary[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  onEndReached: () => void;
  renderItem: (info: { item: SeriesSummary }) => React.ReactElement;
};

function HomeGridBody({
  cols,
  cellWidth,
  series,
  isLoading,
  isError,
  error,
  onRetry,
  isRefetching,
  isFetchingNextPage,
  onEndReached,
  renderItem,
}: HomeGridBodyProps) {
  const t = useTheme();

  if (isLoading) return <HomeGridSkeleton cols={cols} cellWidth={cellWidth} />;

  if (isError) {
    // 쿼리 레이어가 normalizeError로 AppError를 던진다. 코드를 ErrorState의
    // 알려진 집합으로 매핑; 그 외 치명 코드는 위 FeatureErrorBoundary가 처리.
    const code = isAppError(error) ? error.code : 'UNKNOWN';
    return (
      <ErrorState
        code={code === 'ENTITY_NOT_FOUND' ? 'ENTITY_NOT_FOUND' : 'UNKNOWN'}
        message={isAppError(error) ? error.message : undefined}
        onRetry={onRetry}
      />
    );
  }

  if (series.length === 0) {
    return (
      <EmptyState
        title="아직 작품이 없어요"
        description="새로운 작품이 올라오면 여기에서 만나보세요."
      />
    );
  }

  return (
    <FlatList
      // 컬럼 변경(회전/split-view)에서 numColumns 변경은 remount가 필요하다.
      key={`grid-${cols}`}
      data={series}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      numColumns={cols}
      // numColumns===1이면 columnWrapperStyle에서 RN throw → cols>1일 때만.
      columnWrapperStyle={cols > 1 ? { gap: SERIES_GRID.gap } : undefined}
      contentContainerStyle={{
        paddingTop: t.space.sm,
        paddingBottom: t.space.xl,
        gap: SERIES_GRID.gap,
      }}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshing={isRefetching}
      onRefresh={onRetry}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View style={{ flexDirection: 'row', gap: SERIES_GRID.gap, paddingTop: SERIES_GRID.gap }}>
            {Array.from({ length: cols }).map((_, i) => (
              <SeriesGridCardSkeleton key={i} width={cellWidth} />
            ))}
          </View>
        ) : null
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/*  Skeleton — poster-shaped grid loading state (cols-matched footprint).      */
/* -------------------------------------------------------------------------- */

function HomeGridSkeleton({
  cols = 2,
  cellWidth,
}: {
  cols?: number;
  cellWidth?: number;
}) {
  const t = useTheme();
  const r = useResponsive();

  // Suspense fallback에서는 cols/cellWidth가 안 넘어올 수 있으므로 자체 도출.
  const resolvedCols = cols ?? (r.select({ phone: 2, tablet: 3, large: 3 }) ?? 2);
  const gutter = t.space.lg;
  const width =
    cellWidth ?? seriesGridLayout(r.width - gutter * 2, resolvedCols).cellWidth;

  // 두 줄 분량의 포스터 플레이스홀더로 로드 시 reflow를 방지.
  const rows = 3;
  return (
    <View style={{ flex: 1, paddingTop: t.space.lg }}>
      <View style={{ gap: SERIES_GRID.gap }}>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', gap: SERIES_GRID.gap }}>
            {Array.from({ length: resolvedCols }).map((_, colIndex) => (
              <SeriesGridCardSkeleton key={colIndex} width={width} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
