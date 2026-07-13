/**
 * 내 문의 목록 (M2) — 고객센터 허브. my 탭 '고객센터' 섹션에서 진입.
 * 상태(PENDING/ANSWERED/CLOSED)를 조용한 pill로, 최신순 무한스크롤.
 */
import { FlatList, Pressable, View } from 'react-native';

import type { InquiryResponse } from '@/api/types';
import { INQUIRY_TYPE_LABEL } from '@/features/inquiry/categories';
import { useMyInquiries } from '@/features/inquiry/hooks';
import { relativeTime } from '@/features/comments';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import { flattenInfinite, useInfiniteQuery } from '@/lib/query';
import {
  Button,
  EmptyState,
  ErrorState,
  HeaderIconButton,
  Screen,
  Skeleton,
  Text,
  useTheme,
} from '@/ui';

const STATUS_LABEL = { PENDING: '접수', ANSWERED: '답변 완료', CLOSED: '종료' } as const;

export default function InquiriesScreen() {
  const t = useTheme();
  const nav = useGuardedNavigation();
  const q = useInfiniteQuery(useMyInquiries());
  const items = flattenInfinite<InquiryResponse>(q.data, (i) => i.id ?? -1);

  return (
    <Screen
      surface="ambient"
      header={{
        variant: 'ambient',
        back: true,
        title: '문의 내역',
        right: (
          <HeaderIconButton
            name="plus"
            fallback="＋"
            accessibilityLabel="문의하기"
            onPress={() => nav.push({ pathname: '/inquiries/new' })}
          />
        ),
      }}
    >
      {q.isLoading ? (
        <InquirySkeleton />
      ) : q.isError ? (
        <ErrorState code="UNKNOWN" onRetry={() => void q.refetch()} />
      ) : items.length === 0 ? (
        <View style={{ flex: 1, gap: t.space.lg }}>
          <EmptyState title="문의 내역이 없어요" description="궁금한 점이나 불편한 점을 알려주세요." />
          <Button label="문의하기" onPress={() => nav.push({ pathname: '/inquiries/new' })} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: t.space.xl, gap: t.space.xs }}
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <InquiryRow
              inquiry={item}
              onPress={() => nav.push({ pathname: '/inquiries/[id]', params: { id: item.id! } })}
            />
          )}
        />
      )}
    </Screen>
  );
}

function InquiryRow({ inquiry, onPress }: { inquiry: InquiryResponse; onPress: () => void }) {
  const t = useTheme();
  const answered = inquiry.status === 'ANSWERED';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={inquiry.title ?? '문의'}
      style={{ paddingVertical: t.space.sm, gap: 4 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        <Text variant="micro" color="onSurfaceMuted">
          {inquiry.type ? INQUIRY_TYPE_LABEL[inquiry.type] : ''}
        </Text>
        <View
          style={{
            paddingHorizontal: t.space.sm,
            paddingVertical: 2,
            borderRadius: t.radius.pill,
            backgroundColor: answered ? t.color.accentSubtle : t.color.surfaceSunken,
          }}
        >
          <Text variant="micro" weight="semibold" color={answered ? 'accent' : 'onSurfaceMuted'}>
            {inquiry.status ? STATUS_LABEL[inquiry.status] : ''}
          </Text>
        </View>
        <Text variant="micro" color="onSurfaceMuted">
          {relativeTime(inquiry.createdAt)}
        </Text>
      </View>
      <Text variant="headline" weight="semibold" numberOfLines={1}>
        {inquiry.title ?? ''}
      </Text>
    </Pressable>
  );
}

function InquirySkeleton() {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.lg, paddingTop: t.space.sm }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={{ gap: t.space.xs }}>
          <Skeleton width="30%" height={14} />
          <Skeleton width="70%" height={18} />
        </View>
      ))}
    </View>
  );
}
