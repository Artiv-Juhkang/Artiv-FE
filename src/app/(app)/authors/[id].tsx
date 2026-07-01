/**
 * 작가 작품 모아보기 — 특정 작가의 공개 작품을 포스터 그리드로 보여준다.
 * ------------------------------------------------------------------
 * 창작물 상세(SeriesHero)에서 작가 이름을 누르면 authorId + nickname 파라미터로 진입한다.
 * 데이터는 GET /api/authors/{authorId}/series(공개 작품만). 카드를 누르면 그 작품 상세로.
 *
 * 제목은 넘어온 nickname 을 우선 쓰되, 없으면(딥링크 등) 첫 결과의 authorNickname 으로 보정한다.
 */
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { getAuthorSeries } from '@/api/endpoints/series';
import { keys } from '@/lib/query';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  isRecentlyUpdated,
  SERIES_GRID,
  SeriesGridCard,
  seriesGridLayout,
} from '@/features/series/components/SeriesGridCard';
import {
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  Text,
  useResponsive,
  useTheme,
} from '@/ui';

export default function AuthorSeriesScreen() {
  const t = useTheme();
  const r = useResponsive();
  const nav = useGuardedNavigation();
  const { id, nickname } = useLocalSearchParams<{ id: string; nickname?: string }>();
  const authorId = Number(id);

  const q = useQuery({
    queryKey: keys.authors.series(authorId),
    queryFn: () => getAuthorSeries(authorId),
    enabled: Number.isFinite(authorId) && authorId > 0,
  });

  const authorName = nickname || q.data?.[0]?.authorNickname || '작가';
  const series = q.data ?? [];

  // 2열 그리드 셀 폭(Screen gutter 안쪽 콘텐츠 폭 기준).
  const gutter = t.space.lg;
  const { cellWidth } = seriesGridLayout(r.width - gutter * 2, 2);

  return (
    <Screen scroll header={{ back: true, title: `${authorName}님의 작품` }}>
      {q.isLoading ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SERIES_GRID.gap }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} width={cellWidth} height={Math.round(cellWidth / (2 / 3))} radius="lg" />
          ))}
        </View>
      ) : q.isError ? (
        <ErrorState code="UNKNOWN" onRetry={() => q.refetch()} />
      ) : series.length === 0 ? (
        <EmptyState
          title="아직 공개된 작품이 없어요"
          description="이 작가가 작품을 공개하면 여기에 모여요."
        />
      ) : (
        <>
          <Text variant="caption" color="onSurfaceSecondary" style={{ marginBottom: t.space.sm }}>
            공개 작품 {series.length}편
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SERIES_GRID.gap }}>
            {series.map((s) => (
              <SeriesGridCard
                key={s.id}
                series={s}
                width={cellWidth}
                coverUrl={s.coverUrl}
                isUp={isRecentlyUpdated(s.lastPublishedAt)}
                onPress={() => nav.push({ pathname: '/series/[id]', params: { id: String(s.id) } })}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}
