/**
 * 내 문의 상세 (M2) — 내용 + 답변(ANSWERED만). 항상 소유자 본인 문의라
 * (/api/me/inquiries/{id}) 소유자 분기 없이 삭제 액션을 노출한다.
 */
import { Alert, Platform, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { INQUIRY_TYPE_LABEL } from '@/features/inquiry/categories';
import { useDeleteInquiry, useMyInquiry } from '@/features/inquiry/hooks';
import { relativeTime } from '@/features/comments';
import { useGuardedNavigation } from '@/lib/navigation/useGuardedNavigation';
import {
  ErrorState,
  GlassCard,
  HeaderIconButton,
  Screen,
  Skeleton,
  Text,
  useTheme,
  useToast,
} from '@/ui';
import { AppImage } from '@/ui/AppImage';

const STATUS_LABEL = { PENDING: '접수', ANSWERED: '답변 완료', CLOSED: '종료' } as const;

export default function InquiryDetailScreen() {
  const t = useTheme();
  const toast = useToast();
  const nav = useGuardedNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const inquiryId = Number(id);

  const inquiry = useMyInquiry(inquiryId);
  const deleteMut = useDeleteInquiry();

  const confirmDelete = () => {
    if (deleteMut.isPending) return;
    const run = () =>
      deleteMut.mutate(inquiryId, {
        onSuccess: () => {
          toast.show({ message: '문의를 삭제했어요.' });
          nav.back();
        },
        onError: () => toast.show({ tone: 'danger', message: '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.' }),
      });
    if (Platform.OS === 'web') {
      if (window.confirm('이 문의를 삭제할까요? 되돌릴 수 없어요.')) run();
      return;
    }
    Alert.alert('문의 삭제', '이 문의를 삭제할까요? 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: run },
    ]);
  };

  const header = {
    variant: 'ambient' as const,
    back: true,
    title: '문의 상세',
    right: (
      <HeaderIconButton
        name="trash"
        fallback="🗑"
        accessibilityLabel="문의 삭제"
        onPress={confirmDelete}
      />
    ),
  };

  if (inquiry.isLoading) {
    return (
      <Screen surface="ambient" header={header}>
        <View style={{ gap: t.space.md, paddingVertical: t.space.md }}>
          <Skeleton width="40%" height={14} />
          <Skeleton width="90%" height={22} />
          <Skeleton width="100%" height={100} radius="lg" />
        </View>
      </Screen>
    );
  }
  if (inquiry.isError || !inquiry.data) {
    return (
      <Screen surface="ambient" header={header}>
        <ErrorState
          code="ENTITY_NOT_FOUND"
          message="문의가 삭제됐거나 볼 수 없는 상태예요."
          onRetry={() => void inquiry.refetch()}
        />
      </Screen>
    );
  }

  const q = inquiry.data;
  const answered = q.status === 'ANSWERED';

  return (
    <Screen scroll surface="ambient" header={header}>
      <View style={{ gap: t.space.lg, paddingVertical: t.space.md }}>
        <View style={{ gap: t.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
            <Text variant="caption" color="onSurfaceMuted">
              {q.type ? INQUIRY_TYPE_LABEL[q.type] : ''}
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
                {q.status ? STATUS_LABEL[q.status] : ''}
              </Text>
            </View>
            <Text variant="caption" color="onSurfaceMuted">
              {relativeTime(q.createdAt)}
            </Text>
          </View>
          <Text variant="title" weight="bold">
            {q.title ?? ''}
          </Text>
          <Text variant="body" color="onSurfaceSecondary" style={{ marginTop: t.space.xs }}>
            {q.content ?? ''}
          </Text>
        </View>

        {(q.images ?? []).map((im) => {
          const w = im.width ?? 1;
          const h = im.height ?? 1;
          return (
            <AppImage
              key={`${im.sortOrder}-${im.url}`}
              url={im.url}
              recyclingKey={im.url ?? undefined}
              style={{
                width: '100%',
                aspectRatio: w > 0 && h > 0 ? w / h : 1,
                borderRadius: t.radius.lg,
              }}
            />
          );
        })}

        {q.answer ? (
          <GlassCard radius="lg">
            <View style={{ padding: t.space.lg, gap: t.space.xs }}>
              <Text variant="label" weight="semibold" color="accent">
                답변
              </Text>
              <Text variant="body" color="onSurfaceSecondary">
                {q.answer}
              </Text>
            </View>
          </GlassCard>
        ) : (
          <Text variant="caption" color="onSurfaceMuted">
            아직 답변 전이에요. 확인 후 알려드릴게요.
          </Text>
        )}
      </View>
    </Screen>
  );
}
