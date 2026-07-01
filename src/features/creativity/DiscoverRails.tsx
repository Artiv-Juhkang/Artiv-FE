/**
 * DiscoverRails — the '전체' 디스커버 미리보기.
 *
 * 매체 타입별 가로 레일(섹션)을 쌓아, 한 화면에서 웹툰·일러스트·사진… 을 두루 미리 본다.
 * 각 레일 헤더의 '전체보기 ›' 또는 상단 타입 칩을 누르면 그 타입 단일 그리드로 들어간다
 * (onSeeAll → 부모의 setContentType). 데이터는 useDiscoverRails(타입별 page-0 병렬).
 *
 * 매체색(mediaColor)으로 섹션 도트를 칠해 칩·헤어라인과 같은 색 언어를 유지한다.
 * 작품이 없는 매체 레일은 렌더하지 않는다(빈 줄 방지).
 */
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import type { SeriesSummary } from '@/api/types';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { EmptyState, Text, useTheme } from '@/ui';
import {
  SeriesGridCard,
  SeriesGridCardSkeleton,
  SERIES_GRID,
  isRecentlyUpdated,
} from '@/features/series/components/SeriesGridCard';
import { mediaColor } from '@/ui/tokens';

import { useDiscoverRails, type DiscoverRail } from './hooks';

/** 레일 포스터 카드 폭(phone). ~2.5장이 비쳐 스크롤을 유도. */
const RAIL_CARD_WIDTH = 132;

export type DiscoverRailsProps = {
  /** 타입 칩/전체보기에서 단일 그리드로 전환. */
  onSeeAll: (typeKey: string) => void;
};

export function DiscoverRails({ onSeeAll }: DiscoverRailsProps) {
  const t = useTheme();
  const rails = useDiscoverRails();

  const ready = rails.filter((r) => r.series.length > 0);
  const anyLoading = rails.some((r) => r.isLoading);

  if (ready.length === 0) {
    // 아직 한 줄도 못 채웠으면: 로딩 중이면 스켈레톤, 아니면 빈 상태.
    if (anyLoading || rails.length === 0) return <RailsSkeleton />;
    return (
      <EmptyState
        title="아직 작품이 없어요"
        description="새로운 작품이 올라오면 여기에서 만나보세요."
      />
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: t.space.sm, paddingBottom: t.space.xl }}
    >
      {ready.map((rail) => (
        <RailSection key={rail.type.key} rail={rail} onSeeAll={onSeeAll} />
      ))}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */

function RailSection({
  rail,
  onSeeAll,
}: {
  rail: DiscoverRail;
  onSeeAll: (typeKey: string) => void;
}) {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const mc = mediaColor(rail.type.key.toLowerCase());

  return (
    <View style={{ marginTop: t.space.lg }}>
      {/* 섹션 헤더 — 매체 도트 + 라벨 + 전체보기. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: t.space.lg,
          marginBottom: t.space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: mc }} />
          <Text variant="headline" weight="bold">
            {rail.type.label}
          </Text>
        </View>
        <Pressable
          onPress={() => onSeeAll(rail.type.key)}
          accessibilityRole="button"
          accessibilityLabel={`${rail.type.label} 전체보기`}
          hitSlop={8}
        >
          <Text variant="caption" color="onSurfaceSecondary">
            전체보기 ›
          </Text>
        </Pressable>
      </View>

      {/* 가로 레일 — 포스터 카드. */}
      <FlatList
        horizontal
        data={rail.series}
        keyExtractor={(item) => String(item.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: t.space.lg, gap: SERIES_GRID.gap }}
        renderItem={({ item }: { item: SeriesSummary }) => (
          <SeriesGridCard
            series={item}
            width={RAIL_CARD_WIDTH}
            coverUrl={item.coverUrl}
            isUp={isRecentlyUpdated(item.lastPublishedAt)}
            onPress={() => nav.push({ pathname: '/series/[id]', params: { id: item.id! } })}
          />
        )}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */

/** 레일 로딩 — 두 줄의 포스터 플레이스홀더(레이아웃 reflow 방지). */
function RailsSkeleton() {
  const t = useTheme();
  return (
    <View style={{ paddingTop: t.space.lg }}>
      {[0, 1].map((row) => (
        <View key={row} style={{ marginBottom: t.space.lg }}>
          <View
            style={{
              width: 96,
              height: t.typography.fontSize.headline,
              borderRadius: t.radius.sm,
              backgroundColor: t.color.surfaceSunken,
              marginLeft: t.space.lg,
              marginBottom: t.space.sm,
            }}
          />
          <View style={{ flexDirection: 'row', gap: SERIES_GRID.gap, paddingLeft: t.space.lg }}>
            {[0, 1, 2].map((c) => (
              <SeriesGridCardSkeleton key={c} width={RAIL_CARD_WIDTH} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
