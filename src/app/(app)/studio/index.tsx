/**
 * 작가 스튜디오 — 내 작품 목록 + 새 작품 진입.
 *
 * CREATOR 전용(useRequireRole). 각 작품 행에서 회차 업로드로 이동하고, 커버 이미지를
 * 바로 교체할 수 있다. 데이터는 GET /api/series/mine(keys.series.mine).
 */
import { Redirect, useRouter, type Href } from 'expo-router';
import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getMySeries, uploadCover } from '@/api/endpoints/series';
import type { SeriesSummary } from '@/api/types';
import { useContentTypes } from '@/features/creativity/hooks';
import { useRequireRole } from '@/features/auth';
import { pickCover } from '@/features/studio/pickers';
import { keys } from '@/lib/query';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Screen,
  Skeleton,
  Text,
  useTheme,
  useToast,
} from '@/ui';

export default function StudioIndexScreen() {
  const { allowed, loading } = useRequireRole('CREATOR');

  if (loading) {
    return (
      <Screen header={{ variant: 'solid', back: true, title: '작가 스튜디오' }}>
        <View style={{ paddingVertical: 24, gap: 12 }}>
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
        </View>
      </Screen>
    );
  }
  // 작가가 아니면 작가 전환 신청으로 유도(스튜디오는 CREATOR만).
  if (!allowed) return <Redirect href={'/creator-request' as Href} />;

  return <StudioList />;
}

function StudioList() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { show } = useToast();
  const { data: types } = useContentTypes();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: keys.series.mine(),
    queryFn: getMySeries,
  });

  const typeLabel = (key?: string) => types?.find((c) => c.key === key)?.label ?? key ?? '';

  const onCover = async (seriesId: number) => {
    try {
      const file = await pickCover();
      if (!file) return;
      await uploadCover(seriesId, file);
      await qc.invalidateQueries({ queryKey: keys.series.mine() });
      await qc.invalidateQueries({ queryKey: keys.series.detail(seriesId) });
      show({ message: '커버 이미지가 설정됐어요.', tone: 'success' });
    } catch {
      show({ message: '커버 변경에 실패했어요. 다시 시도해 주세요.', tone: 'danger' });
    }
  };

  return (
    <Screen scroll header={{ variant: 'solid', back: true, title: '작가 스튜디오' }}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.lg }}>
        <Button label="+ 새 작품 만들기" fullWidth onPress={() => router.push('/studio/new' as Href)} />

        {isLoading ? (
          <View style={{ gap: t.space.md }}>
            <Skeleton height={72} radius="lg" />
            <Skeleton height={72} radius="lg" />
          </View>
        ) : isError ? (
          <ErrorState code="UNKNOWN" onRetry={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="아직 작품이 없어요"
            description="위 버튼으로 첫 작품을 만들어 회차를 올려보세요."
          />
        ) : (
          data.map((s: SeriesSummary) => (
            <Card key={s.id} padding="lg">
              <View style={{ gap: t.space.md }}>
                <View style={{ gap: 2 }}>
                  <Text variant="headline" weight="semibold" numberOfLines={1}>
                    {s.title}
                  </Text>
                  <Text variant="caption" color="onSurfaceMuted">
                    {typeLabel(s.contentType)}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: t.space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="회차 올리기"
                      fullWidth
                      onPress={() =>
                        router.push({
                          pathname: '/studio/[id]/upload',
                          params: { id: s.id! },
                        } as unknown as Href)
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button label="커버 변경" variant="secondary" fullWidth onPress={() => void onCover(s.id!)} />
                  </View>
                </View>
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
