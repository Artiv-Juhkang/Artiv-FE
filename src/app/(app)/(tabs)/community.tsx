/**
 * 커뮤니티 탭 — 게시글 피드 (C1).
 *
 * [카테고리 칩(전체+4종)] + [정렬 세그(최신/베스트)] + 무한스크롤 피드.
 * 행 탭 → /posts/[id] 상세. 글 작성·소유자 분기·신고·비추천은 후속 슬라이스(C3~C6).
 * 프레임은 R0 ambient(투명 헤더+영속 오로라) 유지 — 라우트 형태도 그대로라 탭 구조 무변경.
 */
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import type { PostCategory, PostSort } from '@/api/types';
import { POST_CATEGORIES, POST_CATEGORY_LABEL } from '@/features/community/categories';
import { PostCard } from '@/features/community/components/PostCard';
import { usePostsInfinite } from '@/features/community/hooks';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { flattenInfinite, useInfiniteQuery } from '@/lib/query';
import { EmptyState, ErrorState, Screen, Skeleton, Text, useTheme } from '@/ui';

type CategoryFilter = PostCategory | 'ALL';

export default function CommunityScreen() {
  const [category, setCategory] = useState<CategoryFilter>('ALL');
  const [sort, setSort] = useState<PostSort>('LATEST');

  return (
    <Screen surface="ambient" header={{ variant: 'ambient', back: false, title: '커뮤니티' }}>
      <View style={{ flex: 1 }}>
        <CategoryChips value={category} onChange={setCategory} />
        <SortSeg value={sort} onChange={setSort} />
        <Feed category={category === 'ALL' ? undefined : category} sort={sort} />
      </View>
    </Screen>
  );
}

/* -------------------------------------------------------------------------- */
/*  카테고리 칩 (전체 + 4종) — TypeChips 문법(가로 스크롤·flexGrow/Shrink 0 고정). */
/* -------------------------------------------------------------------------- */

function CategoryChips({
  value,
  onChange,
}: {
  value: CategoryFilter;
  onChange: (v: CategoryFilter) => void;
}) {
  const t = useTheme();
  const chips: { key: CategoryFilter; label: string }[] = [
    { key: 'ALL', label: '전체' },
    ...POST_CATEGORIES.map((c) => ({ key: c as CategoryFilter, label: POST_CATEGORY_LABEL[c] })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // TypeChips와 동일: RN ScrollView 기본 flexGrow/Shrink:1이 칩 밴드를 부풀리거나
      // 라벨 받침을 잘라먹지 않도록 둘 다 0으로 고정한다.
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        gap: t.space.sm,
        paddingHorizontal: t.space.lg,
        paddingVertical: t.space.sm,
        alignItems: 'center',
      }}
    >
      {chips.map((c) => {
        const active = c.key === value;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingHorizontal: t.space.md,
              paddingVertical: t.space.sm,
              borderRadius: t.radius.pill,
              borderWidth: 1,
              borderColor: active ? t.color.accent : t.color.border,
              backgroundColor: active ? t.color.accentSubtle : t.color.surface,
            }}
          >
            <Text
              variant="caption"
              weight={active ? 'bold' : 'medium'}
              style={{
                color: active ? t.color.accent : t.color.onSurfaceSecondary,
                lineHeight: 18,
              }}
            >
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------- */
/*  정렬 세그 (최신 / 베스트) — 서재 SegTabs 문법.                                */
/* -------------------------------------------------------------------------- */

function SortSeg({ value, onChange }: { value: PostSort; onChange: (v: PostSort) => void }) {
  const t = useTheme();
  const items: readonly [PostSort, string][] = [
    ['LATEST', '최신'],
    ['BEST', '베스트'],
  ];
  return (
    <View style={{ flexDirection: 'row', gap: t.space.sm, paddingHorizontal: t.space.lg, paddingBottom: t.space.sm }}>
      {items.map(([key, label]) => {
        const active = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              paddingHorizontal: t.space.md,
              paddingVertical: t.space.xs,
              borderRadius: t.radius.pill,
              backgroundColor: active ? t.color.accentSubtle : 'transparent',
            }}
          >
            <Text
              variant="caption"
              weight={active ? 'bold' : 'medium'}
              style={{ color: active ? t.color.accent : t.color.onSurfaceMuted, lineHeight: 18 }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/*  피드 목록 — Page 무한쿼리.                                                   */
/* -------------------------------------------------------------------------- */

function Feed({ category, sort }: { category?: PostCategory; sort: PostSort }) {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const q = useInfiniteQuery(usePostsInfinite({ category, sort }));
  const posts = flattenInfinite(q.data, (p) => p.id ?? -1);

  if (q.isLoading) {
    return (
      <View style={{ gap: t.space.md, padding: t.space.lg }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={96} radius="lg" />
        ))}
      </View>
    );
  }
  if (q.isError) {
    return <ErrorState code="UNKNOWN" onRetry={() => void q.refetch()} />;
  }
  if (posts.length === 0) {
    return (
      <EmptyState
        title="아직 글이 없어요"
        description="감상과 잡담, 팬아트까지 — 첫 이야기를 기다리고 있어요."
      />
    );
  }
  return (
    <FlatList
      style={{ flex: 1 }}
      data={posts}
      keyExtractor={(p) => String(p.id)}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: t.space.lg,
        paddingBottom: t.space.xl,
        gap: t.space.md,
      }}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onPress={() => nav.push({ pathname: '/posts/[id]', params: { id: item.id! } })}
        />
      )}
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
      }}
      ListFooterComponent={
        q.isFetchingNextPage ? (
          <View style={{ paddingVertical: t.space.md, alignItems: 'center' }}>
            <Text variant="caption" color="onSurfaceMuted">
              더 불러오는 중…
            </Text>
          </View>
        ) : null
      }
    />
  );
}
